/* ==========================================================================
   Payments test harness — fixed clock, in-memory SQLite, simulated PayPal.

   No network and no real DB file: the adapter is the labelled simulated one and
   every test injects `now`. The seeded offer hash is a stable stand-in; these
   tests exercise settlement safety rules, not canonical offer hashing (that is
   covered by the domain tests).
   ========================================================================== */
import { loadConfig } from '../../src/server/config.js';
import { openDb } from '../../src/server/db.js';
import { Repo, sha256Hex } from '../../src/server/repo.js';
import { createPaypal, simWebhookSignature, type Paypal } from '../../src/server/payments/paypal.js';
import type { SettlementDeps } from '../../src/server/payments/settlement.js';
import type { AppConfig, } from '../../src/server/config.js';
import type { Currency, Offer, OfferStatus, OfferTerms, Participant, Payment, PaymentStatus, PreferenceStatus, Workshop, WorkshopStatus, } from '../../src/shared/types.js';
export const NOW = '2026-11-12T06:00:00Z';
export const DEADLINE = '2026-11-12T18:00:00Z';
export const WORKSHOP_START = '2026-11-21T18:00:00Z';
export const PRICE_CENTS = 4500;
export const OFFER_HASH = 'offer_hash_frozen_1';
export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
    const base = loadConfig();
    return {
        ...base,
        publicBaseUrl: 'http://127.0.0.1:5180',
        paypal: {
            ...base.paypal,
            environment: 'missing',
            live: false,
            forceSimulated: true,
            clientId: '',
            clientSecret: '',
            baseUrl: 'https://api-m.sandbox.paypal.com',
            webhookId: '',
        },
        ...overrides,
    };
}
export interface Harness {
    repo: Repo;
    paypal: Paypal;
    cfg: AppConfig;
    now: string;
    deps: SettlementDeps;
    setNow(iso: string): void;
    advanceMs(ms: number): void;
    close(): void;
}
export async function createHarness(options: {
    nowIso?: string;
} = {}): Promise<Harness> {
    const repo = new Repo((await openDb(':memory:')));
    const cfg = testConfig();
    const paypal = createPaypal(cfg);
    const harness: Harness = {
        repo,
        paypal,
        cfg,
        now: options.nowIso ?? NOW,
        deps: {
            repo,
            paypal,
            now: () => harness.now,
        },
        setNow(iso: string) {
            harness.now = iso;
        },
        advanceMs(ms: number) {
            harness.now = new Date(Date.parse(harness.now) + ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
        },
        close() {
            repo.db.close();
        },
    };
    return harness;
}
export interface SeedOptions {
    idPrefix?: string;
    minParticipants?: number;
    capacity?: number;
    priceCents?: number;
    currency?: Currency;
    workshopStatus?: WorkshopStatus;
    offerStatus?: OfferStatus;
    deadlineUtc?: string;
    participantCount?: number;
    paymentStatuses?: PaymentStatus[];
    authorizedAt?: string | null;
    preferenceStatuses?: Array<PreferenceStatus | null>;
    paymentOverrides?: Array<Partial<Payment>>;
    offerHash?: string;
    workshopId?: string;
}
export interface Seeded {
    workshop: Workshop;
    offer: Offer;
    participants: Participant[];
    payments: Payment[];
}
function isoMinus(nowIso: string, ms: number): string {
    return new Date(Date.parse(nowIso) - ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}
function makeTerms(workshop: Workshop, slotId: string): OfferTerms {
    return {
        schemaVersion: 1,
        workshopId: workshop.id,
        offerVersion: 1,
        merchantName: workshop.merchantName,
        workshopTitle: workshop.title,
        workshopDescription: workshop.description,
        venue: workshop.venue,
        timezone: workshop.timezone,
        slotId,
        startUtc: WORKSHOP_START,
        endUtc: new Date(Date.parse(WORKSHOP_START) + workshop.durationMinutes * 60000).toISOString().replace(/\.\d{3}Z$/, 'Z'),
        durationMinutes: workshop.durationMinutes,
        priceCents: workshop.priceCents,
        currency: workshop.currency,
        inclusions: [...workshop.inclusions],
        minParticipants: workshop.minParticipants,
        capacity: workshop.capacity,
        authDeadlineUtc: workshop.authDeadlineUtc,
        cancellationPolicyVersion: workshop.cancellationPolicyVersion,
        cancellationSummary: workshop.cancellationSummary,
        failureHandlingSummary: workshop.failureHandlingSummary,
    };
}
/**
 * Seed one tenant, workshop, published OPEN offer, participants with confirmed
 * preferences and one payment per participant.
 */
export async function seedWorkshop(harness: Harness, options: SeedOptions = {}): Promise<Seeded> {
    const { repo } = harness;
    const now = harness.now;
    const prefix = options.idPrefix ?? '';
    const workshopId = options.workshopId ?? `${prefix}ws_1`;
    const tenantId = (await repo.createTenant(true, now));
    const count = options.participantCount ?? 4;
    const priceCents = options.priceCents ?? PRICE_CENTS;
    const currency = options.currency ?? 'USD';
    const minParticipants = options.minParticipants ?? 4;
    const capacity = options.capacity ?? 6;
    const workshop: Workshop = {
        id: workshopId,
        tenantId,
        merchantName: 'Kiln & Clay Studio',
        title: 'Two-hour pottery workshop',
        description: 'Wheel throwing and glazing for beginners.',
        venue: '12 Clay Lane',
        timezone: 'America/Los_Angeles',
        durationMinutes: 120,
        priceCents,
        currency,
        inclusions: ['All materials', 'Firing', 'Apron'],
        minParticipants,
        capacity,
        authDeadlineUtc: options.deadlineUtc ?? DEADLINE,
        cancellationPolicyVersion: 'cancel-v1',
        cancellationSummary: 'Full refund if collection fails.',
        failureHandlingSummary: 'Holds released, charges refunded; nobody is charged unless all capture.',
        status: options.workshopStatus ?? 'OFFER_OPEN',
        version: 1,
        createdAt: isoMinus(now, 3600000),
        updatedAt: isoMinus(now, 3600000),
    };
    (await repo.insertWorkshop(workshop));
    const offerHash = options.offerHash ?? OFFER_HASH;
    const offer: Offer = {
        id: `${prefix}off_1`,
        tenantId,
        workshopId,
        version: 1,
        slotId: 'slot_a',
        terms: makeTerms(workshop, 'slot_a'),
        offerHash,
        status: options.offerStatus ?? 'OPEN',
        confirmedByMerchantAt: isoMinus(now, 2000000),
        createdAt: isoMinus(now, 2000000),
        closedAt: null,
    };
    (await repo.insertOffer(offer));
    const participants: Participant[] = [];
    const payments: Payment[] = [];
    for (let index = 0; index < count; index += 1) {
        const ordinal = index + 1;
        const participant: Participant = {
            id: `${prefix}part_${ordinal}`,
            tenantId,
            workshopId,
            displayName: `Person ${ordinal}`,
            tokenHash: sha256Hex(`participant-token-${ordinal}-${workshopId}`),
            persona: null,
            createdAt: isoMinus(now, 1800000 + index * 1000),
        };
        (await repo.insertParticipant(participant));
        participants.push(participant);
        const preferenceStatus = options.preferenceStatuses?.[index] ?? 'CONFIRMED';
        if (preferenceStatus !== null) {
            const preferenceId = `${prefix}pref_${ordinal}`;
            (await repo.insertPreference({
                id: preferenceId,
                participantId: participant.id,
                version: 1,
                status: preferenceStatus,
                sourceText: 'Saturday morning works for me.',
                acceptedSlotIds: ['slot_a'],
                preferredSlotIds: ['slot_a'],
                conditionalSlots: [],
                uncertainties: [],
                extractionMode: 'structured',
                extractionModel: null,
                confirmedAt: isoMinus(now, 1700000),
                createdAt: isoMinus(now, 1700000),
                updatedAt: isoMinus(now, 1700000),
            }, tenantId, workshopId));
        }
        const status = options.paymentStatuses?.[index] ?? 'AUTHORIZED';
        const hasAuthorization = status === 'AUTHORIZED' || status === 'CAPTURING' || status === 'CAPTURED' || status === 'REFUNDING' || status === 'REFUNDED' || status === 'VOIDING';
        const authorizedAt = status === 'AUTHORIZED' || status === 'CAPTURING' || status === 'CAPTURED' || status === 'REFUNDING' || status === 'REFUNDED'
            ? (options.authorizedAt ?? isoMinus(now, 3600000))
            : null;
        const payment: Payment = {
            id: `${prefix}pay_${ordinal}`,
            tenantId,
            workshopId,
            participantId: participant.id,
            offerId: offer.id,
            offerHash,
            status,
            providerStatus: status,
            resourceType: hasAuthorization ? 'authorization' : 'order',
            orderId: `${prefix}order_${ordinal}`,
            authorizationId: hasAuthorization ? `${prefix}auth_${ordinal}` : null,
            captureId: null,
            refundId: null,
            approveUrl: null,
            amountCents: priceCents,
            currency,
            simulated: true,
            observedAt: isoMinus(now, 900000),
            authorizedAt,
            capturedAt: status === 'CAPTURED' || status === 'REFUNDING' || status === 'REFUNDED' ? isoMinus(now, 300000) : null,
            createdAt: isoMinus(now, 900000 - index * 1000), // pay_1 first, for serial capture order
            updatedAt: isoMinus(now, 900000),
            ...(options.paymentOverrides?.[index] ?? {}),
        };
        (await repo.insertPayment(payment));
        payments.push(payment);
    }
    return { workshop, offer, participants, payments };
}
/* ------------------------------- webhooks -------------------------------- */
/**
 * Create the matching provider-side orders/authorizations for seeded AUTHORIZED
 * payments, then point the DB rows at the simulated provider ids. The adapter's
 * ids are keyed to the idempotency key, exactly like PayPal's Request-Id.
 */
export async function wirePaymentsToSimulator(harness: Harness, payments: Payment[]): Promise<void> {
    for (const payment of payments) {
        if (payment.status !== 'AUTHORIZED')
            continue;
        const order = await harness.paypal.createAuthorizeOrder({
            amountCents: payment.amountCents,
            currency: payment.currency,
            description: `test order ${payment.id}`,
            customId: payment.id,
            invoiceId: payment.id,
            returnUrl: `${harness.cfg.publicBaseUrl}/return`,
            cancelUrl: `${harness.cfg.publicBaseUrl}/cancel`,
        }, `create-order:${payment.id}`);
        await harness.paypal.getOrder(order.orderId); // simulated buyer approval
        const auth = await harness.paypal.authorizeOrder(order.orderId, `authorize:${payment.id}`);
        (await harness.repo.updatePayment(payment.id, {
            orderId: order.orderId,
            authorizationId: auth.authorizationId,
            providerStatus: auth.status,
            authorizedAt: harness.now,
            updatedAt: harness.now,
        }));
    }
}
/* ------------------------------- webhooks -------------------------------- */
export interface WebhookEnvelope {
    rawBody: string;
    headers: Record<string, string>;
}
export function webhookEnvelope(input: {
    eventId: string;
    eventType: string;
    resourceType: string;
    resource: Record<string, unknown>;
}): WebhookEnvelope {
    const rawBody = JSON.stringify({
        id: input.eventId,
        event_type: input.eventType,
        resource_type: input.resourceType,
        resource: input.resource,
        create_time: NOW,
    });
    return {
        rawBody,
        headers: {
            'content-type': 'application/json',
            'x-gatherready-sim-signature': simWebhookSignature(rawBody),
        },
    };
}
export function captureResource(input: {
    captureId: string;
    authorizationId: string;
    status?: string;
    amountCents?: number;
}): Record<string, unknown> {
    const cents = input.amountCents ?? PRICE_CENTS;
    return {
        id: input.captureId,
        status: input.status ?? 'COMPLETED',
        amount: { currency_code: 'USD', value: `${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, '0')}` },
        create_time: NOW,
        supplementary_data: { related_ids: { authorization_id: input.authorizationId } },
    };
}
export function authorizationResource(input: {
    authorizationId: string;
    status?: string;
}): Record<string, unknown> {
    return {
        id: input.authorizationId,
        status: input.status ?? 'CREATED',
        amount: { currency_code: 'USD', value: '45.00' },
        create_time: NOW,
        expiration_time: '2026-12-11T18:00:00Z',
        supplementary_data: { related_ids: { order_id: 'order_1' } },
    };
}
export function refundResource(input: {
    refundId: string;
    captureId: string;
    status?: string;
}): Record<string, unknown> {
    return {
        id: input.refundId,
        status: input.status ?? 'COMPLETED',
        amount: { currency_code: 'USD', value: '45.00' },
        supplementary_data: { related_ids: { capture_id: input.captureId } },
    };
}
/** Simulated test hooks; always cleaned up by the calling test file's afterEach. */
export function setSimFail(value: string | null): void {
    if (value === null)
        delete process.env.PAYPAL_SIM_FAIL;
    else
        process.env.PAYPAL_SIM_FAIL = value;
}
export function clearSimFail(): void {
    delete process.env.PAYPAL_SIM_FAIL;
}
