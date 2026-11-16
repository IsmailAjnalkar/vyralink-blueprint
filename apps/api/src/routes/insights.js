// Seller matching and analytics (blueprint B09, B16, O21, F01).
import { member, one, BRAND } from '../http.js';
import { rankSellers } from '../matching.js';
import { loadSettlement } from '../settle.js';
import { SELLER_STATS_SQL } from './identity.js';

const ACTIVE = `('hold', 'confirmed', 'checked_in', 'in_progress')`;

export default async function insights(app) {
  const { pool } = app;

  /**
   * Ranked sellers for a campaign with the reason behind every point. Sellers left out are only counted by reason:
   * a brand never learns another seller's schedule.
   */
  app.get('/campaigns/:id/matches', async (req) => {
    const m = member(req, BRAND);
    const c = await one(pool, `SELECT c.*, ARRAY(SELECT DISTINCT p.category FROM products p WHERE p.id = ANY(c.product_ids)) AS product_categories
      FROM campaigns c WHERE c.id = $1 AND c.org_id = $2`, [req.params.id, m.orgId], 'Campaign not found');
    const { rows } = await pool.query(
      `SELECT s.*, EXISTS (SELECT 1 FROM bookings b WHERE b.seller_id = s.user_id AND b.campaign_id <> $3 AND b.status IN ${ACTIVE} AND b.slot && tstzrange($1, $2)) AS busy
       FROM (${SELLER_STATS_SQL}) s WHERE NOT s.paused LIMIT 500`, [c.starts_at, c.ends_at, c.id]);
    const { rows: inv } = await pool.query('SELECT seller_id, status FROM invitations WHERE campaign_id = $1', [c.id]);
    const invited = new Map(inv.map((i) => [i.seller_id, i.status]));
    const { weights, ranked, excluded } = rankSellers(rows, c);
    const counts = {};
    for (const e of excluded) counts[e.reason] = (counts[e.reason] ?? 0) + 1;
    return {
      weights,
      method: 'Points per rule, highest first. Results and reliability come only from completed Vyralink sessions; follower counts are not used.',
      ranked: ranked.slice(0, 20).map((r) => ({ sellerId: r.seller.user_id, name: r.seller.display_name, score: r.score, ready: r.ready, parts: r.parts, invitation: invited.get(r.seller.user_id) ?? null })),
      excluded: Object.entries(counts).map(([reason, count]) => ({ reason, count })),
    };
  });

  /** Brand analytics across its campaigns; figures come from the same settlement used for invoices and pay. */
  app.get('/analytics/brand', async (req) => {
    const m = member(req, BRAND);
    const { rows: campaigns } = await pool.query(`SELECT id, name, status, starts_at FROM campaigns WHERE org_id = $1 ORDER BY starts_at`, [m.orgId]);
    const { rows: done } = await pool.query(`SELECT b.id, b.campaign_id, b.results_status FROM bookings b JOIN campaigns c ON c.id = b.campaign_id WHERE c.org_id = $1 AND b.status = 'completed'`, [m.orgId]);
    const { rows: costs } = await pool.query(`SELECT campaign_id, sum(amount_cents)::bigint AS cost FROM invoices WHERE org_id = $1 AND status NOT IN ('void', 'draft') GROUP BY campaign_id`, [m.orgId]);
    const { rows: demo } = await pool.query(`SELECT DISTINCT b.campaign_id FROM session_orders o JOIN bookings b ON b.id = o.booking_id JOIN campaigns c ON c.id = b.campaign_id WHERE c.org_id = $1 AND o.source = 'sandbox'`, [m.orgId]);
    const sandbox = new Set(demo.map((d) => d.campaign_id));
    // ponytail: one settlement per completed session (N queries); aggregate in SQL if a brand runs hundreds of sessions.
    const per = new Map();
    for (const b of done) {
      const { liveMinutes, s } = await loadSettlement(pool, b.id);
      const p = per.get(b.campaign_id) ?? { sessions: 0, liveMinutes: 0, orders: 0, gmvCents: 0, refundsCents: 0, final: true };
      per.set(b.campaign_id, { sessions: p.sessions + 1, liveMinutes: p.liveMinutes + liveMinutes, orders: p.orders + s.orders, gmvCents: p.gmvCents + s.gmvCents, refundsCents: p.refundsCents + s.refundsCents, final: p.final && b.results_status === 'locked' });
    }
    const rows = campaigns.map((c) => {
      const p = per.get(c.id) ?? { sessions: 0, liveMinutes: 0, orders: 0, gmvCents: 0, refundsCents: 0, final: false };
      const costCents = Number(costs.find((x) => x.campaign_id === c.id)?.cost ?? 0);
      return { campaignId: c.id, name: c.name, status: c.status, startsAt: c.starts_at, ...p, netSalesCents: p.gmvCents - p.refundsCents, costCents,
        gmvPerHourCents: p.liveMinutes ? Math.round((p.gmvCents * 60) / p.liveMinutes) : null, source: sandbox.has(c.id) ? 'Sandbox (demo data)' : p.sessions ? 'Imported' : 'No results yet' };
    });
    const sum = (k) => rows.reduce((t, r) => t + r[k], 0);
    const totals = { campaigns: rows.length, sessions: sum('sessions'), liveMinutes: sum('liveMinutes'), orders: sum('orders'), gmvCents: sum('gmvCents'), netSalesCents: sum('netSalesCents'), costCents: sum('costCents') };
    return {
      totals: { ...totals, gmvPerHourCents: totals.liveMinutes ? Math.round((totals.gmvCents * 60) / totals.liveMinutes) : null, gmvToCost: totals.costCents ? Math.round((totals.gmvCents / totals.costCents) * 10) / 10 : null },
      campaigns: rows,
      definitions: { gmv: 'Your TikTok Shop sales attributed to the LIVE (not Vyralink revenue).', cost: 'Fees invoiced by Creator Hub, after credit notes.' },
    };
  });

  /** Studio analytics for a location over the last N days (default 30): booth use, outcomes, incidents. */
  app.get('/analytics/studio', async (req) => {
    const m = member(req, ['location_manager', 'finance_admin']);
    const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
    const window = `b.starts_at >= now() - make_interval(days => $2) AND b.starts_at < now() + interval '1 day'`;
    const [booths, statuses, incidents] = await Promise.all([
      pool.query(`SELECT bo.id, bo.name, l.name AS location,
          count(b.id) FILTER (WHERE b.status = 'completed')::int AS sessions,
          COALESCE(round(sum(GREATEST(0, extract(epoch FROM b.actual_end - b.actual_start) / 60 - b.minutes_lost)) FILTER (WHERE b.status = 'completed')), 0)::int AS live_minutes,
          COALESCE(round(sum(extract(epoch FROM upper(b.slot) - lower(b.slot)) / 60) FILTER (WHERE b.status NOT IN ('cancelled', 'expired'))), 0)::int AS reserved_minutes
        FROM booths bo JOIN locations l ON l.id = bo.location_id LEFT JOIN bookings b ON b.booth_id = bo.id AND ${window}
        WHERE l.org_id = $1 GROUP BY bo.id, l.name ORDER BY l.name, bo.name`, [m.orgId, days]),
      pool.query(`SELECT b.status, count(*)::int AS n FROM bookings b JOIN booths bo ON bo.id = b.booth_id JOIN locations l ON l.id = bo.location_id
        WHERE l.org_id = $1 AND ${window} GROUP BY b.status`, [m.orgId, days]),
      pool.query(`SELECT i.category, i.severity, count(*)::int AS n, COALESCE(sum(i.minutes_lost), 0)::int AS minutes_lost FROM incidents i JOIN bookings b ON b.id = i.booking_id
        JOIN booths bo ON bo.id = b.booth_id JOIN locations l ON l.id = bo.location_id WHERE l.org_id = $1 AND ${window} GROUP BY i.category, i.severity ORDER BY n DESC`, [m.orgId, days]),
    ]);
    const by = Object.fromEntries(statuses.rows.map((r) => [r.status, r.n]));
    const ended = (by.completed ?? 0) + (by.no_show ?? 0);
    return {
      days, booths: booths.rows, bookingsByStatus: by, noShowRatePct: ended ? Math.round((100 * (by.no_show ?? 0)) / ended) : null, incidents: incidents.rows,
      definitions: { reserved: 'Booked slot time including setup and teardown.', live: 'LIVE time from the studio log minus minutes lost to incidents.' },
    };
  });
}
