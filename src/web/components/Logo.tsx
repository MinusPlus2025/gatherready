/* ==========================================================================
   Brand mark: three candidate times converging into one agreed, confirmed plan.
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
      <rect width="64" height="64" rx="15" fill="currentColor" />
      <g fill="#F7F6F0">
        <circle cx="19" cy="19" r="3.6" />
        <circle cx="19" cy="32" r="3.6" />
        <circle cx="19" cy="45" r="3.6" />
      </g>
      <g stroke="#F7F6F0" strokeWidth="2.6" strokeLinecap="round" opacity="0.92">
        <path d="M22 19.6 36.8 28.4" />
        <path d="M22.5 32h13" />
        <path d="M22 44.4 36.8 35.6" />
      </g>
      <circle cx="45" cy="32" r="11.5" fill="#F7F6F0" />
      <path
        d="M39.6 32.3l3.8 3.8 7-7.3"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
