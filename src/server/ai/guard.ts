/* ==========================================================================
   Prompt-injection guard shared by the AI modules.

   Participant prose is DATA. It can never become an instruction to the model,
   and nothing in this repo lets a model move money anyway: extraction and
   clarification only produce reviewable constraints and one question.

   Defence in depth:
   1. Strong "override the instructions" phrasings are detected and the text is
      NOT sent to the model at all; the caller falls back to the form path and
      says so. This means an injected sentence can never influence constraints.
   2. Our own delimiters are stripped from the text before it is embedded in a
      prompt, so the data block cannot be broken out of.
   3. Whatever a model returns is still checked by the deterministic verifier in
      src/shared/schemas.ts (allowed slot ids + verbatim quotes).
   ========================================================================== */

const INSTRUCTION_PATTERNS: RegExp[] = [
  /ignore\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|above|earlier|preceding)\s+(?:instructions?|prompts?|rules?|messages?)/i,
  /forget\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|above|earlier|preceding)\s+(?:instructions?|prompts?|rules?|messages?)/i,
  /disregard\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|above|earlier|preceding)?\s*(?:instructions?|prompts?|rules?)/i,
  /^\s*(?:system|assistant|developer)\s*:/im,
  /<\s*\/?\s*(?:participant_text|system_prompt|instructions?|prompt)\s*>/i,
  /\byou\s+are\s+now\s+(?:a|an|the)\b/i,
  /\bact\s+as\s+(?:a|an|the)\b/i,
  /\bnew\s+instructions?\b/i,
  /\b(?:system|developer)\s+prompt\b/i,
  /\b(?:reveal|print|show|repeat)\s+(?:your|the)\s+(?:system\s+)?(?:prompt|instructions?)/i,
  /\b(?:override|bypass)\s+(?:the\s+|all\s+)?(?:rules|instructions|constraints|guardrails)/i,
  /\bdo\s+not\s+follow\s+(?:the\s+)?(?:rules|instructions)/i,
  /\bmark\s+me\s+as\s+(?:paid|confirmed)\b/i,
  /\baccept\s+(?:every|all\s+the)\s+slots?\b.{0,40}\b(?:ignore|regardless|instruction)/i,
];

/** True when the text tries to instruct the reader rather than state a preference. */
export function looksLikeInstructions(text: string): boolean {
  return INSTRUCTION_PATTERNS.some((pattern) => pattern.test(text));
}

/** Collapse whitespace and normalise curly quotes for deterministic matching. */
export function normalizeMatch(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Remove characters that could break out of the data block or the JSON prompt. */
export function sanitizeForPrompt(text: string): string {
  return text
    .replace(/\u0000/g, '')
    .replace(/<\s*\/?\s*(?:participant_text|system_prompt|instructions?|prompt|system)\s*>/gi, '[removed tag]')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Clip to a length budget on a word boundary, marking the cut with an ellipsis. */
export function clipWords(text: string, max: number): string {
  const clean = collapseWhitespace(text);
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, Math.max(1, max - 1));
  const boundary = cut.lastIndexOf(' ');
  const body = (boundary > max / 2 ? cut.slice(0, boundary) : cut).trimEnd();
  return `${body}…`;
}

/** Word tokens for deterministic "does this mention X" checks. */
export function tokens(text: string): string[] {
  return normalizeMatch(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 2);
}

export function hasToken(text: string, candidates: string | string[], minLength = 3): boolean {
  const haystack = normalizeMatch(text);
  const pool = Array.isArray(candidates) ? candidates : [candidates];
  return tokens(pool.join(' '))
    .filter((token) => token.length >= minLength)
    .some((token) => haystack.includes(token));
}
