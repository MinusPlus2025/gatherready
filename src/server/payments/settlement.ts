/* ==========================================================================
   Settlement — the only code that moves money.

   Safety decisions (this is the part of the product that can charge someone):
   - `lockBatch` runs one `BEGIN IMMEDIATE` transaction that re-reads the offer
     and every payment, applies the whole rule set, and persists an immutable
     payment-id snapshot. A second call returns the same batch; it can never
     lock a second one for the same offer (DB unique index backs this too).
   - Only AUTHORIZED payments with a live authorization (<48h), matching
     amount/currency and the exact published offer hash are included. An
     approved order without an authorization does not count, and a withdrawn
     preference is never captured.
   - Every capture/void/refund gets a persisted `operations` row with a stable
     idempotency key *before* the provider call. A crash leaves a trace that
     recovery can query; retries reuse the key so PayPal returns the original
     resource instead of creating a second charge.
   - Unknown provider outcomes are never success. The flow reconciles (query
     first) and, when it still cannot know, stops in MANUAL_REVIEW.
   - All-or-nothing: one failed capture compensates the whole batch (void the
     uncaptured authorizations, refund captured money). There is no partial
     "success" state.
   - `CONFIRMED` is set only after every capture has been queried and reported
     COMPLETED and the count still meets the offer minimum.
   ========================================================================== */
import type { AuditEvent, IsoUtc, Offer, OperationAction, OperationRecord, Payment, PaymentStatus, SettlementBatch, } from '../../shared/types.js';
import type { Repo } from '../repo.js';
import { newId, sha256Hex } from '../repo.js';
import { PaypalError, isUnknownPaypalOutcome, type CaptureSnapshot, type Paypal } from './paypal.js';
export interface SettlementDeps {
    repo: Repo;
    paypal: Paypal;
    now(): string;
}
/** A second call must never start a different collection. */
const MAX_OPERATION_ATTEMPTS = 3;
const MAX_AUTHORIZATION_AGE_HOURS = 48;
const SETTLEMENT_ACTOR = 'settlement-engine';
/* -------------------------------- helpers -------------------------------- */
function hoursBetween(fromUtc: string, toUtc: string): number {
    return (new Date(toUtc).getTime() - new Date(fromUtc).getTime()) / 3600000;
}
function providerErrorText(err: unknown): string {
    if (err instanceof PaypalError) {
        return `${err.info.name}${err.info.status ? ` (status ${err.info.status})` : ''}: ${err.info.message}`;
    }
    return 'unexpected provider error';
}
/** Persisted operation audit payloads never contain emails, tokens, or bodies. */
async function audit(deps: SettlementDeps, input: {
    tenantId: string;
    workshopId: string | null;
    type: string;
    subjectId: string | null;
    payload: Record<string, unknown>;
    actorRef?: string;
}): Promise<void> {
    const event: AuditEvent = {
        id: newId('aud'),
        tenantId: input.tenantId,
        actorKind: 'SYSTEM',
        actorRef: input.actorRef ?? SETTLEMENT_ACTOR,
        workshopId: input.workshopId,
        type: input.type,
        subjectId: input.subjectId,
        payload: input.payload,
        createdAt: deps.now(),
    };
    (await deps.repo.insertAudit(event));
}
/**
 * Stable idempotency keys. They are persisted with the operation row before the
 * provider call, so a retry (or a crash recovery) reuses the same
 * PayPal-Request-Id and can never create a second resource.
 */
export function captureOperationKey(batchId: string, paymentId: string): string {
    return `${batchId}:CAPTURE:${paymentId}`;
}
export function voidOperationKey(scopeId: string, paymentId: string): string {
    return `${scopeId}:VOID:${paymentId}`;
}
export function refundOperationKey(batchId: string, paymentId: string): string {
    return `${batchId}:REFUND:${paymentId}`;
}
/* ------------------------------- lockBatch -------------------------------- */
class LockRejected extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
        super(message);
        this.name = 'LockRejected';
        this.code = code;
    }
}
export type LockBatchResult = {
    ok: true;
    batch: SettlementBatch;
} | {
    ok: false;
    code: string;
    message: string;
};
/**
 * Freeze the collection: validate every safety rule, then persist the batch and
 * its immutable payment-id list in one immediate transaction.
 */
