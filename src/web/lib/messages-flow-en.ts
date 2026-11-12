/* Flow surfaces (organizer plan, participant preferences/authorize) + the
   status engine. Appended by the flow translation pass; keys are namespaced so
   they cannot collide with the shell/landing dictionaries.

   English values are byte-identical to the UI text the pages already showed;
   data (workshop title/merchant, slot labels, AI questions and quotes, server
   errors, offer terms) is interpolated, never translated. */

export const flowEn: Record<string, string> = {
  /* ----------------------------- shared chrome ----------------------------- */
  'flow.action.setUpWorkshop': 'Set up a workshop',
  'flow.action.done': 'Done',
  'flow.participant.eyebrow': 'Participant · {name}',
  'flow.strip.minimum': 'minimum {count}',

  /* ------------------------- status: organizer band ------------------------ */
  'flow.status.organizer.noWorkshop.headline': 'No workshop yet',
  'flow.status.organizer.noWorkshop.detail':
    'Create the activity facts first: three candidate times, price, minimum and authorization deadline.',
  'flow.status.organizer.confirmed.headline': 'Workshop confirmed and charged',
  'flow.status.organizer.confirmed.detailOne': '{count} charge completed · {amount} captured.',
  'flow.status.organizer.confirmed.detailMany': '{count} charges completed · {amount} captured.',
  'flow.status.organizer.notConfirmed.headline': 'Workshop not confirmed',
  'flow.status.organizer.cancelling.detail': 'Releasing authorizations and handling refunds now.',
  'flow.status.organizer.cancelled.detail':
    'This round did not reach the minimum. Holds were released; any captured charge follows the cancellation policy.',
  'flow.status.organizer.compensating.headline': 'Collection problem — compensation in progress',
  'flow.status.organizer.compensating.detail':
    'Uncaptured holds are being released and captured charges refunded. The per-person rows are the source of truth.',
  'flow.status.organizer.settling.headline': 'Collecting payments',
  'flow.status.organizer.settling.detail':
    'Batch locked. The server captures each authorization and checks every result with PayPal.',
  'flow.status.organizer.readyToCollect.headline': 'Authorizations meet the minimum — ready to collect',
  'flow.status.organizer.readyToCollect.detail':
    '{authorized} authorizations (not charges) · {amount} to collect · closes {deadline}.',
  'flow.status.organizer.offerOpen.headlineOne': 'Offer published — {count} more authorization needed',
  'flow.status.organizer.offerOpen.headlineMany': 'Offer published — {count} more authorizations needed',
  'flow.status.organizer.offerOpen.detail':
    '{slot} · {authorized}/{minimum} authorized (authorization is not a charge) · closes {deadline}.',
  'flow.status.organizer.workableSlot.headline': '{slot} already meets the {minimum}-person minimum',
  'flow.status.organizer.workableSlot.detail':
    'Publish one fixed offer. After publishing, price, time and terms freeze and every participant must re-read and authorize it.',
  'flow.status.organizer.questionOut.headline': 'One question is out — waiting for {name}',
  'flow.status.organizer.questionOut.detail':
    '“{question}” · only a person\'s own yes counts toward the minimum.',
  'flow.status.organizer.suggestion.headlineOne':
    '{count} more confirmation needed to reach the {minimum}-person minimum',
  'flow.status.organizer.suggestion.headlineMany':
    '{count} more confirmations needed to reach the {minimum}-person minimum',
  'flow.status.organizer.suggestion.detail':
    "{name}'s condition: “{condition}” · a yes raises {slot} from {before} to {after}.",
  'flow.status.organizer.suggestion.noPath.detail':
    'No single open condition closes the gap. More confirmed interest, or another time, is needed.',
  'flow.status.organizer.noConfirmations.headline': 'No one has confirmed a preference yet',
  'flow.status.organizer.noConfirmations.detail':
    'Interest only counts after the person confirms it themselves. No number can be assumed yet.',
  'flow.status.organizer.noConfirmations.action': 'See the participant view',
  'flow.status.organizer.recompute': 'Recompute the plan',

  /* --------------------------- status: actions ----------------------------- */
  'flow.status.action.seeResult': 'See the result',
  'flow.status.action.openFunding': 'Open funding',
  'flow.status.action.watchFunding': 'Watch funding',
  'flow.status.action.confirmAndCollect': 'Confirm and collect',
  'flow.status.action.publishTheOffer': 'Publish the offer',
  'flow.status.action.seeQuestion': 'See the question',
  'flow.status.action.askTheOneQuestion': 'Ask the one question',

  /* ---------------------------- status: rails ------------------------------ */
  'flow.status.rails.noWorkshop.matchDetail': 'No workshop yet',
  'flow.status.rails.notSelected': 'Not selected yet',
  'flow.status.rails.noOfferPublished': 'No offer published',
  'flow.status.rails.nothingToAuthorize': 'Nothing to authorize',
  'flow.status.rails.matchMet': 'One time meets the minimum',
  'flow.status.rails.matchBest': 'Confirmed fits for the best time',
  'flow.status.rails.selectedVersion': 'Selected · v{version}',
  'flow.status.rails.termsDetail': '{slot} · hash {hash}',
  'flow.status.rails.publishToFreeze': 'Publish one fixed offer to freeze terms',
  'flow.status.rails.capturedCharged': '{count} charged',
  'flow.status.rails.authorizedNotCharged': 'Authorized, not charged yet',
  'flow.status.rails.noAuthorization': 'No authorization yet',

  /* --------------------- status: participant four steps -------------------- */
  'flow.status.participant.step.interest': 'Interest',
  'flow.status.participant.step.interest.confirmed': 'Confirmed · v{version}',
  'flow.status.participant.step.interest.parsed': 'Parsed, not confirmed',
  'flow.status.participant.step.interest.empty': 'Not written yet',
  'flow.status.participant.step.terms': 'Terms',
  'flow.status.participant.step.terms.agreed': 'Agreed · offer v{version}',
  'flow.status.participant.step.terms.current': 'Offer published — read it and consent',
  'flow.status.participant.step.terms.waiting': 'The organizer has not published a plan that includes you',
  'flow.status.participant.step.authorization': 'Authorization (hold)',
  'flow.status.participant.step.authorization.authorized': 'Authorized — not charged',
  'flow.status.participant.step.authorization.charged': 'Charged',
  'flow.status.participant.step.authorization.capturing': 'Capturing',
  'flow.status.participant.step.authorization.failed': 'Needs a status check',
  'flow.status.participant.step.authorization.holdOnly': 'A hold only, never a charge',
  'flow.status.participant.step.charge': 'Charge / cancel',
  'flow.status.participant.step.charge.charged': 'Charged — workshop confirmed',
  'flow.status.participant.step.charge.refunded': 'Not confirmed — refunded',
  'flow.status.participant.step.charge.refunding': 'Not confirmed — refund in progress',
  'flow.status.participant.step.charge.voided': 'Not confirmed — hold released',
  'flow.status.participant.step.charge.failed': 'Result unknown, reconciling',
  'flow.status.participant.step.charge.waiting': 'Happens only if the workshop is confirmed',

  /* --------------------- status: participant headline ---------------------- */
  'flow.status.participant.noWorkshop.headline': 'No workshop to join yet',
  'flow.status.participant.noWorkshop.detail': 'The organizer has not published the activity facts.',
  'flow.status.participant.noPreference.headline': "You haven't expressed a preference",
  'flow.status.participant.noPreference.detail':
    'Write one sentence or tick the times that work, then confirm it yourself. Only confirmed constraints count.',
  'flow.status.participant.noPreference.action': 'Express my preference',
  'flow.status.participant.notConfirmed.headline': 'Your preference is not confirmed yet',
  'flow.status.participant.notConfirmed.detail':
    'Check the times and condition on the card, then confirm. Nothing counts before that click.',
  'flow.status.participant.notConfirmed.action': 'Review and confirm',
  'flow.status.participant.failed.headline': 'Your payment state needs a check',
  'flow.status.participant.failed.detail':
    'The server queries PayPal first and never charges twice. Per-payment state is the source of truth.',
  'flow.status.participant.failed.action': 'Open my status',
  'flow.status.participant.refunded.headline': 'Not confirmed — refunded',
  'flow.status.participant.refunded.detail':
    'PayPal confirmed the refund. The request alone is never shown as a completed refund.',
  'flow.status.participant.refunding.headline': 'Not confirmed — refund in progress',
  'flow.status.participant.refunding.detail':
    'The refund was requested but PayPal has not confirmed it yet, so it is not shown as refunded.',
  'flow.status.participant.voided.headline': 'Not confirmed — hold released',
  'flow.status.participant.voided.detail': 'Nothing was charged; the authorization was released.',
  'flow.status.participant.charged.headline': 'Workshop confirmed — payment captured',
  'flow.status.participant.charged.detail':
    "You paid {amount}. The workshop is confirmed by the organizer's collection result.",
  'flow.status.participant.authorized.headline': 'Authorized — not charged yet',
  'flow.status.participant.authorized.detail':
    'Your authorization holds {amount} without charging it. It is captured only if the workshop is confirmed; otherwise it is released.',
  'flow.status.participant.authorized.action': 'Review my authorization',
  'flow.status.participant.inOffer.headline': 'The plan is published — your terms review is next',
  'flow.status.participant.inOffer.detail':
    'Terms frozen: {slot} · {amount} · minimum {minimum}. Authorization is a hold, not a charge.',
  'flow.status.participant.inOffer.action': 'Review and authorize',
  'flow.status.participant.waiting.headline':
    'Your preference is confirmed — waiting for the organizer to publish a plan',
  'flow.status.participant.waiting.detail':
    'When a fixed offer exists you will read the exact terms and authorize; authorization is a hold, not a charge.',
  'flow.status.participant.moneyNotes':
    '{amount} · minimum {minimum} · closes {deadline} · if not formed: holds released and completed charges refunded',

  /* --------------------------- organizer plan page ------------------------- */
  'flow.plan.empty.body': 'The home screen appears once the activity facts exist.',
  'flow.plan.eyebrow': 'Organizer',
  'flow.plan.title': 'Workshop home',
  'flow.plan.intro':
    'What is true right now, who fits which time, and the one next action. Availability is not a payment: authorization is separate.',
  'flow.plan.recompute': 'Recompute',
  'flow.plan.recomputing': 'Recomputing…',
  'flow.plan.strip.aria': 'Workshop facts',
  'flow.plan.strip.perPerson': '{amount} per person',
  'flow.plan.notice.errorTitle': 'That did not work',
  'flow.plan.notice.questionSent': 'Question sent to {name}. This is the one question they will receive.',
  'flow.plan.notice.recomputed': 'Plan recomputed from the latest confirmed preferences.',
  'flow.plan.preparing': 'Preparing…',
  'flow.plan.question.title': 'Suggested question',
  'flow.plan.question.titleFor': 'Suggested question for {name}',
  'flow.plan.question.sent': 'Sent · waiting for an answer',
  'flow.plan.question.proposed': 'Proposed · not sent yet',
  'flow.plan.question.notSent': 'Not sent yet',
  'flow.plan.question.why': '{label}: {value} · gap closes {before} → {after} confirmed.',
  'flow.plan.question.whyOnly': 'Only this participant’s own yes counts toward the minimum.',
  'flow.plan.question.sending': 'Sending…',
  'flow.plan.question.send': 'Send question to {name}',
  'flow.plan.question.sentNote':
    'Question is in their participant view. A “no” is final and is never re-asked.',
  'flow.plan.question.review': 'Review question',
  'flow.plan.question.source': 'Wording source: AI or template, recorded in the audit trail.',
  'flow.plan.matrix.best':
    'Best time so far: {slot} · {count} confirmed fits · ceiling {ceiling}. A confirmed time is not a payment; each included person still reviews the frozen offer and authorizes separately.',
  'flow.plan.tech.summary': 'Technical details (plan inputs hash, audit, why this order)',
  'flow.plan.tech.rules':
    'Deterministic rules, not a model score: confirmed fits first, fewer pending conditions next, then preferred matches, then the earliest time. The same inputs always produce the same plan.',
  'flow.plan.tech.hashLabel': 'Plan inputs hash:',

  /* --------------------- participant preferences: extraction -------------- */
  'flow.preferences.extraction.live':
    'Extracted by a live model. Check and edit it before confirming — the model never gets the last word.',
  'flow.preferences.extraction.liveWithModel':
    'Extracted by a live model ({model}). Check and edit it before confirming — the model never gets the last word.',
  'flow.preferences.extraction.recorded':
    'Recorded sample: a checked-in demo fixture, not a live model answer for arbitrary text. Check and edit it before confirming.',
  'flow.preferences.extraction.structured':
    'Structured: built only from the times you ticked and the condition you typed. No AI was used.',
  'flow.preferences.extraction.seeded': 'Seeded demo preference. Check and edit it before confirming.',
  'flow.preferences.extraction.label.live': 'Live model extraction',
  'flow.preferences.extraction.label.recorded': 'Recorded sample extraction',
  'flow.preferences.extraction.label.structured': 'Structured — no AI',
  'flow.preferences.extraction.label.seeded': 'Seed extraction',

  /* ---------------------- participant preferences: page ------------------- */
  'flow.preferences.empty.noWorkshop.title': 'No workshop to answer yet',
  'flow.preferences.empty.noWorkshop.action': 'Set up the demo workshop',
  'flow.preferences.empty.noWorkshop.body':
    'The organizer has not published a workshop. Once they do, this page will show the three candidate times.',
  'flow.preferences.empty.organizer.title': 'This page belongs to a participant',
  'flow.preferences.empty.organizer.body':
    'The current session is an organizer view. Use the demo view switcher above to act as one of the synthetic participants.',
  'flow.preferences.title': 'What would make this workshop work for you?',
  'flow.preferences.intro':
    'Answer in your own words, or just tick the times that work. We turn it into a short, reviewable card — nothing counts until you confirm it.',
  'flow.preferences.badge.confirmed': 'Confirmed',
  'flow.preferences.badge.withdrawn': 'Withdrawn',
  'flow.preferences.badge.unconfirmed': 'Not confirmed yet',
  'flow.preferences.strip.aria': 'The workshop',
  'flow.preferences.notice.errorTitle': 'Nothing was saved',
  'flow.preferences.error.needSomething': 'Write a sentence or tick at least one time.',
  'flow.preferences.error.needTime': 'Choose at least one time that works for you — or withdraw instead.',
  'flow.preferences.error.preferredMustBeAccepted':
    'A preferred time must also be a time that works for you.',
  'flow.preferences.notice.confirmed':
    'Preferences confirmed. Nothing was shared with other participants; the organizer sees only your constraints.',
  'flow.preferences.notice.withdrawn':
    'You withdrew. You are not counted in the plan and you will not be asked again.',
  'flow.preferences.answer.changeTitle': 'Change your answer',
  'flow.preferences.answer.title': 'Your answer',
  'flow.preferences.answer.equalPaths':
    'Both paths are equal: if you would rather not write free text, the checkboxes below work without any AI. Start from either one to rebuild the card underneath.',
  'flow.preferences.answer.purpose':
    'Purpose notice: your sentence is sent only to the configured model service to extract these constraints. It is not written to logs, and synthetic demo text is deleted within 7 days. This is a sandbox prototype — no real money moves.',
  'flow.preferences.free.heading': 'In your own words',
  'flow.preferences.free.label': 'Your sentence',
  'flow.preferences.free.hint':
    '{count}/600 characters. Kept only for this workshop; the organizer sees constraints, not your private reasons.',
  'flow.preferences.free.placeholder': 'Saturday morning works for me if all the materials are included…',
  'flow.preferences.free.extracting': 'Extracting…',
  'flow.preferences.free.extract': 'Extract conditions',
  'flow.preferences.structured.heading': 'Or just tick what works',
  'flow.preferences.structured.legend': 'Times that work for you',
  'flow.preferences.structured.conditionLabel': 'Optional: what has to be true?',
  'flow.preferences.structured.conditionHint':
    'One condition at most. The organizer may ask the merchant exactly one yes/no question about it.',
  'flow.preferences.structured.conditionPlaceholder': 'If all the materials are included…',
  'flow.preferences.structured.conditionSlot': 'Which time does the condition apply to?',
  'flow.preferences.structured.building': 'Building…',
  'flow.preferences.structured.useTimes': 'Use these times',
  'flow.preferences.footnote':
    'Changed your mind? You can confirm a new version until the offer closes, and withdraw without a reason.',
  'flow.preferences.compose.times': 'These times work for me: {times}.',
  'flow.preferences.compose.condition': 'My condition: {condition}.',

  /* -------------------- participant preferences: review card -------------- */
  'flow.preferences.review.title': 'Review what we understood',
  'flow.preferences.review.sourceLabel': 'Your sentence, verbatim',
  'flow.preferences.review.mustHave': 'Must have',
  'flow.preferences.review.mustHaveHint': 'times that work for you',
  'flow.preferences.review.preferred': 'Preferred',
  'flow.preferences.review.preferredHint': 'a nice-to-have, never a requirement',
  'flow.preferences.review.clarify': 'Needs clarification',
  'flow.preferences.review.clarifyHint': 'at most one question per person',
  'flow.preferences.review.dependsOnCondition': 'This time depends on the condition below.',
  'flow.preferences.review.tickFirst': 'Tick a time under “Must have” first.',
  'flow.preferences.review.nothingToClarify': 'Nothing needs clarifying from your answer.',
  'flow.preferences.review.conditionLabel': 'Condition {index}',
  'flow.preferences.review.conditionHint':
    'Plain language, one condition. The organizer may ask the merchant one yes/no question about it.',
  'flow.preferences.review.appliesTo': 'Applies to',
  'flow.preferences.review.conditionQuoteLabel': 'From your sentence, verbatim',
  'flow.preferences.review.removeCondition': 'Remove condition',
  'flow.preferences.review.needsClarificationBadge': 'Needs clarification',
  'flow.preferences.review.questionPolicy':
    'A question is asked only when one merchant fact could change whether this time works. You can answer yes or no, and a no is respected.',
  'flow.preferences.review.promiseTitle': 'Nothing counts until you confirm.',
  'flow.preferences.review.promiseRest': 'Until then your answer is a draft only you can see.',
  'flow.preferences.review.confirming': 'Confirming…',
  'flow.preferences.review.confirm': 'Confirm my preferences',
  'flow.preferences.withdraw.summary': 'Withdraw from this workshop',
  'flow.preferences.withdraw.bodyDraft':
    'Withdrawing removes you from the plan immediately. You are not counted, you are not asked again, and no one is charged on your behalf.',
  'flow.preferences.withdraw.withdrawing': 'Withdrawing…',
  'flow.preferences.withdraw.button': 'Withdraw my preferences',
  'flow.preferences.review.shared': 'Shared with the merchant: {times}.',
  'flow.preferences.review.sharedWithConditions':
    'Shared with the merchant: {times}; conditions: {conditions}.',
  'flow.preferences.review.nothingYet': 'nothing yet',

  /* ------------------ participant preferences: confirmed card ------------- */
  'flow.preferences.confirmed.title': 'Preferences confirmed',
  'flow.preferences.confirmed.meta': 'Confirmed {when}. Version {version}.',
  'flow.preferences.confirmed.version': 'Version {version}.',
  'flow.preferences.confirmed.mustHave': 'Must have',
  'flow.preferences.confirmed.preferred': 'Preferred',
  'flow.preferences.confirmed.noPreference': 'No preference between them',
  'flow.preferences.confirmed.needsFact': 'Still needs a merchant fact',
  'flow.preferences.confirmed.conditionSuffix': 'only works if {condition}.',
  'flow.preferences.confirmed.quoteLabel': 'Your words, verbatim',
  'flow.preferences.confirmed.questionNote':
    'At most one yes/no question may be sent to you about this. It is not a commitment.',
  'flow.preferences.confirmed.reviewOffer': 'Review the open offer',
  'flow.preferences.confirmed.update': 'Review and update preferences',
  'flow.preferences.confirmed.withdrawBody':
    'Withdrawing removes you from the plan immediately and releases any hold. No one is charged on your behalf.',

  /* ----------------------- participant authorize page ---------------------- */
  'flow.authorize.empty.noWorkshop.title': 'No workshop yet',
  'flow.authorize.empty.noWorkshop.body':
    'The organizer has not set up a workshop. There is nothing to authorize.',
  'flow.authorize.empty.organizer.title': 'This page belongs to a participant',
  'flow.authorize.empty.organizer.body':
    'Use the demo view switcher above to act as one of the synthetic participants.',
  'flow.authorize.noOffer.title': 'No fixed offer yet',
  'flow.authorize.noOffer.emptyTitle': 'Nothing to authorize right now',
  'flow.authorize.noOffer.body':
    'The organizer has not published a fixed offer. Your confirmed preferences still count, and nothing can be charged before you review the full offer and agree.',
  'flow.authorize.noOffer.link': 'Your preferences',
  'flow.authorize.notIncluded.title': 'This offer does not include you',
  'flow.authorize.notIncluded.emptyTitle': 'You are not counted in this offer',
  'flow.authorize.notIncluded.leadBefore': 'The organizer published an offer for ',
  'flow.authorize.notIncluded.leadAfter':
    ', but your confirmed preference does not accept that time. Nothing will be charged and your preference stays as you set it.',
  'flow.authorize.notIncluded.link': 'Review your preferences',
  'flow.authorize.title': 'Review and authorize',
  'flow.authorize.intro':
    'Read the whole summary below. Nothing is captured now — this creates a temporary PayPal authorization for the exact total, captured only if the workshop is confirmed.',
  'flow.authorize.errorTitle': 'Nothing was charged',
  'flow.authorize.offer.title': '1 · The fixed offer',
  'flow.authorize.offer.meta':
    '{slot} · offer version {version}. Every row below is part of the offer, not a summary written afterwards.',
  'flow.authorize.offer.chip': 'Sandbox · No real money',
  'flow.authorize.offer.totalLabel': 'Total if the workshop is confirmed',
  'flow.authorize.offer.totalNote':
    'Captured only once, only when at least {minimum} people are authorized and the authorization deadline has not passed.',
  'flow.authorize.offer.techSummary': 'Technical details (offer fingerprint)',
  'flow.authorize.consent.title': '2 · Your agreement',
  'flow.authorize.consent.hint':
    'This box starts unchecked on purpose. Nothing happens until you tick it and press the button.',
  'flow.authorize.pay.title': '3 · Authorization',
  'flow.authorize.checking.headline': 'Checking with PayPal',
  'flow.authorize.checking.body':
    'Your browser has come back from PayPal. This screen only shows what the server reports — a finished button is not a payment, so we wait for the authorization state to arrive.',
  'flow.authorize.checking.waitingServer': 'Waiting for the server',
  'flow.authorize.checking.refresh': 'This page refreshes every 4 seconds while the authorization is in flight.',
  'flow.authorize.authorized.headline': 'Authorized — not charged yet',
  'flow.authorize.authorized.body':
    'Your PayPal account has a temporary authorization of {amount}. The studio is paid only if the workshop is confirmed with enough people; otherwise the hold is released and nothing is charged.',
  'flow.authorize.authorized.amount': 'Amount',
  'flow.authorize.authorized.authorization': 'Authorization',
  'flow.authorize.authorized.mode': 'Payment mode',
  'flow.authorize.authorized.simulated': 'Simulated PayPal — no real money',
  'flow.authorize.authorized.sandbox': 'PayPal sandbox',
  'flow.authorize.withdraw.summary': 'Withdraw this authorization',
  'flow.authorize.withdraw.body':
    'You can withdraw before the organizer captures, and the hold is released. Nothing is charged. If the workshop is already settled, the outcome is shown on the result page instead.',
  'flow.authorize.withdraw.withdrawing': 'Withdrawing…',
  'flow.authorize.withdraw.button': 'Withdraw authorization',
  'flow.authorize.settled.changed': 'Your authorization changed',
  'flow.authorize.settled.statusFromServer':
    '{status}. This status came from the server, not from a button click.',
  'flow.authorize.settled.voided': 'The temporary hold was released. Nothing was charged.',
  'flow.authorize.settled.refunded': 'The refund was confirmed by PayPal.',
  'flow.authorize.settled.refunding':
    'A refund has been requested but is not confirmed yet — we do not call it refunded until PayPal says so.',
  'flow.authorize.settled.manual':
    'An uncertain outcome needs a person to check PayPal. Nothing is retried automatically.',
  'flow.authorize.pay.simulatedStrong': 'Simulated PayPal — no real money.',
  'flow.authorize.pay.simulatedRest':
    'No PayPal account is contacted. The server records a sandbox stand-in so the rest of the flow can be tested end to end.',
  'flow.authorize.pay.sandboxNote':
    'You will be handed to PayPal sandbox to authorize the exact total. No live money is involved.',
  'flow.authorize.pay.afterConsent':
    'When you press the button you will be handed to PayPal. Returning does not mark you paid — we read the authorization state back from the server.',
  'flow.authorize.pay.beforeConsent':
    'Tick the agreement box above to enable the payment control. It is disabled until you do.',
  'flow.authorize.footnote':
    'Changed your mind? You can withdraw before capture. If the workshop is not confirmed, every hold is released and nothing is charged.',
  'flow.authorize.error.noCheckout':
    'The server did not return a checkout. Nothing was charged and no hold was created.',
  'flow.authorize.notice.mock':
    'Dev mock: standing in for the PayPal approval step. No PayPal account is contacted.',
  'flow.authorize.error.noApproveLink': 'The server did not return an approval link. Nothing was charged.',
  'flow.authorize.notice.withdrawn':
    'Your authorization was withdrawn and the hold is being released. Nothing was charged.',
};
