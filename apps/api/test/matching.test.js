// Rules-based matching: every point has a reason; exclusions are explicit; order is stable.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rankSellers, WEIGHTS } from '../src/matching.js';

const seller = (over) => ({ user_id: over.display_name, categories: ['skincare'], certificates: ['beauty_claims'], verified_sessions: 0, verified_gmv_per_hour_cents: null, reliability_pct: null, rate_cents: 3000, paused: false, busy: false, ...over });
const campaign = { required_category: null, product_categories: ['skincare'], required_courses: ['beauty_claims'], base_rate_cents: 3000 };

test('weights add up to 100', () => assert.equal(Object.values(WEIGHTS).reduce((a, b) => a + b, 0), 100));

test('verified results and reliability rank first; every rule explains its points', () => {
  const { ranked } = rankSellers([
    seller({ display_name: 'New Nina' }),
    seller({ display_name: 'Proven Pat', verified_sessions: 12, verified_gmv_per_hour_cents: 200000, reliability_pct: 100 }),
    seller({ display_name: 'Half Hal', verified_sessions: 4, verified_gmv_per_hour_cents: 100000, reliability_pct: 50 }),
  ], campaign);
  assert.deepEqual(ranked.map((r) => [r.seller.display_name, r.score]), [['Proven Pat', 100], ['Half Hal', 75], ['New Nina', 60]]);
  const nina = ranked.find((r) => r.seller.display_name === 'New Nina');
  assert.deepEqual(nina.parts.map((p) => [p.rule, p.points]), [['category', 25], ['results', 0], ['reliability', 10], ['training', 15], ['rate', 10]]);
  assert.match(nina.parts.find((p) => p.rule === 'reliability').reason, /neutral/); // new sellers aren't punished for having no history
  assert.ok(ranked.every((r) => r.parts.every((p) => p.reason.length > 5)));
});

test('missing training, rate above budget and category mismatch cost points; paused and wrong category are excluded', () => {
  const { ranked, excluded } = rankSellers([
    seller({ display_name: 'Untrained Uma', certificates: [] }),
    seller({ display_name: 'Pricey Pia', rate_cents: 3500 }),
    seller({ display_name: 'Very Pricey Vic', rate_cents: 5000 }),
    seller({ display_name: 'Paused Pam', paused: true }),
    seller({ display_name: 'Fashion Fay', categories: ['fashion'] }),
  ], { ...campaign, required_category: null });
  const pts = (n, rule) => ranked.find((r) => r.seller.display_name === n).parts.find((p) => p.rule === rule);
  assert.equal(pts('Untrained Uma', 'training').points, 0);
  assert.equal(ranked.find((r) => r.seller.display_name === 'Untrained Uma').ready, false);
  assert.equal(pts('Pricey Pia', 'rate').points, 5);
  assert.equal(pts('Very Pricey Vic', 'rate').points, 0);
  assert.equal(pts('Fashion Fay', 'category').points, 0);
  assert.deepEqual(excluded.map((e) => [e.seller.display_name, e.reason]), [['Paused Pam', 'Paused']]);

  const strict = rankSellers([seller({ display_name: 'Fashion Fay', categories: ['fashion'] })], { ...campaign, required_category: 'Skincare' });
  assert.match(strict.excluded[0].reason, /required category/);
});

test('ties break on verified sessions, then name', () => {
  const { ranked } = rankSellers([seller({ display_name: 'Zed' }), seller({ display_name: 'Amy' }), seller({ display_name: 'Max', verified_sessions: 3 })], campaign);
  assert.deepEqual(ranked.map((r) => r.seller.display_name), ['Max', 'Amy', 'Zed']);
});
