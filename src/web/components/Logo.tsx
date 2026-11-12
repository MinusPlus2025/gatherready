/* ==========================================================================
   Brand mark: a single confident G, drawn as one open circle plus a commitment dot.
   Inline SVG so it stays crisp at any size and needs no network request. The same
   artwork lives in public/logo-mark.svg (favicon, README, submission material).
   ========================================================================== */

export function BrandMark({ size = 36, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      className="brand-mark-svg"
    >
      <rect width="64" height="64" rx="14" fill="currentColor" />
      <path
        d="M46 24.5A16 16 0 1 0 48 32H36.5"
        style={{ stroke: 'var(--accent-contrast, #F7F6F0)' }}
        strokeWidth="4.6"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="49" cy="32" r="3" style={{ fill: 'var(--accent-contrast, #F7F6F0)' }} />
    </svg>
  );
}
