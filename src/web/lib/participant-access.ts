/** Drop bearer access after an explicitly authorized demo role switch. */
export function clearParticipantAccess(storage: Pick<Storage, 'removeItem'>, href: string, replace: (path: string) => void): void {
 storage.removeItem('gr_ptoken');
 const url = new URL(href);
 url.searchParams.delete('ptoken');
 replace(`${url.pathname}${url.search}${url.hash}`);
}