export async function lockBatch(deps: SettlementDeps, workshopId: string): Promise<LockBatchResult> {
    const { repo } = deps;
    const workshop = (await repo.getWorkshop(workshopId));
    if (!workshop)
        return { ok: false, code: 'WORKSHOP_NOT_FOUND', message: 'workshop not found' };
    const currentOffer = (await repo.getOpenOffer(workshopId)) ?? (await repo.getLatestOffer(workshopId));
    if (!currentOffer)
        return { ok: false, code: 'NO_OFFER', message: 'no published offer to settle' };
    const alreadyLocked = (await repo.getBatchByOffer(currentOffer.id));
    if (alreadyLocked)
        return { ok: true, batch: alreadyLocked }; // idempotent second call
    try {
        const batch = (await repo.tx(async () => {
            const lockedWorkshop = (await repo.getWorkshop(workshopId));
            if (!lockedWorkshop)
                throw new LockRejected('WORKSHOP_NOT_FOUND', 'workshop not found');
            const offer = (await repo.getOpenOffer(workshopId)) ?? (await repo.getLatestOffer(workshopId));
            if (!offer)
                throw new LockRejected('NO_OFFER', 'no published offer to settle');
            const existing = (await repo.getBatchByOffer(offer.id));
            if (existing)
                return existing; // a concurrent settle won the race
            if (offer.status !== 'OPEN') {
                throw new LockRejected('OFFER_NOT_OPEN', `offer is ${offer.status}; nothing to collect`);
            }
            const terms = offer.terms;
            if (!terms || terms.currency !== 'USD' || !Number.isSafeInteger(terms.priceCents) || terms.priceCents <= 0) {
                throw new LockRejected('OFFER_TERMS_INVALID', 'the published offer terms are not a valid USD amount');
            }
            const now = deps.now();
            if (now >= terms.authDeadlineUtc) {
                throw new LockRejected('DEADLINE_PASSED', 'the authorization window closed before collection started');
            }
            const allPayments = (await repo.listPaymentsByOffer(offer.id));
            // Only authorized payments count. An approved-but-never-authorized order
            // is excluded here and can never be captured (there is no authorization).
            const included = allPayments.filter((payment) => payment.status === 'AUTHORIZED');
            if (included.length === 0) {
                throw new LockRejected('NO_AUTHORIZED_PAYMENTS', 'no participant has completed a PayPal authorization');
            }
            if (included.length < terms.minParticipants) {
                throw new LockRejected('COUNT_BELOW_MINIMUM', `only ${included.length} of the required ${terms.minParticipants} authorizations exist`);
            }
            if (included.length > terms.capacity) {
                throw new LockRejected('COUNT_ABOVE_CAPACITY', `${included.length} authorizations exceed capacity ${terms.capacity}`);
            }
            for (const payment of included) {
                if (payment.offerHash !== offer.offerHash) {
                    throw new LockRejected('OFFER_HASH_MISMATCH', `payment ${payment.id} was authorized against different offer terms`);
                }
                if (payment.amountCents !== terms.priceCents) {
                    throw new LockRejected('AMOUNT_MISMATCH', `payment ${payment.id} does not match the offer price`);
                }
                if (payment.currency !== terms.currency) {
                    throw new LockRejected('CURRENCY_MISMATCH', `payment ${payment.id} does not match the offer currency`);
                }
                if (!payment.authorizationId || !payment.authorizedAt) {
                    throw new LockRejected('PAYMENT_NOT_AUTHORIZED', `payment ${payment.id} has no usable authorization`);
                }
                const ageHours = hoursBetween(payment.authorizedAt, now);
                if (!Number.isFinite(ageHours) || ageHours < 0 || ageHours >= MAX_AUTHORIZATION_AGE_HOURS) {
                    throw new LockRejected('AUTHORIZATION_STALE', `payment ${payment.id} authorization is older than 48 hours`);
                }
                const preference = (await repo.getPreferenceByParticipant(payment.participantId));
                if (preference && preference.status === 'WITHDRAWN') {
                    throw new LockRejected('PARTICIPANT_WITHDRAWN', `participant ${payment.participantId} withdrew before collection`);
                }
            }
            const batch: SettlementBatch = {
                id: newId('bat'),
                tenantId: lockedWorkshop.tenantId,
                workshopId,
                offerId: offer.id,
                offerHash: offer.offerHash,
                status: 'LOCKED',
                paymentIds: included.map((payment) => payment.id),
                expectedParticipantCount: included.length,
                expectedCents: included.length * terms.priceCents,
                capturedCents: 0,
                refundedCents: 0,
                reason: null,
                startedAt: now,
                deadlineUtc: terms.authDeadlineUtc,
                finishedAt: null,
            };
            (await repo.insertBatch(batch));
            return batch;
        }));
        if (batch.status === 'LOCKED') {
            (await audit(deps, {
                tenantId: batch.tenantId,
                workshopId,
                type: 'batch.locked',
                subjectId: batch.id,
                payload: {
                    offerId: batch.offerId,
                    offerHash: batch.offerHash,
                    paymentIds: batch.paymentIds,
                    expectedCents: batch.expectedCents,
                },
            }));
        }
        return { ok: true, batch };
    }
    catch (err) {
        if (err instanceof LockRejected)
            return { ok: false, code: err.code, message: err.message };
        throw err;
    }
}
/* ------------------------------ operations -------------------------------- */
async function ensureOperation(repo: Repo, input: {
    tenantId: string;
    batchId: string | null;
    paymentId: string;
    action: OperationAction;
    idempotencyKey: string;
    requestHash: string;
    now: IsoUtc;
}): Promise<OperationRecord> {
    const existing = (await repo.getOperationByKey(input.idempotencyKey));
    if (existing)
        return existing;
    const operation: OperationRecord = {
        id: newId('op'),
        tenantId: input.tenantId,
        batchId: input.batchId,
        paymentId: input.paymentId,
        action: input.action,
        idempotencyKey: input.idempotencyKey,
        requestHash: input.requestHash,
        status: 'PENDING',
        attempts: 0,
        providerRef: null,
        lastError: null,
        nextCheckAt: null,
        createdAt: input.now,
        updatedAt: input.now,
    };
    try {
        (await repo.insertOperation(operation));
        return operation;
    }
    catch {
        const raced = (await repo.getOperationByKey(input.idempotencyKey));
        if (raced)
            return raced;
        throw new Error(`could not persist ${input.action} operation for payment ${input.paymentId}`);
    }
}
function isSafeToRetry(operation: OperationRecord): boolean {
    return operation.attempts < MAX_OPERATION_ATTEMPTS;
}
/* ------------------------------ executeBatch ------------------------------ */
type CaptureAttempt = {
    ok: true;
} | {
    ok: false;
    error: string;
};
async function capturePayment(deps: SettlementDeps, batch: SettlementBatch, offer: Offer, payment: Payment): Promise<CaptureAttempt> {
    const { repo, paypal } = deps;
    const now = deps.now();
    const terms = offer.terms;
    const authorizationId = payment.authorizationId;
    if (!authorizationId)
        return { ok: false, error: `payment ${payment.id} has no authorization` };
    const key = captureOperationKey(batch.id, payment.id);
    let operation = (await ensureOperation(repo, {
        tenantId: batch.tenantId,
        batchId: batch.id,
        paymentId: payment.id,
        action: 'CAPTURE',
        idempotencyKey: key,
        requestHash: sha256Hex(JSON.stringify({
            authorizationId,
            amountCents: terms.priceCents,
            currency: terms.currency,
            finalCapture: true,
            invoiceId: payment.id,
            offerHash: offer.offerHash,
        })),
        now,
    }));
    const markCaptured = async (snapshot: CaptureSnapshot): Promise<CaptureAttempt> => {
        if (snapshot.status !== 'COMPLETED') {
            // Record the provider reference even for a non-completed capture: the
            // money may be pending, so compensation must refund (or hold for review)
            // rather than void and pretend nothing happened.
            (await repo.updateOperation(operation.id, {
                status: 'UNKNOWN',
                providerRef: snapshot.captureId,
                lastError: `capture status ${snapshot.status}; not completed`,
                updatedAt: now,
            }));
            (await repo.updatePayment(payment.id, {
                status: 'CAPTURING',
                captureId: snapshot.captureId,
                providerStatus: snapshot.status,
                resourceType: 'capture',
                observedAt: now,
                updatedAt: now,
            }));
            return { ok: false, error: `capture for payment ${payment.id} is ${snapshot.status}, not COMPLETED` };
        }
        if (snapshot.amountCents !== terms.priceCents || snapshot.currency !== terms.currency) {
            (await repo.updatePayment(payment.id, { status: 'MANUAL_REVIEW', captureId: snapshot.captureId, updatedAt: now }));
            (await repo.updateOperation(operation.id, {
                status: 'UNKNOWN',
                providerRef: snapshot.captureId,
                lastError: 'provider captured a different amount',
                updatedAt: now,
            }));
            return { ok: false, error: `capture for payment ${payment.id} returned a different amount` };
        }
        (await repo.tx(async () => {
            (await repo.updatePayment(payment.id, {
                status: 'CAPTURED',
                captureId: snapshot.captureId,
                providerStatus: snapshot.status,
                resourceType: 'capture',
                observedAt: now,
                capturedAt: now,
                updatedAt: now,
            }));
            (await repo.updateOperation(operation.id, {
                status: 'SUCCEEDED',
                providerRef: snapshot.captureId,
                lastError: null,
                updatedAt: now,
            }));
        }));
        return { ok: true };
    };
    // Already recorded in the DB from an earlier attempt.
    if (payment.captureId) {
        try {
            const snapshot = await paypal.getCapture(payment.captureId);
            if (snapshot.status === 'COMPLETED')
                return (await markCaptured(snapshot));
        }
        catch {
            /* fall through: the capture is recorded but cannot be verified right now */
        }
        return { ok: false, error: `capture ${payment.captureId} exists but could not be verified as COMPLETED` };
    }
    if (operation.status === 'SUCCEEDED' && operation.providerRef) {
        try {
            const snapshot = await paypal.getCapture(operation.providerRef);
            return (await markCaptured(snapshot));
        }
        catch (err) {
            (await repo.updateOperation(operation.id, {
                status: 'UNKNOWN',
                lastError: providerErrorText(err),
                updatedAt: now,
            }));
            return { ok: false, error: `capture ${operation.providerRef} could not be verified` };
        }
    }
    if (operation.status === 'FAILED') {
        return { ok: false, error: operation.lastError ?? `capture for payment ${payment.id} previously failed` };
    }
    // Reconcile before retrying: an unknown outcome may already have moved money.
    if (operation.status === 'IN_FLIGHT' || operation.status === 'UNKNOWN' || operation.attempts > 0) {
        try {
            const auth = await paypal.getAuthorization(authorizationId);
            if (auth.status === 'VOIDED') {
                (await repo.updateOperation(operation.id, {
                    status: 'FAILED',
                    lastError: 'authorization was voided before capture',
                    updatedAt: now,
                }));
                return { ok: false, error: `authorization for payment ${payment.id} was voided before capture` };
            }
            // AUTHORIZED => money not moved yet; CAPTURED => an idempotent replay below
            // returns the original capture instead of creating a second charge.
        }
        catch (err) {
            (await repo.updateOperation(operation.id, {
                status: 'UNKNOWN',
                lastError: providerErrorText(err),
                updatedAt: now,
            }));
            return { ok: false, error: 'capture state is unknown; reconciliation required before retrying' };
        }
    }
    if (!isSafeToRetry(operation)) {
        (await repo.updateOperation(operation.id, {
            status: 'FAILED',
            lastError: `capture gave up after ${operation.attempts} attempts`,
            updatedAt: now,
        }));
        return { ok: false, error: `capture for payment ${payment.id} hit the retry limit` };
    }
    (await repo.updateOperation(operation.id, {
        status: 'IN_FLIGHT',
        attempts: operation.attempts + 1,
        lastError: null,
        updatedAt: now,
    }));
    let snapshot: CaptureSnapshot;
    try {
        snapshot = await paypal.captureAuthorization({
            authorizationId,
            amountCents: terms.priceCents,
            currency: terms.currency,
            finalCapture: true,
            invoiceId: payment.id,
        }, key);
    }
    catch (err) {
        if (isUnknownPaypalOutcome(err)) {
            (await repo.updateOperation(operation.id, {
                status: 'UNKNOWN',
                lastError: providerErrorText(err),
                updatedAt: now,
            }));
            // Query once; if the provider says the authorization is still merely
            // authorized, nothing was captured and the next recovery pass may retry.
            try {
                const auth = await paypal.getAuthorization(authorizationId);
                if (auth.status === 'CAPTURED') {
                    // The capture exists; an idempotent replay with the same request id
                    // returns the original capture rather than charging again.
                    try {
                        const replay = await paypal.captureAuthorization({
                            authorizationId,
                            amountCents: terms.priceCents,
                            currency: terms.currency,
                            finalCapture: true,
                            invoiceId: payment.id,
                        }, key);
                        return (await markCaptured(replay));
                    }
                    catch (replayErr) {
                        (await repo.updateOperation(operation.id, {
                            status: 'UNKNOWN',
                            lastError: providerErrorText(replayErr),
                            updatedAt: now,
                        }));
                        return { ok: false, error: 'capture succeeded but could not be reconciled to a capture id' };
                    }
                }
                return { ok: false, error: `capture outcome unknown; authorization is ${auth.status}` };
            }
            catch {
                return { ok: false, error: 'capture outcome unknown and could not be reconciled' };
            }
        }
        // Definitive failure: no capture id was created.
        (await repo.updateOperation(operation.id, {
            status: 'FAILED',
            lastError: providerErrorText(err),
            updatedAt: now,
        }));
        return { ok: false, error: providerErrorText(err) };
    }
    return (await markCaptured(snapshot));
}
/**
 * Execute a locked batch. Serial captures, query every capture, confirm only if
 * all of them are COMPLETED and the minimum is still met; otherwise compensate.
 */
