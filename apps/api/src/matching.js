// Rules-based seller matching (blueprint B09): a fixed, published scoring with a reason for every point.
// No machine learning and no personal attributes: only category fit, verified results from completed sessions,
// reliability, required training, availability and rate. New sellers get a neutral reliability score, never zero.

export const WEIGHTS = { category: 25, results: 30, reliability: 20, training: 15, rate: 10 };

/**
 * candidates: rows from SELLER_STATS_SQL plus { busy: boolean }.
 * campaign: { required_category, product_categories[], required_courses[], base_rate_cents }.
 * Returns eligible sellers ranked by score, each with a points breakdown, and the excluded ones with the reason.
 */
export function rankSellers(candidates, campaign) {
  const wanted = new Set([campaign.required_category, ...(campaign.product_categories ?? [])].filter(Boolean).map((c) => c.toLowerCase()));
  const best = Math.max(0, ...candidates.map((s) => s.verified_gmv_per_hour_cents ?? 0));
  const ranked = [];
  const excluded = [];

  for (const s of candidates) {
    const cats = (s.categories ?? []).map((c) => c.toLowerCase());
    if (s.paused) { excluded.push({ seller: s, reason: 'Paused' }); continue; }
    if (s.busy) { excluded.push({ seller: s, reason: 'Already booked at this time' }); continue; }
    if (campaign.required_category && !cats.includes(campaign.required_category.toLowerCase())) {
      excluded.push({ seller: s, reason: `Doesn't list the required category (${campaign.required_category})` });
      continue;
    }

    const parts = [];
    const fit = cats.filter((c) => wanted.has(c));
    parts.push({ rule: 'category', points: fit.length ? WEIGHTS.category : 0, reason: fit.length ? `Sells ${fit.join(', ')}` : 'No matching category listed' });

    const gph = s.verified_gmv_per_hour_cents;
    parts.push(gph && best
      ? { rule: 'results', points: Math.round((WEIGHTS.results * gph) / best), reason: `Verified GMV per LIVE hour ${dollars(gph)} (best candidate ${dollars(best)})` }
      : { rule: 'results', points: 0, reason: 'No completed sessions yet' });

    parts.push(s.reliability_pct == null
      ? { rule: 'reliability', points: WEIGHTS.reliability / 2, reason: 'No booking history yet (neutral score)' }
      : { rule: 'reliability', points: Math.round((WEIGHTS.reliability * s.reliability_pct) / 100), reason: `On time for ${s.reliability_pct}% of booked sessions` });

    const certs = new Set(s.certificates ?? []);
    const missing = (campaign.required_courses ?? []).filter((c) => !certs.has(c));
    parts.push({ rule: 'training', points: missing.length ? 0 : WEIGHTS.training, reason: missing.length ? `Needs training: ${missing.join(', ')}` : 'Has the required training' });

    const rate = s.rate_cents;
    const budget = campaign.base_rate_cents;
    parts.push(rate == null
      ? { rule: 'rate', points: WEIGHTS.rate / 2, reason: 'No typical rate listed' }
      : rate <= budget ? { rule: 'rate', points: WEIGHTS.rate, reason: `Typical rate ${dollars(rate)} is within your ${dollars(budget)}` }
        : rate <= budget * 1.2 ? { rule: 'rate', points: WEIGHTS.rate / 2, reason: `Typical rate ${dollars(rate)} is up to 20% above your ${dollars(budget)}` }
          : { rule: 'rate', points: 0, reason: `Typical rate ${dollars(rate)} is more than 20% above your ${dollars(budget)}` });

    ranked.push({ seller: s, score: parts.reduce((t, p) => t + p.points, 0), parts, ready: missing.length === 0 });
  }
  // Ties: more verified sessions first, then name, so the order is stable and explainable.
  ranked.sort((a, b) => b.score - a.score || (b.seller.verified_sessions ?? 0) - (a.seller.verified_sessions ?? 0) || a.seller.display_name.localeCompare(b.seller.display_name));
  return { weights: WEIGHTS, ranked, excluded };
}

const dollars = (c) => `$${(c / 100).toFixed(2)}`;
