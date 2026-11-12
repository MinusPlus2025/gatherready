import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

/* ==========================================================================
   Persistence: plain SQLite through node:sqlite (no native build, no ORM).

   Design decisions:
   - The server is the only writer. The UI and the model never reach the DB.
   - Every money action and every state transition is persisted before/after the
     provider call, so a crash can be reconciled by querying PayPal.
   - Unique constraints encode the safety rules (one active payment per
     participant+offer, one batch per offer, one operation per idempotency key,
     one webhook row per provider event id).
   ========================================================================== */

export type DB = DatabaseSync;

export interface OpenDbOptions {
  /** `:memory:` for tests. */
  path: string;
}

export function openDb(dbPath: string): DB {
  if (dbPath !== ':memory:') mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  migrate(db);
  return db;
}

function migrate(db: DB): void {
  db.exec(`
  CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    synthetic INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id_hash TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    view_participant_id TEXT,
    created_at TEXT NOT NULL,
    seen_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS workshops (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    merchant_name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    venue TEXT NOT NULL,
    timezone TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    price_cents INTEGER NOT NULL,
    currency TEXT NOT NULL,
    inclusions_json TEXT NOT NULL,
    min_participants INTEGER NOT NULL,
    capacity INTEGER NOT NULL,
    auth_deadline_utc TEXT NOT NULL,
    cancellation_policy_version TEXT NOT NULL,
    cancellation_summary TEXT NOT NULL,
    failure_handling_summary TEXT NOT NULL,
    status TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    cover_image_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS slots (
    id TEXT NOT NULL,
    workshop_id TEXT NOT NULL REFERENCES workshops(id),
    ordinal INTEGER NOT NULL,
    start_utc TEXT NOT NULL,
    end_utc TEXT NOT NULL,
    display_timezone TEXT NOT NULL,
    day_label TEXT NOT NULL,
    time_label TEXT NOT NULL,
    PRIMARY KEY (workshop_id, id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS slots_workshop_ordinal ON slots(workshop_id, ordinal);

  CREATE TABLE IF NOT EXISTS participants (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    workshop_id TEXT NOT NULL REFERENCES workshops(id),
    display_name TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    persona TEXT,
    created_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS participants_token_hash ON participants(token_hash);

  CREATE TABLE IF NOT EXISTS preferences (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    workshop_id TEXT NOT NULL REFERENCES workshops(id),
    participant_id TEXT NOT NULL UNIQUE REFERENCES participants(id),
    version INTEGER NOT NULL,
    status TEXT NOT NULL,
    source_text TEXT NOT NULL,
    accepted_slot_ids_json TEXT NOT NULL,
    preferred_slot_ids_json TEXT NOT NULL,
    conditional_slots_json TEXT NOT NULL,
    uncertainties_json TEXT NOT NULL,
    extraction_mode TEXT NOT NULL,
    extraction_model TEXT,
    confirmed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS clarifications (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    workshop_id TEXT NOT NULL,
    participant_id TEXT NOT NULL REFERENCES participants(id),
    slot_id TEXT NOT NULL,
    from_preference_version INTEGER NOT NULL,
    condition_text TEXT NOT NULL,
    source_quote TEXT NOT NULL,
    question_text TEXT NOT NULL,
    question_source TEXT NOT NULL,
    fact_label TEXT NOT NULL,
    fact_value TEXT NOT NULL,
    status TEXT NOT NULL,
    answer TEXT,
    sent_at TEXT,
    answered_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS clarifications_participant ON clarifications(participant_id);

  CREATE TABLE IF NOT EXISTS offers (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    workshop_id TEXT NOT NULL REFERENCES workshops(id),
    version INTEGER NOT NULL,
    slot_id TEXT NOT NULL,
    terms_json TEXT NOT NULL,
    offer_hash TEXT NOT NULL,
    status TEXT NOT NULL,
    confirmed_by_merchant_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    closed_at TEXT
  );
  CREATE UNIQUE INDEX IF NOT EXISTS offers_workshop_version ON offers(workshop_id, version);

  CREATE TABLE IF NOT EXISTS consents (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    participant_id TEXT NOT NULL REFERENCES participants(id),
    offer_id TEXT NOT NULL REFERENCES offers(id),
    offer_hash TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL,
    text_version TEXT NOT NULL,
    accepted_at TEXT NOT NULL,
    UNIQUE(participant_id, offer_id)
  );

  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    workshop_id TEXT NOT NULL,
    participant_id TEXT NOT NULL REFERENCES participants(id),
    offer_id TEXT NOT NULL REFERENCES offers(id),
    offer_hash TEXT NOT NULL,
    status TEXT NOT NULL,
    provider_status TEXT,
    resource_type TEXT,
    order_id TEXT UNIQUE,
    authorization_id TEXT UNIQUE,
    capture_id TEXT UNIQUE,
    refund_id TEXT,
    approve_url TEXT,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL,
    simulated INTEGER NOT NULL DEFAULT 0,
    observed_at TEXT,
    authorized_at TEXT,
    captured_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(participant_id, offer_id)
  );
  CREATE INDEX IF NOT EXISTS payments_workshop ON payments(workshop_id);

  CREATE TABLE IF NOT EXISTS settlement_batches (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    workshop_id TEXT NOT NULL,
    offer_id TEXT NOT NULL UNIQUE REFERENCES offers(id),
    offer_hash TEXT NOT NULL,
    status TEXT NOT NULL,
    payment_ids_json TEXT NOT NULL,
    expected_participant_count INTEGER NOT NULL,
    expected_cents INTEGER NOT NULL,
    captured_cents INTEGER NOT NULL DEFAULT 0,
    refunded_cents INTEGER NOT NULL DEFAULT 0,
    reason TEXT,
    started_at TEXT NOT NULL,
    deadline_utc TEXT NOT NULL,
    finished_at TEXT
  );

  CREATE TABLE IF NOT EXISTS operations (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    batch_id TEXT,
    payment_id TEXT,
    action TEXT NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    request_hash TEXT NOT NULL,
    status TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    provider_ref TEXT,
    last_error TEXT,
    next_check_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS operations_batch ON operations(batch_id);
  CREATE INDEX IF NOT EXISTS operations_status ON operations(status);

  CREATE TABLE IF NOT EXISTS webhook_events (
    event_id TEXT PRIMARY KEY,
    verified INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    raw_sha256 TEXT NOT NULL,
    received_at TEXT NOT NULL,
    processed_at TEXT,
    outcome TEXT
  );

  CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    actor_kind TEXT NOT NULL,
    actor_ref TEXT NOT NULL,
    workshop_id TEXT,
    type TEXT NOT NULL,
    subject_id TEXT,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS audit_workshop ON audit_events(workshop_id, created_at);

  CREATE TABLE IF NOT EXISTS llm_calls (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    kind TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS llm_calls_created ON llm_calls(created_at);
  `);

  // Lightweight column migrations (existing demo databases created before the
  // cover image existed). CREATE TABLE IF NOT EXISTS cannot add columns.
  const workshopColumns = db.prepare('PRAGMA table_info(workshops)').all() as Array<{ name: string }>;
  if (!workshopColumns.some((column) => column.name === 'cover_image_url')) {
    db.exec('ALTER TABLE workshops ADD COLUMN cover_image_url TEXT');
  }
}
