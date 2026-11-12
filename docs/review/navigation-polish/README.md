# Journey navigation review

Scope: post-submission UX branch only; creation page on isolated port 5285. Product Design audit guidance plus actual Chrome browser review. No submitted data, payments or master changes.

1. Desktop creation: healthy form grouping; reviewed default viewport. Keyboard Shift+Tab then Tab visibly focuses the current journey link (desktop-focus.jpg).
2. Mobile creation at 390×844: all five stages stay visible; draft is initially collapsed after a mobile page load; page has no horizontal overflow (DOM measurement). Saved mobile.jpg was reopened and inspected.
3. Navigation feedback: increased mobile type from .67rem to .75rem, aligned stage circles and labels centrally, removed extra opacity on disabled text, and used dashed circles for unavailable stages. A current location is not a completed step. Disabled stages remain non-interactive.
4. Keyboard/interaction: explicit focus-visible ring and background; 140ms press feedback, 160ms hover/background transition. Hover effects limited to devices supporting hover. Reduced-motion styles disable transitions/press scaling. CSS verified, reduced-motion OS mode was not interactively switched.

Build and 288 tests pass. This is a bounded navigation improvement, not a claim of complete visual redesign or accessibility certification. Browser translation extension visibly translated EN content; screenshots are not evidence of native Chinese translations. Existing form is still long, especially on mobile. Desktop draft stays collapsed when resizing from mobile without reloading, because disclosure preserves session state; this was not changed. No fresh payment journey was performed in this pass.