export async function executeBatch(deps: SettlementDeps, batchId: string): Promise<{
    ok: boolean;
    batch: SettlementBatch;
    error?: string;
}> {
    const { repo } = deps;
    let batch = (await repo.getBatch(batchId));
    if (!batch)
        throw new Error(`settlement batch not found: ${batchId}`);
    if (batch.status === 'CONFIRMED')
        return { ok: true, batch };
    if (batch.status === 'CANCELLED' || batch.status === 'MANUAL_REVIEW') {
        return { ok: false, batch, error: batch.reason ?? `batch is ${batch.status}` };
    }
    const offer = (await repo.getOffer(batch.offerId));
    if (!offer)
        throw new Error(`offer not found for settlement batch: ${batch.offerId}`);
    const workshop = (await repo.getWorkshop(batch.workshopId));
    if (!workshop)
        throw new Error(`workshop not found for settlement batch: ${batch.workshopId}`);
    if (batch.offerHash !== offer.offerHash) {
        return { ok: false, batch, error: 'the published offer changed after the batch was locked' };
    }
    if (offer.terms.currency !== 'USD') {
        return { ok: false, batch, error: 'only USD collections are supported' };
    }
    const terms = offer.terms;
    const resuming = batch.status === 'CAPTURING';
    let now = deps.now();
    if (!resuming) {
        if (now >= batch.deadlineUtc) {
            const compensated = await compensateBatch(deps, batchId, 'authorization deadline passed before capture');
            return { ok: false, batch: compensated.batch, error: 'authorization deadline passed before capture' };
        }
        (await repo.updateBatch(batchId, { status: 'CAPTURING', reason: null, finishedAt: null }));
        (await repo.updateWorkshopStatus(batch.workshopId, 'SETTLING', now));
        batch = (await repo.getBatch(batchId)) ?? batch;
        (await audit(deps, {
            tenantId: batch.tenantId,
            workshopId: batch.workshopId,
            type: 'batch.capturing',
            subjectId: batch.id,
            payload: { paymentIds: batch.paymentIds, expectedCents: batch.expectedCents },
        }));
    }
    // Immutable snapshot from the LOCKED batch; membership never changes.
    const paymentIds = [...batch.paymentIds];
    let failure: string | null = null;
    for (const paymentId of paymentIds) {
        const payment = (await repo.getPayment(paymentId));
        if (!payment) {
            failure = `payment ${paymentId} disappeared after the batch was locked`;
            break;
        }
        if (payment.status === 'CAPTURED')
            continue;
        if (payment.status === 'CAPTURING' && payment.captureId)
            continue; // verified at the end
        if (payment.status !== 'AUTHORIZED' || !payment.authorizationId) {
            failure = `payment ${paymentId} is ${payment.status}; the batch can no longer be captured safely`;
            break;
        }
        const preference = (await repo.getPreferenceByParticipant(payment.participantId));
        if (preference && preference.status === 'WITHDRAWN') {
            failure = `participant ${payment.participantId} withdrew before capture`;
            break;
        }
        if (!payment.authorizedAt) {
            failure = `payment ${paymentId} has no authorization time`;
            break;
        }
        const ageHours = hoursBetween(payment.authorizedAt, deps.now());
        if (!Number.isFinite(ageHours) || ageHours < 0 || ageHours >= MAX_AUTHORIZATION_AGE_HOURS) {
            failure = `payment ${paymentId} authorization is outside the 48 hour capture window`;
            break;
        }
        if (payment.amountCents !== terms.priceCents || payment.currency !== terms.currency) {
            failure = `payment ${paymentId} no longer matches the offer amount/currency`;
            break;
        }
        const attempt = await capturePayment(deps, batch, offer, payment);
        if (!attempt.ok) {
            failure = attempt.error;
            break;
        }
    }
    // Query every capture before claiming success; CONFIRMED is never optimistic.
    if (!failure) {
        const finalPayments = (await repo.listPaymentsByIds(paymentIds));
        let completed = 0;
        for (const payment of finalPayments) {
            if (!payment.captureId) {
                failure = `payment ${payment.id} has no capture id after capture`;
                break;
            }
            try {
                const snapshot = await deps.paypal.getCapture(payment.captureId);
                if (snapshot.status !== 'COMPLETED') {
                    failure = `capture for payment ${payment.id} is ${snapshot.status}, not COMPLETED`;
                    break;
                }
                if (snapshot.amountCents !== terms.priceCents) {
                    failure = `capture for payment ${payment.id} is not for the offer amount`;
                    break;
                }
                completed += 1;
            }
            catch (err) {
                failure = `capture for payment ${payment.id} could not be verified: ${providerErrorText(err)}`;
                break;
            }
        }
        if (!failure && completed < terms.minParticipants) {
            failure = `only ${completed} of the required ${terms.minParticipants} captures completed`;
        }
        if (!failure && completed > terms.capacity) {
            failure = `${completed} captures exceed the offer capacity`;
        }
    }
    if (failure) {
        const compensated = await compensateBatch(deps, batchId, failure);
        return { ok: false, batch: compensated.batch, error: failure };
    }
    now = deps.now();
    const capturedCents = paymentIds.length * terms.priceCents;
    const confirmed = (await repo.tx(async () => {
        (await repo.updateBatch(batchId, {
            status: 'CONFIRMED',
            capturedCents,
            refundedCents: 0,
            reason: null,
            finishedAt: now,
        }));
        (await repo.updateWorkshopStatus(batch.workshopId, 'CONFIRMED', now));
        return (await repo.getBatch(batchId))!;
    }));
    (await audit(deps, {
        tenantId: confirmed.tenantId,
        workshopId: confirmed.workshopId,
        type: 'batch.confirmed',
        subjectId: confirmed.id,
        payload: {
            capturedCents: confirmed.capturedCents,
            participantCount: confirmed.expectedParticipantCount,
            paymentIds: confirmed.paymentIds,
        },
    }));
    return { ok: true, batch: confirmed };
}
/* ---------------------------- compensateBatch ----------------------------- */
type CompensationOutcome = 'voided' | 'refunded' | 'manual' | 'skipped';
async function voidPayment(deps: SettlementDeps, batch: SettlementBatch, payment: Payment, scopeId: string): Promise<CompensationOutcome> {
    const { repo, paypal } = deps;
    const now = deps.now();
    const authorizationId = payment.authorizationId;
    if (!authorizationId)
        return 'skipped';
    const key = voidOperationKey(scopeId, payment.id);
    let operation = (await ensureOperation(repo, {
        tenantId: batch.tenantId,
        batchId: batch.id,
        paymentId: payment.id,
        action: 'VOID',
        idempotencyKey: key,
        requestHash: sha256Hex(JSON.stringify({ authorizationId })),
        now,
    }));
    const markVoided = async (): Promise<CompensationOutcome> => {
        (await repo.updatePayment(payment.id, {
            status: 'VOIDED',
            providerStatus: 'VOIDED',
            observedAt: now,
            updatedAt: now,
        }));
        (await repo.updateOperation(operation.id, { status: 'SUCCEEDED', providerRef: authorizationId, lastError: null, updatedAt: now }));
        return 'voided';
    };
    if (operation.status === 'SUCCEEDED' || payment.status === 'VOIDED')
        return (await markVoided());
    if (!isSafeToRetry(operation))
        return 'manual';
    (await repo.updateOperation(operation.id, { status: 'IN_FLIGHT', attempts: operation.attempts + 1, updatedAt: now }));
    try {
        const result = await paypal.voidAuthorization(authorizationId, key);
        if (result.status === 'VOIDED' || result.status === 'CAPTURED') {
            if (result.status === 'CAPTURED') {
                (await repo.updateOperation(operation.id, {
                    status: 'UNKNOWN',
                    lastError: 'authorization was captured; it cannot be voided',
                    updatedAt: now,
                }));
                return 'manual';
            }
            return (await markVoided());
        }
        (await repo.updateOperation(operation.id, {
            status: 'UNKNOWN',
            lastError: `void returned ${result.status}`,
            updatedAt: now,
        }));
    }
    catch (err) {
        if (isUnknownPaypalOutcome(err)) {
            (await repo.updateOperation(operation.id, { status: 'UNKNOWN', lastError: providerErrorText(err), updatedAt: now }));
            // Query before deciding: a void that timed out may have succeeded.
            try {
                const auth = await paypal.getAuthorization(authorizationId);
                if (auth.status === 'VOIDED')
                    return (await markVoided());
                if (auth.status === 'AUTHORIZED') {
                    (await repo.updateOperation(operation.id, { status: 'UNKNOWN', lastError: 'void outcome unknown', updatedAt: now }));
                    return 'manual';
                }
                return 'manual';
            }
            catch {
                return 'manual';
            }
        }
        (await repo.updateOperation(operation.id, { status: 'FAILED', lastError: providerErrorText(err), updatedAt: now }));
        try {
            const auth = await paypal.getAuthorization(authorizationId);
            if (auth.status === 'VOIDED')
                return (await markVoided());
            if (auth.status === 'CAPTURED')
                return 'manual';
        }
        catch {
            /* cannot tell; manual review below */
        }
        (await repo.updatePayment(payment.id, { status: 'MANUAL_REVIEW', updatedAt: now }));
        return 'manual';
    }
    // Unknown-but-possibly-voided: query once more before declaring manual.
    try {
        const auth = await paypal.getAuthorization(authorizationId);
        if (auth.status === 'VOIDED')
            return (await markVoided());
    }
    catch {
        /* ignore */
    }
    return 'manual';
}
async function refundPayment(deps: SettlementDeps, batch: SettlementBatch, payment: Payment): Promise<CompensationOutcome> {
    const { repo, paypal } = deps;
    const now = deps.now();
    const captureId = payment.captureId;
    if (!captureId)
        return 'skipped';
    if (payment.status === 'REFUNDED')
        return 'refunded';
    const key = refundOperationKey(batch.id, payment.id);
    let operation = (await ensureOperation(repo, {
        tenantId: batch.tenantId,
        batchId: batch.id,
        paymentId: payment.id,
        action: 'REFUND',
        idempotencyKey: key,
        requestHash: sha256Hex(JSON.stringify({ captureId, amountCents: payment.amountCents, currency: payment.currency })),
        now,
    }));
    const markRefunded = async (refundId: string): Promise<CompensationOutcome> => {
        (await repo.updatePayment(payment.id, {
            status: 'REFUNDED',
            refundId,
            providerStatus: 'REFUNDED',
            resourceType: 'refund',
            observedAt: now,
            updatedAt: now,
        }));
        (await repo.updateOperation(operation.id, { status: 'SUCCEEDED', providerRef: refundId, lastError: null, updatedAt: now }));
        return 'refunded';
    };
    // If a refund id is already recorded, verify it before trusting it.
    if (payment.refundId) {
        try {
            const refund = await paypal.getRefund(payment.refundId);
            if (refund.status === 'COMPLETED')
                return (await markRefunded(refund.refundId));
            (await repo.updateOperation(operation.id, { status: 'UNKNOWN', providerRef: payment.refundId, updatedAt: now }));
            return 'manual';
        }
        catch {
            /* unknown: fall through to an idempotent retry below */
        }
    }
    if (operation.status === 'SUCCEEDED' && operation.providerRef) {
        try {
            const refund = await paypal.getRefund(operation.providerRef);
            if (refund.status === 'COMPLETED')
                return (await markRefunded(refund.refundId));
        }
        catch {
            /* unknown */
        }
        return 'manual';
    }
    if (!isSafeToRetry(operation))
        return 'manual';
    (await repo.updateOperation(operation.id, { status: 'IN_FLIGHT', attempts: operation.attempts + 1, updatedAt: now }));
    try {
        const refund = await paypal.refundCapture({ captureId, amountCents: payment.amountCents, currency: payment.currency }, key);
        (await repo.updateOperation(operation.id, { status: 'IN_FLIGHT', providerRef: refund.refundId, updatedAt: now }));
        // A refund is only REFUNDED after it is queried and reported COMPLETED.
        try {
            const verified = await paypal.getRefund(refund.refundId);
            if (verified.status === 'COMPLETED')
                return (await markRefunded(refund.refundId));
            (await repo.updateOperation(operation.id, { status: 'UNKNOWN', providerRef: refund.refundId, updatedAt: now }));
            (await repo.updatePayment(payment.id, { status: 'REFUNDING', refundId: refund.refundId, providerStatus: verified.status, updatedAt: now }));
            return 'manual';
        }
        catch (err) {
            (await repo.updateOperation(operation.id, { status: 'UNKNOWN', providerRef: refund.refundId, lastError: providerErrorText(err), updatedAt: now }));
            (await repo.updatePayment(payment.id, { status: 'REFUNDING', refundId: refund.refundId, updatedAt: now }));
            return 'manual';
        }
    }
    catch (err) {
        if (isUnknownPaypalOutcome(err)) {
            // NEVER mark REFUNDED on an unknown refund outcome.
            (await repo.updateOperation(operation.id, { status: 'UNKNOWN', lastError: providerErrorText(err), updatedAt: now }));
            (await repo.updatePayment(payment.id, { status: 'REFUNDING', updatedAt: now }));
            return 'manual';
        }
        (await repo.updateOperation(operation.id, { status: 'FAILED', lastError: providerErrorText(err), updatedAt: now }));
        // A definitive failure may still mean the capture is already refunded.
        try {
            const capture = await paypal.getCapture(captureId);
            if (capture.status === 'REFUNDED' || capture.refundedCents >= payment.amountCents) {
                const existingRefund = payment.refundId ?? `refunded:${captureId}`;
                return (await markRefunded(existingRefund));
            }
        }
        catch {
            /* ignore */
        }
        (await repo.updatePayment(payment.id, { status: 'MANUAL_REVIEW', updatedAt: now }));
        return 'manual';
    }
}
/**
 * Compensate a batch: void every uncaptured authorization, refund every capture.
 * Unknown provider outcomes never become success; they end in MANUAL_REVIEW.
 */
