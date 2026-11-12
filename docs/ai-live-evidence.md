# Live-model evidence (participant preference extraction)

Captured 2026-11-12 23:35 (Asia/Shanghai) against the running app with a real local
model, not the structured fallback. This is a single reproducible run, not a
quality benchmark.

## Environment

| Fact | Value |
|---|---|
| App | `http://localhost:5180`, production build, `GATHERREADY_DB=data/gatherready.db` |
| `GET /healthz` | `{"ok":true,"paypal":"simulated","ai":"live"}` |
| Model server | Ollama `127.0.0.1:11434` |
| Model | `qwen2.5:7b-instruct` (4.7 GB, Q4 local) |
| Payment adapter | `simulated` — **no PayPal request was made** |
| Browser | headless Chrome 143, no translation extension |

## Input and result

The participant already had a confirmed version (v1, Sunday morning). They chose
**Change preference** and entered a new, independent sentence:

> "I can do Saturday morning only, starting at 10."

`POST /api/preferences/preview` returned in **1.5 s** (a previous run took 2.0 s):

- `extractionMode: "live"`, `extractionModel: "qwen2.5:7b-instruct"`
- accepted: `slot_a` — Saturday Nov 28, 10:00–12:00 (`America/Los_Angeles`)
- conditions: none
- the saved v1 preference was still `CONFIRMED` while the preview existed

The participant then confirmed. `POST /api/preferences/revise` returned `200` and
the server stored **v2 CONFIRMED** with the new sentence and accepted time.

## Effect on the candidate times

| Candidate time | Before (v1) | After (v2) | Minimum 4 |
|---|---|---|---|
| Saturday 10:00–12:00 | 3 fits | **4 fits** | reached |
| Saturday 13:00–15:00 | 2 fits | 2 fits | no |
| Sunday 10:00–12:00 | 1 fit | 0 fits | no |

The change is a deterministic recomputation from stored preferences, not a model
claim. No payment moved.

## Saved-version safety

- During preview: saved preference stayed `CONFIRMED` v1.
- Cancel + reload after a later preview: saved preference stayed `CONFIRMED` v2;
  the unsaved sentence never reached the database.
- Network trace for the run: `preview 200`, `revise 200`, `preview 200`; no
  `parse`/persisting call happened for the edit.

Evidence files:

- [`docs/audit/ai-live-evidence.json`](audit/ai-live-evidence.json) — raw JSON
- [`docs/screenshots/participant-final-edit-before-1440.png`](screenshots/participant-final-edit-before-1440.png)
- [`docs/screenshots/participant-final-preview-1440.png`](screenshots/participant-final-preview-1440.png)
- [`docs/screenshots/participant-final-saved-1440.png`](screenshots/participant-final-saved-1440.png)
- [`docs/screenshots/participant-final-saved-390.png`](screenshots/participant-final-saved-390.png)

## Reproduce

```bash
# terminal 1: local model
ollama serve
ollama pull qwen2.5:7b-instruct

# terminal 2
GATHERREADY_DB=data/gatherready.db LLM_OLLAMA=1 LLM_MODEL=qwen2.5:7b-instruct \
  LLM_TIMEOUT_MS=240000 npm start
curl -s http://localhost:5180/healthz   # ai must be "live"
node scripts/evidence-live-ai.mjs       # the script used for this capture
```

## Honest limits

- **One English sentence on one local 7B model.** It is evidence that a real model
  ran end-to-end, not that extraction is accurate in general.
- In an earlier run the same model attached a condition to Saturday morning when
  the sentence said Saturday afternoon. The review card caught it and the
  participant could correct it; model output is always editable, never money.
- The model-unavailable fallback is covered by code paths (`structured` /
  `recorded`, shown in the UI), but this capture does not kill the model to prove
  the fallback. No fallback run is claimed here.
- No PayPal sandbox authorization, capture or cancellation was made. See the
  blocked items in [`docs/participant-flow-pass.md`](participant-flow-pass.md).
