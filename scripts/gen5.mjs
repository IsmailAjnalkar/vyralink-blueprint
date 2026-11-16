// Batch 5: §10 21 business flowcharts (BF01–BF21), §11 edge-case catalog, D7 user journeys (J1–J8).
// Usage: node gen5.mjs <rootDir>
import fs from 'node:fs';
import path from 'node:path';
import { doc, FONT, badge, chip, table, p, ul, card, grid } from './lib.mjs';

const ROOT = process.argv[2];
const written = [];
const out = (rel, s) => {
  const f = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, s);
  written.push(rel);
  if (s.replace(/&(amp|lt|gt|quot|#\d+);/g, '').includes('&')) console.warn(`WARN raw & in ${rel}`);
  if (s.includes('{{')) console.warn(`WARN {{ in ${rel}`);
};
const folderOf = (id) => ({ B: 'brand', C: 'creator', O: 'ops', F: 'fin', A: 'admin', M: 'brand' })[id[0]];
const exists = (id) => /^(B(0[1-9]|1[0-8])|C(0[1-9]|1\d|2[0-7])|O(0[1-9]|1\d|2[0-4])|F0[1-8]|A(0[1-9]|1[0-2])|M01)$/.test(id);
const rel = (from, id) => `../${folderOf(id)}/${id}.dc.html`;
const linkIds = (from, s) => s.replace(/\b([BCOFA]\d\d|M01)\b/g, (m) => (exists(m) ? `<a href="${rel(from, m)}" style="color:#1a1a1a">${m}</a>` : m));

// ---------------------------------------------------------------- diagram primitives (diagrams.md)
let mk = 0;
const STROKE = '#5c5c5c';
const svg = ({ left, top, w, h, d, head, dashed, aria }) => {
  const id = head ? `dc-arrow-head-filled-${++mk}` : '';
  const a11y = aria ? `role="img" aria-label="${aria}"` : 'aria-hidden="true"';
  return `<svg ${a11y} width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="position: absolute; left: ${left}px; top: ${top}px; width: ${w}px; height: ${h}px; overflow: visible; fill: none; stroke: ${STROKE}; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round${dashed ? '; stroke-dasharray: 6 6' : ''}">${head ? `<defs><marker id="${id}" orient="auto" markerWidth="5" markerHeight="5" refX="2" refY="2" overflow="visible"><path d="M0 0 L4 2 L0 4 Z" fill="${STROKE}" stroke="none" style="stroke: none; fill: ${STROKE}; fill: context-stroke"/></marker></defs>` : ''}<path d="${d}"${head ? ` marker-end="url(#${id})"` : ''}></path></svg>`;
};
const hArrow = (x, tipX, y, o) => { const n = tipX - x; return svg({ left: x, top: y - 4, w: n, h: 8, d: `M 0 4 L ${n - 4} 4`, head: true, ...o }); };
const vArrow = (x, y, tipY, o) => { const n = tipY - y; return svg({ left: x - 4, top: y, w: 8, h: n, d: `M 4 0 L 4 ${n - 4}`, head: true, ...o }); };
const esc = (s) => s.replace(/<[^>]+>/g, '').replace(/"/g, '');

// ---------------------------------------------------------------- flowchart generator
const COL = 280, R = 440;
const flowBoard = (folder, f) => {
  mk = 0;
  const nodes = f.nodes;
  const W = 64 + nodes.length * COL - 80 + 64;
  const H = R + 140 + 168 + 64;
  const arrows = [], cards = [], labels = [];
  let stepNo = 0;
  const geo = nodes.map((n, i) => {
    const colX = 64 + i * COL;
    if (n.t === 'start' || n.t === 'end') return { x: colX + 20, y: R - 32, w: 160, h: 64 };
    if (n.t === 'dec') return { x: colX, y: R - 60, w: 200, h: 120 };
    return { x: colX, y: R - 96, w: 200, h: 192 };
  });
  const names = nodes.map((n) => (n.t === 'step' ? `${++stepNo} · ${esc(n.text)}` : n.t === 'dec' ? `decision: ${esc(n.q)}` : esc(n.text)));
  stepNo = 0;
  nodes.forEach((n, i) => {
    const g = geo[i];
    const base = `position: absolute; left: ${g.x}px; top: ${g.y}px; width: ${g.w}px; height: ${g.h}px; box-sizing: border-box`;
    if (n.t === 'start' || n.t === 'end') cards.push(`<div style="${base}; padding: 8px; display: flex; align-items: center; justify-content: center; text-align: center; background: #1a1a1a; color: #ffffff; border-radius: 32px; font-size: 13px; font-weight: 700; line-height: 17px"><span>${n.t === 'start' ? 'Start: ' : 'End: '}${linkIds(folder, n.text).replace(/color:#1a1a1a/g, 'color:#ffffff')}</span></div>`);
    else if (n.t === 'dec') {
      cards.push(`<div style="${base}; padding: 20px 36px; display: flex; align-items: center; justify-content: center; text-align: center; background: #dcdcdc; clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); font-size: 13px; font-weight: 700; line-height: 16px"><span>${n.q}</span></div>`);
      const cx = g.x + g.w / 2;
      arrows.push(vArrow(cx, g.y + g.h, R + 139, { dashed: true, aria: `From ${names[i]} down to the ${n.noLabel || 'No'} path` }));
      labels.push(`<div style="position: absolute; left: ${cx + 12}px; top: ${R + 92}px; width: 40px; font-size: 13px; line-height: 16px; color: #3d3d3d">${n.noLabel || 'No'}</div>`);
      const fl = n.no;
      cards.push(`<div style="position: absolute; left: ${g.x}px; top: ${R + 140}px; width: 200px; height: 168px; box-sizing: border-box; padding: 8px 10px; display: flex; align-items: center; justify-content: flex-start; text-align: left; background: #f2f2f2; border: 1px dashed #4d4d4d; border-radius: 8px; font-size: 12px; line-height: 16px"><span>${linkIds(folder, fl.text)}${fl.status ? `<br><b>Status:</b> ${fl.status}` : ''}${fl.notify ? `<br><b>Notify:</b> ${fl.notify}` : ''}</span></div>`);
    } else {
      stepNo++;
      cards.push(`<div style="${base}; padding: 8px 10px; display: flex; align-items: center; justify-content: flex-start; text-align: left; background: ${n.ext ? '#f7f7f7' : '#ffffff'}; border: ${n.ext ? '1px dashed #4d4d4d' : '1px solid #8c8c8c'}; border-radius: 10px; font-size: 12px; line-height: 16px"><span><span style="font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #3d3d3d">${n.actor}</span><br><b style="font-size: 13px">${stepNo}. ${n.text}</b>${n.ids ? `<br>Screens: ${linkIds(folder, n.ids)}` : ''}${n.status ? `<br><b>Status:</b> ${n.status}` : ''}${n.notify ? `<br><b>Notify:</b> ${n.notify}` : ''}</span></div>`);
    }
    if (i + 1 < nodes.length) {
      const nx = geo[i + 1];
      arrows.push(hArrow(g.x + g.w, nx.x - 1, R, { aria: `From ${names[i]} to ${names[i + 1]}${n.t === 'dec' ? `, if ${n.yesLabel || 'yes'}` : ''}` }));
      if (n.t === 'dec') { const mid = Math.round((g.x + g.w + nx.x) / 2); labels.push(`<div style="position: absolute; left: ${mid - 20}px; top: ${R - 28}px; width: 40px; text-align: center; font-size: 13px; line-height: 16px; color: #3d3d3d">${n.yesLabel || 'Yes'}</div>`); }
    }
  });
  labels.push(`<div style="position: absolute; left: 64px; top: 56px; font-size: 30px; font-weight: 700; line-height: 38px">${f.id} · ${f.title} ${f.priority ? f.priority.map(badge).join(' ') : ''}</div>`);
  labels.push(`<div style="position: absolute; left: 64px; top: 108px; width: ${Math.max(W - 128, 900)}px; font-size: 14px; line-height: 22px; color: #1a1a1a"><b>Trigger:</b> ${f.trigger}<br><b>Actors:</b> ${f.actors}<br><b>Statuses:</b> ${f.statuses}<br><b>Notifications:</b> ${f.notify}<br><b>Screens:</b> ${linkIds(folder, f.screens)}${f.note ? `<br><b>Note:</b> ${f.note}` : ''}</div>`);
  const body = `<div style="position: relative; width: ${Math.max(W, 1028)}px; height: ${H}px; background: #ffffff; ${FONT}; color: #1a1a1a">
${[...arrows, ...cards, ...labels].join('\n')}
</div>`;
  out(`project/${folder}/${f.id}.dc.html`, doc(`${f.id} ${f.title.replace(/<[^>]+>/g, '')}`, Math.max(W, 1028), H, body));
  return { w: Math.max(W, 1028), h: H };
};
const st = (actor, text, ids, status, notify, ext) => ({ t: 'step', actor, text, ids, status, notify, ext });
const dec = (q, text, o = {}) => ({ t: 'dec', q, no: { text, status: o.status, notify: o.notify }, noLabel: o.noLabel, yesLabel: o.yesLabel });
const start = (text) => ({ t: 'start', text });
const end = (text) => ({ t: 'end', text });

// ---------------------------------------------------------------- the 21 flows (§10)
const FL = [
  { id: 'BF01', title: 'Brand onboarding', priority: ['MVP'], trigger: 'A visitor chooses “Sign up as a brand”.', actors: 'Brand Owner, platform verifier.', statuses: 'Organization: Unverified → Submitted → In review → Verified, or Rejected → Resubmitted.', notify: 'Verification email; reviewer queue; decision to Brand Owner (in-app and email).', screens: 'B01, B02, B03, B04, A04',
    nodes: [start('Visitor on sign-up'), st('Brand Owner', 'Create account', 'B01', 'Org Unverified', 'Verification email'), dec('Email verified within 24 h?', '<b>Resend link</b> (B01). Account stays unverified; banner on every page.'), st('Brand Owner', 'Complete onboarding wizard', 'B03'), st('Brand Owner', 'Submit company documents', 'B02', 'Submitted', 'Verifier queue (A04)'), st('Platform verifier', 'Review documents', 'A04', 'In review'), dec('Documents valid?', '<b>Rejected with reason.</b> Brand fixes and resubmits in B02; fields kept.', { status: 'Rejected → Resubmitted', notify: 'Brand Owner' }), st('System', 'Organization verified', 'A04', 'Verified', 'Brand Owner'), end('Brand can publish (B04)')] },
  { id: 'BF02', title: 'Product onboarding', priority: ['MVP'], trigger: 'Brand adds a product or imports a CSV.', actors: 'Brand Owner or Marketing Manager, moderator.', statuses: 'Product: Draft → Pending review → Approved or Rejected → Archived.', notify: 'Moderator queue; decision to brand; sample reminders.', screens: 'B05, B06, A05',
    nodes: [start('Add product'), st('Brand', 'Enter details, claims, samples', 'B05', 'Draft'), st('Brand', 'Submit for review', 'B05', 'Pending review', 'Moderators (A05)'), st('Moderator', 'Check claims and category rules', 'A05'), dec('Claims supported?', '<b>Request changes or reject</b> with reason; brand edits in B05 and resubmits.', { status: 'Rejected', notify: 'Brand' }), st('Moderator', 'Approve product', 'A05, B06', 'Approved', 'Brand'), dec('Samples available?', '<b>Approved, flagged “Samples needed”.</b> Booking blocked until samples ship (O09).', { notify: 'Brand' }), end('Ready for campaigns (B07)')] },
  { id: 'BF03', title: 'Campaign creation', priority: ['MVP'], trigger: 'Brand clicks Create campaign (B04, B08).', actors: 'Brand Marketing Manager or Owner.', statuses: 'Campaign: Draft (saved after every step).', notify: 'Stock and capacity warnings in the wizard.', screens: 'B07, B05, B13',
    nodes: [start('Create campaign'), st('Brand', 'Objective and campaign type', 'B07 steps 1–2', 'Draft'), st('Brand', 'Pick approved products', 'B07 step 3'), dec('Stock covers expected units?', '<b>Warning;</b> restock in B05 or lower the target. Operations notified.', { notify: 'Brand, operations' }), st('Brand', 'LIVE date and duration', 'B07 step 4'), dec('Studio capacity at that time?', '<b>Suggest other slots or locations</b> (B07 step 7, B13).'), st('Brand', 'Budget and compensation', 'B07 step 5'), st('Brand', 'Seller and studio requirements', 'B07 steps 6–7'), st('Brand', 'Review', 'B07 step 8'), end('Ready to publish (BF04)')] },
  { id: 'BF04', title: 'Campaign approval', priority: ['MVP'], trigger: 'Brand clicks Publish.', actors: 'Brand Marketing Manager, Brand Owner, system.', statuses: 'Draft → Pending approval → Published → Recruiting.', notify: 'Approval request to Owner; decision to requester; job visible to sellers.', screens: 'B07, B08, B17, B02, C09',
    nodes: [start('Publish clicked'), dec('Brand verified?', '<b>Publish disabled</b> with link to B02.'), dec('Budget within threshold?', '<b>Pending approval.</b> Owner reviews in B08 or B17.', { status: 'Pending approval', notify: 'Brand Owner' }), dec('Owner approves?', '<b>Back to Draft</b> with comments (B07).', { status: 'Draft', notify: 'Requester' }), st('System', 'Publish to job marketplace', 'B08, C09', 'Published', 'Matching sellers'), st('System', 'First invite or application', 'B12', 'Recruiting'), end('Matching (BF05)')] },
  { id: 'BF05', title: 'Seller matching', priority: ['MVP', 'P3'], trigger: 'Campaign is Published.', actors: 'Brand, Creator Hub (sourcing), system.', statuses: 'Campaign stays Recruiting.', notify: 'Sourcing request to Creator Hub; training prompt to seller.', screens: 'B09, B10, B11, O23, C05, M01', note: 'MVP is manual filters; AI match scores (M01) are Phase 3.',
    nodes: [start('Find sellers'), st('Brand', 'Filter and sort sellers', 'B09'), dec('Qualified sellers found?', '<b>Widen filters</b> or ask Creator Hub to source (O23).', { notify: 'Creator Hub' }), st('Brand', 'Open profiles, compare', 'B10, B11'), dec('Available on the date?', '<b>Pick the next candidate</b> (B09).'), dec('Has required certificate?', '<b>Invite with training first;</b> booking blocked until passed (C05).', { notify: 'Seller' }), end('Invite seller (BF06)')] },
  { id: 'BF06', title: 'Seller invitation and application', priority: ['MVP'], trigger: 'Brand invites (B12) or seller applies (C11).', actors: 'Brand, LIVE Seller.', statuses: 'Invited → Viewed → Accepted, Declined, Countered or Expired; Withdrawn by brand.', notify: 'Invite (in-app, email); responses; expiry warning at 24 h.', screens: 'B12, C09, C10, C11',
    nodes: [start('Invite or apply'), st('Brand', 'Send invitation', 'B12', 'Invited', 'Seller'), st('Seller', 'Open job detail', 'C10', 'Viewed'), dec('Responds within 48 h?', '<b>Expired.</b> Brand resends or invites the next seller.', { status: 'Expired', notify: 'Brand' }), dec('Not declined?', '<b>Declined</b> with reason; brand sees next suggestions (B12).', { status: 'Declined', notify: 'Brand' }), dec('Accepts as offered?', '<b>Counter-offer</b> loop in B12 / C11 until accept or decline.', { status: 'Countered', notify: 'Other party' }), st('Seller', 'Accept', 'C11', 'Accepted', 'Brand'), end('Contract (BF07)')] },
  { id: 'BF07', title: 'Contract and compensation confirmation', priority: ['MVP'], trigger: 'Seller accepts.', actors: 'System, Brand, LIVE Seller.', statuses: 'Contract: Draft → Signed by one → Signed by both; campaign → Scheduled when booth confirmed.', notify: 'Signature requests; reminders at 12 h; booking confirmation to all.', screens: 'B14, C12, C03, O06',
    nodes: [start('Seller accepted'), dec('Seller identity and payout verified?', '<b>Accept blocked;</b> seller completes C03 first.', { notify: 'Seller' }), st('System', 'Generate contract from campaign terms', 'B14, C12', 'Contract draft'), st('Brand', 'Brand signs', 'B14'), st('Seller', 'Seller signs', 'C12', 'Signed by both'), dec('Both signed before the hold expires?', '<b>Hold expires;</b> brand re-selects a slot (B13); seller re-confirms.', { notify: 'Brand, seller' }), st('System', 'Booking confirmed', 'O06', 'Scheduled', 'Brand, seller, studio'), end('Studio prep (BF08–BF10)')] },
  { id: 'BF08', title: 'Studio booking', priority: ['MVP'], trigger: 'Campaign step 7, or a confirmed seller.', actors: 'System, Location Manager, Brand.', statuses: 'Booking: Hold → Confirmed → Checked in → In progress → Completed; or Cancelled, No-show, Expired.', notify: 'Hold created; hold expiring; confirmed; cancellation with fee.', screens: 'B07, B13, O05, O06, B14',
    nodes: [start('Slot requested'), st('System', 'Create hold on booth', 'O05', 'Hold'), dec('Booth free incl. buffers?', '<b>Refused by the server;</b> alternatives offered: booth, time, location.'), dec('Contract signed before hold expires?', '<b>Hold expires;</b> slot released.', { status: 'Expired', notify: 'Brand' }), dec('Producer assignable?', '<b>Needs action</b> in O06 / O07; brand told if time may change.', { notify: 'Location Manager' }), st('Location Manager', 'Confirm booking', 'O06', 'Confirmed', 'Brand, seller, producer'), dec('Not cancelled before the LIVE?', '<b>Cancellation:</b> fee shown first (B14), booth released, parties notified.', { status: 'Cancelled' }), end('Booked (BF09, BF10)')] },
  { id: 'BF09', title: 'Product shipping and receiving', priority: ['MVP'], trigger: 'Booking confirmed.', actors: 'Brand, Inventory Coordinator.', statuses: 'Shipment: Expected → Received / Short / Overdue.', notify: 'Shipping reminder; overdue at cutoff; short or damaged.', screens: 'B14, O09, O10, O11',
    nodes: [start('Booking confirmed'), st('Brand', 'Ship samples, add tracking', 'B14', 'Expected'), st('Inventory', 'Receive and count', 'O09'), dec('Arrived before cutoff (48 h)?', '<b>Overdue:</b> brand and manager notified; reschedule or cancel by policy.', { status: 'Overdue', notify: 'Brand, manager' }), dec('Count and condition OK?', '<b>Short or damaged:</b> photo, brand asked to resend; producer briefed.', { status: 'Short', notify: 'Brand, producer' }), st('Inventory', 'Store on shelf', 'O11', 'Received', 'Brand timeline (B14)'), end('Samples ready')] },
  { id: 'BF10', title: 'Producer scheduling', priority: ['MVP'], trigger: 'Booking confirmed; gap check 72 h ahead.', actors: 'Location Manager, Studio Producer.', statuses: 'Booking needs action until a producer is assigned.', notify: 'Gap alert; assignment to producer; seller sees producer name.', screens: 'O06, O07, O08, C14',
    nodes: [start('Unassigned session'), st('System', 'List gaps 72 h ahead', 'O07'), st('Location Manager', 'Assign producer', 'O07'), dec('Producer available and skilled?', '<b>Assign another</b> or escalate; brand told if start may move.', { notify: 'Manager, brand' }), st('Producer', 'Prepare session kit', 'O08'), dec('Kit passes check?', '<b>Swap from backup kit</b> (O08); repair logged.'), end('Producer and kit on booking (O06)')] },
  { id: 'BF11', title: 'Seller check-in', priority: ['MVP'], trigger: 'LIVE day; reminders at 24 h and 2 h.', actors: 'LIVE Seller, front desk, producer, Location Manager.', statuses: 'Booking → Checked in; campaign → In progress; or No-show.', notify: 'Reminders; producer on check-in; no-show alert.', screens: 'C13, C14, C15, O12, O23',
    nodes: [start('Seller travels'), st('Seller', 'Arrive, show code', 'C15, O12'), dec('Within check-in window?', '<b>Too early:</b> opens 60 min before arrival time.'), dec('Checked in by arrival + 15 min?', '<b>No-show:</b> producer calls; manager chooses wait, backup seller (O23) or reschedule.', { status: 'No-show', notify: 'Brand, manager' }), dec('Photo ID matches profile?', '<b>Not checked in;</b> manager review; brand told start may move.'), st('Front desk', 'Confirm check-in', 'O12', 'Checked in', 'Producer'), end('Readiness (BF12)')] },
  { id: 'BF12', title: 'Pre-LIVE readiness', priority: ['MVP'], trigger: 'Seller checked in.', actors: 'LIVE Seller, Studio Producer, Location Manager.', statuses: 'Readiness 0–8 of 8; Go / No-go.', notify: 'Brand if start slips more than 10 minutes.', screens: 'C16, C17, O13, O08',
    nodes: [start('Checked in'), st('Seller', 'Read briefing, acknowledge', 'C16'), st('Producer', 'Compliance check of seller’s plan', 'O13'), dec('Claims within the brief?', '<b>Corrected brief;</b> seller re-acknowledges (C16).'), st('Seller', 'TikTok login and showcase on studio phone', 'C17', '', '', true), st('Producer', 'Camera, audio, network test', 'O13'), dec('All 8 items pass?', '<b>Delay start,</b> swap kit or booth; manager override needs a reason.', { notify: 'Brand if > 10 min' }), st('Producer', 'Give Go', 'O13, C17', 'Ready'), end('LIVE (BF13)')] },
  { id: 'BF13', title: 'LIVE session operations', priority: ['MVP', 'P2'], trigger: 'Producer gives Go.', actors: 'LIVE Seller, Studio Producer, Location Manager.', statuses: 'Session: LIVE → Completed, Interrupted, Ended early (partial).', notify: 'Incidents (High → brand immediately); emergency stop to all parties.', screens: 'C18, O14, O15, O16, O17', note: 'Vyralink never controls the TikTok stream; start and end happen in TikTok on the studio device.',
    nodes: [start('Go given'), st('Seller', 'Start LIVE in TikTok on cue', 'C18', 'LIVE', '', true), st('Producer', 'Monitor; enter metrics every 30 min', 'O14, O15'), dec('Stream healthy?', '<b>Incident</b> (O16): runbook, escalate at 5 / 15 min; may end early (partial).', { status: 'Interrupted', notify: 'Brand if High' }), dec('Conduct within rules?', '<b>Correct on air;</b> serious → emergency stop instruction (O14).', { notify: 'Brand, manager' }), st('Seller', 'End LIVE in TikTok on cue', 'C18', '', '', true), st('Producer', 'Closeout', 'O17', 'Completed (results pending)'), end('Results (BF15)')] },
  { id: 'BF14', title: 'Customer purchase and fulfillment', priority: ['MVP'], trigger: 'Viewer watches the LIVE.', actors: 'Customer, TikTok Shop, merchant (brand).', statuses: 'Order: Placed → Fulfilled → Completed or Refunded (in TikTok Shop).', notify: 'Handled by TikTok Shop, not Vyralink.', screens: 'F05, B15, C21', note: 'Entirely outside Vyralink. Vyralink only imports the resulting reports.',
    nodes: [start('Viewer in LIVE'), st('Customer', 'Views pinned product', '', '', '', true), dec('Buys?', '<b>No order.</b> Counts toward a zero-sales result if nobody buys.'), st('Customer', 'Checkout and pay in TikTok Shop', '', 'Order placed', '', true), st('Merchant', 'Fulfil in Seller Center', '', 'Fulfilled', '', true), dec('Kept after returns window?', '<b>Refund by TikTok Shop;</b> appears in the refunds report; deducted in F05.', { status: 'Refunded' }), end('Order in imported report')] },
  { id: 'BF15', title: 'LIVE analytics ingestion', priority: ['MVP', 'P2'], trigger: 'Session closeout.', actors: 'Producer or finance, system.', statuses: 'Results: Delayed → Imported (pending verification) → Locked.', notify: 'Reminder at 24 h if missing; brand and seller when imported.', screens: 'O17, A06, B15, C19, F05', note: 'Phase 2: automatic sync only through access TikTok authorizes.',
    nodes: [start('Session closed'), dec('Report available?', '<b>Delayed:</b> B15 shows “Delayed”; reminder at 24 h.', { status: 'Delayed' }), st('Producer or finance', 'Export TikTok Shop report', '', '', '', true), st('Producer or finance', 'Upload CSV at closeout', 'O17'), dec('File matches template?', '<b>Import errors</b> listed; fix mapping (A06), re-upload.'), dec('Orders attributed to this LIVE?', '<b>Unattributed orders excluded</b> with reason (F05).'), st('System', 'Store results', 'B15, C19', 'Imported', 'Brand, seller'), end('Earnings and invoices (BF16, BF17)')] },
  { id: 'BF16', title: 'Creator earnings calculation', priority: ['MVP'], trigger: 'Results imported.', actors: 'System, Finance Administrator.', statuses: 'Ledger: Provisional → Locked → Scheduled → Paid; On hold; Adjusted.', notify: 'Seller on each change; dispute updates.', screens: 'C20, C21, F03, F05, A08',
    nodes: [start('Results imported'), st('System', 'Base pay = rate × studio-log hours', 'F03, C21', 'Locked'), st('System', 'Commission and bonus on eligible sales so far', 'C21', 'Provisional', 'Seller'), dec('No new refunds?', '<b>Recalculate</b> commission and bonus check (C21).', { notify: 'Seller' }), dec('Returns window closed?', '<b>Stays Provisional</b> until [DATE].'), dec('Amount undisputed?', '<b>Hold disputed part</b> (A08); rest continues.', { status: 'On hold' }), st('Finance', 'Lock results', 'F05', 'Locked'), end('Payout run (BF18)')] },
  { id: 'BF17', title: 'Creator Hub invoicing', priority: ['MVP'], trigger: 'Session delivered; results imported.', actors: 'System, Finance Administrator, Brand Owner.', statuses: 'Invoice: Draft → Issued → Paid; Overdue; Disputed; Credited.', notify: 'Invoice issued; payment failed; overdue reminders.', screens: 'F02, F05, B16, O24, A08',
    nodes: [start('Session delivered'), st('System', 'Issue production fee invoice', 'F02, B16', 'Issued', 'Brand Owner'), st('System', 'Draft performance fee at import', 'F02', 'Draft'), dec('Results locked?', '<b>Draft waits</b> for the returns window.'), st('Finance', 'Issue final performance fee', 'F02', 'Issued', 'Brand Owner'), dec('Paid by due date?', '<b>Provider retries;</b> reminders; after grace, bookings flagged (O24).', { status: 'Overdue', notify: 'Brand, manager' }), dec('Not disputed?', '<b>Amount paused</b>; case in A08; outcome → credit note.', { status: 'Disputed' }), end('Paid; revenue recognized (F01)')] },
  { id: 'BF18', title: 'Payment reconciliation', priority: ['MVP'], trigger: 'Provider events; payout schedule.', actors: 'Finance Administrator, second approver, payment provider.', statuses: 'Payout: Scheduled → Processing → Paid or Failed.', notify: 'Seller on payout and failure; approver request.', screens: 'F04, F05, C22, A07',
    nodes: [start('Provider events'), st('System', 'Match charges, deposits, fees to invoices', 'F05'), dec('Matched automatically?', '<b>Manual match;</b> unknown deposits investigated.'), st('Finance', 'Build payout run from Locked lines', 'F04'), dec('Seller has no holds?', '<b>Held:</b> tax form, payout account or dispute; seller told.', { notify: 'Seller' }), dec('Approved (two people if large)?', '<b>Run waits</b> for the second approver.'), st('Provider', 'Send payouts', 'F04', 'Processing', '', true), dec('Payout succeeded?', '<b>Failure queue;</b> seller fixes account (C22); retry.', { status: 'Failed', notify: 'Seller' }), end('Ledger Paid; period closed')] },
  { id: 'BF19', title: 'Campaign reporting', priority: ['MVP'], trigger: 'Results locked.', actors: 'System, Brand, platform admin.', statuses: 'Campaign: In progress → Completed; Disputed.', notify: 'Report ready to brand; dispute updates.', screens: 'B15, B17, B08, A08, C23, B10',
    nodes: [start('Results locked'), st('System', 'Compile report: GMV, orders, hours, refunds, cost, sources', 'B15'), dec('All sources final?', '<b>Marked Provisional</b> with what is pending.'), st('System', 'Add producer notes and incidents', 'B15'), st('System', 'Send report', 'B15, B17', 'Completed', 'Brand'), dec('Brand accepts results?', '<b>Dispute</b> (A08): evidence 5 days, decision, adjustments.', { status: 'Disputed', notify: 'All parties' }), st('System', 'Update seller profile', 'C23, B10'), end('Repeat? (BF20)')] },
  { id: 'BF20', title: 'Repeat campaign', priority: ['MVP', 'P3'], trigger: 'Brand reads the report.', actors: 'Brand, LIVE Seller, system.', statuses: 'New campaign: Draft → Published → Recruiting / Scheduled.', notify: 'Re-invite to seller.', screens: 'B15, B08, B07, B12, B13, M01', note: 'MVP: duplicate campaign. Phase 3: AI recommendations (M01).',
    nodes: [start('Report read'), dec('Repeat?', '<b>Archive campaign</b> (B08).', { status: 'Archived' }), st('Brand', 'Duplicate campaign with same terms', 'B08, B07', 'Draft'), st('Brand', 'Re-invite same seller', 'B12', 'Invited', 'Seller'), dec('Seller available?', '<b>Suggest similar sellers</b> (B09, M01 in Phase 3).'), dec('Same studio slot free?', '<b>Alternatives</b> (B13).'), end('New campaign Recruiting')] },
  { id: 'BF21', title: 'Multi-location expansion', priority: ['P2'], trigger: 'Leadership approves a new studio.', actors: 'Super Admin, Location Manager, staff.', statuses: 'Location: Opening soon (holds only) → Open.', notify: 'Staff invites; brands when the location opens.', screens: 'O03, O04, O08, O21, A11, O02, B07',
    nodes: [start('New studio approved'), st('Super Admin', 'Create location; enable flag', 'O03, A11', 'Opening soon'), st('Location Manager', 'Set up booths and kit', 'O04, O08'), st('Location Manager', 'Invite staff', 'O21', '', 'New staff'), dec('Practice LIVEs pass?', '<b>Fix kit or network;</b> repeat practice sessions.'), dec('Readiness review approved?', '<b>Stay Opening soon</b> (holds only).'), st('Super Admin', 'Open location', 'O02, B07', 'Open', 'Brands'), end('Bookable everywhere')] },
];

const flowSizes = {};
for (const f of FL) flowSizes[f.id] = flowBoard('flows', f);

// ---------------------------------------------------------------- journeys (D7)
const J = [
  { id: 'J1', title: 'Brand Owner · from sign-up to repeat', priority: ['MVP'], trigger: 'GlowSkin Beauty signs up.', actors: 'Maya Chen (Brand Owner).', statuses: 'Organization Verified; campaign Draft → Completed.', notify: 'As in BF01–BF07, BF19.', screens: 'B01–B18',
    nodes: [start('Sign up'), st('Brand Owner', 'Create account', 'B01'), st('Brand Owner', 'Verify company', 'B02'), dec('Documents accepted?', '<b>Error path:</b> B02 Rejected state → upload new proof of address → resubmit.'), st('Brand Owner', 'Onboarding', 'B03'), st('Brand Owner', 'Add product', 'B05, B06'), st('Brand Owner', 'Create campaign', 'B07'), st('Brand Owner', 'Find and invite seller', 'B09, B10, B12'), dec('Seller accepts?', '<b>Error path:</b> B12 Declined state → invite next suggestion.'), st('Brand Owner', 'Track booking', 'B14, B13'), dec('Samples arrive in time?', '<b>Error path:</b> B14 reschedule or cancel by policy (fee shown first).'), st('Brand Owner', 'Read results', 'B15'), st('Brand Owner', 'Pay invoices', 'B16'), end('Repeat (B08)')] },
  { id: 'J2', title: 'LIVE Seller · from sign-up to payout', priority: ['MVP'], trigger: 'Sarah Johnson signs up on her phone.', actors: 'Sarah Johnson (LIVE Seller).', statuses: 'Profile → certified → Booked → Paid.', notify: 'Invites, contract, reminders, results, payouts.', screens: 'C01–C27',
    nodes: [start('Sign up'), st('Seller', 'Account, profile, skills', 'C01, C02, C04'), dec('Payout set up?', '<b>Error path:</b> C10 Accept blocked → C03 payout setup.'), st('Seller', 'Academy and final check', 'C05, C06, C07'), st('Seller', 'Find job, read details', 'C09, C10'), st('Seller', 'Accept or counter', 'C11'), st('Seller', 'Sign contract', 'C12'), st('Seller', 'Plan the day', 'C13, C14'), dec('Arrives on time?', '<b>Error path:</b> C14 “Running late” → producer notified; C15 Late state.'), st('Seller', 'Check in, briefing, checklist', 'C15, C16, C17'), dec('Stream stays up?', '<b>Error path:</b> C18 Stream dropped → stay on set; producer reconnects.'), st('Seller', 'Go LIVE and finish', 'C18, C19'), st('Seller', 'Check pay breakdown', 'C20, C21'), dec('Payout succeeds?', '<b>Error path:</b> C22 Failed payout → update account → retried.'), end('Paid (C22)')] },
  { id: 'J3', title: 'Brand Marketing Manager · campaign under approval', priority: ['MVP'], trigger: 'Leo Park is invited to GlowSkin.', actors: 'Leo Park (Brand Marketing Manager), Maya Chen (approver).', statuses: 'Draft → Pending approval → Published.', notify: 'Approval request; decision.', screens: 'B04, B07, B08, B17, B12, B15, B16, B18',
    nodes: [start('Accept invite'), st('Marketing Manager', 'Dashboard', 'B04'), st('Marketing Manager', 'Create campaign over budget threshold', 'B07'), st('Marketing Manager', 'Publish → Pending approval', 'B08'), dec('Owner approves?', '<b>Error path:</b> declined → Draft with comments (B07).'), st('Marketing Manager', 'Invite sellers', 'B12'), dec('Can open Billing?', '<b>Error path:</b> 403 (B18 state) → Request access.'), st('Marketing Manager', 'Read results', 'B15'), end('Campaign completed')] },
  { id: 'J4', title: 'Studio Producer · one LIVE day', priority: ['MVP'], trigger: 'Jordan P. starts a shift.', actors: 'Jordan P. (Studio Producer).', statuses: 'Booking Checked in → In progress → Completed.', notify: 'Assignment, check-in, incidents.', screens: 'O07, O08, O12, O13, O14, O15, O16, O17, O18',
    nodes: [start('Shift starts'), st('Producer', 'See assignments and kit', 'O07, O08'), st('Producer', 'Seller checked in', 'O12'), st('Producer', 'Readiness and compliance', 'O13'), dec('All checks pass?', '<b>Error path:</b> network fails → backup line or booth; delay start.'), st('Producer', 'Monitor LIVE, enter metrics', 'O14, O15'), dec('No incidents?', '<b>Error path:</b> log incident (O16), escalate, resume or end early.'), st('Producer', 'Closeout with report upload', 'O17'), st('Producer', 'Return samples to stock', 'O18'), end('Session completed')] },
  { id: 'J5', title: 'Location Manager · running the studio', priority: ['MVP', 'P2'], trigger: 'Rosa Diaz opens the day.', actors: 'Rosa Diaz (Location Manager).', statuses: 'Bookings, rota, incidents.', notify: 'Gaps, conflicts, High incidents.', screens: 'O01, O05, O06, O07, O14, O16, O19, O24',
    nodes: [start('Morning'), st('Location Manager', 'Today’s dashboard', 'O01'), st('Location Manager', 'Bookings and holds', 'O06, O05'), dec('Every booking has a producer?', '<b>Error path:</b> O07 gap → assign or escalate.'), st('Location Manager', 'Watch the floor', 'O14'), dec('Incidents under control?', '<b>Error path:</b> O16 High incident → decide continue, move booth or end.'), st('Location Manager', 'Review utilization', 'O19'), end('Day closed')] },
  { id: 'J6', title: 'Inventory Coordinator · samples in and out', priority: ['MVP'], trigger: 'Shipments due this week.', actors: 'Sam K. (Inventory Coordinator).', statuses: 'Expected → Received → In session → Returned.', notify: 'Overdue, short, discrepancy.', screens: 'O09, O10, O11, O18',
    nodes: [start('Shipments due'), st('Inventory', 'Receive and count', 'O09'), dec('Complete and on time?', '<b>Error path:</b> overdue or short → brand notified; booking flagged.'), st('Inventory', 'Stock and reserve', 'O10'), st('Inventory', 'Move to booth and back', 'O11'), dec('Balanced after LIVE?', '<b>Error path:</b> discrepancy → incident (O16).'), st('Inventory', 'Return or dispose', 'O18'), end('Campaign samples closed')] },
  { id: 'J7', title: 'Finance Administrator · month in finance', priority: ['MVP', 'P2'], trigger: 'Results imported across sessions.', actors: 'Alex M. (Finance Administrator).', statuses: 'Locked results; invoices issued; payouts paid.', notify: 'Disputes, failures, overdue.', screens: 'F01, F05, F02, F03, F04, F07, A08',
    nodes: [start('Work queue'), st('Finance', 'Overview and queue', 'F01'), st('Finance', 'Lock results', 'F05'), dec('No attribution disputes?', '<b>Error path:</b> A08 case; hold only disputed amount.'), st('Finance', 'Issue performance-fee invoices', 'F02'), st('Finance', 'Review seller ledger', 'F03'), st('Finance', 'Approve payout run', 'F04'), dec('All payouts succeed?', '<b>Error path:</b> failure queue; seller updates account (C22).'), st('Finance', 'Location results', 'F07'), end('Period closed')] },
  { id: 'J8', title: 'Super Admin · platform oversight', priority: ['MVP'], trigger: 'Daily admin review.', actors: 'Taylor Reed (Super Administrator).', statuses: 'Verifications, moderation, disputes.', notify: 'Queues over SLA.', screens: 'A01, A04, A05, A08, A09, A11',
    nodes: [start('Daily review'), st('Super Admin', 'Platform health and queues', 'A01'), st('Super Admin', 'Verifications', 'A04'), st('Super Admin', 'Moderation', 'A05'), st('Super Admin', 'Disputes', 'A08'), dec('Need to see what a brand sees?', '<b>Read-only view</b> with ticket, 30 min, logged (A02, A09).', { noLabel: 'Yes', yesLabel: 'No' }), st('Super Admin', 'Feature flags for pilots', 'A11'), end('Queues within SLA')] },
];
const jSizes = {};
for (const j of J) jSizes[j.id] = flowBoard('journeys', j);

// ---------------------------------------------------------------- edge-case catalog (§11)
const flowLink = (ids) => ids.split(', ').map((id) => `<a href="../flows/${id}.dc.html">${id}</a>`).join(', ');
const E = [
  ['Brand verification failure', 'A04 reviewer', 'B02 Rejected with reason; fields kept', 'Upload the corrected document and resubmit', 'B02, A04', 'BF01'],
  ['Product rejection', 'A05 moderator', 'B05 Rejected with reviewer note', 'Edit claim or add evidence; resubmit', 'B05, A05', 'BF02'],
  ['Restricted product claims', 'A05, O13 compliance check, producer on air', 'Claim blocked in review; corrected brief; on-air correction', 'Seller re-acknowledges brief; compliance incident if said on air', 'B06, C16, O13, O16', 'BF02, BF12, BF13'],
  ['Missing product samples', 'O09 at cutoff', 'Overdue on B14 timeline and O09', 'Brand ships or chooses reschedule / cancel by policy', 'O09, O10, B14', 'BF09'],
  ['Seller declines invitation', 'C11', 'B12 Declined with reason', 'Invite next suggested seller', 'B12, C11', 'BF06'],
  ['Seller cancels', 'C13 / C11', 'Brand notified; booking flagged', 'Free until 72 h; later hurts reliability; brand re-matches while hold kept 24 h', 'C10, B12, O06', 'BF06, BF08'],
  ['Seller no-show', 'O12 at arrival + 15 min', 'No-show state on O12 and C15', 'Wait, certified backup seller (O23) or reschedule; 2 no-shows pause account', 'O12, O23, C15', 'BF11'],
  ['Studio fully booked', 'B07 step 7, O05', 'No capacity message', 'Pick suggested slot or another location', 'B07, B13, O05', 'BF03, BF08'],
  ['Double-booking prevention', 'Server on save', 'Refusal naming the conflicting booking', 'Choose another booth or time; buffers included', 'O05, B13', 'BF08'],
  ['Producer unavailable', 'O07 gap check', 'Gap flagged 72 h ahead', 'Reassign from rota or escalate; brand told if time moves', 'O07, O06', 'BF10'],
  ['Camera or internet failure', 'O13 tests, O14 monitor', 'Degraded / Interrupted card; incident', 'Swap kit or backup line; escalate at 5 / 15 min', 'O08, O13, O14, O16', 'BF12, BF13'],
  ['TikTok Shop connection failure', 'B03 / B18 connect, A06', 'Connection failed; mode stays Manual', 'Retry later; keep manual import', 'B03, B18, A06', 'BF15'],
  ['LIVE session interrupted', 'O14', 'Interrupted status, minutes lost', 'Reconnect and resume, or end early as partial', 'O14, O16, C18', 'BF13'],
  ['Zero sales', 'O17 closeout', 'Recorded as a result, not an error', 'Base pay applies; commission and performance fee $0; report explains', 'O17, B15, C21', 'BF15, BF16'],
  ['Incorrect sales attribution', 'F05, seller or brand question', 'Data review / dispute case', 'Compare order IDs; hold only disputed amount; decision with evidence', 'F05, C21, A08', 'BF15, BF16'],
  ['Delayed analytics', 'O17, B15', '“Delayed” tag with expected time', 'Reminder at 24 h; manual import', 'B04, B15, O17', 'BF15'],
  ['Returns and refunds', 'Refunds report import', 'Provisional figures change; credit notes later', 'Recalculate until lock; after lock use adjustments / credit notes', 'F05, F02, C21', 'BF14, BF16, BF17'],
  ['Inventory shortage', 'B06, O10', 'Warning when stock is below expected units', 'Restock, lower target, or reschedule', 'B06, O10, B07', 'BF03, BF09'],
  ['Commission disagreement', 'C21 “Question this figure”', 'On hold for the disputed part', 'Finance review → A08 decision → ledger adjustment', 'C21, F03, A08', 'BF16'],
  ['Payment failure', 'Provider', 'B16 card declined; C22 payout failed', 'Update card or account; retries; grace period', 'B16, F02, F04, C22', 'BF17, BF18'],
  ['Brand cancellation', 'B14', 'Fee shown before confirming', 'Policy fee applied; seller, studio notified; booth released', 'B14, O06', 'BF08'],
  ['Partial campaign completion', 'O16, O17', 'Partial flag with minutes lost', 'Pay and fees per contract; 7-day dispute window', 'B14, O17, C19', 'BF13'],
  ['Disputed deliverables', 'Brand on B08', 'Campaign status Disputed', 'Evidence 5 days; admin decision; adjustments', 'B08, A08, F03', 'BF19'],
  ['Incomplete seller certification', 'C10, B11, O23', 'Accept / booking blocked with reason', 'Seller takes the course (C05) and passes (C07)', 'C05, C07, C10, B11', 'BF05'],
  ['Unauthorized role access', 'Server on every request', '403 with “Request access”', 'Owner grants role or explains; attempt logged', 'B18, O21, A09', 'All flows'],
];
const edge = `<div style="width:100%; max-width:1440px; margin:0 auto; ${FONT}; color:#1a1a1a; background:#ffffff; padding:48px; box-sizing:border-box; display:flex; flex-direction:column; gap:24px">
<span style="font-size:13px; font-weight:800; letter-spacing:0.12em">§11 · EDGE CASES</span>
<h1 style="margin:0; font-size:40px">Edge cases and recovery</h1>
${p('Every edge case from the brief, where it is detected, what the person sees, and how it is recovered. Each links to its screens and flowchart.', { size: 16 })}
${table(['#', 'Edge case', 'Detected by', 'What the user sees', 'Recovery action', 'Screens', 'Flow'], E.map((e, i) => [String(i + 1), `<b>${e[0]}</b>`, e[1], e[2], e[3], linkIds('edge', e[4]), e[5] === 'All flows' ? 'All flows' : flowLink(e[5])]), { min: 1200 })}
${card('Rules that apply to every error state', ul(['Every error names what happened and offers a next step; no dead ends.', 'Money is never silently changed: holds, adjustments and credit notes carry a reason and are logged.', 'Missing data is shown as Delayed or Unavailable, never as zero.', 'Permissions are checked on the server; the 403 screen offers Request access.'], { size: 14 }))}
</div>`;
out('project/edge/EdgeCases.dc.html', doc('Edge cases and recovery', 1440, 2600, edge));

// ---------------------------------------------------------------- canvas.json (merge)
const cpath = path.join(ROOT, 'project/canvas.json');
const canvas = JSON.parse(fs.readFileSync(cpath, 'utf8'));
for (const pg of [{ id: 'bflows', name: '7 · Business flowcharts (BF01–BF21)' }, { id: 'journeys', name: '8 · Edge cases and user journeys' }]) if (!canvas.pages.some((x) => x.id === pg.id)) canvas.pages.push(pg);
const COLX = 3300;
let y = 0;
for (let r = 0; r < FL.length; r += 3) {
  const rowF = FL.slice(r, r + 3);
  rowF.forEach((f, c) => { const file = `flows/${f.id}.dc.html`; canvas.boards[file] = { x: c * COLX, y, w: flowSizes[f.id].w, h: flowSizes[f.id].h, page: 'bflows', is_interactive: true, title: `${f.id} · ${f.title}` }; if (!canvas.order.includes(file)) canvas.order.push(file); });
  y += Math.max(...rowF.map((f) => flowSizes[f.id].h)) + 120;
}
canvas.boards['edge/EdgeCases.dc.html'] = { x: 0, y: 0, w: 1440, h: 2600, page: 'journeys', expand: 'fill', is_interactive: true, title: '§11 · Edge cases and recovery' };
if (!canvas.order.includes('edge/EdgeCases.dc.html')) canvas.order.push('edge/EdgeCases.dc.html');
let jy = 0;
for (const j of J) { const file = `journeys/${j.id}.dc.html`; canvas.boards[file] = { x: 1520, y: jy, w: jSizes[j.id].w, h: jSizes[j.id].h, page: 'journeys', is_interactive: true, title: `${j.id} · ${j.title}` }; if (!canvas.order.includes(file)) canvas.order.push(file); jy += jSizes[j.id].h + 120; }
canvas.notes.bflowsTitle = { x: 0, y: -300, text: '§10 · 21 business flowcharts', kind: 'title1', maxW: 3 * COLX, page: 'bflows' };
canvas.notes.bflowsTip = { x: 3 * COLX, y: 0, w: 380, text: 'Each flow: header (trigger, actors, statuses, notifications, screens), then start → numbered steps → end. Diamonds are decisions; the dashed “No” card below is the failure or alternate path and its recovery. Dashed step cards happen outside Vyralink (TikTok Shop). Screen IDs are links.', fill: 'gray', page: 'bflows' };
canvas.notes.journeysTitle = { x: 0, y: -300, text: '§11 edge cases · D7 connected user journeys', kind: 'title1', maxW: 8000, page: 'journeys' };
if (canvas.notes.overviewTitle) canvas.notes.overviewTitle.text = 'Vyralink + Creator Hub · Batches 1–5';
fs.writeFileSync(cpath, JSON.stringify(canvas, null, 2));
written.push('project/canvas.json');
fs.writeFileSync(path.join(ROOT, 'batch5-files.json'), JSON.stringify(written));
console.log(written.length, 'files; widest flow', Math.max(...Object.values(flowSizes).map((s) => s.w)), 'widest journey', Math.max(...Object.values(jSizes).map((s) => s.w)));
