import { AsyncSql } from './async-sql.js';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { DB } from './db.js';
import type { AuditEvent, BatchStatus, Clarification, ClarificationStatus, Consent, Currency, IsoUtc, Offer, OfferStatus, OfferTerms, OperationRecord, OperationStatus, Participant, Payment, PaymentStatus, Preference, SettlementBatch, Slot, Workshop, WorkshopStatus, } from '../shared/types.js';
/* ==========================================================================
   Repo — the only code allowed to read/write SQLite.

   It exposes typed helpers for the application plus generic query helpers for
   the payments module (which owns its own state machine transitions). Every
   write happens inside a caller-owned transaction when safety matters.
   ========================================================================== */
export type Param = string | number | null;
export function newId(prefix: string): string {
    return `${prefix}_${randomBytes(9).toString('base64url')}`;
}
export function sha256Hex(value: string): string {
    return createHash('sha256').update(value).digest('hex');
}
export function tokenHash(token: string): string {
    return sha256Hex(`gatherready.participant:${token}`);
}
export function newParticipantToken(): string {
    return randomBytes(32).toString('base64url'); // 43 chars
}
export function constantTimeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && timingSafeEqual(ab, bb);
}
function n(value: string | number | boolean | null | undefined): string | number | null {
    if (value === undefined || value === null)
        return null;
    if (typeof value === 'boolean')
        return value ? 1 : 0;
    return value;
}
function parseJson<T>(raw: string, fallback: T): T {
    try {
        return JSON.parse(raw) as T;
    }
    catch {
        return fallback;
    }
}
type Row = Record<string, unknown>;
function str(row: Row, key: string): string {
    const v = row[key];
    return typeof v === 'string' ? v : '';
}
function maybeStr(row: Row, key: string): string | null {
    const v = row[key];
    return typeof v === 'string' ? v : null;
}
function num(row: Row, key: string): number {
    const v = row[key];
    return typeof v === 'number' ? v : Number(v ?? 0);
}
/* ------------------------------- mappers -------------------------------- */
export function mapWorkshop(row: Row): Workshop {
    return {
        id: str(row, 'id'),
        tenantId: str(row, 'tenant_id'),
        merchantName: str(row, 'merchant_name'),
        title: str(row, 'title'),
        description: str(row, 'description'),
        venue: str(row, 'venue'),
        timezone: str(row, 'timezone'),
        durationMinutes: num(row, 'duration_minutes'),
        priceCents: num(row, 'price_cents'),
        currency: str(row, 'currency') as Currency,
        inclusions: parseJson<string[]>(str(row, 'inclusions_json'), []),
        minParticipants: num(row, 'min_participants'),
        capacity: num(row, 'capacity'),
        authDeadlineUtc: str(row, 'auth_deadline_utc'),
        cancellationPolicyVersion: str(row, 'cancellation_policy_version'),
        cancellationSummary: str(row, 'cancellation_summary'),
        failureHandlingSummary: str(row, 'failure_handling_summary'),
        status: str(row, 'status') as WorkshopStatus,
        version: num(row, 'version'),
        coverImageUrl: maybeStr(row, 'cover_image_url'),
        createdAt: str(row, 'created_at'),
        updatedAt: str(row, 'updated_at'),
    };
}
export function mapSlot(row: Row): Slot {
    return {
        id: str(row, 'id'),
        workshopId: str(row, 'workshop_id'),
        ordinal: num(row, 'ordinal') as 1 | 2 | 3,
        startUtc: str(row, 'start_utc'),
        endUtc: str(row, 'end_utc'),
        displayTimezone: str(row, 'display_timezone'),
        dayLabel: str(row, 'day_label'),
        timeLabel: str(row, 'time_label'),
    };
}
export function mapParticipant(row: Row): Participant {
    return {
        id: str(row, 'id'),
        tenantId: str(row, 'tenant_id'),
        workshopId: str(row, 'workshop_id'),
        displayName: str(row, 'display_name'),
        tokenHash: str(row, 'token_hash'),
        persona: maybeStr(row, 'persona'),
        createdAt: str(row, 'created_at'),
    };
}
export function mapPreference(row: Row): Preference {
    return {
        id: str(row, 'id'),
        participantId: str(row, 'participant_id'),
        version: num(row, 'version'),
        status: str(row, 'status') as Preference['status'],
        sourceText: str(row, 'source_text'),
        acceptedSlotIds: parseJson<string[]>(str(row, 'accepted_slot_ids_json'), []),
        preferredSlotIds: parseJson<string[]>(str(row, 'preferred_slot_ids_json'), []),
        conditionalSlots: parseJson<Preference['conditionalSlots']>(str(row, 'conditional_slots_json'), []),
        uncertainties: parseJson<Preference['uncertainties']>(str(row, 'uncertainties_json'), []),
        extractionMode: str(row, 'extraction_mode') as Preference['extractionMode'],
        extractionModel: maybeStr(row, 'extraction_model'),
        confirmedAt: maybeStr(row, 'confirmed_at'),
        createdAt: str(row, 'created_at'),
        updatedAt: str(row, 'updated_at'),
    };
}
export function mapClarification(row: Row): Clarification {
    return {
        id: str(row, 'id'),
        participantId: str(row, 'participant_id'),
        workshopId: str(row, 'workshop_id'),
        fromPreferenceVersion: num(row, 'from_preference_version'),
        slotId: str(row, 'slot_id'),
        conditionText: str(row, 'condition_text'),
        sourceQuote: str(row, 'source_quote'),
        questionText: str(row, 'question_text'),
        questionSource: str(row, 'question_source') as 'ai' | 'template',
        factLabel: str(row, 'fact_label'),
        factValue: str(row, 'fact_value'),
        status: str(row, 'status') as ClarificationStatus,
        answer: (maybeStr(row, 'answer') as 'YES' | 'NO' | null) ?? null,
        sentAt: maybeStr(row, 'sent_at'),
        answeredAt: maybeStr(row, 'answered_at'),
        createdAt: str(row, 'created_at'),
    };
}
export function mapOffer(row: Row): Offer {
    return {
        id: str(row, 'id'),
        tenantId: str(row, 'tenant_id'),
        workshopId: str(row, 'workshop_id'),
        version: num(row, 'version'),
        slotId: str(row, 'slot_id'),
        terms: parseJson<OfferTerms>(str(row, 'terms_json'), {} as OfferTerms),
        offerHash: str(row, 'offer_hash'),
        status: str(row, 'status') as OfferStatus,
        confirmedByMerchantAt: str(row, 'confirmed_by_merchant_at'),
        createdAt: str(row, 'created_at'),
        closedAt: maybeStr(row, 'closed_at'),
    };
}
export function mapConsent(row: Row): Consent {
    return {
        id: str(row, 'id'),
        tenantId: str(row, 'tenant_id'),
        participantId: str(row, 'participant_id'),
        offerId: str(row, 'offer_id'),
        offerHash: str(row, 'offer_hash'),
        amountCents: num(row, 'amount_cents'),
        currency: str(row, 'currency') as Currency,
        textVersion: str(row, 'text_version'),
        acceptedAt: str(row, 'accepted_at'),
    };
}
export function mapPayment(row: Row): Payment {
    return {
        id: str(row, 'id'),
        tenantId: str(row, 'tenant_id'),
        workshopId: str(row, 'workshop_id'),
        participantId: str(row, 'participant_id'),
        offerId: str(row, 'offer_id'),
        offerHash: str(row, 'offer_hash'),
        status: str(row, 'status') as PaymentStatus,
        providerStatus: maybeStr(row, 'provider_status'),
        resourceType: maybeStr(row, 'resource_type'),
        orderId: maybeStr(row, 'order_id'),
        authorizationId: maybeStr(row, 'authorization_id'),
        captureId: maybeStr(row, 'capture_id'),
        refundId: maybeStr(row, 'refund_id'),
        approveUrl: maybeStr(row, 'approve_url'),
        amountCents: num(row, 'amount_cents'),
        currency: str(row, 'currency') as Currency,
        simulated: num(row, 'simulated') === 1,
        observedAt: maybeStr(row, 'observed_at'),
        authorizedAt: maybeStr(row, 'authorized_at'),
        capturedAt: maybeStr(row, 'captured_at'),
        createdAt: str(row, 'created_at'),
        updatedAt: str(row, 'updated_at'),
    };
}
export function mapBatch(row: Row): SettlementBatch {
    return {
        id: str(row, 'id'),
        tenantId: str(row, 'tenant_id'),
        workshopId: str(row, 'workshop_id'),
        offerId: str(row, 'offer_id'),
        offerHash: str(row, 'offer_hash'),
        status: str(row, 'status') as BatchStatus,
        paymentIds: parseJson<string[]>(str(row, 'payment_ids_json'), []),
        expectedParticipantCount: num(row, 'expected_participant_count'),
        expectedCents: num(row, 'expected_cents'),
        capturedCents: num(row, 'captured_cents'),
        refundedCents: num(row, 'refunded_cents'),
        reason: maybeStr(row, 'reason'),
        startedAt: str(row, 'started_at'),
        deadlineUtc: str(row, 'deadline_utc'),
        finishedAt: maybeStr(row, 'finished_at'),
    };
}
export function mapOperation(row: Row): OperationRecord {
    return {
        id: str(row, 'id'),
        tenantId: str(row, 'tenant_id'),
        batchId: maybeStr(row, 'batch_id'),
        paymentId: maybeStr(row, 'payment_id'),
        action: str(row, 'action') as OperationRecord['action'],
        idempotencyKey: str(row, 'idempotency_key'),
        requestHash: str(row, 'request_hash'),
        status: str(row, 'status') as OperationStatus,
        attempts: num(row, 'attempts'),
        providerRef: maybeStr(row, 'provider_ref'),
        lastError: maybeStr(row, 'last_error'),
        nextCheckAt: maybeStr(row, 'next_check_at'),
        createdAt: str(row, 'created_at'),
        updatedAt: str(row, 'updated_at'),
    };
}
export function mapAudit(row: Row): AuditEvent {
    return {
        id: str(row, 'id'),
        tenantId: str(row, 'tenant_id'),
        actorKind: str(row, 'actor_kind') as AuditEvent['actorKind'],
        actorRef: str(row, 'actor_ref'),
        workshopId: maybeStr(row, 'workshop_id'),
        type: str(row, 'type'),
        subjectId: maybeStr(row, 'subject_id'),
        payload: parseJson<Record<string, unknown>>(str(row, 'payload_json'), {}),
        createdAt: str(row, 'created_at'),
    };
}
/* --------------------------------- repo --------------------------------- */
export interface ParticipantWithToken {
    participant: Participant;
    token: string;
}
export class Repo extends AsyncSql {
    constructor(public readonly db: DB) { super(db); }
    /* --------------------------- tenants/sessions ------------------------- */
    async createTenant(synthetic: boolean, now: IsoUtc): Promise<string> {
        const id = newId('tn');
        (await this.run('INSERT INTO tenants (id, synthetic, created_at) VALUES (?, ?, ?)', id, n(synthetic), now));
        return id;
    }
    async getTenant(id: string): Promise<{
        id: string;
        synthetic: boolean;
        createdAt: string;
    } | null> {
        const row = (await this.one('SELECT * FROM tenants WHERE id = ?', id));
        if (!row)
            return null;
        return { id: str(row, 'id'), synthetic: num(row, 'synthetic') === 1, createdAt: str(row, 'created_at') };
    }
    async createSession(idHash: string, tenantId: string, now: IsoUtc): Promise<void> {
        (await this.run('INSERT INTO sessions (id_hash, tenant_id, view_participant_id, created_at, seen_at) VALUES (?, ?, NULL, ?, ?)', idHash, tenantId, now, now));
    }
    async getSession(idHash: string): Promise<{
        tenantId: string;
        viewParticipantId: string | null;
    } | null> {
        const row = (await this.one('SELECT * FROM sessions WHERE id_hash = ?', idHash));
        if (!row)
            return null;
        return { tenantId: str(row, 'tenant_id'), viewParticipantId: maybeStr(row, 'view_participant_id') };
    }
    async setSessionView(idHash: string, participantId: string | null, now: IsoUtc): Promise<void> {
        (await this.run('UPDATE sessions SET view_participant_id = ?, seen_at = ? WHERE id_hash = ?', n(participantId), now, idHash));
    }
    async touchSession(idHash: string, now: IsoUtc): Promise<void> {
        (await this.run('UPDATE sessions SET seen_at = ? WHERE id_hash = ?', now, idHash));
    }
    async bindSessionTenant(idHash: string, tenantId: string, now: IsoUtc): Promise<void> {
        (await this.run('UPDATE sessions SET tenant_id = ?, seen_at = ? WHERE id_hash = ?', tenantId, now, idHash));
    }
    /* ------------------------------ workshops ----------------------------- */
    async insertWorkshop(w: Workshop): Promise<void> {
        (await this.run(`INSERT INTO workshops (id, tenant_id, merchant_name, title, description, venue, timezone, duration_minutes,
        price_cents, currency, inclusions_json, min_participants, capacity, auth_deadline_utc,
        cancellation_policy_version, cancellation_summary, failure_handling_summary, status, version, cover_image_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, w.id, w.tenantId, w.merchantName, w.title, w.description, w.venue, w.timezone, n(w.durationMinutes), n(w.priceCents), w.currency, JSON.stringify(w.inclusions), n(w.minParticipants), n(w.capacity), w.authDeadlineUtc, w.cancellationPolicyVersion, w.cancellationSummary, w.failureHandlingSummary, w.status, n(w.version), n(w.coverImageUrl), w.createdAt, w.updatedAt));
    }
    async getWorkshop(id: string): Promise<Workshop | null> {
        const row = (await this.one('SELECT * FROM workshops WHERE id = ?', id));
        return row ? mapWorkshop(row) : null;
    }
    async getLatestWorkshop(tenantId: string): Promise<Workshop | null> {
        const row = (await this.one('SELECT * FROM workshops WHERE tenant_id = ? ORDER BY created_at DESC, id DESC LIMIT 1', tenantId));
        return row ? mapWorkshop(row) : null;
    }
    async listWorkshopsByStatus(status: WorkshopStatus): Promise<Workshop[]> {
        return (await this.all('SELECT * FROM workshops WHERE status = ? ORDER BY created_at ASC', status)).map(mapWorkshop);
    }
    async updateWorkshopStatus(id: string, status: WorkshopStatus, now: IsoUtc): Promise<void> {
        (await this.run('UPDATE workshops SET status = ?, updated_at = ? WHERE id = ?', status, now, id));
    }
    /* -------------------------------- slots ------------------------------- */
    async insertSlot(s: Slot): Promise<void> {
        (await this.run(`INSERT INTO slots (id, workshop_id, ordinal, start_utc, end_utc, display_timezone, day_label, time_label)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, s.id, s.workshopId, n(s.ordinal), s.startUtc, s.endUtc, s.displayTimezone, s.dayLabel, s.timeLabel));
    }
    async listSlots(workshopId: string): Promise<Slot[]> {
        return (await this.all('SELECT * FROM slots WHERE workshop_id = ? ORDER BY ordinal ASC', workshopId)).map(mapSlot);
    }
    async getSlot(workshopId: string, id: string): Promise<Slot | null> {
        const row = (await this.one('SELECT * FROM slots WHERE workshop_id = ? AND id = ?', workshopId, id));
        return row ? mapSlot(row) : null;
    }
    /* ----------------------------- participants --------------------------- */
    async insertParticipant(p: Participant): Promise<void> {
        (await this.run(`INSERT INTO participants (id, tenant_id, workshop_id, display_name, token_hash, persona, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, p.id, p.tenantId, p.workshopId, p.displayName, p.tokenHash, n(p.persona), p.createdAt));
    }
    async getParticipant(id: string): Promise<Participant | null> {
        const row = (await this.one('SELECT * FROM participants WHERE id = ?', id));
        return row ? mapParticipant(row) : null;
    }
    async getParticipantByTokenHash(hash: string): Promise<Participant | null> {
        const row = (await this.one('SELECT * FROM participants WHERE token_hash = ?', hash));
        return row ? mapParticipant(row) : null;
    }
    async listParticipants(workshopId: string): Promise<Participant[]> {
        return (await this.all('SELECT * FROM participants WHERE workshop_id = ? ORDER BY created_at ASC, id ASC', workshopId)).map(mapParticipant);
    }
    async countParticipants(workshopId: string): Promise<number> {
        return num((await this.one('SELECT COUNT(*) AS c FROM participants WHERE workshop_id = ?', workshopId)) ?? {}, 'c');
    }
    /* ----------------------------- preferences ---------------------------- */
    async insertPreference(p: Preference, tenantId: string, workshopId: string): Promise<void> {
        (await this.run(`INSERT INTO preferences (id, tenant_id, workshop_id, participant_id, version, status, source_text,
        accepted_slot_ids_json, preferred_slot_ids_json, conditional_slots_json, uncertainties_json,
        extraction_mode, extraction_model, confirmed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, p.id, tenantId, workshopId, p.participantId, n(p.version), p.status, p.sourceText, JSON.stringify(p.acceptedSlotIds), JSON.stringify(p.preferredSlotIds), JSON.stringify(p.conditionalSlots), JSON.stringify(p.uncertainties), p.extractionMode, n(p.extractionModel), n(p.confirmedAt), p.createdAt, p.updatedAt));
    }
    /** Workshops are derived from the participant so the table stays normalised. */
    async fillPreferenceScope(preferenceId: string, tenantId: string, workshopId: string): Promise<void> {
        (await this.run('UPDATE preferences SET tenant_id = ?, workshop_id = ? WHERE id = ?', tenantId, workshopId, preferenceId));
    }
    async updatePreference(p: Preference): Promise<void> {
        (await this.run(`UPDATE preferences SET version = ?, status = ?, source_text = ?, accepted_slot_ids_json = ?,
        preferred_slot_ids_json = ?, conditional_slots_json = ?, uncertainties_json = ?, extraction_mode = ?,
        extraction_model = ?, confirmed_at = ?, updated_at = ? WHERE participant_id = ?`, n(p.version), p.status, p.sourceText, JSON.stringify(p.acceptedSlotIds), JSON.stringify(p.preferredSlotIds), JSON.stringify(p.conditionalSlots), JSON.stringify(p.uncertainties), p.extractionMode, n(p.extractionModel), n(p.confirmedAt), p.updatedAt, p.participantId));
    }
    async getPreferenceByParticipant(participantId: string): Promise<Preference | null> {
        const row = (await this.one('SELECT * FROM preferences WHERE participant_id = ?', participantId));
        return row ? mapPreference(row) : null;
    }
    async listPreferences(workshopId: string): Promise<Preference[]> {
        return (await this.all('SELECT * FROM preferences WHERE workshop_id = ? ORDER BY created_at ASC', workshopId)).map(mapPreference);
    }
    /* ---------------------------- clarifications -------------------------- */
    async insertClarification(c: Clarification, tenantId: string): Promise<void> {
        (await this.run(`INSERT INTO clarifications (id, tenant_id, workshop_id, participant_id, slot_id, from_preference_version,
        condition_text, source_quote, question_text, question_source, fact_label, fact_value, status, answer,
        sent_at, answered_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, c.id, tenantId, c.workshopId, c.participantId, c.slotId, n(c.fromPreferenceVersion), c.conditionText, c.sourceQuote, c.questionText, c.questionSource, c.factLabel, c.factValue, c.status, n(c.answer), n(c.sentAt), n(c.answeredAt), c.createdAt));
    }
    async updateClarification(c: Clarification): Promise<void> {
        (await this.run('UPDATE clarifications SET status = ?, answer = ?, sent_at = ?, answered_at = ? WHERE id = ?', c.status, n(c.answer), n(c.sentAt), n(c.answeredAt), c.id));
    }
    async getClarification(id: string): Promise<Clarification | null> {
        const row = (await this.one('SELECT * FROM clarifications WHERE id = ?', id));
        return row ? mapClarification(row) : null;
    }
    async listClarifications(workshopId: string): Promise<Clarification[]> {
        return (await this.all('SELECT * FROM clarifications WHERE workshop_id = ? ORDER BY created_at ASC, id ASC', workshopId)).map(mapClarification);
    }
    async findUnansweredClarification(participantId: string): Promise<Clarification | null> {
        const row = (await this.one("SELECT * FROM clarifications WHERE participant_id = ? AND status IN ('PROPOSED','SENT') ORDER BY created_at DESC LIMIT 1", participantId));
        return row ? mapClarification(row) : null;
    }
    /* -------------------------------- offers ------------------------------ */
    async insertOffer(o: Offer): Promise<void> {
        (await this.run(`INSERT INTO offers (id, tenant_id, workshop_id, version, slot_id, terms_json, offer_hash, status,
        confirmed_by_merchant_at, created_at, closed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, o.id, o.tenantId, o.workshopId, n(o.version), o.slotId, JSON.stringify(o.terms), o.offerHash, o.status, o.confirmedByMerchantAt, o.createdAt, n(o.closedAt)));
    }
    async updateOfferStatus(id: string, status: OfferStatus, now: IsoUtc): Promise<void> {
        const closed = status === 'OPEN' ? null : now;
        (await this.run('UPDATE offers SET status = ?, closed_at = ? WHERE id = ?', status, n(closed), id));
    }
    async getOffer(id: string): Promise<Offer | null> {
        const row = (await this.one('SELECT * FROM offers WHERE id = ?', id));
        return row ? mapOffer(row) : null;
    }
    async getOpenOffer(workshopId: string): Promise<Offer | null> {
        const row = (await this.one("SELECT * FROM offers WHERE workshop_id = ? AND status = 'OPEN' ORDER BY version DESC LIMIT 1", workshopId));
        return row ? mapOffer(row) : null;
    }
    async getLatestOffer(workshopId: string): Promise<Offer | null> {
        const row = (await this.one('SELECT * FROM offers WHERE workshop_id = ? ORDER BY version DESC LIMIT 1', workshopId));
        return row ? mapOffer(row) : null;
    }
    async allOffers(workshopId: string): Promise<Offer[]> {
        return (await this.all('SELECT * FROM offers WHERE workshop_id = ? ORDER BY version ASC', workshopId)).map(mapOffer);
    }
    async nextOfferVersion(workshopId: string): Promise<number> {
        const row = (await this.one('SELECT MAX(version) AS v FROM offers WHERE workshop_id = ?', workshopId)) ?? {};
        return num(row, 'v') + 1;
    }
    /* -------------------------------- consents ---------------------------- */
    async insertConsent(c: Consent): Promise<void> {
        (await this.run(`INSERT INTO consents (id, tenant_id, participant_id, offer_id, offer_hash, amount_cents, currency, text_version, accepted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, c.id, c.tenantId, c.participantId, c.offerId, c.offerHash, n(c.amountCents), c.currency, c.textVersion, c.acceptedAt));
    }
    async getConsent(participantId: string, offerId: string): Promise<Consent | null> {
        const row = (await this.one('SELECT * FROM consents WHERE participant_id = ? AND offer_id = ?', participantId, offerId));
        return row ? mapConsent(row) : null;
    }
    async listConsents(offerId: string): Promise<Consent[]> {
        return (await this.all('SELECT * FROM consents WHERE offer_id = ? ORDER BY accepted_at ASC', offerId)).map(mapConsent);
    }
    /* -------------------------------- payments ---------------------------- */
    async insertPayment(p: Payment): Promise<void> {
        (await this.run(`INSERT INTO payments (id, tenant_id, workshop_id, participant_id, offer_id, offer_hash, status, provider_status,
        resource_type, order_id, authorization_id, capture_id, refund_id, approve_url, amount_cents, currency,
        simulated, observed_at, authorized_at, captured_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, p.id, p.tenantId, p.workshopId, p.participantId, p.offerId, p.offerHash, p.status, n(p.providerStatus), n(p.resourceType), n(p.orderId), n(p.authorizationId), n(p.captureId), n(p.refundId), n(p.approveUrl), n(p.amountCents), p.currency, n(p.simulated), n(p.observedAt), n(p.authorizedAt), n(p.capturedAt), p.createdAt, p.updatedAt));
    }
    async updatePayment(id: string, patch: Partial<Payment>): Promise<void> {
        const current = (await this.getPayment(id));
        if (!current)
            throw new Error(`payment not found: ${id}`);
        const next = { ...current, ...patch };
        (await this.run(`UPDATE payments SET status = ?, provider_status = ?, resource_type = ?, order_id = ?, authorization_id = ?,
        capture_id = ?, refund_id = ?, approve_url = ?, amount_cents = ?, currency = ?, simulated = ?,
        observed_at = ?, authorized_at = ?, captured_at = ?, updated_at = ? WHERE id = ?`, next.status, n(next.providerStatus), n(next.resourceType), n(next.orderId), n(next.authorizationId), n(next.captureId), n(next.refundId), n(next.approveUrl), n(next.amountCents), next.currency, n(next.simulated), n(next.observedAt), n(next.authorizedAt), n(next.capturedAt), next.updatedAt, id));
    }
    async getPayment(id: string): Promise<Payment | null> {
        const row = (await this.one('SELECT * FROM payments WHERE id = ?', id));
        return row ? mapPayment(row) : null;
    }
    async getPaymentByParticipant(participantId: string): Promise<Payment | null> {
        const row = (await this.one('SELECT * FROM payments WHERE participant_id = ? ORDER BY created_at DESC LIMIT 1', participantId));
        return row ? mapPayment(row) : null;
    }
    async getPaymentByParticipantAndOffer(participantId: string, offerId: string): Promise<Payment | null> {
        const row = (await this.one('SELECT * FROM payments WHERE participant_id = ? AND offer_id = ?', participantId, offerId));
        return row ? mapPayment(row) : null;
    }
    async getPaymentByOrderId(orderId: string): Promise<Payment | null> {
        const row = (await this.one('SELECT * FROM payments WHERE order_id = ?', orderId));
        return row ? mapPayment(row) : null;
    }
    async getPaymentByAuthorizationId(authorizationId: string): Promise<Payment | null> {
        const row = (await this.one('SELECT * FROM payments WHERE authorization_id = ?', authorizationId));
        return row ? mapPayment(row) : null;
    }
    async getPaymentByCaptureId(captureId: string): Promise<Payment | null> {
        const row = (await this.one('SELECT * FROM payments WHERE capture_id = ?', captureId));
        return row ? mapPayment(row) : null;
    }
    async listPaymentsByOffer(offerId: string): Promise<Payment[]> {
        return (await this.all('SELECT * FROM payments WHERE offer_id = ? ORDER BY created_at ASC', offerId)).map(mapPayment);
    }
    async listPaymentsByIds(ids: string[]): Promise<Payment[]> {
        if (ids.length === 0)
            return [];
        const placeholders = ids.map(() => '?').join(',');
        const rows = (await this.all(`SELECT * FROM payments WHERE id IN (${placeholders})`, ...ids));
        const byId = new Map(rows.map((row) => [str(row as Row, 'id'), mapPayment(row as Row)]));
        return ids.map((id) => byId.get(id)).filter((p): p is Payment => Boolean(p));
    }
    async listPaymentsByWorkshop(workshopId: string): Promise<Payment[]> {
        return (await this.all('SELECT * FROM payments WHERE workshop_id = ? ORDER BY created_at ASC', workshopId)).map(mapPayment);
    }
    /* ------------------------------- batches ------------------------------ */
    async insertBatch(b: SettlementBatch): Promise<void> {
        (await this.run(`INSERT INTO settlement_batches (id, tenant_id, workshop_id, offer_id, offer_hash, status, payment_ids_json,
        expected_participant_count, expected_cents, captured_cents, refunded_cents, reason, started_at, deadline_utc, finished_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, b.id, b.tenantId, b.workshopId, b.offerId, b.offerHash, b.status, JSON.stringify(b.paymentIds), n(b.expectedParticipantCount), n(b.expectedCents), n(b.capturedCents), n(b.refundedCents), n(b.reason), b.startedAt, b.deadlineUtc, n(b.finishedAt)));
    }
    async updateBatch(id: string, patch: Partial<SettlementBatch>): Promise<void> {
        const current = (await this.getBatch(id));
        if (!current)
            throw new Error(`batch not found: ${id}`);
        const next = { ...current, ...patch };
        (await this.run(`UPDATE settlement_batches SET status = ?, captured_cents = ?, refunded_cents = ?, reason = ?, finished_at = ?
       WHERE id = ?`, next.status, n(next.capturedCents), n(next.refundedCents), n(next.reason), n(next.finishedAt), id));
    }
    async getBatch(id: string): Promise<SettlementBatch | null> {
        const row = (await this.one('SELECT * FROM settlement_batches WHERE id = ?', id));
        return row ? mapBatch(row) : null;
    }
    async getBatchByOffer(offerId: string): Promise<SettlementBatch | null> {
        const row = (await this.one('SELECT * FROM settlement_batches WHERE offer_id = ?', offerId));
        return row ? mapBatch(row) : null;
    }
    async listBatchesByStatus(status: BatchStatus): Promise<SettlementBatch[]> {
        return (await this.all('SELECT * FROM settlement_batches WHERE status = ? ORDER BY started_at ASC', status)).map(mapBatch);
    }
    /* ------------------------------ operations ----------------------------- */
    async insertOperation(o: OperationRecord): Promise<void> {
        (await this.run(`INSERT INTO operations (id, tenant_id, batch_id, payment_id, action, idempotency_key, request_hash, status,
        attempts, provider_ref, last_error, next_check_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, o.id, o.tenantId, n(o.batchId), n(o.paymentId), o.action, o.idempotencyKey, o.requestHash, o.status, n(o.attempts), n(o.providerRef), n(o.lastError), n(o.nextCheckAt), o.createdAt, o.updatedAt));
    }
    async updateOperation(id: string, patch: Partial<OperationRecord>): Promise<void> {
        const current = (await this.getOperation(id));
        if (!current)
            throw new Error(`operation not found: ${id}`);
        const next = { ...current, ...patch };
        (await this.run(`UPDATE operations SET status = ?, attempts = ?, provider_ref = ?, last_error = ?, next_check_at = ?, updated_at = ?
       WHERE id = ?`, next.status, n(next.attempts), n(next.providerRef), n(next.lastError), n(next.nextCheckAt), next.updatedAt, id));
    }
    async getOperation(id: string): Promise<OperationRecord | null> {
        const row = (await this.one('SELECT * FROM operations WHERE id = ?', id));
        return row ? mapOperation(row) : null;
    }
    async getOperationByKey(idempotencyKey: string): Promise<OperationRecord | null> {
        const row = (await this.one('SELECT * FROM operations WHERE idempotency_key = ?', idempotencyKey));
        return row ? mapOperation(row) : null;
    }
    async listOperationsByBatch(batchId: string): Promise<OperationRecord[]> {
        return (await this.all('SELECT * FROM operations WHERE batch_id = ? ORDER BY created_at ASC', batchId)).map(mapOperation);
    }
    async listUnresolvedOperations(): Promise<OperationRecord[]> {
        return (await this.all("SELECT * FROM operations WHERE status IN ('IN_FLIGHT','UNKNOWN','PENDING') ORDER BY created_at ASC LIMIT 200")).map(mapOperation);
    }
    /* ------------------------------- webhooks ------------------------------ */
    async insertWebhookEvent(event: {
        eventId: string;
        verified: boolean;
        eventType: string;
        resourceType: string | null;
        resourceId: string | null;
        rawSha256: string;
        receivedAt: string;
    }): Promise<boolean> {
        const result = (await this.run(`INSERT OR IGNORE INTO webhook_events (event_id, verified, event_type, resource_type, resource_id, raw_sha256, received_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, event.eventId, n(event.verified), event.eventType, n(event.resourceType), n(event.resourceId), event.rawSha256, event.receivedAt));
        return result.changes > 0;
    }
    async markWebhookProcessed(eventId: string, outcome: string, now: IsoUtc): Promise<void> {
        (await this.run('UPDATE webhook_events SET processed_at = ?, outcome = ? WHERE event_id = ?', now, outcome, eventId));
    }
    async getWebhookEvent(eventId: string): Promise<{
        eventId: string;
        verified: boolean;
        processedAt: string | null;
    } | null> {
        const row = (await this.one('SELECT * FROM webhook_events WHERE event_id = ?', eventId));
        if (!row)
            return null;
        return {
            eventId: str(row, 'event_id'),
            verified: num(row, 'verified') === 1,
            processedAt: maybeStr(row, 'processed_at'),
        };
    }
    /* --------------------------------- audit ------------------------------- */
    async insertAudit(a: AuditEvent): Promise<void> {
        (await this.run(`INSERT INTO audit_events (id, tenant_id, actor_kind, actor_ref, workshop_id, type, subject_id, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, a.id, a.tenantId, a.actorKind, a.actorRef, n(a.workshopId), a.type, n(a.subjectId), JSON.stringify(a.payload), a.createdAt));
    }
    async listAudit(workshopId: string, limit = 60): Promise<AuditEvent[]> {
        return (await this.all('SELECT * FROM audit_events WHERE workshop_id = ? ORDER BY created_at DESC, id DESC LIMIT ?', workshopId, limit)).map(mapAudit);
    }
    /* ------------------------------- llm calls ----------------------------- */
    async recordLlmCall(tenantId: string | null, kind: string, now: IsoUtc): Promise<void> {
        (await this.run('INSERT INTO llm_calls (id, tenant_id, kind, created_at) VALUES (?, ?, ?, ?)', newId('llm'), n(tenantId), kind, now));
    }
    async countLlmCallsSince(sinceIso: string): Promise<number> {
        return num((await this.one('SELECT COUNT(*) AS c FROM llm_calls WHERE created_at >= ?', sinceIso)) ?? {}, 'c');
    }
    /* ------------------------- demo data retention ------------------------- */
    /**
     * Delete synthetic demo tenants older than the cutoff (brief §9: demo text is
     * short-lived). Never deletes a tenant whose money is still moving — those
     * need a human or the scheduler, not a garbage collector.
     * Returns the number of tenants purged.
     */
    async purgeSyntheticTenantsOlderThan(cutoffIso: string): Promise<number> {
        const tenants = (await this.all<{
            id: string;
        }>("SELECT id FROM tenants WHERE synthetic = 1 AND created_at < ? ORDER BY created_at ASC", cutoffIso));
        let purged = 0;
        for (const tenant of tenants) {
            const busy = (await this.one<{
                c: number;
            }>(`SELECT COUNT(*) AS c FROM settlement_batches
         WHERE tenant_id = ? AND status IN ('LOCKED','CAPTURING','COMPENSATING','MANUAL_REVIEW')`, tenant.id));
            if ((busy?.c ?? 0) > 0)
                continue;
            (await this.tx(async () => {
                // Child rows first (FK order), then the tenant itself.
                for (const table of [
                    'operations',
                    'payments',
                    'consents',
                    'settlement_batches',
                    'clarifications',
                    'preferences',
                    'offers',
                    'participants',
                    'audit_events',
                    'sessions',
                ]) {
                    (await this.run(`DELETE FROM ${table} WHERE tenant_id = ?`, tenant.id));
                }
                // slots are scoped by workshop, not by tenant
                (await this.run('DELETE FROM slots WHERE workshop_id IN (SELECT id FROM workshops WHERE tenant_id = ?)', tenant.id));
                (await this.run('DELETE FROM workshops WHERE tenant_id = ?', tenant.id));
                (await this.run('DELETE FROM llm_calls WHERE tenant_id = ?', tenant.id));
                (await this.run('DELETE FROM tenants WHERE id = ?', tenant.id));
            }));
            purged += 1;
        }
        return purged;
    }
}
