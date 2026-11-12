# Form typography audit and repair

Tooling actually used: Product Design audit/index/user-context/critical-overrides guidance; local user-context preflight (no saved entries); CUA Chrome browser viewport and full-page capture; TypeScript/build/Vitest. Existing real Mac preview was required, not a recreated mock. No Figma or image generation is claimed.

1. Desktop creation: fixed. Native fieldset legend previously interrupted the border. The accessible legend is retained visually hidden; visible section heading is now inside card padding. Both facts and candidate-times groups use this treatment. ParticipantPreferences uses a deliberately hidden legend and was left intact.
2. Mobile 390px fields: fixed. A recently added studio override was keeping three-field groups in two columns despite the global phone rule. Now all setup field grids become single column under 650px. Labels/hints/errors wrap at line-height 1.5; controls and fieldsets can shrink. Full saved capture 02-mobile-full.jpg was reopened and inspected.
3. Narrow desktop 980px and long bilingual title: checked. Draft title wraps, group heading and error text remain inside surfaces. Tested negative price; submission stayed on form and focused its error summary. See 03-narrow-error-before-price-fix.jpg for the actual observed state.
4. Invalid price draft: additionally fixed. Browser translation had left the old $45 amount visible despite invalid -1 input. Keying the price cell to its input forces that small cell to remount. Subsequent browser check showed “— USD” rather than the old amount, then 45.00 was restored. No activity was created and no payment invoked.

Full-page captures can position sticky headers differently from the viewport. Browser translation extension changes the displayed English to automatic Chinese; this is not the application's own Chinese locale. Invalid-price AFTER proof is accessibility-tree evidence, not the BEFORE image.

Limits: actual browser zoom at 200% and a screen reader were not exercised; not a full accessibility certification. Full create/invite/participant/payment path is being independently audited on a different port. This review touched only isolated form-review.db on 5285; existing user 5284 session and competition master are unchanged. Preview: http://127.0.0.1:5285/organizer/setup (Mac local only).