export async function compensateBatch(deps: SettlementDeps, batchId: string, reason: string): Promise<{
    ok: boolean;
    batch: SettlementBatch;
}> {
    const { repo } = deps;
    let batch = (await repo.getBatch(batchId));
    if (!batch)
        throw new Error(`settlement batch not found: ${batchId}`);
    if (batch.status === 'CONFIRMED')
        return { ok: false, batch }; // never compensate a confirmed batch
    if (batch.status === 'CANCELLED')
        return { ok: true, batch };
    if (batch.status !== 'COMPENSATING') {
        const now = deps.now();
        (await repo.updateBatch(batchId, { status: 'COMPENSATING', reason, finishedAt: null }));
        (await repo.updateWorkshopStatus(batch.workshopId, 'COMPENSATING', now));
        batch = (await repo.getBatch(batchId)) ?? batch;
        (await audit(deps, {
            tenantId: batch.tenantId,
            workshopId: batch.workshopId,
            type: 'batch.compensating',
            subjectId: batch.id,
            payload: { reason, paymentIds: batch.paymentIds },
        }));
    }
    for (const paymentId of [...batch.paymentIds]) {
        const payment = (await repo.getPayment(paymentId));
        if (!payment)
            continue;
        if (payment.status === 'REFUNDED' || payment.status === 'VOIDED' || payment.status === 'FAILED')
            continue;
        if (payment.captureId) {
            await refundPayment(deps, batch, payment);
            continue;
        }
        if (payment.status === 'CAPTURING' || payment.status === 'UNKNOWN' || payment.status === 'MANUAL_REVIEW') {
            // Money may have moved without a recorded capture id: reconcile first.
            const captureOperation = (await repo.getOperationByKey(captureOperationKey(batch.id, payment.id)));
            const possibleCapture = payment.captureId ?? captureOperation?.providerRef ?? null;
            if (possibleCapture) {
                try {
                    const snapshot = await deps.paypal.getCapture(possibleCapture);
                    if (snapshot.status === 'COMPLETED') {
                        (await repo.updatePayment(payment.id, { captureId: possibleCapture, status: 'CAPTURED', updatedAt: deps.now() }));
                        await refundPayment(deps, batch, { ...payment, captureId: possibleCapture });
                        continue;
                    }
                }
                catch {
                    /* unknown */
                }
            }
        }
        if (payment.authorizationId && payment.status !== 'REFUNDING') {
            await voidPayment(deps, batch, payment, batch.id);
            continue;
        }
        if (!payment.authorizationId && (payment.status === 'ORDER_CREATED' || payment.status === 'APPROVED' || payment.status === 'AUTHORIZING')) {
            // No authorization exists, so no money can move.
            (await repo.updatePayment(payment.id, { status: 'FAILED', updatedAt: deps.now() }));
        }
    }
    const finalPayments = (await repo.listPaymentsByIds(batch.paymentIds));
    const capturedCents = finalPayments.reduce((sum, payment) => (payment.captureId ? sum + payment.amountCents : sum), 0);
    const refundedCents = finalPayments.reduce((sum, payment) => (payment.status === 'REFUNDED' ? sum + payment.amountCents : sum), 0);
    const unresolvedMoney = finalPayments.some((payment) => (payment.captureId && payment.status !== 'REFUNDED') ||
        payment.status === 'REFUNDING' ||
        payment.status === 'MANUAL_REVIEW' ||
        payment.status === 'UNKNOWN' ||
        payment.status === 'CAPTURING');
    const now = deps.now();
    const outcome = (await repo.tx(async () => {
        (await repo.updateBatch(batchId, {
            status: unresolvedMoney ? 'MANUAL_REVIEW' : 'CANCELLED',
            capturedCents,
            refundedCents,
            reason,
            finishedAt: now,
        }));
        (await repo.updateWorkshopStatus(batch.workshopId, unresolvedMoney ? 'MANUAL_REVIEW' : 'CANCELLED', now));
        return (await repo.getBatch(batchId))!;
    }));
    (await audit(deps, {
        tenantId: outcome.tenantId,
        workshopId: outcome.workshopId,
        type: unresolvedMoney ? 'batch.manual_review' : 'batch.cancelled',
        subjectId: outcome.id,
        payload: {
            reason,
            capturedCents,
            refundedCents,
            statuses: finalPayments.map((payment) => `${payment.id}:${payment.status}`),
        },
    }));
    return { ok: true, batch: outcome };
}
/* ----------------------------- recoverPending ----------------------------- */
export interface RecoverySummary {
    reconciled: number;
    captured: number;
    voided: number;
    refunded: number;
    manualReview: number;
}
function summariseTransition(summary: RecoverySummary, before: Map<string, PaymentStatus>, after: Payment[]): void {
    for (const payment of after) {
        const previous = before.get(payment.id);
        if (previous === payment.status)
            continue;
        summary.reconciled += 1;
        if (payment.status === 'CAPTURED')
            summary.captured += 1;
        else if (payment.status === 'VOIDED')
            summary.voided += 1;
        else if (payment.status === 'REFUNDED')
            summary.refunded += 1;
        else if (payment.status === 'MANUAL_REVIEW' || payment.status === 'UNKNOWN')
            summary.manualReview += 1;
    }
}
/**
 * Recover anything a crash or a timeout left behind. Runs on boot and from the
 * scheduler; every step is idempotent and bounded by operation attempt counts.
 */
