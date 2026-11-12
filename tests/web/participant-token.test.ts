import { it, expect } from 'vitest';
import { clearParticipantAccess } from '../../src/web/lib/participant-access.js';
it('removes stale participant bearer access when changing demo identity', () => {
 let removed = ''; let replaced = '';
 clearParticipantAccess({ removeItem: (key: string) => { removed = key; } }, 'http://localhost:5180/participant/preferences?ptoken=stale&other=1', (path: string) => { replaced = path; });
 expect(removed).toBe('gr_ptoken');
 expect(replaced).toBe('/participant/preferences?other=1');
});
