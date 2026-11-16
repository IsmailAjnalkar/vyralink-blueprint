// Batch 4: Finance (F01–F08), Super Admin (A01–A12), AI matching (M01) + cross-link fixer for earlier boards.
// Usage: node gen4.mjs <rootDir>
import fs from 'node:fs';
import path from 'node:path';
import { doc, FONT, inputStyle, btn, badge, chip, prov, field, sel, area, check, row, col, grid, card, kpi, table, ph, tabs, state, banner, ul, p, dl, sub, bell } from './lib.mjs';

const ROOT = process.argv[2];
const written = [];
const out = (rel, s) => {
  const f = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, s);
  if (!written.includes(rel)) written.push(rel);
  if (s.replace(/&(amp|lt|gt|quot|#\d+);/g, '').includes('&')) console.warn(`WARN raw & in ${rel}`);
  if (s.includes('{{')) console.warn(`WARN {{ in ${rel}`);
};
const EX = prov('Example data');
const sr = (t) => `<span style="position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap">${t}</span>`;

// ---------------------------------------------------------------- cross-folder links
const folderOf = (id) => ({ B: 'brand', C: 'creator', O: 'ops', F: 'fin', A: 'admin', M: 'brand' })[id[0]];
const exists = (id) => /^(B(0[1-9]|1[0-8])|C(0[1-9]|1\d|2[0-7])|O(0[1-9]|1\d|2[0-4])|F0[1-8]|A(0[1-9]|1[0-2])|M01)$/.test(id);
const rel = (from, id) => (folderOf(id) === from ? `${id}.dc.html` : `../${folderOf(id)}/${id}.dc.html`);

const notesBox = (from, id, n) => `<aside aria-label="Spec notes for ${id}" style="flex:1 1 280px; min-width:0; border:1px dashed #8c8c8c; border-radius:8px; padding:16px; background:#fafafa; font-size:13px; line-height:1.5; display:flex; flex-direction:column; gap:14px; box-sizing:border-box">
<div style="display:flex; justify-content:space-between; align-items:center; gap:8px"><span style="font-size:11px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#3d3d3d">Spec notes · ${id}</span>${[].concat(n.priority).map(badge).join(' ')}</div>
<div><b>Purpose.</b> ${n.purpose}</div>
<div><b>Roles.</b> ${n.roles}</div>
<div style="display:flex; flex-direction:column; gap:6px"><b>Rules</b>${ul(n.rules, { size: 13, gap: 4 })}</div>
<div style="display:flex; flex-direction:column; gap:6px"><b>States and errors</b>${ul(n.states, { size: 13, gap: 4 })}</div>
<div><b>Goes to.</b> ${n.links.map((id) => (exists(id) ? `<a href="${rel(from, id)}">${id}</a>` : id)).join(' · ')}</div>
</aside>`;

// ---------------------------------------------------------------- portal shells
const PORTALS = {
  fin: { logo: 'CREATOR HUB <span style="font-weight:500; letter-spacing:0">ops</span>', home: 'O01', switcher: 'Creator Hub · all locations ▾', role: 'Finance Administrator', user: ['Alex M.', 'AM'],
    nav: [['Overview', 'O01'], ['LIVE Control Center', 'O14'], ['Locations', 'O03'], ['Booths', 'O04'], ['Bookings', 'O06'], ['Producers', 'O07'], ['Inventory', 'O10'], ['Sellers', 'O23'], ['Brands', 'O24'], ['Finance', 'F01'], ['Reports', 'O19'], ['Staff', 'O21'], ['Settings', 'O22']], navLabel: 'Operations navigation' },
  admin: { logo: 'VYRALINK <span style="font-weight:500; letter-spacing:0">admin</span>', home: 'A01', switcher: 'Platform · Super Administrator', role: 'Super Administrator', user: ['Taylor Reed', 'TR'],
    nav: [['Platform Overview', 'A01'], ['Organizations', 'A02'], ['Users', 'A03'], ['Verifications', 'A04'], ['Campaign Moderation', 'A05'], ['Commerce Integrations', 'A06'], ['Payments', 'A07'], ['Disputes', 'A08'], ['Audit Logs', 'A09'], ['Security', 'A10'], ['Feature Flags', 'A11'], ['Platform Settings', 'A12']], navLabel: 'Admin navigation' },
  brand: { logo: 'VYRALINK', home: 'B04', switcher: 'GlowSkin Beauty · Brand Owner ▾', role: '', user: ['Maya Chen', 'MC'],
    nav: [['Dashboard', 'B04'], ['Products', 'B05'], ['Campaigns', 'B08'], ['Find Creators', 'B09'], ['LIVE Calendar', 'B13'], ['Analytics', 'B15'], ['Billing', 'B16'], ['Messages', 'B17'], ['Team', 'B18'], ['Settings', 'B18']], navLabel: 'Brand navigation' },
};
const screen = (folder, s) => {
  const P = PORTALS[folder];
  const body = `<div style="width:100%; max-width:1440px; margin:0 auto; ${FONT}; color:#1a1a1a; background:#ffffff; display:flex; flex-direction:column">
<header style="display:flex; flex-wrap:wrap; align-items:center; gap:16px; padding:12px 24px; border-bottom:1px solid #c4c4c4">
<a href="${rel(folder, P.home)}" style="font-weight:800; letter-spacing:0.1em; text-decoration:none; color:#1a1a1a; font-size:16px">${P.logo}</a>
<button type="button" aria-label="Switch context. Current: ${P.switcher.replace(' ▾', '')}" style="min-height:44px; padding:0 12px; border:1px solid #8c8c8c; border-radius:6px; background:#ffffff; font-family:inherit; font-size:14px; font-weight:600; cursor:pointer">${P.switcher}</button>
${P.role ? `<span style="font-size:13px; color:#3d3d3d">${P.role}</span>` : ''}
<input type="search" aria-label="Search" placeholder="Search" style="${inputStyle}; flex:1 1 240px; width:auto">
<span aria-label="Notifications" style="display:inline-flex; align-items:center; min-height:44px; min-width:44px; justify-content:center">${bell}</span>
<span aria-label="Signed in as ${P.user[0]}" style="width:36px; height:36px; border-radius:50%; background:#e6e6e6; border:1px solid #8c8c8c; display:inline-flex; align-items:center; justify-content:center; font-size:13px; font-weight:700">${P.user[1]}</span>
</header>
<div style="display:flex; flex-wrap:wrap; align-items:stretch">
<nav aria-label="${P.navLabel}" style="flex:1 1 220px; min-width:0; background:#f7f7f7; border-right:1px solid #c4c4c4; padding:16px 12px; display:flex; flex-direction:column; gap:4px; box-sizing:border-box">
${P.nav.map(([l, id]) => { const on = l === s.nav; return `<a href="${rel(folder, id)}"${on ? ' aria-current="page"' : ''} style="display:flex; align-items:center; min-height:44px; padding:0 12px; border-radius:6px; text-decoration:none; color:#1a1a1a; font-size:14px; font-weight:${on ? 700 : 500}; background:${on ? '#e0e0e0' : 'transparent'}">${l}</a>`; }).join('\n')}
</nav>
<main style="flex:999 1 560px; min-width:0; padding:32px; display:flex; flex-direction:column; gap:24px; box-sizing:border-box">
<div style="display:flex; flex-wrap:wrap; gap:16px; align-items:flex-end; justify-content:space-between">
<div style="display:flex; flex-direction:column; gap:8px; min-width:0">
<nav aria-label="Breadcrumb" style="font-size:13px; color:#3d3d3d">${(s.crumbs || [s.title]).join(' / ')}</nav>
<div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center"><span style="font-size:12px; font-weight:700; border:1px solid #1a1a1a; border-radius:4px; padding:2px 6px">${s.id}</span><h1 style="margin:0; font-size:28px">${s.title}</h1>${(s.badges || []).join('')}</div>
</div>
${s.actions ? row(s.actions, { gap: 8 }) : ''}
</div>
${s.subnav || ''}
<div style="display:flex; flex-wrap:wrap; gap:24px; align-items:flex-start">
<div style="flex:999 1 560px; min-width:0; display:flex; flex-direction:column; gap:24px">${s.main}</div>
${notesBox(folder, s.id, s.notes)}
</div>
</main>
</div>
</div>`;
  out(`project/${folder}/${s.id}.dc.html`, doc(`${s.id} ${s.title}`, 1440, s.h, body));
};
const subnav = (folder, items, active) => `<nav aria-label="Section" style="display:flex; flex-wrap:wrap; gap:4px; border-bottom:1px solid #c4c4c4">${items.map(([l, id]) => { const on = id === active; return `<a href="${rel(folder, id)}"${on ? ' aria-current="page"' : ''} style="display:inline-flex; align-items:center; min-height:44px; padding:0 12px; text-decoration:none; color:#1a1a1a; font-size:14px; font-weight:${on ? 700 : 500}; border-bottom:3px solid ${on ? '#1a1a1a' : 'transparent'}">${l}</a>`; }).join('')}</nav>`;
const FSUB = [['Overview', 'F01'], ['Invoices and AR', 'F02'], ['Seller ledger', 'F03'], ['Payouts', 'F04'], ['Reconciliation', 'F05'], ['Campaign profitability', 'F06'], ['Location profitability', 'F07'], ['Expenses', 'F08']];
const fsn = (id) => subnav('fin', FSUB, id);
const money = (n) => n;

// ---------------------------------------------------------------- Finance
const F = [];
F.push({ id: 'F01', title: 'Finance overview', h: 1600, badges: [badge('MVP'), EX], crumbs: ['Finance', 'Overview'],
  notes: { priority: 'MVP', purpose: 'Creator Hub’s money position and the finance work queue.', roles: 'Finance Administrator; Location Managers see their location’s summary.',
    rules: ['Revenue = Creator Hub service fees (production, studio, performance, packages). GMV is brand sales and never counted as revenue.', 'Seller compensation is an expense, accrued when earned and paid in payout runs.', 'Vyralink holds no customer funds and no escrow: brand charges and seller payouts are separate flows through the payment provider.', 'Recognition (as configured with your accountant): production fee when the session is delivered; performance fee when results are locked.'],
    states: ['Provider sync delayed → figures show last sync time', 'Period not closed → “Provisional” label'], links: ['F02', 'F03', 'F04', 'F05', 'F07'] },
  main: [
    grid([kpi('Recognized service revenue · 30 days', '$71,000', 'Fees for delivered sessions and locked results'), kpi('Pending invoices', '$8,940', '12 performance-fee drafts waiting for reconciliation'), kpi('Accounts receivable', '$14,250', '$2,400 overdue (1 brand)'), kpi('Seller compensation · 30 days', '$29,400', '$24,100 paid · $5,300 accrued'), kpi('Next payout run', '$5,300', '14 sellers · needs approval'), kpi('Payment processing fees · 30 days', '$1,410', 'From provider statements', 'Imported')], 220),
    card('Context: brand sales (not Creator Hub revenue)', row([kpi('GMV from LIVEs · 30 days', '$412,000', 'Brands’ TikTok Shop sales; basis for performance fees', 'Imported')])),
    card('Work queue', table(['Item', 'Count', 'Oldest', ''], [['Sessions waiting to lock (returns window closed)', '7', '3 days', btn('Reconcile', { ghost: true, href: 'F05.dc.html' })], ['Open finance disputes', '3', '5 days', btn('Open', { ghost: true, href: '../admin/A08.dc.html' })], ['Failed payouts', '1', '1 day', btn('Fix', { ghost: true, href: 'F04.dc.html' })], ['Overdue invoices', '1', '5 days', btn('Chase', { ghost: true, href: 'F02.dc.html' })]], { min: 640 })),
    state('Provider sync delayed', 'Payment provider data last synced 2 hours ago', 'Receivables and payouts may be out of date. Retry, or check the provider status page.', [btn('Retry sync')]),
  ].join('') });

F.push({ id: 'F02', title: 'Brand invoices and receivables', h: 1900, badges: [badge('MVP'), EX], actions: [btn('Create credit note'), btn('New invoice', { primary: true })], crumbs: ['Finance', 'Invoices and AR'],
  notes: { priority: 'MVP', purpose: 'Bill brands for Creator Hub services and track what is owed.', roles: 'Finance Administrator.',
    rules: ['Invoice statuses: Draft → Issued → Paid; or Overdue, Disputed (amount paused), Void, Credited.', 'Every line has a basis (fixed price, hours × rate, % × eligible attributable GMV).', 'Performance-fee invoices are created as Drafts and issued only after results lock (F05).', 'Collection, card storage and reminders run through the payment provider; Vyralink stores tokens and statuses.', 'Prices come from the price book; custom prices need approval.'],
    states: ['Payment failed → provider retries; grace period then bookings flagged (O24)', 'Disputed line → paused, linked to A08', 'Refund after invoicing → credit note'], links: ['F05', 'B16', 'O24', 'A08'] },
  main: [
    grid([kpi('Current', '$11,850'), kpi('1–30 days overdue', '$2,400'), kpi('31–60 days', '$0'), kpi('60+ days', '$0')], 180),
    table(['Invoice', 'Brand', 'Description', 'Basis', 'Amount', 'Status', 'Due'], [
      ['INV-1043', 'GlowSkin Beauty', 'Vitamin C LIVE · performance fee', '7% × $5,840 eligible so far', '$408.80', chip('Draft · waiting for lock'), '—'],
      ['INV-1042', 'GlowSkin Beauty', 'Vitamin C LIVE · production / service fee', 'Per-session package', '$750.00', chip('Issued', 'outline'), 'Net 15'],
      ['INV-1041', 'TechNest', 'Earbuds LIVE · production fee', 'Per-session package', '$750.00', chip('Issued', 'outline'), 'Net 15'],
      ['INV-1040', 'Petal Co.', 'Lip tint LIVE · production fee', 'Per-session package', '$750.00', chip('Paid', 'dark'), 'Paid'],
      ['INV-1036', 'Urban Thread', 'Monthly LIVE retainer', 'Retainer (Phase 2 package)', '$2,400.00', chip('Overdue 5 days', 'alert'), '5 days ago'],
      ['CR-0007', 'GlowSkin Beauty', 'Credit · Spring serum LIVE', '7% × $160 refunded after invoicing', '−$11.20', chip('Applied', 'dark'), '—'],
    ], { min: 1000 }),
    card('INV-1043 · draft detail', col([table(['Line', 'Basis', 'Amount'], [['GMV attributed to the LIVE', 'TikTok Shop report', '$6,000.00'], ['Refunds and cancellations so far', '4 orders', '−$160.00'], ['Eligible attributable GMV (provisional)', 'Final after returns window', '$5,840.00'], ['Performance fee', '7% × eligible', '$408.80']], { min: 520, rowHead: true }), p('At import the draft was $420.00 (7% × $6,000); refunds reduced it. It is issued at the final figure when results lock.', { size: 13, mute: true })])),
    card('Price book · configurable terms', table(['Item', 'Price', 'Basis', 'Priority'], [
      ['Subscription plan', '[PRICE] / month', 'Platform access', badge('MVP')],
      ['Per-session LIVE package', '$750', '3 h booth, producer, standard kit', badge('MVP')],
      ['Extra studio hour', '[PRICE]', 'Per hour beyond the package', badge('MVP')],
      ['Performance fee', '7%', 'Of eligible attributable GMV', badge('MVP')],
      ['Seller sourcing (managed)', '[PRICE] or included', 'Per campaign', badge('MVP')],
      ['Managed LIVE retainer', '[PRICE] / month', 'Bundle of sessions and reporting', badge('P2')],
    ], { min: 720 })),
    state('Dispute', 'GlowSkin disputes nothing; Urban Thread disputes INV-1036', 'Reason: monthly report missing. Amount paused (not cancelled) while A08 case D-0013 is open.', [btn('Open dispute', { href: '../admin/A08.dc.html' })]),
  ].join('') });

F.push({ id: 'F03', title: 'Seller earnings ledger', h: 1600, badges: [badge('MVP'), EX], actions: [btn('Add adjustment'), btn('Export CSV')], crumbs: ['Finance', 'Seller ledger'],
  notes: { priority: 'MVP', purpose: 'Every amount owed to every seller, with its basis and status.', roles: 'Finance Administrator.',
    rules: ['Line types: base pay, commission, bonus, adjustment.', 'Statuses: Provisional → Locked → Scheduled → Paid; Adjusted; On hold (dispute or missing payout details).', 'Commission is recalculated as refunds arrive and locks after the returns window.', 'Manual adjustments need a reason; over $[N] they need a second approver.', 'Ledger lines are append-only; corrections are new lines.'],
    states: ['Refund after lock → negative adjustment on next run', 'Dispute → only the disputed amount on hold'], links: ['F04', 'F05', 'C20', 'C21'] },
  main: [
    row([sel('Seller', ['All sellers', 'Sarah Johnson', 'Jade Morgan', 'Marcus Lee', 'Priya Nair'], { grow: true }), sel('Status', ['All', 'Provisional', 'Locked', 'Scheduled', 'Paid', 'Adjusted', 'On hold'], { grow: true }), sel('Period', ['Last 30 days', 'This year'], { grow: true })], { gap: 12, align: 'flex-end' }),
    table(['Date', 'Seller', 'Session', 'Line', 'Basis', 'Amount', 'Status'], [
      ['Sat', 'Sarah Johnson', 'GlowSkin Vitamin C LIVE', 'Base pay', '$30 × 3 h (studio log)', '$90.00', chip('Locked', 'dark')],
      ['Sat', 'Sarah Johnson', 'GlowSkin Vitamin C LIVE', 'Commission', '5% × $5,840 eligible so far', '$292.00', chip('Provisional')],
      ['Sat', 'Sarah Johnson', 'GlowSkin Vitamin C LIVE', 'Bonus', 'Eligible GMV ≥ $5,000', '$100.00', chip('Provisional')],
      ['Sat', 'Marcus Lee', 'Urban Thread denim LIVE', 'Base pay', 'Contract terms for interrupted sessions', '$70.00', chip('Locked', 'dark')],
      ['Last week', 'Priya Nair', 'Holiday bundle LIVE', 'Commission', '5% × $2,400', '$120.00', chip('On hold · D-0012', 'alert')],
      ['Last week', 'Priya Nair', 'Lumen Skin night oil', 'Adjustment', 'Refund after lock: 5% × $90', '−$4.50', chip('Adjusted', 'outline')],
    ], { min: 1000 }),
    card('Add adjustment', grid([sel('Seller', ['Sarah Johnson']), sel('Session', ['GlowSkin Vitamin C LIVE']), field('Amount (USD)', '', { ph: '−4.50 or 25.00' }), sel('Reason', ['Refund after lock', 'Corrected hours', 'Goodwill', 'Dispute outcome']), area('Note (required)', ''), sel('Second approver (over $100)', ['Not needed', 'Rosa Diaz'])], 220)),
  ].join('') });

F.push({ id: 'F04', title: 'Payout runs', h: 1700, badges: [badge('MVP'), badge('P2'), EX], actions: [btn('Approve run PR-0031', { primary: true })], crumbs: ['Finance', 'Payouts'],
  notes: { priority: ['MVP', 'P2'], purpose: 'Pay sellers for locked earnings, through the payment provider.', roles: 'Finance Administrator; second approver for large runs.',
    rules: ['Runs include Locked lines only; held lines show why.', 'Runs over $[N] need two approvals.', 'The payment provider moves the money; Vyralink records the provider’s status per payout.', 'Holds: payout account unverified, tax form missing, dispute.', 'Year-end tax forms are issued by the provider where required.', 'Instant payouts and multiple schedules are Phase 2.'],
    states: ['Payout failed → seller fixes account (C22), retry in next run or manually', 'Provider outage → run paused, nothing double-paid (idempotency key per payout)'], links: ['F03', 'C22', 'A07'] },
  main: [
    table(['Run', 'Date', 'Sellers', 'Amount', 'Status'], [['PR-0031', '[DATE]', '14', '$5,300.00', chip('Draft · needs approval', 'outline')], ['PR-0030', 'Last month', '31', '$24,100.00', chip('Completed · 2 retried', 'dark')]], { min: 640 }),
    card('PR-0031 · sellers', table(['Seller', 'Locked amount', 'Payout account', 'Tax form', 'Status'], [
      ['Sarah Johnson', '$90.00', 'Bank ending 6789 · verified', 'W-9 on file', chip('Included', 'dark')],
      ['Marcus Lee', '$70.00', 'Restricted by provider', 'W-9 on file', chip('Held · account restricted', 'alert')],
      ['Jade Morgan', '$180.00', 'Verified', 'Missing', chip('Held · tax form', 'alert')],
      ['Priya Nair', '$310.50', 'Verified', 'W-9 on file', chip('Included ($120 on hold)', 'outline')],
    ], { min: 860 })),
    grid([
      card('Failures', table(['Payout', 'Seller', 'Reason from provider', ''], [['P-0029', 'Marcus Lee', 'Account restricted', btn('Notify seller', { ghost: true })]], { min: 480 })),
      card('Tax documents', dl([['On file', '29 sellers'], ['Missing', '2 sellers (payouts held)'], ['Year-end forms', 'Issued by the payment provider where required']])),
    ], 320),
    row([btn('Instant payout', { disabled: true }), badge('P2')], { gap: 8 }),
    state('Approval', 'PR-0031 needs a second approver', 'Total $5,300 is over the $[N] threshold. Rosa Diaz has been asked to approve.'),
  ].join('') });

F.push({ id: 'F05', title: 'Reconciliation', h: 2000, badges: [badge('MVP'), EX], crumbs: ['Finance', 'Reconciliation'],
  notes: { priority: 'MVP', purpose: 'Turn session results into final numbers once, and match money in and out.', roles: 'Finance Administrator.',
    rules: ['Eligible attributable sales = orders TikTok Shop attributes to the LIVE − refunds − cancellations − excluded orders, after the returns window.', 'Sources ranked: TikTok Shop report (imported) > producer entries (manual, for monitoring only).', 'Lock produces: final performance-fee invoice, final commission and bonus lines. One base, used for both.', 'After lock, changes are adjustments with a reason, never edits.', 'Payments tab matches provider deposits and payouts to invoices and ledger lines.'],
    states: ['Returns window open → Lock disabled with date', 'Sources disagree → data review case', 'Attribution dispute → only the disputed orders held'], links: ['F02', 'F03', 'O17', 'A08', 'B15', 'C21'] },
  main: [
    tabs(['Session results (7 ready, 12 waiting)', 'Payments'], 0),
    table(['Session', 'Closeout', 'Results source', 'Returns window', 'Status', ''], [
      ['GlowSkin Vitamin C LIVE', 'Submitted Sat 10:40 PM', 'TikTok Shop report · imported Sun', 'Open until [DATE]', chip('Waiting'), btn('Open', { ghost: true })],
      ['Lumen Skin night oil', 'Submitted', 'Report imported', 'Closed', chip('Ready to lock', 'dark'), btn('Lock', { ghost: true })],
      ['Urban Thread denim LIVE', 'Partial · INC-0045', 'Report pending', '—', chip('Results delayed', 'alert'), btn('Chase', { ghost: true })],
    ], { min: 900 }),
    card('GlowSkin Vitamin C LIVE · calculation', col([
      table(['Source', 'Orders', 'GMV', 'Use'], [['Producer entries (manual, last 8:20 PM)', '64', '$2,560', 'Monitoring only'], ['TikTok Shop report (imported Sun 9:12 AM)', '150', '$6,000', 'Basis'], ['Refunds and cancellations (imported)', '4', '−$160', 'Deducted'], ['Excluded orders', '0', '$0', '—']], { min: 640, rowHead: true }),
      table(['Result', 'Basis', 'Amount'], [['Eligible attributable sales', '$6,000 − $160', '$5,840 (provisional)'], ['Performance fee → INV-1043', '7% × $5,840', '$408.80'], ['Seller commission → ledger', '5% × $5,840', '$292.00'], ['Seller bonus → ledger', 'Eligible ≥ $5,000', '$100.00']], { min: 640, rowHead: true }),
      row([btn('Open data review'), btn('Lock results', { primary: true, disabled: true })], { gap: 8 }),
      p('Lock opens when the returns window closes on [DATE].', { size: 13, mute: true }),
    ])),
    state('Attribution question', 'Sarah Johnson counted 152 orders, the report shows 150', 'Case D-0014: the 2 extra orders were placed at 10:05 and 10:07 PM, after the LIVE ended, and TikTok Shop did not attribute them to the LIVE. Proposed outcome: no change; seller gets the explanation.', [btn('Open case', { href: '../admin/A08.dc.html' })]),
    card('Payments · matching', table(['Provider item', 'Amount', 'Matched to', 'Status'], [['Card charge · GlowSkin', '$750.00', 'INV-1042', chip('Pending')], ['Deposit · Petal Co.', '$750.00', 'INV-1040', chip('Matched', 'dark')], ['Provider fee', '−$21.75', 'Processing fees', chip('Matched', 'dark')], ['Payout batch PR-0030', '−$24,100.00', '31 ledger payouts', chip('Matched', 'dark')], ['Unknown deposit', '$300.00', '—', chip('Unmatched', 'alert')]], { min: 720 })),
  ].join('') });

F.push({ id: 'F06', title: 'Campaign profitability', h: 1400, badges: [badge('P2'), EX], crumbs: ['Finance', 'Campaign profitability'],
  notes: { priority: 'P2', purpose: 'Did each campaign make money for Creator Hub?', roles: 'Finance Administrator, leadership.',
    rules: ['Revenue = fees for the campaign. GMV shown only as context.', 'Direct costs: seller compensation, producer time (setup to teardown × rate), payment fees.', 'Rates (producer hourly cost, fee %) come from settings; figures are Provisional until results lock.'],
    states: ['Results not locked → Provisional', 'Missing producer rate → cost shown as “Not set”'], links: ['F05', 'F07'] },
  main: [
    table(['Campaign', 'Fees (revenue)', 'Seller pay', 'Producer time', 'Payment fees', 'Contribution', 'GMV (context)'], [
      ['GlowSkin Vitamin C LIVE', '$1,158.80 ($750 + $408.80)', '−$482.00', '−$102.00 (4.25 h × $24)', '−$33.61 (2.9%)', '<b>$541.19</b> (provisional)', '$6,000'],
      ['Petal Co. lip tint LIVE', '$750 + [locks later]', '[pending]', '−$66.00', '−$21.75', 'Provisional', 'Pending'],
    ], { min: 1000 }),
    p('Example data. Producer hourly cost and processing rate are placeholders until set in settings.', { size: 13, mute: true }),
    ph('Bar chart · contribution by campaign', 200),
  ].join('') });

F.push({ id: 'F07', title: 'Location profitability', h: 1400, badges: [badge('P2'), EX], crumbs: ['Finance', 'Location profitability'],
  notes: { priority: 'P2', purpose: 'Monthly result per studio.', roles: 'Finance Administrator, leadership.',
    rules: ['Same revenue rule as O20: fees only, never GMV.', 'Operating expenses come from F08.', 'Pre-opening costs for a new location are shown separately.'],
    states: ['Expenses missing for the month → “Incomplete” label'], links: ['F08', 'O20', 'O02'] },
  main: [
    table(['Line', 'Creator Hub Virginia', 'Creator Hub Maryland'], [
      ['Service revenue', '$71,000', '—'], ['Seller compensation', '−$29,400', '—'], ['Studio staff', '−$18,200', '−$4,000 (hiring)'], ['Payment fees and other direct costs', '−$3,100', '—'], ['<b>Contribution</b>', '<b>$20,300</b>', '<b>−$4,000</b>'],
      ['Rent', '−$9,500', '−$6,000'], ['Equipment depreciation', '−$1,800', '−$1,500'], ['Internet', '−$600', '−$500'], ['Consumables', '−$400', '—'], ['<b>Operating result</b>', '<b>$8,000</b>', '<b>−$12,000 (pre-opening)</b>'],
    ], { min: 720, rowHead: true }),
    p('Example data for one month. Brand GMV from Virginia LIVEs that month: $412,000 (context only).', { size: 13, mute: true }),
  ].join('') });

F.push({ id: 'F08', title: 'Operating expenses', h: 1400, badges: [badge('P2'), EX], actions: [btn('Import from accounting'), btn('Add expense', { primary: true })], crumbs: ['Finance', 'Expenses'],
  notes: { priority: 'P2', purpose: 'Studio running costs, so location results are complete.', roles: 'Finance Administrator.',
    rules: ['Each expense has category, location (or shared), period and source (manual or accounting import).', 'Shared costs are allocated by booth hours (configurable).', 'Vyralink is not the accounting system of record; it imports summaries.'],
    states: ['Import mapping missing → map categories first', 'Duplicate detected → confirm or skip'], links: ['F07'] },
  main: [
    table(['Period', 'Category', 'Location', 'Amount', 'Source'], [['This month', 'Rent', 'Virginia', '$9,500', 'Accounting import'], ['This month', 'Internet', 'Virginia', '$600', 'Manual'], ['This month', 'Equipment depreciation', 'Virginia', '$1,800', 'Accounting import'], ['This month', 'Consumables', 'Virginia', '$400', 'Manual'], ['This month', 'Rent', 'Maryland', '$6,000', 'Accounting import']], { min: 760 }),
    card('Add expense', grid([sel('Category', ['Rent', 'Staff', 'Equipment', 'Internet', 'Consumables', 'Other']), sel('Location', ['Virginia', 'Maryland', 'Shared']), field('Amount (USD)', ''), field('Period', 'This month'), area('Note', '')], 200)),
  ].join('') });

for (const s of F) screen('fin', { ...s, nav: 'Finance', subnav: fsn(s.id) });

// ---------------------------------------------------------------- Super Admin
const A = [];
A.push({ id: 'A01', title: 'Platform overview', nav: 'Platform Overview', h: 1500, badges: [badge('MVP'), EX],
  notes: { priority: 'MVP', purpose: 'Health of the whole platform and the admin work queue.', roles: 'Platform Super Administrator.',
    rules: ['Counts are across all organizations; drill-downs open the owning screen.', 'Third-party status comes from each provider’s status feed.', 'No customer funds are held by Vyralink, so there is no balance to show.'],
    states: ['Provider degraded → banner and affected flows listed', 'Queue over SLA → highlighted'], links: ['A02', 'A04', 'A05', 'A08', 'A11'] },
  main: [
    grid([kpi('Brands', '42', '37 verified · 5 in review'), kpi('LIVE Sellers', '318', '204 studio ready'), kpi('Creator Hub locations', '1 open', '1 opening (Maryland)'), kpi('Active campaigns', '61'), kpi('Sessions this week', '96'), kpi('Open disputes', '4', '1 over SLA')], 200),
    card('Work queue', table(['Queue', 'Open', 'Over SLA', ''], [['Verifications', '7', '1', btn('Open', { ghost: true, href: 'A04.dc.html' })], ['Moderation', '5', '0', btn('Open', { ghost: true, href: 'A05.dc.html' })], ['Disputes', '4', '1', btn('Open', { ghost: true, href: 'A08.dc.html' })], ['Security events', '2', '0', btn('Open', { ghost: true, href: 'A10.dc.html' })]], { min: 600 })),
    card('Service health', table(['Service', 'Status', 'Affects'], [['Payment provider', chip('Operational', 'dark'), 'Invoices, payouts'], ['Identity provider', chip('Degraded · slow checks', 'alert'), 'Seller onboarding (C03)'], ['Email', chip('Operational', 'dark'), 'Notifications'], ['Job queue', chip('Operational', 'dark'), 'Imports, reminders'], ['TikTok Shop API', chip('Not enabled · Phase 2'), 'Automatic results sync']], { min: 600 })),
  ].join('') });

A.push({ id: 'A02', title: 'Organizations', nav: 'Organizations', h: 1600, badges: [badge('MVP'), EX],
  notes: { priority: 'MVP', purpose: 'Every brand and operator organization, with status and controls.', roles: 'Platform Super Administrator.',
    rules: ['Organization types: Brand, Operator (Creator Hub). Sellers are personal accounts (A03).', 'Suspension needs a reason; effect: campaigns paused, new bookings blocked, existing bookings flagged for review.', 'Impersonation is read-only, time-limited (30 min), needs a ticket reference, and is audit-logged (A09).'],
    states: ['Suspend with live sessions → blocked until sessions end', 'Unpaid invoices → shown before suspension'], links: ['A03', 'A04', 'A09', 'F02'] },
  main: [
    table(['Organization', 'Type', 'Verification', 'Members', 'Active campaigns', 'Billing', 'Status'], [
      ['GlowSkin Beauty', 'Brand', chip('In review', 'outline'), '3', '2', 'Current', chip('Active', 'dark')],
      ['Petal Co.', 'Brand', chip('Verified', 'dark'), '2', '1', 'Current', chip('Active', 'dark')],
      ['TechNest', 'Brand', chip('Verified', 'dark'), '4', '1', 'Current', chip('Active', 'dark')],
      ['Urban Thread', 'Brand', chip('Verified', 'dark'), '2', '3', chip('Overdue 5 days', 'alert'), chip('Active', 'dark')],
      ['Creator Hub', 'Operator', chip('Verified', 'dark'), '9', '—', '—', chip('Active', 'dark')],
    ], { min: 960 }),
    card('GlowSkin Beauty · actions', col([dl([['Owner', 'Maya Chen'], ['Created', '[DATE]'], ['Verification', 'Resubmitted · in review (A04)']]), row([btn('View as organization (read-only)'), btn('Suspend organization')], { gap: 8 })])),
    state('Confirm', 'Start read-only view of GlowSkin Beauty?', 'Ticket reference required. Session lasts 30 minutes, every page you open is logged, and Maya Chen is notified.', [field('Ticket reference', 'SUP-2231'), btn('Start read-only view', { primary: true })]),
  ].join('') });

A.push({ id: 'A03', title: 'Users', nav: 'Users', h: 1500, badges: [badge('MVP'), EX],
  notes: { priority: 'MVP', purpose: 'Every person, their memberships and account security.', roles: 'Platform Super Administrator.',
    rules: ['A user can hold several memberships (organization + role); sellers also have a personal creator profile.', 'Admins can lock accounts, reset two-step verification and end sessions; they can’t see passwords.', 'Role changes inside an organization are made by that organization’s owner, except in emergencies (logged).'],
    states: ['Two-step reset → user notified, must re-enrol', 'Locked account → all sessions ended'], links: ['A02', 'A09', 'A10'] },
  main: [
    table(['User', 'Memberships', 'Two-step', 'Last sign-in', 'Status', ''], [
      ['Maya Chen', 'GlowSkin Beauty · Brand Owner', 'On', 'Today', chip('Active', 'dark'), btn('Manage', { ghost: true })],
      ['Leo Park', 'GlowSkin Beauty · Brand Marketing Manager<br>Lumen Skin · Brand Marketing Manager', 'On', 'Today', chip('Active', 'dark'), btn('Manage', { ghost: true })],
      ['Sarah Johnson', 'Creator profile (LIVE Seller)', 'On', 'Today', chip('Active', 'dark'), btn('Manage', { ghost: true })],
      ['Rosa Diaz', 'Creator Hub · Location Manager (Virginia)', 'On', 'Today', chip('Active', 'dark'), btn('Manage', { ghost: true })],
      ['Alex M.', 'Creator Hub · Finance Administrator (all locations)', 'On', 'Yesterday', chip('Active', 'dark'), btn('Manage', { ghost: true })],
      ['Unknown sign-in attempts', 'leo@glowskin.example', '—', '—', chip('5 failed in 10 min', 'alert'), btn('Review', { ghost: true, href: 'A10.dc.html' })],
    ], { min: 960 }),
    row([btn('Reset two-step verification'), btn('End all sessions'), btn('Lock account')], { gap: 8 }),
  ].join('') });

A.push({ id: 'A04', title: 'Verifications', nav: 'Verifications', h: 1800, badges: [badge('MVP'), EX],
  notes: { priority: 'MVP', purpose: 'Decide on brand verifications and review seller identity results that need a human.', roles: 'Platform verifier (Super Admin or delegated reviewer).',
    rules: ['Brand documents are reviewed here; seller identity is checked by the identity provider and only exceptions come here.', 'Decision options: Approve, Request more information, Reject (reason from template + note).', 'SLA timer: [REVIEW SLA] business days from submission.', 'Reviewer can’t verify an organization they belong to.', 'Every decision is versioned and audit-logged.'],
    states: ['Document unreadable → Request more information', 'Expiring document → re-verification task', 'Identity provider degraded → seller checks queue here'], links: ['B02', 'C03', 'A09'] },
  main: [
    table(['Submitted', 'Subject', 'Type', 'Reason in queue', 'SLA', 'Status'], [
      ['Tue', 'GlowSkin Beauty LLC', 'Brand', 'Resubmitted: new proof of address', '1 day left', chip('In review', 'outline')],
      ['Mon', 'Urban Thread', 'Brand', 'Certificate expiring in 30 days', '3 days left', chip('Re-verification', 'outline')],
      ['Today', 'Dev Patel', 'Seller identity', 'Provider result: name mismatch', 'Same day', chip('Needs review', 'alert')],
    ], { min: 900 }),
    card('GlowSkin Beauty LLC · review', col([
      grid([ph('Document viewer · proof of business address (new)', 260), col([check('Legal name matches the registry', true), check('Address document dated within 90 days', true), check('Representative is authorized (officer list)', true), check('Website and business match', true)], 0)], 300),
      table(['Document', 'Version', 'Decision'], [['Certificate of formation', 'v1', 'Accepted'], ['Proof of business address', 'v2 (v1 rejected: older than 90 days)', 'Pending'], ['Representative photo ID', 'v1', 'Accepted']], { min: 560 }),
      sel('Decision', ['Approve', 'Request more information', 'Reject']), area('Note to the brand (shown in B02)', ''),
      btn('Submit decision', { primary: true }),
    ])),
  ].join('') });

A.push({ id: 'A05', title: 'Campaign moderation', nav: 'Campaign Moderation', h: 1700, badges: [badge('MVP'), EX],
  notes: { priority: 'MVP', purpose: 'Keep products, campaigns, reviews and messages within the rules.', roles: 'Platform moderators (Super Admin or delegated).',
    rules: ['Queues: product reviews (claims), campaign flags, reported reviews, flagged messages.', 'Restricted categories and claims list are managed in settings (A12).', 'Decisions: Approve, Request changes (reason), Remove; all logged and shown to the owner.', 'Automatic flags (e.g. contact details in messages, medical words in claims) are suggestions; a person decides.'],
    states: ['Change requested → owner sees reason in B05 / B07', 'Repeat violations → organization warning, then suspension (A02)'], links: ['B05', 'B06', 'B07', 'C24', 'A12'] },
  main: [
    tabs(['Product reviews 3', 'Campaign flags 1', 'Reported reviews 1', 'Flagged messages 2'], 0),
    table(['Product', 'Brand', 'Flag', 'Suggested', ''], [
      ['Hydrating Night Cream', 'GlowSkin Beauty', '“Clinically proven hydration” needs evidence', 'Request evidence', btn('Review', { ghost: true })],
      ['Daily SPF 50 Sunscreen', 'GlowSkin Beauty', '“Reef-safe” resubmitted with evidence', 'Approve', btn('Review', { ghost: true })],
      ['Earbuds TN-EB-2', 'TechNest', '“Waterproof” vs IPX4 rating', 'Request change', btn('Review', { ghost: true })],
    ], { min: 860 }),
    card('Hydrating Night Cream · claim review', col([dl([['Claim', '“Clinically proven hydration”'], ['Evidence on file', 'None'], ['Category rule', 'Beauty: efficacy claims need a study summary']]), sel('Decision', ['Request changes', 'Approve', 'Remove claim']), area('Reason shown to brand', 'Upload the study summary or reword to “hydrating formula”.'), btn('Send decision', { primary: true })])),
    state('Flagged message', 'Phone number shared in a seller–brand chat', 'It was masked automatically. Remind both parties that contracting stays on-platform, or dismiss.', [btn('Send reminder'), btn('Dismiss', { ghost: true })]),
  ].join('') });

A.push({ id: 'A06', title: 'Commerce integrations', nav: 'Commerce Integrations', h: 1500, badges: [badge('MVP'), badge('P2'), EX],
  notes: { priority: ['MVP', 'P2'], purpose: 'How sales data gets in: import templates now, authorized connections later.', roles: 'Platform Super Administrator.',
    rules: ['MVP: CSV import templates map TikTok Shop report columns to Vyralink fields (used in O17).', 'Phase 2: connections only through access TikTok officially authorizes for each shop; scopes listed; no scraping, no stored passwords.', 'Vyralink never controls a shop or a LIVE; it reads results it is allowed to read.', 'When a connection fails, the brand falls back to manual import automatically.'],
    states: ['Template mismatch (report format changed) → import errors list, update mapping', 'Connection revoked by the shop → status Disconnected, brand notified'], links: ['O17', 'B18', 'B03'] },
  main: [
    card('Import templates · MVP', table(['Template', 'Columns mapped', 'Last used', 'Errors (30 days)'], [['TikTok Shop order report', 'Order ID, time, product, amount, status, LIVE ID', 'Today', '0'], ['TikTok Shop refunds report', 'Order ID, refund amount, date', 'Yesterday', '2 (date format)']], { min: 760 }), { right: btn('Edit mapping') }),
    card('Shop connections · Phase 2', col([banner('Only through access TikTok officially authorizes for each shop. Until then every brand uses manual import.'), table(['Brand', 'Shop', 'Mode', 'Scopes', 'Last sync'], [['GlowSkin Beauty', 'GlowSkin Beauty Official', 'Manual import', '—', '—'], ['TechNest', 'TechNest Store', 'Manual import', '—', '—']], { min: 720 })]), { right: badge('P2') }),
  ].join('') });

A.push({ id: 'A07', title: 'Payments', nav: 'Payments', h: 1500, badges: [badge('MVP'), EX],
  notes: { priority: 'MVP', purpose: 'Platform view of money moving through the payment provider.', roles: 'Platform Super Administrator; Finance Administrator read-only.',
    rules: ['Vyralink holds no customer funds and runs no escrow. Brand charges and seller payouts are separate provider-managed flows.', 'Customer purchases happen in TikTok Shop and never appear here.', 'Vyralink subscription revenue and Creator Hub service revenue are reported separately; the arrangement between the two companies is [TO DEFINE].', 'Webhook failures are retried; nothing is marked paid without the provider’s confirmation.'],
    states: ['Webhook backlog → statuses delayed banner', 'Provider outage → charges and payouts paused'], links: ['F02', 'F04', 'F05'] },
  main: [
    grid([kpi('Brand charges · 30 days', '$86,400', 'Creator Hub fees and Vyralink subscriptions'), kpi('Seller payouts · 30 days', '$24,100'), kpi('Failed charges', '2'), kpi('Failed payouts', '1'), kpi('Provider fees · 30 days', '$1,410', '', 'Imported')], 200),
    card('Revenue by company', table(['Company', 'Revenue type', '30 days'], [['Vyralink', 'Subscriptions', '[AMOUNT]'], ['Creator Hub', 'Service fees', '$71,000']], { min: 520 })),
    card('Webhooks', table(['Event', 'Last received', 'Status'], [['charge.succeeded', '2 min ago', chip('OK', 'dark')], ['payout.failed', 'Yesterday', chip('OK', 'dark')], ['invoice.payment_failed', '3 h ago', chip('Retrying', 'outline')]], { min: 520 })),
  ].join('') });

A.push({ id: 'A08', title: 'Disputes', nav: 'Disputes', h: 1900, badges: [badge('MVP'), EX],
  notes: { priority: 'MVP', purpose: 'Resolve disagreements about money, results and deliverables, fairly and on record.', roles: 'Platform Super Administrator (decides); Finance Administrator (applies outcomes).',
    rules: ['Types: invoice, attribution / results, commission, deliverables, cancellation fee.', 'Opening a dispute holds only the disputed amount.', 'Both sides can add evidence for 5 days; the decision cites evidence.', 'Outcomes become credit notes (F02) or ledger adjustments (F03); appeal once within 7 days.'],
    states: ['No response from a party → decide on available evidence', 'Over SLA → escalated'], links: ['F02', 'F03', 'F05', 'B08', 'C21'] },
  main: [
    table(['Case', 'Type', 'Parties', 'Amount held', 'Opened', 'Status'], [
      ['D-0014', 'Attribution', 'Sarah Johnson · GlowSkin · Creator Hub', '$4.00 (5% × 2 × $40)', 'Sun', chip('Proposed outcome', 'outline')],
      ['D-0013', 'Invoice', 'Urban Thread · Creator Hub', '$2,400.00', '5 days ago', chip('Evidence', 'outline')],
      ['D-0012', 'Deliverables', 'GlowSkin · Priya Nair', '$120.00 commission', '8 days ago', chip('Over SLA', 'alert')],
    ], { min: 960 }),
    card('D-0014 · Vitamin C LIVE · 152 vs 150 orders', col([
      dl([['Claim', 'Seller counted 152 orders in the TikTok Shop dashboard'], ['Evidence', 'Seller screenshot; TikTok Shop order report; session timeline'], ['Finding', 'Orders 151 and 152 were placed at 10:05 and 10:07 PM, after the LIVE ended at 10:00 PM. The report does not attribute them to the LIVE.']]),
      sel('Decision', ['No change: orders not attributed to the LIVE', 'Adjust: add 2 orders', 'Partial']), area('Explanation to parties', 'The 2 orders came after the LIVE ended and TikTok Shop did not credit them to it.'),
      row([btn('Publish decision', { primary: true })]),
    ])),
    state('Deliverables dispute', 'D-0012: brand says the LIVE ended 40 minutes early', 'Session timeline shows the end at 8:20 PM with no incident logged. Ask the producer for the closeout notes before deciding.'),
  ].join('') });

A.push({ id: 'A09', title: 'Audit logs', nav: 'Audit Logs', h: 1400, badges: [badge('MVP'), EX], actions: [btn('Export')],
  notes: { priority: 'MVP', purpose: 'Who did what, when, to which record — for every sensitive action.', roles: 'Platform Super Administrator; organization owners see their own organization’s log.',
    rules: ['Append-only; entries can’t be edited or deleted by anyone in the app.', 'Logged: sign-ins, role changes, approvals, money terms, verification decisions, reconciliation locks, payouts, impersonation, settings changes.', 'Each entry: actor, action, target, organization, time, IP, before and after.', 'Retention: [RETENTION PERIOD].'],
    states: ['Export over 50,000 rows → emailed when ready'], links: ['A02', 'A03', 'A10'] },
  main: [
    row([field('Search', '', { ph: 'Actor, action or record', grow: true }), sel('Organization', ['All', 'GlowSkin Beauty', 'Creator Hub'], { grow: true }), sel('Action', ['All', 'Money', 'Roles', 'Verification', 'Impersonation', 'Settings'], { grow: true })], { gap: 12, align: 'flex-end' }),
    table(['Time', 'Actor', 'Action', 'Target', 'Organization', 'IP'], [
      ['Sat 8:31 PM', 'Rosa Diaz', 'Readiness override (reason: backup line tested)', 'TechNest earbuds LIVE', 'Creator Hub', '[IP]'],
      ['Sat 4:02 PM', 'Taylor Reed', 'Read-only view started (SUP-2231)', 'GlowSkin Beauty', 'Platform', '[IP]'],
      ['Tue 4:15 PM', 'Sarah Johnson', 'Signed contract v2', 'Vitamin C LIVE', 'GlowSkin Beauty', '[IP]'],
      ['Mon 11:40 AM', 'Maya Chen', 'Published campaign', 'Vitamin C LIVE', 'GlowSkin Beauty', '[IP]'],
      ['Mon 9:00 AM', 'Alex M.', 'Changed hold window 24 h → [HOLD WINDOW]', 'Settings', 'Creator Hub', '[IP]'],
    ], { min: 960 }),
  ].join('') });

A.push({ id: 'A10', title: 'Security', nav: 'Security', h: 1500, badges: [badge('MVP'), EX],
  notes: { priority: 'MVP', purpose: 'Account protection policies, security events and privacy requests.', roles: 'Platform Super Administrator.',
    rules: ['Two-step verification required for: Super Admins, Creator Hub staff, Brand Owners (configurable for others).', 'Admins sign in with single sign-on only.', 'Lockout after 5 failed sign-ins in 10 minutes.', 'Privacy requests (export, delete) tracked to completion; deletion respects legal retention of financial records.'],
    states: ['Suspicious sign-in → user notified, session challenged', 'Deletion blocked by open bookings or unpaid earnings → reason shown'], links: ['A03', 'A09', 'C27'] },
  main: [
    card('Policies', col([check('Require two-step verification for Brand Owners', true), check('Require two-step verification for Creator Hub staff', true), check('Require two-step verification for LIVE Sellers with bookings', false), check('Admins: single sign-on only', true), sel('Session timeout', ['12 hours', '8 hours', '24 hours'])], 0)),
    card('Security events', table(['Time', 'Event', 'User', 'Action taken'], [['Today 9:14 AM', '5 failed sign-ins in 10 min', 'leo@glowskin.example', 'Locked 15 min; user notified'], ['Yesterday', 'New device sign-in', 'Rosa Diaz', 'Two-step challenge passed']], { min: 720 })),
    card('Privacy requests', table(['Request', 'Person', 'Status', 'Note'], [['Export my data', 'Former seller', chip('Completed', 'dark'), 'Sent via secure link'], ['Delete my account', 'Seller', chip('Blocked', 'alert'), '1 unpaid payout; financial records kept as required']], { min: 720 })),
  ].join('') });

A.push({ id: 'A11', title: 'Feature flags', nav: 'Feature Flags', h: 1300, badges: [badge('MVP'), EX],
  notes: { priority: 'MVP', purpose: 'Switch future-phase features on for specific organizations, safely.', roles: 'Platform Super Administrator.',
    rules: ['Phase 2 and 3 features ship dark behind flags; screens show them as disabled until on.', 'Targeting: off, specific organizations, percentage, all.', 'Every change is audit-logged; kill switch turns a flag off everywhere.'],
    states: ['Flag depends on another (e.g. AI matching needs verified data volume) → can’t enable'], links: ['A09', 'M01'] },
  main: table(['Flag', 'Phase', 'Status', 'Targeting', ''], [
    ['tiktok_shop_sync', badge('P2'), chip('Off'), '—', btn('Edit', { ghost: true })],
    ['multi_location', badge('P2'), chip('Pilot', 'outline'), 'Creator Hub (Maryland setup)', btn('Edit', { ghost: true })],
    ['managed_retainers', badge('P2'), chip('Pilot', 'outline'), 'Urban Thread', btn('Edit', { ghost: true })],
    ['instant_payouts', badge('P2'), chip('Off'), '—', btn('Edit', { ghost: true })],
    ['sms_notifications', badge('P2'), chip('Off'), '—', btn('Edit', { ghost: true })],
    ['ai_matching', badge('P3'), chip('Off · needs data', 'alert'), 'Requires [N] verified sessions per category', btn('Edit', { ghost: true })],
  ], { min: 860 }) });

A.push({ id: 'A12', title: 'Platform settings', nav: 'Platform Settings', h: 1700, badges: [badge('MVP')], actions: [btn('Save', { primary: true })],
  notes: { priority: 'MVP', purpose: 'Defaults every organization starts with, and legal documents.', roles: 'Platform Super Administrator.',
    rules: ['Location settings (O22) and campaign terms can override defaults where allowed.', 'New legal document versions require re-acceptance at next sign-in.', 'Changes apply to new records only; signed contracts keep their terms.'],
    states: ['Value out of range → inline error', 'Publishing new terms → preview who must re-accept'], links: ['O22', 'B01', 'C01'] },
  main: [
    card('Commercial defaults', grid([field('Default seller commission (%)', '5'), field('Performance fee (%)', '7'), field('Returns window (days)', '[N]'), field('Invitation expiry (hours)', '48'), field('Studio hold window (hours)', '[HOLD WINDOW]'), field('Seller payment timing (days after lock)', '[N]')], 220)),
    card('Regional', grid([sel('Currency', ['USD']), sel('Default time zone', ['Eastern Time (US)']), sel('Countries open for sign-up', ['United States'])], 220)),
    card('Restricted claims and categories', col([ul(['Medical and treatment claims (all categories)', 'Beauty efficacy claims without evidence', 'Supplements: health claims not allowed in MVP'], { size: 13 }), btn('Edit list')])),
    card('Legal documents', table(['Document', 'Version', 'Status'], [['Terms of Service', 'v3', chip('Live', 'dark')], ['Brand Agreement', 'v2', chip('Live', 'dark')], ['Creator Agreement', 'v2', chip('Live', 'dark')], ['Creator Agreement', 'v3 (draft)', chip('Draft')]], { min: 480 })),
  ].join('') });

for (const s of A) screen('admin', s);

// ---------------------------------------------------------------- M01 AI matching (Phase 3, brand portal)
const factor = (name, val, src, strength) => [name, val, prov(src), strength];
screen('brand', { id: 'M01', title: 'AI seller matching', nav: 'Find Creators', h: 2200, badges: [badge('P3'), EX], crumbs: ['Brand portal', '<a href="B09.dc.html">Find creators</a>', 'AI matching (Phase 3 preview)'], actions: [btn('Back to filters', { href: 'B09.dc.html' })],
  notes: { priority: 'P3', purpose: 'Explainable seller suggestions for a campaign, once enough verified data exists.', roles: 'Brand Owner, Brand Marketing Manager.',
    rules: ['The score ranks sellers for this campaign. It is not a prediction of sales and is not scientifically validated until enough verified data exists.', 'Every factor shows its value, weight and source (Verified or Self-reported).', 'Sellers without history get “Limited data” instead of a score, and a fallback explanation.', 'Manual override (pin, hide) is always available and logged.', 'Behind feature flag ai_matching (A11).'],
    states: ['Flag off → B09 manual filters only', 'Data completeness low → score hidden', 'Seller becomes unavailable → removed from suggestions'], links: ['B09', 'B10', 'B11', 'B12', 'A11'] },
  main: [
    banner(`${badge('P3')} Preview of a Phase 3 feature. Match scores rank sellers for this campaign; they are not a forecast of sales and are not validated yet.`),
    sel('Campaign', ['Vitamin C LIVE — Saturday · Beauty · Sat 7–10 PM · Creator Hub Virginia']),
    card('Sarah Johnson · 94% match', col([
      row([ph('Photo', 64, '64px'), col([`<b style="font-size:16px">Sarah Johnson</b>`, `<span style="font-size:13px">Data completeness: High (9 of 10 fields)</span>`], 4), `<span style="font-size:40px; font-weight:800; margin-left:auto">94%</span>`], { gap: 16 }),
      table(['Factor', 'Sarah', 'Source', 'Fit', 'Weight'], [
        [...factor('Category experience', '12 verified beauty sessions', 'Verified', 'Strong'), '20%'],
        [...factor('Verified GMV / hour', '$1,850', 'Verified', 'Strong'), '20%'],
        [...factor('Availability', 'Free Sat 7–10 PM', 'Verified', 'Yes'), '15%'],
        [...factor('Distance to studio', '12 miles', 'Verified', 'Strong'), '10%'],
        [...factor('Language', 'English, Spanish', 'Self-reported', 'Match'), '10%'],
        [...factor('Reliability', '98% on time', 'Verified', 'Strong'), '10%'],
        [...factor('Rate vs budget', '$30 / h within $40 cap', 'Verified', 'Yes'), '10%'],
        [...factor('Brand preference: Beauty Claims certificate', 'Passed', 'Verified', 'Yes'), '5%'],
      ], { min: 760, rowHead: true }),
      p('Why 94%: strong on every weighted factor; small deduction because language is self-reported.', { size: 13 }),
      row([btn('View profile', { href: 'B10.dc.html' }), btn('Compare', { href: 'B11.dc.html' }), btn('Invite', { primary: true, href: 'B12.dc.html' })], { gap: 8 }),
    ])),
    card('Other suggestions', table(['Seller', 'Match', 'Main reason', 'Data', ''], [
      ['Priya Nair', '88%', 'Strong verified sales; 95 miles from studio', 'High', btn('Pin', { ghost: true })],
      ['Marcus Lee', '71%', 'Good fit, but sales are self-reported only', 'Medium', btn('Hide', { ghost: true })],
      ['Ana Ruiz', 'Limited data', 'New seller: certified, practice LIVE reviewed, available, 8 miles away', 'Low', btn('Pin', { ghost: true })],
    ], { min: 760 })),
    card('Manual override', col([sel('Action', ['Pin to top', 'Hide from suggestions']), sel('Seller', ['Ana Ruiz']), area('Reason (logged)', 'Want a Spanish-speaking host for this audience.'), btn('Apply override')])),
    state('New seller fallback', 'Not enough data to score Ana Ruiz', 'Shown with what we know: Academy certificates, practice LIVE review, availability and distance. No score until she has [N] verified sessions.'),
  ].join('') });

// ---------------------------------------------------------------- fixer: link "Goes to" IDs and ops Finance nav in earlier boards
const fixDirs = ['brand', 'creator', 'ops'];
let fixed = 0;
for (const d of fixDirs) {
  for (const f of fs.readdirSync(path.join(ROOT, 'project', d))) {
    if (!f.endsWith('.dc.html') || f === 'M01.dc.html') continue;
    const fp = path.join(ROOT, 'project', d, f);
    let s = fs.readFileSync(fp, 'utf8');
    const before = s;
    s = s.replace(/<div><b>Goes to\.<\/b> (.*?)<\/div>/g, (m, inner) => `<div><b>Goes to.</b> ${inner.split(' · ').map((tok) => { const id = (tok.match(/([BCOFA]\d\d|M01)/) || [])[1]; return id && exists(id) ? `<a href="${rel(d, id)}">${id}</a>` : tok; }).join(' · ')}</div>`);
    if (d === 'ops') s = s.replace(/<span style="([^"]*?); color:#3d3d3d">Finance <span style="font-size:11px">Batch 4<\/span><\/span>/, (m, st) => `<a href="../fin/F01.dc.html" style="${st}">Finance</a>`);
    if (s !== before) { fs.writeFileSync(fp, s); written.push(`project/${d}/${f}`); fixed++; }
  }
}

// ---------------------------------------------------------------- canvas.json (merge)
const cpath = path.join(ROOT, 'project/canvas.json');
const canvas = JSON.parse(fs.readFileSync(cpath, 'utf8'));
if (!canvas.pages.some((pg) => pg.id === 'finadmin')) canvas.pages.push({ id: 'finadmin', name: '6 · Finance, Super Admin, AI matching' });
const placeRows = (list, folder, y0) => { let y = y0; for (let r = 0; r < list.length; r += 3) { const rowS = list.slice(r, r + 3); rowS.forEach((s, c) => { const file = `${folder}/${s.id}.dc.html`; canvas.boards[file] = { x: c * 1520, y, w: 1440, h: s.h, page: 'finadmin', expand: 'fill', is_interactive: true, title: `${s.id} · ${s.title}` }; if (!canvas.order.includes(file)) canvas.order.push(file); }); y += Math.max(...rowS.map((s) => s.h)) + 120; } return y; };
let y = placeRows(F, 'fin', 0);
const aTop = y + 300;
y = placeRows(A, 'admin', aTop);
const mTop = y + 300;
canvas.boards['brand/M01.dc.html'] = { x: 0, y: mTop, w: 1440, h: 2200, page: 'finadmin', expand: 'fill', is_interactive: true, title: 'M01 · AI seller matching (Phase 3)' };
if (!canvas.order.includes('brand/M01.dc.html')) canvas.order.push('brand/M01.dc.html');
canvas.notes.finTitle = { x: 0, y: -300, text: 'D6 · Creator Hub finance · F01–F08', kind: 'title1', maxW: 4480, page: 'finadmin' };
canvas.notes.adminTitle = { x: 0, y: aTop - 300, text: 'D6 · Super Admin console · A01–A12', kind: 'title1', maxW: 4480, page: 'finadmin' };
canvas.notes.mTitle = { x: 0, y: mTop - 300, text: '§9 · AI matching · Phase 3 preview', kind: 'title1', maxW: 4480, page: 'finadmin' };
canvas.notes.finTip = { x: 3 * 1520, y: 0, w: 360, text: 'Money rules used everywhere: GMV is brand sales, never revenue. Seller pay is a Creator Hub expense. One eligible-sales base drives both the performance fee and seller commission. No escrow: brand charges and seller payouts are separate provider flows.', fill: 'gray', page: 'finadmin' };
if (canvas.notes.overviewTitle) canvas.notes.overviewTitle.text = 'Vyralink + Creator Hub · Batches 1–4';
fs.writeFileSync(cpath, JSON.stringify(canvas, null, 2));
written.push('project/canvas.json');
fs.writeFileSync(path.join(ROOT, 'batch4-files.json'), JSON.stringify(written));
console.log(written.length, 'files;', fixed, 'earlier boards relinked');
