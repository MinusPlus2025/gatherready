/** Explicit isolated-DB initialization command. Never run against shared/prod DB. */
import { openDb } from '../src/server/db.js';
const url=process.env.LIBSQL_URL ?? '';
if (!/^(libsql|https):\/\//.test(url)) throw new Error('Remote LIBSQL_URL required');
if (process.env.GATHERREADY_ALLOW_ISOLATED_MIGRATION !== 'true') throw new Error('Explicit isolated database migration opt-in required');
const db=await openDb(url,{authToken:process.env.LIBSQL_AUTH_TOKEN});
db.close();
console.log('Isolated database migration completed. No transaction or model was invoked.');
