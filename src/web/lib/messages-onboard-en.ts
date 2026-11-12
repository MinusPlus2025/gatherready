/* Organizer setup / participant clarify surfaces.

   English values are copied byte-for-byte from the text these screens already
   render, including the few trailing/leading spaces marked below: those keys
   wrap an inline <strong> in the JSX, so the space has to live on one side of
   the split. Chinese values keep their own natural spacing. */
export const onboardEn: Record<string, string> = {
  /* --------------------------- organizer setup --------------------------- */
  'onboard.setup.eyebrow': 'Organizer · step 1',
  'onboard.setup.title': 'Set up your workshop',
  'onboard.setup.intro':
    'One merchant, one two-hour workshop, three candidate times. These are the facts every participant will eventually see in a fixed offer.',
  'onboard.setup.loadSample': 'Load a sample workshop',
  'onboard.setup.loadingSample': 'Loading sample…',
  /* ends with a space — followed by <strong>Create workshop</strong> */
  'onboard.setup.formNoteBefore':
    'The fields are pre-filled from a sample workshop to make the walkthrough quick. Edit anything — nothing is created until you press ',
  'onboard.setup.formNoteConfirm': 'Create workshop',
  'onboard.setup.formNoteAfter': '.',
  'onboard.setup.apiError': 'The workshop was not created',
  'onboard.setup.factsLegend': 'Workshop facts',

  'onboard.setup.field.merchantName': 'Merchant name',
  'onboard.setup.field.title': 'Workshop title',
  'onboard.setup.field.description': 'Description',
  'onboard.setup.field.descriptionHint': 'What happens in the session. This appears verbatim in the offer.',
  'onboard.setup.field.venue': 'Venue',
  'onboard.setup.field.timezone': 'Timezone (IANA)',
  'onboard.setup.field.duration': 'Duration (minutes)',
  'onboard.setup.field.price': 'Price per person (USD)',
  'onboard.setup.field.priceHint': 'Fixed and all-inclusive. Stored as integer cents.',
  'onboard.setup.field.inclusions': 'What the price includes',
  'onboard.setup.field.inclusionsHint': 'One item per line. These are listed in the offer.',
  'onboard.setup.field.minParticipants': 'Minimum participants',
  'onboard.setup.field.capacity': 'Capacity',
  'onboard.setup.field.authDeadline': 'Authorization deadline ({timezone})',
  'onboard.setup.field.authDeadlineHint':
    'When the authorization window closes. It must end before the first session.',

  'onboard.setup.slots.legend': 'Candidate times (3)',
  'onboard.setup.slots.hint':
    'Enter the wall-clock times in {timezone}. The stored instant is UTC; every screen renders it back in this timezone.',
  'onboard.setup.slot.title': 'Time {n}',
  'onboard.setup.slot.start': 'Starts',
  'onboard.setup.slot.end': 'Ends',

  'onboard.setup.create': 'Create workshop',
  'onboard.setup.creating': 'Creating workshop…',
  'onboard.setup.actionsNote':
    'The server validates the draft again. It refuses an authorization deadline that has already passed, a minimum above capacity, or overlapping times.',

  /* ------------------------ organizer setup: done ------------------------ */
  'onboard.setup.created.eyebrow': 'Organizer',
  'onboard.setup.created.title': 'Your workshop is set up',
  'onboard.setup.created.intro':
    '{merchant} · {price} {currency} per person · minimum {min}, capacity {capacity}.',
  'onboard.setup.status.offerOpen': 'Offer open',
  'onboard.setup.status.clarifying': 'Clarifying conditions',
  'onboard.setup.status.collecting': 'Collecting interest',
  'onboard.setup.created.facts': 'Workshop facts',
  'onboard.setup.created.venue': 'Venue',
  'onboard.setup.created.timezone': 'Timezone',
  'onboard.setup.created.length': 'Length',
  'onboard.setup.created.lengthValue': '{n} minutes',
  'onboard.setup.created.includes': 'Includes',
  'onboard.setup.created.deadline': 'Authorization deadline',
  'onboard.setup.created.candidateTimes': 'Candidate times',
  'onboard.setup.created.next': 'Next step',
  /* ends with a space — followed by <strong>Confirm my preferences</strong> */
  'onboard.setup.created.nextBefore':
    'Participants now see the big question and build a reviewable preference. Nothing counts until each person presses ',
  'onboard.setup.created.nextConfirm': 'Confirm my preferences',
  'onboard.setup.created.nextAfter':
    '. Use the view switcher above to act as one of the participants.',
  'onboard.setup.created.openPlan': 'Open the plan',
  'onboard.setup.created.openParticipant': 'Open a participant view',

  /* --------------------- organizer setup: client errors ------------------ */
  'onboard.setup.error.required': '{label} is required.',
  'onboard.setup.error.timezone': 'Choose a valid IANA timezone.',
  'onboard.setup.error.duration': 'Duration must be a whole number of minutes.',
  'onboard.setup.error.price': 'Price must be a dollar amount with at most two decimals.',
  'onboard.setup.error.inclusions': 'List at least one thing the price includes.',
  'onboard.setup.error.min': 'Minimum must be a whole number.',
  'onboard.setup.error.capacity': 'Capacity must be a whole number.',
  'onboard.setup.error.minOverCapacity': 'Minimum cannot be larger than capacity.',
  'onboard.setup.error.deadlineFormat': 'Enter the authorization deadline as a date and time.',
  'onboard.setup.error.deadlineFuture': 'The authorization deadline must be in the future.',
  'onboard.setup.error.slotRange': 'Time {n} needs a start and an end.',
  'onboard.setup.error.slotOrder': 'Time {n} must end after it starts.',
  'onboard.setup.error.slotOverlap': 'Candidate times must not overlap.',
  'onboard.setup.error.deadlineBeforeFirst':
    'The authorization deadline must close before the first session starts.',

  /* ------------------------- participant clarify ------------------------- */
  'onboard.clarify.eyebrow': 'Participant · {name}',
  'onboard.clarify.preferences': 'Your preferences',
  'onboard.clarify.openOffer': 'Review the open offer',

  'onboard.clarify.noParticipant.title': 'This page belongs to a participant',
  'onboard.clarify.noParticipant.body':
    'Use the view switcher above to act as one of the participants.',

  'onboard.clarify.none.title': 'No question for you',
  'onboard.clarify.none.emptyTitle': 'Nothing to answer right now',
  'onboard.clarify.none.body1':
    'A question is only asked when one merchant fact could change whether a time works for you. Most people never get one, and you get at most one.',
  'onboard.clarify.none.body2': 'Your confirmed preferences still count exactly as you set them.',

  'onboard.clarify.answered.titleYes': 'Thanks — that time now counts',
  'onboard.clarify.answered.titleNo': 'Your preference is unchanged',
  'onboard.clarify.answered.intro':
    'Nothing else is needed from you. This question is closed and will not be asked again.',
  'onboard.clarify.answered.badge': 'Answered',
  'onboard.clarify.answered.heading': 'Your answer',
  'onboard.clarify.answered.yesStrong': 'Yes, this works.',
  'onboard.clarify.answered.noStrong': 'No, keep my preference.',
  /* leading space — wraps after <strong>…</strong> on the same line */
  'onboard.clarify.answered.yesBody':
    ' Your preference was updated to include this time — subject to the same fixed offer and the same authorization step as everyone else.',
  'onboard.clarify.answered.noBody':
    ' Your original preference stays exactly as you confirmed it. There is no penalty, no discount, and no re-asking.',
  'onboard.clarify.answered.quoteLabel': 'What you originally wrote',

  'onboard.clarify.proposed.title': 'No question sent to you yet',
  'onboard.clarify.proposed.emptyTitle': 'The organizer is still reviewing a possible question',
  'onboard.clarify.proposed.body':
    'Nothing has been sent to you, and nothing counts until it is. Your confirmed preferences are unchanged.',

  'onboard.clarify.ask.title': 'One question about your condition',
  'onboard.clarify.ask.intro': 'Answer in one click. This is the only question you will be asked.',
  'onboard.clarify.ask.badge': 'Waiting for your answer',
  'onboard.clarify.ask.saveError': 'Your answer was not saved',
  'onboard.clarify.ask.toldHeading': 'What you told us',
  'onboard.clarify.ask.verbatim': '{name} · verbatim',
  'onboard.clarify.ask.toldNote': 'You wrote this when you confirmed your preference.',
  'onboard.clarify.ask.dependsHeading': 'What it depends on',
  'onboard.clarify.ask.dependsNote':
    'This is a merchant fact, not a promise from GatherReady or from the AI. The organizer checked it before sending the question.',
  'onboard.clarify.ask.heading': 'The question',
  /* ends with a space — followed by <strong>{slotLabel}</strong> */
  'onboard.clarify.ask.sourcePrefix': 'Wording source: {source}. It concerns only ',
  'onboard.clarify.ask.sourceAi': 'AI-written, then checked by the organizer',
  'onboard.clarify.ask.sourceTemplate': 'template wording — no AI used',
  'onboard.clarify.ask.sourceSuffix': '.',
  'onboard.clarify.ask.answerGroupAria': 'Answer the question',
  'onboard.clarify.ask.saving': 'Saving…',
  'onboard.clarify.ask.yes': 'Yes, this works',
  'onboard.clarify.ask.no': 'No, keep my preference',
  'onboard.clarify.ask.noStrong': 'No is a complete answer.',
  /* leading space — wraps after <strong>No is a complete answer.</strong> */
  'onboard.clarify.ask.noNote':
    ' Your preference stays exactly as it is, you are not asked again, and no one is charged on your behalf.',
};
