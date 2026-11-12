/* French (fr) UI strings. Keys mirror the merged English dictionary one to one;
   placeholders are identical. Data stays in the language it was created in:
   workshop facts, AI questions and quotes, canonical offer terms and server
   error text are not translated here. */

export const fr: Record<string, string> = {
  /* ------------------------------ pay status ------------------------------ */
  'pay.status.NONE': 'Pas commencé',
  'pay.status.ORDER_CREATED': 'Commande créée — en attente de validation',
  'pay.status.APPROVED': 'Validé — autorisation en cours',
  'pay.status.AUTHORIZING': 'Autorisation en cours',
  'pay.status.AUTHORIZED': 'Autorisé — pas encore débité',
  'pay.status.CAPTURING': 'Débit en cours',
  'pay.status.CAPTURED': 'Débité',
  'pay.status.VOIDING': 'Libération de l’empreinte',
  'pay.status.VOIDED': 'Empreinte libérée (annulée)',
  'pay.status.REFUNDING': 'Remboursement demandé — en attente de PayPal',
  'pay.status.REFUNDED': 'Remboursé',
  'pay.status.FAILED': 'Échec — rien n’a été débité',
  'pay.status.UNKNOWN': 'Inconnu — vérification auprès de PayPal',
  'pay.status.MANUAL_REVIEW': 'Nécessite une intervention manuelle',
  'language.label': 'Langue',
  'language.en': 'English',
  'language.zh': '中文',

  /* -------------------------------- shell -------------------------------- */
  'shell.skip': 'Aller au contenu principal',
  'shell.boot.loading': 'Chargement de l’atelier…',
  'shell.boot.failed': 'Le serveur n’a pas répondu.',
  'shell.boot.loadingShort': 'Chargement…',
  'shell.boot.retry': 'Réessayer',
  'shell.tagline': 'Un plan accepté par tous, financé seulement quand il devient réalité',
  'shell.mode.simulated': 'Sandbox PayPal — sans argent réel',
  'shell.mode.sandbox': 'Sandbox PayPal — sans argent réel',
  'shell.role.organizer': 'Vous êtes l’organisateur',
  'shell.role.participant': 'Vous êtes {name} — participant',
  'shell.context.offerOpen': 'Offre ouverte',
  'shell.context.clarifying': 'Clarification des conditions',
  'shell.context.collecting': 'Collecte des intentions',
  'shell.countdown.closes': 'L’autorisation se ferme dans',
  'shell.countdown.closed': 'Fenêtre d’autorisation fermée',
  'shell.myAuthorization': 'Votre autorisation :',
  'shell.extraction.live': 'modèle en direct',
  'shell.extraction.recorded': 'échantillon enregistré',
  'shell.extraction.structured': 'structuré (sans AI)',
  'shell.mode.payments': '',
  'shell.refreshFailed': 'Impossible d’actualiser',
  'shell.retryNow': 'Réessayer maintenant',
  'shell.footer.text': 'Prototype PayPal AI Hackathon exécuté dans la sandbox PayPal. Aucun argent réel ne circule.',
  'shell.footer.credit': 'Photos : licence Pexels — images d’illustration.',
  'shell.footer.languageNote':
    'Langue de l’interface uniquement : les faits de l’atelier, les questions de l’AI et les conditions contractuelles restent dans la langue de leur création.',
  'shell.footer.navLabel': 'Écrans',
  'shell.nav.setup': 'Configuration organisateur',
  'shell.nav.preferences': 'Préférences participant',
  'shell.nav.plan': 'Plan',
  'shell.nav.funding': 'Collecte',

  /* ------------------------------- demo bar ------------------------------ */
  'demo.view': 'Voir en tant que',
  'demo.organizer': 'Organisateur',
  'demo.screens': 'Écrans',
  'demo.reset': 'Réinitialiser',
  'demo.route.setup': 'Configuration organisateur',
  'demo.route.preferences': 'Préférences participant',
  'demo.route.plan': 'Plan organisateur',
  'demo.route.clarify': 'Clarification participant',
  'demo.route.offer': 'Offre organisateur',
  'demo.route.authorize': 'Autorisation participant',
  'demo.route.funding': 'Collecte organisateur',
  'demo.route.result': 'Résultat organisateur',

  /* ------------------------------- landing ------------------------------- */
  'landing.eyebrow': 'Ateliers de consensus · sandbox PayPal',
  'landing.hero.title': 'Un atelier n’a lieu que quand assez de personnes disent réellement oui.',
  'landing.hero.lede':
    'GatherReady transforme un intérêt conditionnel — « samedi matin, si le matériel est inclus » — en un plan fixe que chacun peut lire, une question facultative, et une autorisation PayPal débitée seulement quand tout le plan est réel.',
  'landing.cta.setup': 'Créer un atelier',
  'landing.cta.participant': 'Voir en tant que participant',
  'landing.meta.sandbox': 'Sandbox PayPal uniquement',
  'landing.meta.offer': 'Une offre immuable',
  'landing.meta.ai': 'L’AI ne touche jamais à l’argent',
  'landing.photo.altHands': 'Mains façonnant un pot sur un tour de potier, argile humide luisant sous une lumière chaude',
  'landing.photo.altWorkshop': 'Un atelier de poterie en activité : étagères de pièces finies, tours et pots en séchage',
  'landing.photo.altStudio': 'Un atelier de poterie lumineux avec des récipients artisanaux colorés sur les étagères',
  'landing.frame.aria': 'Aperçu de l’écran de plan de l’organisateur',
  'landing.frame.title': 'Le plan',
  'landing.frame.badge': 'Plan d’exemple',
  'landing.frame.interested': 'Intéressé',
  'landing.frame.fits': 'Compatible avec ce plan',
  'landing.frame.authorized': 'Paiement autorisé',
  'landing.frame.slot1': 'Sam. 10:00–12:00',
  'landing.frame.slot1meta': '3 confirmés · 1 conditionnel',
  'landing.frame.slot2': 'Sam. 13:00–15:00',
  'landing.frame.slot2meta': '2 confirmés',
  'landing.frame.slot3': 'Dim. 10:00–12:00',
  'landing.frame.slot3meta': '1 confirmé',
  'landing.frame.suggested': 'Question suggérée — relue avant envoi',
  'landing.frame.question': '« Tout le matériel est inclus. Le samedi 10:00–12:00 vous conviendrait-il ? »',
  'landing.frame.condition': 'Condition de Diego : matériel inclus',
  'landing.frame.gap': 'Écart à combler :',
  'landing.frame.foot': 'Empreinte de l’offre 4a96… · chaque état monétaire est relu depuis le serveur',
  'landing.states.aria': 'Quatre états que GatherReady garde distincts',
  'landing.states.interested': 'Intéressé',
  'landing.states.interestedDetail': 'Une phrase écrite ou un horaire coché. Ne compte pas encore.',
  'landing.states.fits': 'Compatible avec ce plan',
  'landing.states.fitsDetail': 'Horaire exact confirmé. Seul ce nombre est compté.',
  'landing.states.authorized': 'Paiement autorisé',
  'landing.states.authorizedDetail': 'Une empreinte chez PayPal. Pas de l’argent reçu.',
  'landing.states.captured': 'Débité',
  'landing.states.capturedDetail': 'PayPal a confirmé que le commerçant a été payé. État final.',
  'landing.current.eyebrow': 'Atelier en cours',
  'landing.current.candidateTimes': '{count} horaires candidats',
  'landing.current.perPerson': 'par personne',
  'landing.current.statusConfirmed': 'Atelier confirmé',
  'landing.current.statusCancelled': 'Atelier annulé',
  'landing.current.statusOfferOpen': 'Offre ouverte à l’autorisation',
  'landing.current.statusCollecting': 'Collecte des intentions',
  'landing.current.openPlan': 'Ouvrir le plan de l’organisateur',
  'landing.current.openParticipant': 'Ouvrir une vue participant',
  'landing.current.seeResult': 'Voir le résultat',
  'landing.how.title': 'La boucle, sans le groupe de discussion',
  'landing.how.intro':
    'Manifester de l’intérêt est facile. Obtenir un nombre sur lequel agir ne l’est pas. Ces trois étapes sont tout le produit — le reste, c’est la sécurité financière en dessous.',
  'landing.how.step1.title': 'Lire la condition, pas l’humeur',
  'landing.how.step1.body':
    'Un participant écrit une phrase en désordre. Le modèle renvoie une fiche modifiable qui cite ses propres mots, et le participant la confirme. Rien ne compte avant ce clic.',
  'landing.how.step2.title': 'Poser au plus une question',
  'landing.how.step2.body':
    'Le solveur ne compte que les contraintes confirmées. Si un seul fait commerçant permet de combler l’écart, l’organisateur relit et envoie une seule question oui/non. Un « non » est définitif.',
  'landing.how.step3.title': 'Figer le plan, puis le financer',
  'landing.how.step3.body':
    'Une offre immuable avec une empreinte. Chacun la lit, consent et autorise le montant exact. L’organisateur ne débite qu’après l’atteinte du minimum d’autorisations.',
  'landing.honest.doesTitle': 'Ce que fait le prototype',
  'landing.honest.does1': 'Traduit un intérêt conditionnel en contraintes modifiables, avec citations mot pour mot.',
  'landing.honest.does2': 'Ne compte que les préférences confirmées et pose au plus une question par personne.',
  'landing.honest.does3': 'Fige une offre et lie chaque consentement à son empreinte avant PayPal.',
  'landing.honest.does4': 'Ne débite que lorsque chaque autorisation est valide et le minimum atteint.',
  'landing.honest.doesntTitle': 'Ce qu’il ne fait pas',
  'landing.honest.doesnt1': 'Déplacer de l’argent réel : cette version fonctionne uniquement dans la sandbox PayPal.',
  'landing.honest.doesnt2':
    'Envoyer des e-mails, ou lire des discussions privées, des calendriers ou des boîtes de réception.',
  'landing.honest.doesnt3': 'Laisser un modèle confirmer une préférence, décider qui participe ou toucher à un paiement.',
  'landing.honest.doesnt4': 'Prendre un onglet PayPal rouvert ou un bouton cliqué pour de l’argent reçu.',
  'landing.photo.bandAria': 'Contexte de l’atelier de poterie',
  'doc.setup': 'Créer un atelier',
  'doc.plan': 'Le plan',
  'doc.offer': 'Offre',
  'doc.funding': 'Collecte',
  'doc.result': 'Résultat',
  'doc.preferences': 'Vos préférences',
  'doc.clarify': 'Votre question',
  'doc.authorize': 'Vérifier et autoriser',
  'doc.invitation': 'Votre invitation',
  'doc.default': 'GatherReady — un plan accepté par tous',
  'common.errorTitle': 'Un problème est survenu',
  'common.loading': 'Chargement…',
  'common.loadErrorTitle': 'Impossible de charger cette page',
  'common.tryAgain': 'Réessayer',
  'common.auditSummary': 'Journal d’audit ({count} événements)',
  'common.fingerprintLabel': 'Empreinte de l’offre',
  'common.fingerprintHint': 'Toute modification d’une condition produit une empreinte différente.',
  'shell.extraction.prefix': 'Extraction :',
  'notfound.title': 'Cette page n’existe pas',
  'notfound.body': 'Le lien est peut-être obsolète. Les écrans sont listés dans le pied de page.',
  'notfound.back': 'Revenir à GatherReady',
  'link.opening': 'Ouverture de votre invitation…',
  'link.expiredSuffix': 'Ce lien a peut-être expiré, ou la session appartient à un autre participant.',
  'common.required': '(requis)',

  /* ------------------------------ workshop UI ----------------------------- */
  'workshop.statusAria': 'État actuel',
  'workshop.railsAria': 'Trois mesures de progression distinctes',
  'workshop.rail.match': 'Compatible avec ce plan',
  'workshop.rail.terms': 'Conditions confirmées',
  'workshop.rail.authorization': 'Autorisations valides',
  'workshop.stepsAria': 'Vos quatre états distincts',
  'workshop.state.accepted': 'Confirmé pour cet horaire',
  'workshop.state.preferred': 'Confirmé, aussi préféré',
  'workshop.state.conditional': 'Conditionnel — non compté',
  'workshop.state.cannot': 'Indisponible pour cet horaire',
  'workshop.state.unknown': 'Pas encore confirmé',
  'workshop.condition': 'Condition :',
  'workshop.theirWords': 'Ses mots :',
  'workshop.noCondition': 'Aucune condition sur cet horaire — confirmé directement.',
  'workshop.noConstraint': 'Aucune contrainte confirmée pour cet horaire.',
  'workshop.aiCard': 'Fiche AI',
  'workshop.ai.live': 'modèle en direct',
  'workshop.ai.recorded': 'enregistré',
  'workshop.ai.structured': 'structuré',
  'workshop.questionStatus': 'question {status}',
  'workshop.questionSent': 'Question déjà envoyée',
  'workshop.preparing': 'Préparation…',
  'workshop.askOne': 'Poser l’unique question',
  'workshop.openTheirView': 'Ouvrir sa vue',
  'workshop.meetsNote':
    'Cet horaire atteint déjà le minimum de {min}. Publier une offre fige le prix, l’horaire et les conditions ; chaque participant inclus doit tout de même la lire et l’autoriser.',
  'workshop.fitsNote':
    '{fits} confirmés · plafond {ceiling} (les personnes conditionnelles ne comptent jamais avant d’avoir répondu oui).',
  'workshop.matrix.title': 'Horaires candidats',
  'workshop.matrix.intro':
    'Disponibilités uniquement. Un horaire confirmé n’est pas un paiement : l’autorisation est une étape distincte que chaque participant doit faire.',
  'workshop.matrix.caption': 'Horaires candidats selon les disponibilités des participants',
  'workshop.matrix.time': 'Horaire',
  'workshop.matrix.confirmed': 'Confirmés',
  'workshop.matrix.ceiling': 'Plafond',
  'workshop.selected': 'sélectionné',
  'workshop.cardMeta': '{fits} confirmés · plafond {ceiling}',
  'workshop.meetsMinimum': 'minimum atteint',
  'workshop.legend.accepted': 'confirmé',
  'workshop.legend.preferred': 'préféré (aussi confirmé)',
  'workshop.legend.conditional': 'conditionnel — jamais compté',
  'workshop.legend.unknown': 'en pointillés = pas encore confirmé',
  'workshop.legend.cannot': 'confirmé, pas pour cet horaire',

  /* ------------------------------- PayPal UI ------------------------------ */
  'pay.paypal.checking': 'Vérification de la sandbox…',
  'pay.paypal.simulated': 'Paiement sandbox — sans argent réel',
  'pay.paypal.recording': 'Enregistrement de l’autorisation sandbox',
  'pay.paypal.authorizeSim': 'Autoriser {amount} dans la sandbox',
  'pay.paypal.opening': 'Ouverture de PayPal…',
  'pay.paypal.openingAria': 'Ouverture de PayPal',
  'pay.paypal.continue': 'Continuer vers PayPal pour autoriser {amount}',

  /* ---------------------------- landing extras ---------------------------- */
  'landing.hero.caption': 'Tournage · deux heures',
  'landing.gallery.title': 'Dans ces deux heures',
  'landing.gallery.intro':
    'Un atelier en activité, des pièces finies sur les étagères et de l’argile encore humide sur le tour. Ouvrez n’importe quelle image.',
  'landing.gallery.room': 'La salle',
  'landing.gallery.fresh': 'Tout juste tourné',
  'landing.gallery.shelves': 'Étagères de l’atelier',
  'landing.gallery.trimming': 'Tournassage',
  'landing.gallery.detail': 'Surface et texture',
  'landing.gallery.open': 'agrandir',
  'landing.gallery.close': 'Fermer l’image',
  'landing.gallery.dialog': 'Photos de l’atelier',
  'landing.gallery.credit': 'Images d’exemple · licence Pexels',
  'landing.frame.interactive': 'Aperçu interactif',
  'landing.frame.ask': 'Poser l’unique question',
  'landing.frame.asking': 'Question envoyée — en attente de Diego…',
  'landing.frame.waitingNote': 'En attente d’un oui…',
  'landing.frame.seePlan': 'Ouvrir le vrai plan',
  'landing.frame.yesKicker': 'Diego a dit oui',
  'landing.frame.yesBody':
    'Un seul oui confirmé comble l’écart : le meilleur horaire compte maintenant 4 confirmations retenues.',
  'landing.frame.diegoSaid': 'Diego : « oui, le samedi me va »',
  'landing.frame.again': 'Relancer',
  'landing.frame.tryNo': 'Essayer un non',
  'landing.frame.noKicker': 'Diego a dit non',
  'landing.frame.noBody':
    'Rien n’a été compté et personne n’a été pressé : le compte reste à 3, et l’organisateur peut interroger quelqu’un d’autre ou choisir un autre horaire.',
  'landing.frame.noNote': 'Aucun changement',
  'landing.frame.slot1metaYes': '4 confirmés · 0 conditionnel',

  /* ----------------------------- flow: actions ---------------------------- */
  'flow.action.setUpWorkshop': 'Créer un atelier',
  'flow.action.done': 'Terminé',
  'flow.participant.eyebrow': 'Participant · {name}',
  'flow.strip.minimum': 'minimum {count}',

  /* --------------------------- flow: status band -------------------------- */
  'flow.status.organizer.noWorkshop.headline': 'Pas encore d’atelier',
  'flow.status.organizer.noWorkshop.detail':
    'Créez d’abord les faits de l’activité : trois horaires candidats, le prix, le minimum et la date limite d’autorisation.',
  'flow.status.organizer.confirmed.headline': 'Atelier confirmé et débité',
  'flow.status.organizer.confirmed.detailOne': '{count} débit effectué · {amount} débité.',
  'flow.status.organizer.confirmed.detailMany': '{count} débits effectués · {amount} débité.',
  'flow.status.organizer.notConfirmed.headline': 'Atelier non confirmé',
  'flow.status.organizer.cancelling.detail':
    'Libération des autorisations et traitement des remboursements en cours.',
  'flow.status.organizer.cancelled.detail':
    'Cette session n’a pas atteint le minimum. Les empreintes ont été libérées ; tout débit effectué suit la politique d’annulation.',
  'flow.status.organizer.compensating.headline': 'Problème de collecte — compensation en cours',
  'flow.status.organizer.compensating.detail':
    'Les empreintes non débitées sont libérées et les débits effectués remboursés. Les lignes par personne font foi.',
  'flow.status.organizer.settling.headline': 'Collecte des paiements',
  'flow.status.organizer.settling.detail':
    'Lot verrouillé. Le serveur débite chaque autorisation et vérifie chaque résultat auprès de PayPal.',
  'flow.status.organizer.readyToCollect.headline':
    'Les autorisations atteignent le minimum — prêt à collecter',
  'flow.status.organizer.readyToCollect.detail':
    '{authorized} autorisations (pas des débits) · {amount} à collecter · clôture {deadline}.',
  'flow.status.organizer.offerOpen.headlineOne':
    'Offre publiée — {count} autorisation supplémentaire nécessaire',
  'flow.status.organizer.offerOpen.headlineMany':
    'Offre publiée — {count} autorisations supplémentaires nécessaires',
  'flow.status.organizer.offerOpen.detail':
    '{slot} · {authorized}/{minimum} autorisés (une autorisation n’est pas un débit) · clôture {deadline}.',
  'flow.status.organizer.workableSlot.headline':
    '{slot} atteint déjà le minimum de {minimum} personnes',
  'flow.status.organizer.workableSlot.detail':
    'Publiez une offre fixe. Après publication, le prix, l’horaire et les conditions sont figés et chaque participant doit la relire et l’autoriser.',
  'flow.status.organizer.questionOut.headline': 'Une question est envoyée — en attente de {name}',
  'flow.status.organizer.questionOut.detail':
    '« {question} » · seul le oui de la personne concernée compte pour le minimum.',
  'flow.status.organizer.suggestion.headlineOne':
    '{count} confirmation supplémentaire nécessaire pour atteindre le minimum de {minimum} personnes',
  'flow.status.organizer.suggestion.headlineMany':
    '{count} confirmations supplémentaires nécessaires pour atteindre le minimum de {minimum} personnes',
  'flow.status.organizer.suggestion.detail':
    'La condition de {name} : « {condition} » · un oui fait passer {slot} de {before} à {after}.',
  'flow.status.organizer.suggestion.noPath.detail':
    'Aucune condition ouverte ne comble l’écart. Il faut plus d’intérêt confirmé, ou un autre horaire.',
  'flow.status.organizer.noConfirmations.headline': 'Personne n’a encore confirmé de préférence',
  'flow.status.organizer.noConfirmations.detail':
    'L’intérêt ne compte qu’après confirmation par la personne elle-même. Aucun nombre ne peut être supposé pour l’instant.',
  'flow.status.organizer.noConfirmations.action': 'Voir la vue participant',
  'flow.status.organizer.recompute': 'Recalculer le plan',
  'flow.status.action.seeResult': 'Voir le résultat',
  'flow.status.action.openFunding': 'Ouvrir la collecte',
  'flow.status.action.watchFunding': 'Suivre la collecte',
  'flow.status.action.confirmAndCollect': 'Confirmer et collecter',
  'flow.status.action.publishTheOffer': 'Publier l’offre',
  'flow.status.action.seeQuestion': 'Voir la question',
  'flow.status.action.askTheOneQuestion': 'Poser l’unique question',
  'flow.status.rails.noWorkshop.matchDetail': 'Pas encore d’atelier',
  'flow.status.rails.notSelected': 'Pas encore sélectionné',
  'flow.status.rails.noOfferPublished': 'Aucune offre publiée',
  'flow.status.rails.nothingToAuthorize': 'Rien à autoriser',
  'flow.status.rails.matchMet': 'Un horaire atteint le minimum',
  'flow.status.rails.matchBest': 'Confirmations retenues pour le meilleur horaire',
  'flow.status.rails.selectedVersion': 'Sélectionné · v{version}',
  'flow.status.rails.termsDetail': '{slot} · empreinte {hash}',
  'flow.status.rails.publishToFreeze': 'Publiez une offre fixe pour figer les conditions',
  'flow.status.rails.capturedCharged': '{count} débités',
  'flow.status.rails.authorizedNotCharged': 'Autorisé, pas encore débité',
  'flow.status.rails.noAuthorization': 'Pas encore d’autorisation',
  'flow.status.participant.step.interest': 'Intérêt',
  'flow.status.participant.step.interest.confirmed': 'Confirmé · v{version}',
  'flow.status.participant.step.interest.parsed': 'Analysé, non confirmé',
  'flow.status.participant.step.interest.empty': 'Pas encore écrit',
  'flow.status.participant.step.terms': 'Conditions',
  'flow.status.participant.step.terms.agreed': 'Accepté · offre v{version}',
  'flow.status.participant.step.terms.current': 'Offre publiée — à lire et à consentir',
  'flow.status.participant.step.terms.waiting':
    'L’organisateur n’a pas publié de plan qui vous inclut',
  'flow.status.participant.step.authorization': 'Autorisation (empreinte)',
  'flow.status.participant.step.authorization.authorized': 'Autorisé — pas débité',
  'flow.status.participant.step.authorization.charged': 'Débité',
  'flow.status.participant.step.authorization.capturing': 'Débit en cours',
  'flow.status.participant.step.authorization.failed': 'Vérification d’état nécessaire',
  'flow.status.participant.step.authorization.holdOnly': 'Une empreinte seulement, jamais un débit',
  'flow.status.participant.step.charge': 'Débit / annulation',
  'flow.status.participant.step.charge.charged': 'Débité — atelier confirmé',
  'flow.status.participant.step.charge.refunded': 'Non confirmé — remboursé',
  'flow.status.participant.step.charge.refunding': 'Non confirmé — remboursement en cours',
  'flow.status.participant.step.charge.voided': 'Non confirmé — empreinte libérée',
  'flow.status.participant.step.charge.failed': 'Résultat inconnu, rapprochement en cours',
  'flow.status.participant.step.charge.waiting': 'N’a lieu que si l’atelier est confirmé',
  'flow.status.participant.noWorkshop.headline': 'Pas encore d’atelier à rejoindre',
  'flow.status.participant.noWorkshop.detail': 'L’organisateur n’a pas publié les faits de l’activité.',
  'flow.status.participant.noPreference.headline': 'Vous n’avez pas encore exprimé de préférence',
  'flow.status.participant.noPreference.detail':
    'Écrivez une phrase ou cochez les horaires qui vous vont, puis confirmez-la vous-même. Seules les contraintes confirmées comptent.',
  'flow.status.participant.noPreference.action': 'Exprimer ma préférence',
  'flow.status.participant.notConfirmed.headline': 'Votre préférence n’est pas encore confirmée',
  'flow.status.participant.notConfirmed.detail':
    'Vérifiez les horaires et la condition sur la fiche, puis confirmez. Rien ne compte avant ce clic.',
  'flow.status.participant.notConfirmed.action': 'Vérifier et confirmer',
  'flow.status.participant.failed.headline':
    'L’état de votre paiement nécessite une vérification',
  'flow.status.participant.failed.detail':
    'Le serveur interroge PayPal en premier et ne débite jamais deux fois. L’état par paiement fait foi.',
  'flow.status.participant.failed.action': 'Ouvrir mon état',
  'flow.status.participant.refunded.headline': 'Non confirmé — remboursé',
  'flow.status.participant.refunded.detail':
    'PayPal a confirmé le remboursement. La demande seule n’est jamais présentée comme un remboursement effectué.',
  'flow.status.participant.refunding.headline': 'Non confirmé — remboursement en cours',
  'flow.status.participant.refunding.detail':
    'Le remboursement a été demandé mais PayPal ne l’a pas encore confirmé : il n’est donc pas affiché comme remboursé.',
  'flow.status.participant.voided.headline': 'Non confirmé — empreinte libérée',
  'flow.status.participant.voided.detail': 'Rien n’a été débité ; l’autorisation a été libérée.',
  'flow.status.participant.charged.headline': 'Atelier confirmé — paiement débité',
  'flow.status.participant.charged.detail':
    'Vous avez payé {amount}. L’atelier est confirmé par le résultat de la collecte de l’organisateur.',
  'flow.status.participant.authorized.headline': 'Autorisé — pas encore débité',
  'flow.status.participant.authorized.detail':
    'Votre autorisation bloque {amount} sans le débiter. Elle n’est débitée que si l’atelier est confirmé ; sinon, elle est libérée.',
  'flow.status.participant.authorized.action': 'Vérifier mon autorisation',
  'flow.status.participant.inOffer.headline':
    'Le plan est publié — votre relecture des conditions est la prochaine étape',
  'flow.status.participant.inOffer.detail':
    'Conditions figées : {slot} · {amount} · minimum {minimum}. Une autorisation est une empreinte, pas un débit.',
  'flow.status.participant.inOffer.action': 'Vérifier et autoriser',
  'flow.status.participant.waiting.headline':
    'Votre préférence est confirmée — en attente de la publication d’un plan par l’organisateur',
  'flow.status.participant.waiting.detail':
    'Quand une offre fixe existera, vous lirez les conditions exactes et autoriserez ; une autorisation est une empreinte, pas un débit.',
  'flow.status.participant.moneyNotes':
    '{amount} · minimum {minimum} · clôture {deadline} · si l’atelier ne se forme pas : empreintes libérées et débits effectués remboursés',
  'workshop.questionAnsweredYes': 'répondue — oui',
  'workshop.questionAnsweredNo': 'répondue — non',
  'workshop.questionSentStatus': 'envoyée',
  'workshop.questionProposedStatus': 'proposée',

  /* ------------------------- flow: organizer plan ------------------------- */
  'flow.plan.empty.body': 'L’écran d’accueil apparaît une fois les faits de l’activité renseignés.',
  'flow.plan.eyebrow': 'Organisateur',
  'flow.plan.title': 'Accueil de l’atelier',
  'flow.plan.intro':
    'Ce qui est vrai maintenant, qui correspond à quel horaire, et la prochaine action. La disponibilité n’est pas un paiement : l’autorisation est une étape distincte.',
  'flow.plan.recompute': 'Recalculer',
  'flow.plan.recomputing': 'Recalcul…',
  'flow.plan.strip.aria': 'Faits de l’atelier',
  'flow.plan.strip.perPerson': '{amount} par personne',
  'flow.plan.notice.errorTitle': 'L’opération a échoué',
  'flow.plan.notice.questionSent':
    'Question envoyée à {name}. C’est l’unique question que cette personne recevra.',
  'flow.plan.notice.recomputed': 'Plan recalculé à partir des dernières préférences confirmées.',
  'flow.plan.preparing': 'Préparation…',
  'flow.plan.question.title': 'Question suggérée',
  'flow.plan.question.titleFor': 'Question suggérée pour {name}',
  'flow.plan.question.sent': 'Envoyée · en attente d’une réponse',
  'flow.plan.question.proposed': 'Proposée · pas encore envoyée',
  'flow.plan.question.notSent': 'Pas encore envoyée',
  'flow.plan.question.why':
    '{label} : {value} · l’écart se comble de {before} à {after} confirmations.',
  'flow.plan.question.whyOnly': 'Seul le oui de ce participant compte pour le minimum.',
  'flow.plan.question.sending': 'Envoi…',
  'flow.plan.question.send': 'Envoyer la question à {name}',
  'flow.plan.question.sentNote':
    'La question est dans sa vue participant. Un « non » est définitif et n’est jamais reposé.',
  'flow.plan.question.review': 'Relire la question',
  'flow.plan.question.source': 'Source du libellé : AI ou gabarit, consigné dans le journal d’audit.',
  'flow.plan.matrix.best':
    'Meilleur horaire pour l’instant : {slot} · {count} confirmations retenues · plafond {ceiling}. Un horaire confirmé n’est pas un paiement ; chaque personne incluse relit encore l’offre figée et autorise séparément.',
  'flow.plan.tech.summary': 'Détails techniques (empreinte des entrées du plan, audit, logique de cet ordre)',
  'flow.plan.tech.rules':
    'Règles déterministes, pas un score de modèle : confirmations retenues d’abord, moins de conditions en attente ensuite, puis les correspondances préférées, puis l’horaire le plus tôt. Les mêmes entrées produisent toujours le même plan.',
  'flow.plan.tech.hashLabel': 'Empreinte des entrées du plan :',

  /* ---------------------- flow: participant preferences ------------------- */
  'flow.preferences.extraction.live':
    'Extrait par un modèle en direct. Vérifiez et modifiez avant de confirmer — le modèle n’a jamais le dernier mot.',
  'flow.preferences.extraction.liveWithModel':
    'Extrait par un modèle en direct ({model}). Vérifiez et modifiez avant de confirmer — le modèle n’a jamais le dernier mot.',
  'flow.preferences.extraction.recorded':
    'Extraction enregistrée : échantillon fixe, pas une réponse de modèle en direct pour un texte quelconque. Vérifiez et modifiez avant de confirmer.',
  'flow.preferences.extraction.structured':
    'Structuré : construit uniquement à partir des horaires cochés et de la condition saisie. Aucun AI n’a été utilisé.',
  'flow.preferences.extraction.seeded':
    'Préférence préremplie. Vérifiez et modifiez avant de confirmer.',
  'flow.preferences.extraction.label.live': 'Extraction par modèle en direct',
  'flow.preferences.extraction.label.recorded': 'Extraction d’échantillon enregistré',
  'flow.preferences.extraction.label.structured': 'Structuré — sans AI',
  'flow.preferences.extraction.label.seeded': 'Extraction préremplie',
  'flow.preferences.empty.noWorkshop.title': 'Pas encore d’atelier à commenter',
  'flow.preferences.empty.noWorkshop.action': 'Créer l’atelier',
  'flow.preferences.empty.noWorkshop.body':
    'L’organisateur n’a pas publié d’atelier. Dès qu’il le fera, cette page affichera les trois horaires candidats.',
  'flow.preferences.empty.organizer.title': 'Cette page appartient à un participant',
  'flow.preferences.empty.organizer.body':
    'La session actuelle est une vue organisateur. Utilisez le sélecteur de vue ci-dessus pour agir en tant que participant.',
  'flow.preferences.title': 'Qu’est-ce qui rendrait cet atelier possible pour vous ?',
  'flow.preferences.intro':
    'Répondez avec vos mots, ou cochez simplement les horaires qui vous vont. Nous en faisons une fiche courte et vérifiable — rien ne compte avant votre confirmation.',
  'flow.preferences.badge.confirmed': 'Confirmé',
  'flow.preferences.badge.withdrawn': 'Retiré',
  'flow.preferences.badge.unconfirmed': 'Pas encore confirmé',
  'flow.preferences.strip.aria': 'L’atelier',
  'flow.preferences.notice.errorTitle': 'Rien n’a été enregistré',
  'flow.preferences.error.needSomething': 'Écrivez une phrase ou cochez au moins un horaire.',
  'flow.preferences.error.needTime':
    'Choisissez au moins un horaire qui vous va — ou retirez-vous.',
  'flow.preferences.error.preferredMustBeAccepted':
    'Un horaire préféré doit aussi être un horaire qui vous va.',
  'flow.preferences.notice.confirmed':
    'Préférences confirmées. Rien n’a été partagé avec les autres participants ; l’organisateur ne voit que vos contraintes.',
  'flow.preferences.notice.withdrawn':
    'Vous vous êtes retiré. Vous n’êtes pas compté dans le plan et vous ne serez plus sollicité.',
  'flow.preferences.answer.changeTitle': 'Modifier votre réponse',
  'flow.preferences.answer.title': 'Votre réponse',
  'flow.preferences.answer.equalPaths':
    'Les deux chemins se valent : si vous préférez ne pas écrire de texte libre, les cases ci-dessous fonctionnent sans aucun AI. Partez de l’un ou de l’autre pour reconstruire la fiche en dessous.',
  'flow.preferences.answer.purpose':
    'Mention d’usage : votre phrase est envoyée uniquement au service de modèle configuré pour extraire ces contraintes. Elle n’est pas écrite dans les journaux et les données de cette version sont supprimées sous 7 jours. Cette version est une sandbox — aucun argent réel ne circule.',
  'flow.preferences.free.heading': 'Avec vos mots',
  'flow.preferences.free.label': 'Votre phrase',
  'flow.preferences.free.hint':
    '{count}/600 caractères. Conservée uniquement pour cet atelier ; l’organisateur voit les contraintes, pas vos raisons privées.',
  'flow.preferences.free.placeholder': 'Le samedi matin me va si tout le matériel est inclus…',
  'flow.preferences.free.extracting': 'Extraction…',
  'flow.preferences.free.extract': 'Extraire les conditions',
  'flow.preferences.structured.heading': 'Ou cochez simplement ce qui vous va',
  'flow.preferences.structured.legend': 'Horaires qui vous vont',
  'flow.preferences.structured.conditionLabel': 'Facultatif : qu’est-ce qui doit être vrai ?',
  'flow.preferences.structured.conditionHint':
    'Une condition au maximum. L’organisateur peut poser au commerçant exactement une question oui/non à ce sujet.',
  'flow.preferences.structured.conditionPlaceholder': 'Si tout le matériel est inclus…',
  'flow.preferences.structured.conditionSlot': 'À quel horaire la condition s’applique-t-elle ?',
  'flow.preferences.structured.building': 'Construction…',
  'flow.preferences.structured.useTimes': 'Utiliser ces horaires',
  'flow.preferences.footnote':
    'Changé d’avis ? Vous pouvez confirmer une nouvelle version jusqu’à la fermeture de l’offre, et vous retirer sans motif.',
  'flow.preferences.compose.times': 'Ces horaires me vont : {times}.',
  'flow.preferences.compose.condition': 'Ma condition : {condition}.',
  'flow.preferences.review.title': 'Vérifier ce que nous avons compris',
  'flow.preferences.review.sourceLabel': 'Votre phrase, mot pour mot',
  'flow.preferences.review.mustHave': 'Indispensable',
  'flow.preferences.review.mustHaveHint': 'horaires qui vous vont',
  'flow.preferences.review.preferred': 'Préféré',
  'flow.preferences.review.preferredHint': 'un plus, jamais une obligation',
  'flow.preferences.review.clarify': 'Nécessite une clarification',
  'flow.preferences.review.clarifyHint': 'au plus une question par personne',
  'flow.preferences.review.dependsOnCondition': 'Cet horaire dépend de la condition ci-dessous.',
  'flow.preferences.review.tickFirst': 'Cochez d’abord un horaire sous « Indispensable ».',
  'flow.preferences.review.nothingToClarify': 'Rien à clarifier dans votre réponse.',
  'flow.preferences.review.conditionLabel': 'Condition {index}',
  'flow.preferences.review.conditionHint':
    'En langage clair, une seule condition. L’organisateur peut poser au commerçant une question oui/non à ce sujet.',
  'flow.preferences.review.appliesTo': 'S’applique à',
  'flow.preferences.review.conditionQuoteLabel': 'Extrait de votre phrase, mot pour mot',
  'flow.preferences.review.removeCondition': 'Supprimer la condition',
  'flow.preferences.review.needsClarificationBadge': 'Nécessite une clarification',
  'flow.preferences.review.questionPolicy':
    'Une question n’est posée que si un fait commerçant pourrait changer le fait que cet horaire vous convienne. Vous pouvez répondre oui ou non, et un non est respecté.',
  'flow.preferences.review.promiseTitle': 'Rien ne compte avant votre confirmation.',
  'flow.preferences.review.promiseRest':
    'D’ici là, votre réponse est un brouillon que vous seul pouvez voir.',
  'flow.preferences.review.confirming': 'Confirmation…',
  'flow.preferences.review.confirm': 'Confirmer mes préférences',
  'flow.preferences.withdraw.summary': 'Se retirer de cet atelier',
  'flow.preferences.withdraw.bodyDraft':
    'Vous retirer vous supprime immédiatement du plan. Vous n’êtes pas compté, vous n’êtes plus sollicité, et personne n’est débité en votre nom.',
  'flow.preferences.withdraw.withdrawing': 'Retrait…',
  'flow.preferences.withdraw.button': 'Retirer mes préférences',
  'flow.preferences.review.shared': 'Partagé avec le commerçant : {times}.',
  'flow.preferences.review.sharedWithConditions':
    'Partagé avec le commerçant : {times} ; conditions : {conditions}.',
  'flow.preferences.review.nothingYet': 'rien pour l’instant',
  'flow.preferences.confirmed.title': 'Préférences confirmées',
  'flow.preferences.confirmed.meta': 'Confirmé {when}. Version {version}.',
  'flow.preferences.confirmed.version': 'Version {version}.',
  'flow.preferences.confirmed.mustHave': 'Indispensable',
  'flow.preferences.confirmed.preferred': 'Préféré',
  'flow.preferences.confirmed.noPreference': 'Aucune préférence entre eux',
  'flow.preferences.confirmed.needsFact': 'Encore besoin d’un fait commerçant',
  'flow.preferences.confirmed.conditionSuffix': 'ne fonctionne que si {condition}.',
  'flow.preferences.confirmed.quoteLabel': 'Vos mots, mot pour mot',
  'flow.preferences.confirmed.questionNote':
    'Au plus une question oui/non peut vous être envoyée à ce sujet. Ce n’est pas un engagement.',
  'flow.preferences.confirmed.reviewOffer': 'Relire l’offre ouverte',
  'flow.preferences.confirmed.update': 'Relire et mettre à jour mes préférences',
  'flow.preferences.confirmed.withdrawBody':
    'Vous retirer vous supprime immédiatement du plan et libère toute empreinte. Personne n’est débité en votre nom.',

  /* ---------------------- flow: participant authorize --------------------- */
  'flow.authorize.empty.noWorkshop.title': 'Pas encore d’atelier',
  'flow.authorize.empty.noWorkshop.body':
    'L’organisateur n’a pas créé d’atelier. Il n’y a rien à autoriser.',
  'flow.authorize.empty.organizer.title': 'Cette page appartient à un participant',
  'flow.authorize.empty.organizer.body':
    'Utilisez le sélecteur de vue ci-dessus pour agir en tant que participant.',
  'flow.authorize.noOffer.title': 'Pas encore d’offre fixe',
  'flow.authorize.noOffer.emptyTitle': 'Rien à autoriser pour l’instant',
  'flow.authorize.noOffer.body':
    'L’organisateur n’a pas publié d’offre fixe. Vos préférences confirmées comptent toujours, et rien ne peut être débité avant que vous ayez lu l’offre complète et accepté.',
  'flow.authorize.noOffer.link': 'Vos préférences',
  'flow.authorize.notIncluded.title': 'Cette offre ne vous inclut pas',
  'flow.authorize.notIncluded.emptyTitle': 'Vous n’êtes pas compté dans cette offre',
  'flow.authorize.notIncluded.leadBefore': 'L’organisateur a publié une offre pour ',
  'flow.authorize.notIncluded.leadAfter':
    ', mais votre préférence confirmée n’accepte pas cet horaire. Rien ne sera débité et votre préférence reste telle que vous l’avez définie.',
  'flow.authorize.notIncluded.link': 'Relire vos préférences',
  'flow.authorize.title': 'Vérifier et autoriser',
  'flow.authorize.intro':
    'Lisez tout le récapitulatif ci-dessous. Rien n’est débité maintenant — cela crée une autorisation PayPal temporaire pour le montant total exact, débitée uniquement si l’atelier est confirmé.',
  'flow.authorize.errorTitle': 'Rien n’a été débité',
  'flow.authorize.offer.title': '1 · L’offre fixe',
  'flow.authorize.offer.meta':
    '{slot} · version de l’offre {version}. Chaque ligne ci-dessous fait partie de l’offre, pas d’un résumé rédigé après coup.',
  'flow.authorize.offer.chip': 'Sandbox · sans argent réel',
  'flow.authorize.offer.totalLabel': 'Total si l’atelier est confirmé',
  'flow.authorize.offer.totalNote':
    'Débité une seule fois, uniquement quand au moins {minimum} personnes sont autorisées et que la date limite d’autorisation n’est pas passée.',
  'flow.authorize.offer.techSummary': 'Détails techniques (empreinte de l’offre)',
  'flow.authorize.consent.title': '2 · Votre accord',
  'flow.authorize.consent.hint':
    'Cette case est volontairement décochée. Rien ne se passe avant que vous la cochiez et appuyiez sur le bouton.',
  'flow.authorize.pay.title': '3 · Autorisation',
  'flow.authorize.checking.headline': 'Vérification auprès de PayPal',
  'flow.authorize.checking.body':
    'Votre navigateur revient de PayPal. Cet écran n’affiche que ce que le serveur rapporte — un bouton cliqué n’est pas un paiement, nous attendons donc l’arrivée de l’état d’autorisation.',
  'flow.authorize.checking.waitingServer': 'En attente du serveur',
  'flow.authorize.checking.refresh':
    'Cette page s’actualise toutes les 4 secondes pendant que l’autorisation est en cours.',
  'flow.authorize.authorized.headline': 'Autorisé — pas encore débité',
  'flow.authorize.authorized.body':
    'Votre compte PayPal porte une autorisation temporaire de {amount}. L’atelier n’est payé que s’il est confirmé avec assez de personnes ; sinon, l’empreinte est libérée et rien n’est débité.',
  'flow.authorize.authorized.amount': 'Montant',
  'flow.authorize.authorized.authorization': 'Autorisation',
  'flow.authorize.authorized.mode': 'Mode de paiement',
  'flow.authorize.authorized.simulated': 'Sandbox',
  'flow.authorize.authorized.sandbox': 'Sandbox PayPal',
  'flow.authorize.withdraw.summary': 'Retirer cette autorisation',
  'flow.authorize.withdraw.body':
    'Vous pouvez vous retirer avant que l’organisateur ne débite, et l’empreinte est libérée. Rien n’est débité. Si l’atelier est déjà réglé, le résultat est affiché sur la page de résultat.',
  'flow.authorize.withdraw.withdrawing': 'Retrait…',
  'flow.authorize.withdraw.button': 'Retirer l’autorisation',
  'flow.authorize.settled.changed': 'Votre autorisation a changé',
  'flow.authorize.settled.statusFromServer':
    '{status}. Cet état vient du serveur, pas d’un clic sur un bouton.',
  'flow.authorize.settled.voided': 'L’empreinte temporaire a été libérée. Rien n’a été débité.',
  'flow.authorize.settled.refunded': 'Le remboursement a été confirmé par PayPal.',
  'flow.authorize.settled.refunding':
    'Un remboursement a été demandé mais n’est pas encore confirmé — nous ne l’appelons pas remboursé tant que PayPal ne l’a pas dit.',
  'flow.authorize.settled.manual':
    'Un résultat incertain nécessite une vérification humaine auprès de PayPal. Rien n’est retenté automatiquement.',
  'flow.authorize.pay.simulatedStrong': 'Mode sandbox.',
  'flow.authorize.pay.simulatedRest':
    'Aucun compte PayPal n’est contacté et aucun argent ne circule ; le reste du parcours est inchangé.',
  'flow.authorize.pay.sandboxNote':
    'Vous serez redirigé vers la sandbox PayPal pour autoriser le montant total exact. Aucun argent réel n’est impliqué.',
  'flow.authorize.pay.afterConsent':
    'Quand vous appuyez sur le bouton, vous êtes redirigé vers PayPal. Revenir ne signifie pas que vous avez payé — nous relisons l’état de l’autorisation depuis le serveur.',
  'flow.authorize.pay.beforeConsent':
    'Cochez la case d’accord ci-dessus pour activer le contrôle de paiement. Il reste désactivé tant que ce n’est pas fait.',
  'flow.authorize.footnote':
    'Changé d’avis ? Vous pouvez vous retirer avant le débit. Si l’atelier n’est pas confirmé, chaque empreinte est libérée et rien n’est débité.',
  'flow.authorize.error.noCheckout':
    'Le serveur n’a pas renvoyé de paiement. Rien n’a été débité et aucune empreinte n’a été créée.',
  'flow.authorize.notice.mock':
    'Simulation de développement : remplace l’étape d’approbation PayPal. Aucun compte PayPal n’est contacté.',
  'flow.authorize.error.noApproveLink':
    'Le serveur n’a pas renvoyé de lien d’approbation. Rien n’a été débité.',
  'flow.authorize.notice.withdrawn':
    'Votre autorisation a été retirée et l’empreinte est en cours de libération. Rien n’a été débité.',

  /* ---------------------------- money: shared ----------------------------- */
  'money.shared.organizer': 'Organisateur',
  'money.shared.noWorkshopTitle': 'Pas encore d’atelier',
  'money.shared.setupWorkshop': 'Créer un atelier',
  'money.shared.backToPlan': 'Retour au plan',
  'money.shared.simulatedChip': 'Sandbox PayPal — sans argent réel',

  /* ----------------------------- money: offer ----------------------------- */
  'money.offer.eyebrow': 'Organisateur · Offre',
  'money.offer.publishedTitle': 'Offre publiée',
  'money.offer.publishedIntro':
    'Ces conditions sont fixes. Les participants voient exactement ce récapitulatif, mot pour mot, avant tout bouton PayPal.',
  'money.offer.statusOpen': 'Offre ouverte à l’autorisation',
  'money.offer.stripAria': 'Atelier',
  'money.offer.perPerson': 'par personne',
  'money.offer.stripMinimum': 'minimum {min}',
  'money.offer.frozenHeadline': '{slot} · conditions figées',
  'money.offer.frozenDetailOne':
    '{count} confirmation retenue · {price} · minimum {min} · clôture {deadline}.',
  'money.offer.frozenDetailMany':
    '{count} confirmations retenues · {price} · minimum {min} · clôture {deadline}.',
  'money.offer.openFunding': 'Ouvrir la collecte',
  'money.offer.publishErrorTitle': 'L’opération a échoué',
  'money.offer.immutableTerms': 'Conditions immuables',
  'money.offer.versionLine': 'version {version} · {state}',
  'money.offer.state.draft': 'brouillon',
  'money.offer.state.open': 'ouverte',
  'money.offer.state.closed': 'fermée',
  'money.offer.state.settled': 'réglée',
  'money.offer.state.cancelled': 'annulée',
  'money.offer.fingerprintBadge': 'Empreinte {hash}',
  'money.offer.lockTitle': 'Toute modification exige désormais une nouvelle offre',
  'money.offer.lockLead': 'Cette offre est verrouillée sur l’empreinte ',
  'money.offer.lockTail':
    '. Toute modification d’une condition — prix, horaire, lieu, inclusions, minimum — exige de publier une nouvelle offre, et chaque participant doit la relire et consentir à nouveau. Aucune offre en cours ne peut être modifiée discrètement.',
  'money.offer.included': 'Participants inclus : {names} ({count} sur un minimum de {min}).',
  'money.offer.noFitList':
    'Aucune liste de confirmations retenues n’est disponible pour cet horaire.',
  'money.offer.seeParticipant': 'Voir la vue participant',
  'money.offer.techOfferSummary': 'Détails techniques (empreinte de l’offre, audit)',
  'money.offer.noWorkshopBody': 'L’offre est construite à partir des faits de l’atelier et du plan.',
  'money.offer.publishTitle': 'Publier une offre fixe',
  'money.offer.publishIntro':
    'Un horaire, un prix, un jeu de conditions. Après publication, rien ne peut être modifié sur place — un changement signifie une nouvelle offre et un nouveau consentement de chaque participant.',
  'money.offer.blockedHeadline': 'Aucun horaire n’atteint encore le minimum',
  'money.offer.blockedDetail':
    'La publication est bloquée tant qu’un horaire n’a pas au moins {min} confirmations retenues. Posez l’unique question sur le plan, ou attendez une autre confirmation.',
  'money.offer.chooseHeadline': 'Choisissez un horaire et confirmez les conditions',
  'money.offer.chooseDetail':
    'Seul un horaire avec au moins {min} confirmations retenues peut être proposé. La publication fige le prix, l’horaire et les conditions pour tous.',
  'money.offer.notPublishedTitle': 'L’offre n’a pas été publiée',
  'money.offer.planMissingTitle': 'Le plan n’est pas encore calculé',
  'money.offer.planMissingBody':
    'Une offre ne peut être publiée que pour un horaire qui atteint le minimum.',
  'money.offer.candidateTimes': 'Horaires candidats',
  'money.offer.candidateIntro':
    'Seules les confirmations retenues comptent. Un participant conditionnel ne compte jamais avant d’avoir répondu oui ; un horaire confirmé n’est toujours pas un paiement.',
  'money.offer.slotMetaMetOne': '{count} confirmation retenue · minimum atteint ({min})',
  'money.offer.slotMetaMetMany': '{count} confirmations retenues · minimum atteint ({min})',
  'money.offer.slotMetaNeedsOne':
    '{count} confirmation retenue · {more} de plus nécessaire',
  'money.offer.slotMetaNeedsMany':
    '{count} confirmations retenues · {more} de plus nécessaires',
  'money.offer.meetsMinimum': 'Minimum atteint',
  'money.offer.blocked': 'Bloqué',
  'money.offer.previewTitle': 'Le récapitulatif exact que verront les participants',
  'money.offer.previewIntro':
    'L’ordre est fixe : commerçant, atelier, date et heure, fuseau horaire, lieu, inclusions, total, minimum, date limite d’autorisation, annulation, en cas d’échec de la collecte.',
  'money.offer.previewFoot':
    'L’empreinte est calculée par le serveur sur exactement ces conditions au moment de la publication.',
  'money.offer.merchantConfirmTitle': 'Confirmation du commerçant',
  'money.offer.merchantConfirmLabel':
    'Je confirme que ces conditions sont définitives pour cette offre.',
  'money.offer.merchantConfirmHint':
    'La publication verrouille le prix, l’horaire, le lieu, les inclusions et le minimum. Tout changement ultérieur exige une nouvelle offre et un nouveau consentement de chaque participant.',
  'money.offer.publishing': 'Publication…',
  'money.offer.publish': 'Publier l’offre',
  'money.offer.selectTimeHint':
    'Sélectionnez un horaire qui atteint le minimum pour voir les conditions exactes. Aucune publication n’est possible pour un horaire encore en deçà de {min} participants confirmés.',
  'money.offer.techPlanSummary': 'Détails techniques (empreinte des entrées du plan, audit)',
  'money.offer.planInputsHash': 'Empreinte des entrées du plan :',
  'money.offer.error.chooseTime': 'Choisissez un horaire pour l’offre.',
  'money.offer.error.notMinimum':
    'Cet horaire n’atteint pas encore le minimum, il ne peut donc pas être proposé.',
  'money.offer.error.confirmTerms': 'Vous devez confirmer les conditions avant de publier.',
  'money.offer.term.merchant': 'Commerçant',
  'money.offer.term.workshop': 'Atelier',
  'money.offer.term.dateTime': 'Date et heure',
  'money.offer.term.timezone': 'Fuseau horaire',
  'money.offer.term.venue': 'Lieu',
  'money.offer.term.includes': 'Inclusions',
  'money.offer.term.total': 'Total',
  'money.offer.term.minimum': 'Minimum',
  'money.offer.term.deadline': 'Date limite d’autorisation',
  'money.offer.term.cancellation': 'Annulation',
  'money.offer.term.failure': 'En cas d’échec de la collecte',
  'money.offer.term.minimumValue': '{min} participants (maximum {max})',

  /* ---------------------------- money: funding ---------------------------- */
  'money.funding.noWorkshopBody':
    'La collecte apparaît quand une offre est ouverte et que des personnes ont autorisé.',
  'money.funding.eyebrow': 'Organisateur · étape 4',
  'money.funding.title': 'Collecte',
  'money.funding.intro':
    '« Autorisé » est une empreinte, pas de l’argent reçu. Le débit n’a lieu qu’une fois, seulement quand tout le plan est réel — et le serveur revérifie chaque ligne avant.',
  'money.funding.nothingCaptured': 'Rien n’a été débité',
  'money.funding.summaryAria': 'Récapitulatif des autorisations',
  'money.funding.summaryAuthorized': 'Autorisé',
  'money.funding.summaryHeld': 'Empreinte (non débitée)',
  'money.funding.summaryCaptured': 'Débité',
  'money.funding.ofMinimum': 'sur un minimum de {min}',
  'money.funding.peopleTitle': 'Chronologie monétaire par personne',
  'money.funding.peopleIntro':
    'En attente de validation → Autorisé → Débit en cours → Débité. Une empreinte qui se termine sans débit est affichée comme libérée ; un remboursement n’apparaît qu’une fois confirmé par PayPal.',
  'money.funding.noPayments': 'Personne n’a encore commencé d’autorisation.',
  'money.funding.you': '(vous)',
  'money.funding.modeSimulated': 'Sandbox PayPal',
  'money.funding.modeSandbox': 'Sandbox PayPal',
  'money.funding.providerStatus': 'État du fournisseur : {status}',
  'money.funding.timelineAria': 'Chronologie monétaire : {word}',
  'money.funding.step.awaiting': 'En attente de validation',
  'money.funding.step.authorized': 'Autorisé',
  'money.funding.step.collecting': 'Débit en cours',
  'money.funding.step.captured': 'Débité',
  'money.funding.endedVoided': 'Terminé : empreinte libérée',
  'money.funding.endedRefund': 'Terminé : parcours de remboursement',
  'money.funding.endedAttention': 'Terminé : nécessite une intervention',
  'money.funding.batchTitle': 'Lot de règlement',
  'money.funding.batchMeta':
    '{count} participants · verrouillé avant tout débit · date limite {deadline}',
  'money.funding.expectedTotal': 'Total attendu',
  'money.funding.captured': 'Débité',
  'money.funding.refundedConfirmed': 'Remboursé (confirmé)',
  'money.funding.batchImmutable':
    'L’appartenance au lot est immuable. Une seconde demande de « collecte » renvoie ce même lot au lieu d’en créer un autre.',
  'money.funding.seeResult': 'Voir le résultat',
  'money.funding.noBatchTitle': 'Aucun lot verrouillé pour l’instant',
  'money.funding.noBatchBody':
    'Un lot n’est créé que lorsque le serveur vérifie que l’offre est ouverte, que la date limite n’est pas passée, que le nombre d’autorisations est compris entre {min} et {capacity}, et que chaque autorisation correspond au montant et à l’empreinte de l’offre. D’ici là, il n’y a ni lot ni total à afficher.',
  'money.funding.collectTitle': 'Confirmer l’atelier et collecter',
  'money.funding.settledBody':
    'Le règlement a déjà eu lieu. Le résultat du serveur est sur la page de résultat ; l’argent débité n’est jamais deviné dans le navigateur.',
  'money.funding.collectPre':
    'C’est le seul bouton de GatherReady qui déplace de l’argent. Il demande au serveur de débiter ',
  'money.funding.collectAmountOne': '{count} autorisation pour {total}',
  'money.funding.collectAmountMany': '{count} autorisations pour {total}',
  'money.funding.collectPost':
    '. L’AI ne peut pas le cliquer et n’a aucun moyen de le déclencher.',
  'money.funding.blockerNoOffer': 'Aucune offre n’est encore ouverte.',
  'money.funding.blockerOfferClosed': 'L’offre n’est plus ouverte à l’autorisation.',
  'money.funding.blockerExpired': 'La fenêtre d’autorisation est fermée.',
  'money.funding.blockerNeedOne':
    '1 autorisation supplémentaire est nécessaire pour atteindre le minimum de {min}.',
  'money.funding.blockerNeedMany':
    '{count} autorisations supplémentaires sont nécessaires pour atteindre le minimum de {min}.',
  'money.funding.blockerInFlight': 'Une autorisation ou un débit est encore en cours.',
  'money.funding.blockerTooMany': 'Il y a plus d’autorisations que de places.',
  'money.funding.allClear':
    'Tous les contrôles du serveur sont actuellement satisfaits. Il revérifiera tout de même chaque ligne avant de débiter.',
  'money.funding.collecting': 'Confirmation auprès de PayPal…',
  'money.funding.collect': 'Confirmer l’atelier et collecter',
  'money.funding.disabledHint':
    'Le bouton reste désactivé tant que chaque blocage ci-dessus n’est pas levé.',
  'money.funding.noOfferEyebrow': 'Organisateur',
  'money.funding.noOfferTitle': 'Collecte',
  'money.funding.noOfferIntro':
    'L’argent ne circule qu’après l’autorisation d’une offre fixe par les personnes.',
  'money.funding.noOfferEmpty': 'Aucune offre n’est encore ouverte',
  'money.funding.publishOffer': 'Publier l’offre',
  'money.funding.noOfferBody':
    'Il n’y a rien à collecter tant qu’une offre fixe n’est pas publiée et autorisée par les participants.',

  /* -------------------------- money: batch status ------------------------- */
  'money.batch.status.LOCKED': 'VERROUILLÉ',
  'money.batch.status.CAPTURING': 'DÉBIT EN COURS',
  'money.batch.status.CONFIRMED': 'CONFIRMÉ',
  'money.batch.status.COMPENSATING': 'COMPENSATION',
  'money.batch.status.CANCELLED': 'ANNULÉ',
  'money.batch.status.MANUAL_REVIEW': 'INTERVENTION MANUELLE',

  /* ----------------------------- money: result ---------------------------- */
  'money.result.noWorkshopBody':
    'Le résultat apparaît après la confirmation ou l’annulation de l’atelier.',
  'money.result.title': 'Résultat',
  'money.result.intro': 'Ce qui est réellement arrivé à chaque débit.',
  'money.result.noSettlementTitle': 'Le règlement n’a pas encore eu lieu',
  'money.result.goFunding': 'Aller à la collecte',
  'money.result.noSettlementBody':
    'Quand l’organisateur confirme l’atelier et collecte, l’état réel de chaque débit apparaît ici. Un règlement en attente affiche « vérification », jamais une supposition.',
  'money.result.eyebrow': 'Organisateur · résultat',
  'money.result.outcome.confirmed': 'Atelier confirmé',
  'money.result.outcome.notConfirmed': 'Atelier non confirmé',
  'money.result.outcome.pending': 'Vérification auprès de PayPal',
  'money.result.outcome.attention': 'Nécessite une intervention manuelle',
  'money.result.bannerCaptured': 'Débité (confirmé par PayPal)',
  'money.result.bannerRefunded': 'Remboursé (confirmé par PayPal)',
  'money.result.bannerNeedsPerson': 'Nécessite une personne',
  'money.result.pendingOne': '1 débit nécessite une personne pour vérifier PayPal',
  'money.result.pendingMany':
    '{count} débits nécessitent une personne pour vérifier PayPal',
  'money.result.pendingBody':
    'Ces résultats sont incertains et ne sont jamais retentés automatiquement. Consultez le tableau de bord sandbox PayPal pour le débit ou le remboursement indiqué avant de décider quoi que ce soit.',
  'money.result.notConfirmedTitle': 'Aucun atelier, et aucun argent retenu',
  'money.result.notConfirmedBody':
    'Le plan ne s’est pas concrétisé. Les empreintes jamais débitées sont libérées, les débits effectués sont remboursés, et tout ce qui est incertain est transmis à une personne. Un remboursement n’apparaît comme « remboursé » qu’après confirmation par PayPal.',
  'money.result.perChargeTitle': 'État par débit',
  'money.result.perPersonTitle': 'État des reçus par personne',
  'money.result.receiptIntro':
    'Chaque ligne correspond à l’argent d’une personne, tel que rapporté par le serveur. Une demande de remboursement n’est pas un remboursement ; nous ne disons « remboursé » qu’après confirmation par PayPal.',
  'money.result.noCharges': 'Aucun débit n’a été concerné.',
  'money.result.captureId': 'Débit {id} · ',
  'money.result.refundId': 'Remboursement {id}',
  'money.result.noIds': 'Aucun identifiant de débit ou de remboursement — voir l’état ci-dessus.',
  'money.result.legendTitle': 'Comment lire ces états',
  'money.result.legend.authorized': 'Autorisé',
  'money.result.legend.authorizedDetail': 'Une empreinte temporaire. Aucun argent n’a circulé.',
  'money.result.legend.captured': 'Débité',
  'money.result.legend.capturedDetail':
    'PayPal a confirmé que le commerçant a reçu le montant.',
  'money.result.legend.voided': 'Annulé',
  'money.result.legend.voidedDetail': 'L’empreinte a été libérée. Rien n’a été débité.',
  'money.result.legend.refunding': 'Remboursement en cours',
  'money.result.legend.refundingDetail':
    'Un remboursement a été demandé mais n’est pas encore confirmé — non compté comme remboursé.',
  'money.result.legend.refunded': 'Remboursé',
  'money.result.legend.refundedDetail': 'PayPal a confirmé le remboursement.',
  'money.result.legend.attention': 'Nécessite une attention',
  'money.result.legend.attentionDetail':
    'Le résultat est inconnu. Une personne doit le vérifier ; rien n’est retenté automatiquement.',
  'money.result.batchTitle': 'Lot de règlement',
  'money.result.batchMeta':
    '{count} participants · attendu {expected} · débité {captured} · remboursé {refunded}',
  'money.result.backToFunding': 'Retour à la collecte',

  /* -------------------------- onboard: organizer setup -------------------- */
  'onboard.setup.eyebrow': 'Organisateur · étape 1',
  'onboard.setup.title': 'Configurez votre atelier',
  'onboard.setup.intro':
    'Un commerçant, un atelier de deux heures, trois horaires candidats. Ce sont les faits que chaque participant verra finalement dans une offre fixe.',
  'onboard.setup.loadSample': 'Charger un atelier d’exemple',
  'onboard.setup.loadingSample': 'Chargement de l’exemple…',
  'onboard.setup.formNoteBefore':
    'Les champs sont préremplis à partir d’un atelier d’exemple pour accélérer la démonstration. Modifiez ce que vous voulez — rien n’est créé avant que vous appuyiez sur ',
  'onboard.setup.formNoteConfirm': 'Créer l’atelier',
  'onboard.setup.formNoteAfter': '.',
  'onboard.setup.apiError': 'L’atelier n’a pas été créé',
  'onboard.setup.factsLegend': 'Faits de l’atelier',
  'onboard.setup.field.merchantName': 'Nom du commerçant',
  'onboard.setup.field.title': 'Titre de l’atelier',
  'onboard.setup.field.description': 'Description',
  'onboard.setup.field.descriptionHint':
    'Ce qui se passe pendant la session. Ce texte apparaît mot pour mot dans l’offre.',
  'onboard.setup.field.venue': 'Lieu',
  'onboard.setup.field.timezone': 'Fuseau horaire (IANA)',
  'onboard.setup.field.duration': 'Durée (minutes)',
  'onboard.setup.field.price': 'Prix par personne (USD)',
  'onboard.setup.field.priceHint': 'Fixe et tout compris. Stocké en centimes entiers.',
  'onboard.setup.field.inclusions': 'Ce que le prix comprend',
  'onboard.setup.field.inclusionsHint': 'Un élément par ligne. Ils sont listés dans l’offre.',
  'onboard.setup.field.minParticipants': 'Minimum de participants',
  'onboard.setup.field.capacity': 'Capacité',
  'onboard.setup.field.authDeadline': 'Date limite d’autorisation ({timezone})',
  'onboard.setup.field.authDeadlineHint':
    'Quand la fenêtre d’autorisation se ferme. Elle doit se terminer avant la première session.',
  'onboard.setup.slots.legend': 'Horaires candidats (3)',
  'onboard.setup.slots.hint':
    'Saisissez les heures locales dans {timezone}. L’instant stocké est en UTC ; chaque écran le réaffiche dans ce fuseau horaire.',
  'onboard.setup.slot.title': 'Horaire {n}',
  'onboard.setup.slot.start': 'Début',
  'onboard.setup.slot.end': 'Fin',
  'onboard.setup.create': 'Créer l’atelier',
  'onboard.setup.creating': 'Création de l’atelier…',
  'onboard.setup.actionsNote':
    'Le serveur valide à nouveau le brouillon. Il refuse une date limite d’autorisation déjà passée, un minimum supérieur à la capacité, ou des horaires qui se chevauchent.',
  'onboard.setup.created.eyebrow': 'Organisateur',
  'onboard.setup.created.title': 'Votre atelier est configuré',
  'onboard.setup.created.intro':
    '{merchant} · {price} {currency} par personne · minimum {min}, capacité {capacity}.',
  'onboard.setup.status.offerOpen': 'Offre ouverte',
  'onboard.setup.status.clarifying': 'Clarification des conditions',
  'onboard.setup.status.collecting': 'Collecte des intentions',
  'onboard.setup.created.facts': 'Faits de l’atelier',
  'onboard.setup.created.venue': 'Lieu',
  'onboard.setup.created.timezone': 'Fuseau horaire',
  'onboard.setup.created.length': 'Durée',
  'onboard.setup.created.lengthValue': '{n} minutes',
  'onboard.setup.created.includes': 'Inclusions',
  'onboard.setup.created.deadline': 'Date limite d’autorisation',
  'onboard.setup.created.candidateTimes': 'Horaires candidats',
  'onboard.setup.created.next': 'Étape suivante',
  'onboard.setup.created.nextBefore':
    'Les participants voient maintenant la grande question et construisent une préférence vérifiable. Rien ne compte avant que chaque personne appuie sur ',
  'onboard.setup.created.nextConfirm': 'Confirmer mes préférences',
  'onboard.setup.created.nextAfter':
    '. Utilisez le sélecteur de vue ci-dessus pour agir en tant que participant.',
  'onboard.setup.created.openPlan': 'Ouvrir le plan',
  'onboard.setup.created.openParticipant': 'Ouvrir une vue participant',
  'onboard.setup.error.required': '{label} est requis.',
  'onboard.setup.error.timezone': 'Choisissez un fuseau horaire IANA valide.',
  'onboard.setup.error.duration': 'La durée doit être un nombre entier de minutes.',
  'onboard.setup.error.price':
    'Le prix doit être un montant en dollars avec au plus deux décimales.',
  'onboard.setup.error.inclusions': 'Indiquez au moins un élément inclus dans le prix.',
  'onboard.setup.error.min': 'Le minimum doit être un nombre entier.',
  'onboard.setup.error.capacity': 'La capacité doit être un nombre entier.',
  'onboard.setup.error.minOverCapacity': 'Le minimum ne peut pas dépasser la capacité.',
  'onboard.setup.error.deadlineFormat':
    'Saisissez la date limite d’autorisation sous forme de date et d’heure.',
  'onboard.setup.error.deadlineFuture':
    'La date limite d’autorisation doit être dans le futur.',
  'onboard.setup.error.slotRange': 'L’horaire {n} a besoin d’un début et d’une fin.',
  'onboard.setup.error.slotOrder': 'L’horaire {n} doit se terminer après son début.',
  'onboard.setup.error.slotOverlap': 'Les horaires candidats ne doivent pas se chevaucher.',
  'onboard.setup.error.deadlineBeforeFirst':
    'La date limite d’autorisation doit se fermer avant le début de la première session.',

  /* ------------------------ onboard: participant clarify ------------------ */
  'onboard.clarify.eyebrow': 'Participant · {name}',
  'onboard.clarify.preferences': 'Vos préférences',
  'onboard.clarify.openOffer': 'Relire l’offre ouverte',
  'onboard.clarify.noParticipant.title': 'Cette page appartient à un participant',
  'onboard.clarify.noParticipant.body':
    'Utilisez le sélecteur de vue ci-dessus pour agir en tant que participant.',
  'onboard.clarify.none.title': 'Aucune question pour vous',
  'onboard.clarify.none.emptyTitle': 'Rien à répondre pour l’instant',
  'onboard.clarify.none.body1':
    'Une question n’est posée que si un fait commerçant pourrait changer le fait qu’un horaire vous convienne. La plupart des gens n’en reçoivent jamais, et vous en recevez au plus une.',
  'onboard.clarify.none.body2':
    'Vos préférences confirmées comptent toujours exactement comme vous les avez définies.',
  'onboard.clarify.answered.titleYes': 'Merci — cet horaire compte maintenant',
  'onboard.clarify.answered.titleNo': 'Votre préférence est inchangée',
  'onboard.clarify.answered.intro':
    'Vous n’avez rien d’autre à faire. Cette question est close et ne sera plus reposée.',
  'onboard.clarify.answered.badge': 'Répondu',
  'onboard.clarify.answered.heading': 'Votre réponse',
  'onboard.clarify.answered.yesStrong': 'Oui, cela me va.',
  'onboard.clarify.answered.noStrong': 'Non, garder ma préférence.',
  'onboard.clarify.answered.yesBody':
    ' Votre préférence a été mise à jour pour inclure cet horaire — sous réserve de la même offre fixe et de la même étape d’autorisation que tout le monde.',
  'onboard.clarify.answered.noBody':
    ' Votre préférence d’origine reste exactement telle que vous l’avez confirmée. Aucune pénalité, aucun rabais, et aucune nouvelle question.',
  'onboard.clarify.answered.quoteLabel': 'Ce que vous aviez écrit au départ',
  'onboard.clarify.proposed.title': 'Aucune question ne vous a encore été envoyée',
  'onboard.clarify.proposed.emptyTitle':
    'L’organisateur examine encore une question possible',
  'onboard.clarify.proposed.body':
    'Rien ne vous a été envoyé, et rien ne compte avant. Vos préférences confirmées sont inchangées.',
  'onboard.clarify.ask.title': 'Une question sur votre condition',
  'onboard.clarify.ask.intro':
    'Répondez en un clic. C’est l’unique question qui vous sera posée.',
  'onboard.clarify.ask.badge': 'En attente de votre réponse',
  'onboard.clarify.ask.saveError': 'Votre réponse n’a pas été enregistrée',
  'onboard.clarify.ask.toldHeading': 'Ce que vous nous avez dit',
  'onboard.clarify.ask.verbatim': '{name} · mot pour mot',
  'onboard.clarify.ask.toldNote':
    'Vous avez écrit ceci lorsque vous avez confirmé votre préférence.',
  'onboard.clarify.ask.dependsHeading': 'De quoi cela dépend',
  'onboard.clarify.ask.dependsNote':
    'C’est un fait commerçant, pas une promesse de GatherReady ni de l’AI. L’organisateur l’a vérifié avant d’envoyer la question.',
  'onboard.clarify.ask.heading': 'La question',
  'onboard.clarify.ask.sourcePrefix':
    'Source du libellé : {source}. Elle ne concerne que ',
  'onboard.clarify.ask.sourceAi': 'rédaction par l’AI, vérifiée par l’organisateur',
  'onboard.clarify.ask.sourceTemplate': 'gabarit, sans AI',
  'onboard.clarify.ask.sourceSuffix': '.',
  'onboard.clarify.ask.answerGroupAria': 'Répondre à la question',
  'onboard.clarify.ask.saving': 'Enregistrement…',
  'onboard.clarify.ask.yes': 'Oui, cela me va',
  'onboard.clarify.ask.no': 'Non, garder ma préférence',
  'onboard.clarify.ask.noStrong': 'Un non est une réponse complète.',
  'onboard.clarify.ask.noNote':
    ' Votre préférence reste exactement telle quelle, vous n’êtes plus sollicité, et personne n’est débité en votre nom.',
};
