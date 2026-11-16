// Pure money rules from the blueprint. All amounts are integer cents; rates are basis points.
// One eligible-sales base drives both the seller commission and the brand performance fee.

const pct = (cents, bps) => Math.round((cents * bps) / 10000);

/** GMV attributed to the LIVE: attributed, not-cancelled orders, before refunds. */
export function attributedGmv(orders) {
  return orders.filter((o) => o.attributed && o.status !== 'cancelled').reduce((s, o) => s + o.amount_cents, 0);
}

/** Eligible attributable sales: attributed orders minus refunds and cancellations (and excluded orders). */
export function eligibleSales(orders) {
  return orders
    .filter((o) => o.attributed && o.status !== 'cancelled')
    .reduce((s, o) => s + (o.status === 'refunded' ? 0 : o.amount_cents - (o.refund_cents ?? 0)), 0);
}

/** Base pay = rate × hours. Hours come from the studio log (actual start → end, minus minutes lost). */
export function basePay(rateCents, minutes) {
  return Math.round((rateCents * minutes) / 60);
}

export const commission = (eligibleCents, bps) => pct(eligibleCents, bps);
export const performanceFee = (eligibleCents, bps) => pct(eligibleCents, bps);
export const bonus = (eligibleCents, thresholdCents, bonusCents) => (thresholdCents != null && eligibleCents >= thresholdCents ? bonusCents : 0);

/** Brand cancellation fee by the example policy: free > 72 h before, 50% of production fee 24–72 h, 100% < 24 h. */
export function cancellationFee(productionFeeCents, hoursBefore) {
  if (hoursBefore > 72) return 0;
  if (hoursBefore >= 24) return Math.round(productionFeeCents / 2);
  return productionFeeCents;
}

/** Everything finance needs for one session, from imported orders and campaign terms. */
export function settle(orders, terms, liveMinutes) {
  const eligible = eligibleSales(orders);
  return {
    orders: orders.filter((o) => o.attributed && o.status !== 'cancelled').length,
    gmvCents: attributedGmv(orders),
    refundsCents: attributedGmv(orders) - eligible,
    eligibleCents: eligible,
    basePayCents: basePay(terms.base_rate_cents, liveMinutes),
    commissionCents: commission(eligible, terms.commission_bps),
    bonusCents: bonus(eligible, terms.bonus_gmv_threshold_cents, terms.bonus_cents),
    performanceFeeCents: performanceFee(eligible, terms.performance_fee_bps),
    productionFeeCents: terms.production_fee_cents,
  };
}

export const dollars = (cents) => `${cents < 0 ? '−' : ''}$${(Math.abs(cents) / 100).toFixed(2)}`;
