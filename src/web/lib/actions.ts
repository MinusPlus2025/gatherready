/* ==========================================================================
   Web → server action names. One union for every mutating call in the frozen
   HTTP contract (docs/CONTRACT.md §4), so the store can route them to the real
   API or to the dev-only mock without the pages caring which is active.
   ========================================================================== */

import type {
  AnswerClarificationRequest,
  ConfirmPreferencesRequest,
  CreateWorkshopRequest,
  DemoViewRequest,
  ParsePreferencesRequest,
  PublishOfferRequest,
  RevisePreferencesRequest,
  StartCheckoutRequest,
} from '../../shared/api.js';

export type WebAction =
  | { type: 'workshop.create'; payload: CreateWorkshopRequest }
  | { type: 'preferences.parse'; payload: ParsePreferencesRequest }
  | { type: 'preferences.confirm'; payload: ConfirmPreferencesRequest }
  | { type: 'preferences.revise'; payload: RevisePreferencesRequest }
  | { type: 'plans.compute' }
  | { type: 'clarifications.propose'; participantId?: string }
  | { type: 'clarifications.send'; id: string }
  | { type: 'clarifications.answer'; id: string; payload: AnswerClarificationRequest }
  | { type: 'offers.publish'; payload: PublishOfferRequest }
  | { type: 'checkout.start'; payload: StartCheckoutRequest }
  | { type: 'checkout.complete'; orderId: string }
  | { type: 'participants.withdraw'; id: string }
  | { type: 'workshops.settle'; id: string }
  | { type: 'demo.view'; payload: DemoViewRequest }
  | { type: 'demo.reset' };
