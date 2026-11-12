# Post-submission journey polish

Branch: polish/post-submission-ux. Competition master and original database untouched.

## References actually inspected
- https://luma.com/discover : compact navigation, event identity and date/location alongside imagery; primary action remains visible rather than buried under a long explanation.
- https://classbento.com/pottery-classes-new-york-city : workshop photography anchors the experience, then price, duration and booking facts support a decision.
No imagery/reviews copied. Existing gallery continues to state that photos are reference imagery from different studios, not evidence of the advertised venue or results.

## Decisions implemented
- Role-specific persistent journey navigation above workspace content. Organizer sees setup/plan/offer/funding/result; participant sees preferences/review. Unavailable future steps are text, not dead links. Number means position, not completed payment.
- Current-screen line animates over 220ms; number color over 180ms. Feedback is restrained and does not imply a server action completed. Reduced-motion disables these effects.
- Settled payment page leads with the server-provided state, not an invitation to authorize again. Completed capture badge is success-toned. Previously accepted terms become a collapsed read-only record; no misleading editable consent checkbox. Settled pages no longer suggest cancellation before capture.
- Payment result panels have stronger type hierarchy, calm surface contrast and tabular totals. Mobile navigation wraps without horizontal scrolling; usable link height is retained.

## Actual checks
- Web TypeScript and production build passed.
- Vitest 22 files / 264 tests passed, including new navigation tests: current state, unavailable result, participant role restriction, no workflow chrome on landing.
- CUA observed desktop organizer setup and participant captured state. Observed both at 390x844; navigation fits and no horizontal overflow was visible. Restored viewport afterward.
- Browser reload showed captured state, collapsed agreement and no stale cancellation footnote. No payment or creation button clicked during this review.
- Synthetic isolated DB only, PAYPAL_FORCE_SIMULATED=1, LLM_PROVIDER=none. Preview http://localhost:5284 is local to the Mac; not public deployment.

## Limits
Not a comprehensive accessibility certification or real PayPal test. Reduced-motion is CSS-implemented, not OS-setting toggled. Browser translation extension rewrote English text during screenshots (e.g. Charged became an incorrect Chinese term); those are not app locale translations. Existing SlotMatrix React key warning appears in an unrelated test. No competition submission, production or public hosting changes.

## Workshop creation studio (second pass)
Observed full landing hero, below-fold gallery/state strip, desktop creation and 390px mobile creation. The hero stacks photography and a complete interactive sample and remains tall; this is a known next composition opportunity, not silently described as solved.

Creation is now a two-column editing studio with an invitation-like live draft: restrained printed-card typography, merchant/title, description, venue, duration and price. It updates directly from the unsaved form, without server writes. No new stock photo is used to impersonate the venue. Desktop keeps the draft in view; mobile shows a collapsed native disclosure before the form, with logical DOM/keyboard order. The draft explicitly says unsaved and not published/bookable. Disclosure uses a short 220ms entry and is disabled under reduced motion. All eight locale dictionaries include the new labels.

Actual interaction: changing the title to Saturday clay club immediately changed the draft heading. Reload discarded this unsaved edit. Mobile 390x844 loaded collapsed; click expanded it without leaving the form. Screenshots were emitted in review tools. Saving JPG to the repo from the browser runtime was denied (EPERM), so no saved screenshot artifact is claimed. Build/web TypeScript passed; 264 tests passed before the final DOM-order-only adjustment, which was rebuilt and typechecked. No workshop created, no payment sent. Full journey visual redesign is not yet complete.
