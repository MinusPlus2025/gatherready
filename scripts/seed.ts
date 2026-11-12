/**
 * Initialise the SQLite database and print what exists. Safe to re-run.
 *
 * GatherReady scopes everything to an isolated demo tenant created per browser
 * session, so there is no global seed to plant: `Load sample` does that inside
 * the visitor's own tenant. This script only creates the schema and reports.
 */
import { openDb } from '../src/server/db.js';
import { loadConfig } from '../src/server/config.js';
import { Repo } from '../src/server/repo.js';

const cfg = loadConfig();
const db = openDb(cfg.dbPath);
const repo = new Repo(db);

const tables = repo.all<{ name: string }>(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
);
console.log(`[seed] database ready: ${cfg.dbPath}`);
console.log(`[seed] tables: ${tables.map((t) => t.name).join(', ')}`);
const tenants = repo.one<{ c: number }>('SELECT COUNT(*) AS c FROM tenants');
const workshops = repo.one<{ c: number }>('SELECT COUNT(*) AS c FROM workshops');
console.log(`[seed] tenants=${tenants?.c ?? 0} workshops=${workshops?.c ?? 0}`);
console.log('[seed] no global demo rows are created: each browser session gets its own isolated tenant.');
db.close();
