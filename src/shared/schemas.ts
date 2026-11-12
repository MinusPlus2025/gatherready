/* ==========================================================================
   GatherReady — zod contracts

   The AI output schema is the brief's §5.1 interface, with hard limits and a
   post-parse verifier that rejects any slot the workshop did not offer and any
   quote that is not a verbatim substring of the participant's own sentence.
   ========================================================================== */

import { z } from 'zod';

/* ---------------------------- AI extraction ------------------------------ */

export const MAX_SOURCE_TEXT = 600;

export const PreferenceExtractSchema = z
  .object({
    schema_version: z.literal('1'),
    source_id: z.string().min(1).max(64),
    accepted_slot_ids: z.array(z.string().min(1).max(64)).max(3),
    preferred_slot_ids: z.array(z.string().min(1).max(64)).max(3),
    conditional_slots: z
      .array(
        z
          .object({
            slot_id: z.string().min(1).max(64),
            condition: z.string().min(1).max(200),
            source_quote: z.string().min(1).max(400),
          })
          .strict(),
      )
      .max(3),
    uncertainties: z
      .array(
        z
          .object({
            field: z.enum(['time', 'date', 'timezone', 'condition', 'other']),
            question: z.string().min(1).max(200),
            source_quote: z.string().max(400),
          })
          .strict(),
      )
      .max(2),
    requires_confirmation: z.literal(true),
  })
  .strict();

export type PreferenceExtract = z.infer<typeof PreferenceExtractSchema>;

export interface ExtractVerificationContext {
  allowedSlotIds: string[];
  sourceText: string;
}

export type ExtractVerification =
  | { ok: true; value: PreferenceExtract }
  | { ok: false; errors: string[] };

function normalizeForQuote(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Deterministic verifier that runs after the schema. The model may not invent
 * slots and may not paraphrase the participant when it claims a quote. A failed
 * verification is a failed call, which triggers the bounded retry and then the
 * structured fallback.
 */
export function verifyExtract(raw: unknown, ctx: ExtractVerificationContext): ExtractVerification {
  const parsed = PreferenceExtractSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join('.') || 'root'}: ${i.message}`) };
  }
  const value = parsed.data;
  const errors: string[] = [];
  const allowed = new Set(ctx.allowedSlotIds);
  const source = normalizeForQuote(ctx.sourceText);

  for (const id of [...value.accepted_slot_ids, ...value.preferred_slot_ids]) {
    if (!allowed.has(id)) errors.push(`unknown slot id: ${id}`);
  }
  if (new Set(value.accepted_slot_ids).size !== value.accepted_slot_ids.length) {
    errors.push('accepted_slot_ids contains duplicates');
  }
  if (new Set(value.preferred_slot_ids).size !== value.preferred_slot_ids.length) {
    errors.push('preferred_slot_ids contains duplicates');
  }
  for (const c of value.conditional_slots) {
    if (!allowed.has(c.slot_id)) errors.push(`unknown conditional slot id: ${c.slot_id}`);
    if (value.accepted_slot_ids.includes(c.slot_id)) errors.push(`slot ${c.slot_id} is both accepted and conditional`);
    if (!source.includes(normalizeForQuote(c.source_quote))) {
      errors.push(`conditional quote is not verbatim: ${JSON.stringify(c.source_quote.slice(0, 80))}`);
    }
  }
  for (const u of value.uncertainties) {
    if (u.source_quote && !source.includes(normalizeForQuote(u.source_quote))) {
      errors.push(`uncertainty quote is not verbatim: ${JSON.stringify(u.source_quote.slice(0, 80))}`);
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

/* ------------------------------ API bodies ------------------------------- */

const slotId = z.string().min(1).max(64);
const sourceText = z.string().trim().min(1).max(MAX_SOURCE_TEXT);

export const CreateWorkshopRequestSchema = z
  .object({
    sample: z.boolean().optional(),
    draft: z
      .object({
        merchantName: z.string().trim().min(1).max(120),
        title: z.string().trim().min(1).max(160),
        description: z.string().trim().min(1).max(2000),
        venue: z.string().trim().min(1).max(300),
        timezone: z.string().trim().min(1).max(64),
        durationMinutes: z.number().int().min(15).max(720),
        priceCents: z.number().int().positive().max(10_000_000),
        inclusions: z.array(z.string().trim().min(1).max(160)).max(10),
        minParticipants: z.number().int().min(1).max(50),
        capacity: z.number().int().min(1).max(200),
        authDeadlineUtc: z.string().datetime(),
        slots: z
          .array(z.object({ startUtc: z.string().datetime(), endUtc: z.string().datetime() }).strict())
          .min(1)
          .max(3),
      })
      .strict()
      .optional(),
  })
  .strict();

export const ParsePreferencesRequestSchema = z
  .object({
    sourceText,
    structured: z
      .object({
        acceptedSlotIds: z.array(slotId).max(3),
        preferredSlotIds: z.array(slotId).max(3),
        conditions: z.array(z.object({ slotId, condition: z.string().trim().min(1).max(200) }).strict()).max(3),
      })
      .strict()
      .optional(),
  })
  .strict();

export const ConfirmPreferencesRequestSchema = z
  .object({
    version: z.number().int().nonnegative(),
    acceptedSlotIds: z.array(slotId).max(3),
    preferredSlotIds: z.array(slotId).max(3),
    conditions: z
      .array(
        z
          .object({
            slotId,
            condition: z.string().trim().min(1).max(200),
            sourceQuote: z.string().max(400),
          })
          .strict(),
      )
      .max(3),
    uncertainties: z
      .array(
        z
          .object({
            field: z.enum(['time', 'date', 'timezone', 'condition', 'other']),
            question: z.string().trim().min(1).max(200),
            sourceQuote: z.string().max(400),
          })
          .strict(),
      )
      .max(2),
  })
  .strict();

export const AnswerClarificationRequestSchema = z.object({ answer: z.enum(['YES', 'NO']) }).strict();

export const PublishOfferRequestSchema = z.object({ slotId }).strict();

export const StartCheckoutRequestSchema = z
  .object({ participantId: slotId.optional(), consent: z.boolean().optional() })
  .strict();

export const DemoViewRequestSchema = z.object({ participantId: slotId.nullable() }).strict();

export const WithdrawRequestSchema = z.object({}).strict();

export const SettleRequestSchema = z.object({}).strict();

/* --------------------------- participant access -------------------------- */

export const ParticipantTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'invalid participant token');

export const RevisePreferencesRequestSchema = z.object({
  baseVersion: z.number().int().min(1),
  sourceText: z.string().max(600),
  acceptedSlotIds: z.array(z.string()).max(3),
  preferredSlotIds: z.array(z.string()).max(3),
  conditions: z
    .array(z.object({ slotId: z.string(), condition: z.string().max(200), sourceQuote: z.string().max(400) }))
    .max(3),
  uncertainties: z
    .array(z.object({ field: z.string().max(40), question: z.string().max(300), sourceQuote: z.string().max(400) }))
    .max(3),
  extractionMode: z.enum(['live', 'recorded', 'structured', 'failed', 'seed']),
  extractionModel: z.string().max(120).nullable(),
});
