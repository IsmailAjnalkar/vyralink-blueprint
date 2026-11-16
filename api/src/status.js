// Allowed status transitions, one table per record type (blueprint B08, O06, F02, F03, C11).
import { conflict } from './http.js';

export const FLOWS = {
  campaign: {
    draft: ['pending_approval', 'published', 'cancelled'],
    pending_approval: ['published', 'draft', 'cancelled'],
    published: ['recruiting', 'cancelled'],
    recruiting: ['scheduled', 'cancelled'],
    scheduled: ['in_progress', 'recruiting', 'cancelled'],
    in_progress: ['completed'],
    completed: ['archived', 'disputed'],
    disputed: ['completed'],
    cancelled: ['archived'],
    archived: [],
  },
  product: {
    draft: ['pending_review'],
    pending_review: ['approved', 'rejected'],
    rejected: ['pending_review'],
    approved: ['pending_review', 'archived'],
    archived: ['approved'],
  },
  invitation: {
    invited: ['viewed', 'accepted', 'declined', 'countered', 'expired', 'withdrawn'],
    viewed: ['accepted', 'declined', 'countered', 'expired', 'withdrawn'],
    applied: ['accepted', 'declined', 'withdrawn', 'expired'],
    countered: ['invited', 'accepted', 'declined', 'withdrawn', 'expired'],
    accepted: [], declined: [], expired: [], withdrawn: [],
  },
  booking: {
    hold: ['confirmed', 'cancelled', 'expired'],
    confirmed: ['checked_in', 'no_show', 'cancelled'],
    checked_in: ['in_progress', 'cancelled'],
    in_progress: ['completed'],
    completed: [], cancelled: [], no_show: [], expired: [],
  },
  invoice: {
    draft: ['issued', 'void'],
    issued: ['paid', 'overdue', 'disputed', 'void', 'credited'],
    overdue: ['paid', 'disputed'],
    disputed: ['issued', 'paid', 'credited'],
    paid: ['credited'],
    void: [], credited: [],
  },
};

export function assertMove(kind, from, to) {
  if (!FLOWS[kind]?.[from]?.includes(to)) throw conflict(`A ${kind} can’t move from ${from} to ${to}`, 'invalid_transition');
}