export async function recoverPending(deps: SettlementDeps): Promise<RecoverySummary> {
    const { repo } = deps;
    const summary: RecoverySummary = { reconciled: 0, captured: 0, voided: 0, refunded: 0, manualReview: 0 };
    // Finishing captures that were in flight must be safe: PayPal replays the
    // original resource for the same PayPal-Request-Id, so no second charge.
    for (const batch of (await repo.listBatchesByStatus('CAPTURING'))) {
        const before = new Map((await repo.listPaymentsByIds(batch.paymentIds)).map((payment) => [payment.id, payment.status] as const));
        try {
            await executeBatch(deps, batch.id);
        }
        catch {
            summary.manualReview += 1;
        }
        summariseTransition(summary, before, (await repo.listPaymentsByIds(batch.paymentIds)));
    }
    // Finish compensating money that a crash interrupted.
    for (const batch of (await repo.listBatchesByStatus('COMPENSATING'))) {
        const before = new Map((await repo.listPaymentsByIds(batch.paymentIds)).map((payment) => [payment.id, payment.status] as const));
        try {
            await compensateBatch(deps, batch.id, batch.reason ?? 'recovery of an interrupted compensation');
        }
        catch {
            summary.manualReview += 1;
        }
        summariseTransition(summary, before, (await repo.listPaymentsByIds(batch.paymentIds)));
    }
    // Re-check manual review batches: if the provider later shows the refund
    // completed, record it. Unknown stays unknown — never guessed.
    for (const batch of (await repo.listBatchesByStatus('MANUAL_REVIEW'))) {
        const before = new Map((await repo.listPaymentsByIds(batch.paymentIds)).map((payment) => [payment.id, payment.status] as const));
        let stillManual = false;
        for (const payment of (await repo.listPaymentsByIds(batch.paymentIds))) {
            if (payment.status === 'REFUNDING') {
                if (payment.refundId) {
                    try {
                        const refund = await deps.paypal.getRefund(payment.refundId);
                        if (refund.status === 'COMPLETED') {
                            (await repo.updatePayment(payment.id, { status: 'REFUNDED', providerStatus: refund.status, updatedAt: deps.now() }));
                        }
                        else {
                            stillManual = true;
                        }
                    }
                    catch {
                        stillManual = true;
                    }
                }
                else if (payment.captureId) {
                    // Retry with the persisted idempotency key; bounded by attempt count.
                    const outcome = await refundPayment(deps, batch, payment);
                    if (outcome !== 'refunded')
                        stillManual = true;
                }
                else {
                    stillManual = true;
                }
            }
            else if (payment.status === 'MANUAL_REVIEW' || payment.status === 'UNKNOWN' || payment.status === 'CAPTURING') {
                if (payment.captureId) {
                    try {
                        const snapshot = await deps.paypal.getCapture(payment.captureId);
                        if (snapshot.status === 'REFUNDED') {
                            const refundId = payment.refundId ?? `refunded:${payment.captureId}`;
                            (await repo.updatePayment(payment.id, { status: 'REFUNDED', refundId, providerStatus: snapshot.status, updatedAt: deps.now() }));
                        }
                        else {
                            stillManual = true;
                        }
                    }
                    catch {
                        stillManual = true;
                    }
                }
                else {
                    stillManual = true;
                }
            }
            else if (payment.status === 'AUTHORIZED') {
                await voidPayment(deps, batch, payment, batch.id);
            }
        }
        const after = (await repo.listPaymentsByIds(batch.paymentIds));
        summariseTransition(summary, before, after);
        const resolved = after.every((payment) => payment.status === 'REFUNDED' || payment.status === 'VOIDED' || payment.status === 'FAILED');
        if (resolved && !stillManual) {
            const now = deps.now();
            (await repo.tx(async () => {
                (await repo.updateBatch(batch.id, {
                    status: 'CANCELLED',
                    reason: batch.reason ?? 'provider state reconciled',
                    finishedAt: now,
                }));
                (await repo.updateWorkshopStatus(batch.workshopId, 'CANCELLED', now));
            }));
            (await audit(deps, {
                tenantId: batch.tenantId,
                workshopId: batch.workshopId,
                type: 'batch.reconciled',
                subjectId: batch.id,
                payload: { from: 'MANUAL_REVIEW', to: 'CANCELLED' },
            }));
        }
        else {
            summary.manualReview += 1;
        }
    }
    return summary;
}
/* --------------------- shared single-payment helpers ---------------------- */
/**
 * Void one authorized payment outside a batch (used by the deadline canceller).
 * Exposed so the scheduler reuses the same idempotency/operation discipline.
 */
export async function voidAuthorizedPayment(deps: SettlementDeps, input: {
    scopeId: string;
    workshopId: string;
    tenantId: string;
    payment: Payment;
}): Promise<CompensationOutcome> {
    const batchLike: SettlementBatch = {
        id: input.scopeId,
        tenantId: input.tenantId,
        workshopId: input.workshopId,
        offerId: '',
        offerHash: '',
        status: 'CANCELLED',
        paymentIds: [input.payment.id],
        expectedParticipantCount: 0,
        expectedCents: 0,
        capturedCents: 0,
        refundedCents: 0,
        reason: null,
        startedAt: deps.now(),
        deadlineUtc: deps.now(),
        finishedAt: null,
    };
    return (await voidPayment(deps, batchLike, input.payment, input.scopeId));
}
export { LockRejected };
