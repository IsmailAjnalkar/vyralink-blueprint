// Batch 3: Creator Hub operations portal (O01–O24) at 1440 px + O12 front-desk tablet (768 px).
// Usage: node gen3.mjs <rootDir>   (reads and extends <rootDir>/project/canvas.json)
import fs from 'node:fs';
import path from 'node:path';
import { doc, FONT, inputStyle, btn, badge, chip, prov, field, sel, area, check, row, col, grid, card, kpi, table, ph, tabs, state, banner, ul, p, dl, sub, bell } from './lib.mjs';

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
const EX = prov('Example data');
const sr = (t) => `<span style="position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap">${t}</span>`;

const href = (id) => (/^O\d\d$/.test(id) ? `${id}.dc.html` : /^B\d\d$/.test(id) ? `../brand/${id}.dc.html` : /^C\d\d$/.test(id) ? `../creator/${id}.dc.html` : null);
const linkTo = (id) => { const h = href(id); return h ? `<a href="${h}">${id}</a>` : `${id}${/^[FAM]\d\d$/.test(id) ? ' (Batch 4)' : ''}`; };
const notesBox = (id, n) => `<aside aria-label="Spec notes for ${id}" style="flex:1 1 280px; min-width:0; border:1px dashed #8c8c8c; border-radius:8px; padding:16px; background:#fafafa; font-size:13px; line-height:1.5; display:flex; flex-direction:column; gap:14px; box-sizing:border-box">
<div style="display:flex; justify-content:space-between; align-items:center; gap:8px"><span style="font-size:11px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#3d3d3d">Spec notes · ${id}</span>${[].concat(n.priority).map(badge).join(' ')}</div>
${n.view ? `<div style="font-size:12px; color:#3d3d3d">${n.view}</div>` : ''}
<div><b>Purpose.</b> ${n.purpose}</div>
<div><b>Roles.</b> ${n.roles}</div>
<div style="display:flex; flex-direction:column; gap:6px"><b>Rules</b>${ul(n.rules, { size: 13, gap: 4 })}</div>
<div style="display:flex; flex-direction:column; gap:6px"><b>States and errors</b>${ul(n.states, { size: 13, gap: 4 })}</div>
<div><b>Goes to.</b> ${n.links.map(linkTo).join(' · ')}</div>
</aside>`;

// ---------------------------------------------------------------- ops shell
const NAV = [['Overview', 'O01'], ['LIVE Control Center', 'O14'], ['Locations', 'O03'], ['Booths', 'O04'], ['Bookings', 'O06'], ['Producers', 'O07'], ['Inventory', 'O10'], ['Sellers', 'O23'], ['Brands', 'O24'], ['Finance', 'F01'], ['Reports', 'O19'], ['Staff', 'O21'], ['Settings', 'O22']];
const USERS = { manager: ['Rosa Diaz', 'Location Manager', 'RD'], producer: ['Jordan P.', 'Studio Producer', 'JP'], inventory: ['Sam K.', 'Inventory Coordinator', 'SK'], desk: ['Front desk', 'Location Manager', 'FD'] };
const opsScreen = (s) => {
  const [uname, urole, ini] = USERS[s.user || 'manager'];
  const body = `<div style="width:100%; max-width:1440px; margin:0 auto; ${FONT}; color:#1a1a1a; background:#ffffff; display:flex; flex-direction:column">
<header style="display:flex; flex-wrap:wrap; align-items:center; gap:16px; padding:12px 24px; border-bottom:1px solid #c4c4c4">
<a href="O01.dc.html" style="font-weight:800; letter-spacing:0.1em; text-decoration:none; color:#1a1a1a; font-size:16px">CREATOR HUB <span style="font-weight:500; letter-spacing:0">ops</span></a>
<button type="button" aria-label="Switch location. Current: Creator Hub Virginia" style="min-height:44px; padding:0 12px; border:1px solid #8c8c8c; border-radius:6px; background:#ffffff; font-family:inherit; font-size:14px; font-weight:600; cursor:pointer">Creator Hub Virginia ▾</button>
<span style="font-size:13px; color:#3d3d3d">${urole}</span>
<input type="search" aria-label="Search" placeholder="Search sessions, sellers, brands, SKUs" style="${inputStyle}; flex:1 1 240px; width:auto">
<a href="O16.dc.html" aria-label="Alerts, 3 open" style="display:inline-flex; align-items:center; gap:6px; min-height:44px; min-width:44px; justify-content:center; text-decoration:none; font-size:13px; font-weight:700">${bell}<span>3</span></a>
<span aria-label="Signed in as ${uname}" style="width:36px; height:36px; border-radius:50%; background:#e6e6e6; border:1px solid #8c8c8c; display:inline-flex; align-items:center; justify-content:center; font-size:13px; font-weight:700">${ini}</span>
</header>
<div style="display:flex; flex-wrap:wrap; align-items:stretch">
<nav aria-label="Operations navigation" style="flex:1 1 220px; min-width:0; background:#f7f7f7; border-right:1px solid #c4c4c4; padding:16px 12px; display:flex; flex-direction:column; gap:4px; box-sizing:border-box">
${NAV.map(([l, id]) => { const on = l === s.nav; const h = href(id); const st = `display:flex; align-items:center; justify-content:space-between; min-height:44px; padding:0 12px; border-radius:6px; text-decoration:none; color:#1a1a1a; font-size:14px; font-weight:${on ? 700 : 500}; background:${on ? '#e0e0e0' : 'transparent'}`; return h ? `<a href="${h}"${on ? ' aria-current="page"' : ''} style="${st}">${l}${l === 'LIVE Control Center' ? ' <span style="font-size:11px; font-weight:700; border:1px solid #1a1a1a; border-radius:999px; padding:0 6px">2 LIVE</span>' : ''}</a>` : `<span style="${st}; color:#3d3d3d">${l} <span style="font-size:11px">Batch 4</span></span>`; }).join('\n')}
</nav>
<main style="flex:999 1 560px; min-width:0; padding:32px; display:flex; flex-direction:column; gap:24px; box-sizing:border-box">
<div style="display:flex; flex-wrap:wrap; gap:16px; align-items:flex-end; justify-content:space-between">
<div style="display:flex; flex-direction:column; gap:8px; min-width:0">
<nav aria-label="Breadcrumb" style="font-size:13px; color:#3d3d3d">${(s.crumbs || ['Operations', s.title]).join(' / ')}</nav>
<div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center"><span style="font-size:12px; font-weight:700; border:1px solid #1a1a1a; border-radius:4px; padding:2px 6px">${s.id}</span><h1 style="margin:0; font-size:28px">${s.title}</h1>${(s.badges || []).join('')}</div>
</div>
${s.actions ? row(s.actions, { gap: 8 }) : ''}
</div>
${s.subnav ? s.subnav : ''}
<div style="display:flex; flex-wrap:wrap; gap:24px; align-items:flex-start">
<div style="flex:999 1 560px; min-width:0; display:flex; flex-direction:column; gap:24px">${s.main}</div>
${notesBox(s.id, s.notes)}
</div>
</main>
</div>
</div>`;
  out(`project/ops/${s.id}.dc.html`, doc(`${s.id} ${s.title}`, 1440, s.h, body));
};
// in-page sub navigation (links between sibling screens)
const subnav = (items, active) => `<nav aria-label="Section" style="display:flex; flex-wrap:wrap; gap:4px; border-bottom:1px solid #c4c4c4">${items.map(([l, id]) => { const on = id === active; return `<a href="${id}.dc.html"${on ? ' aria-current="page"' : ''} style="display:inline-flex; align-items:center; min-height:44px; padding:0 14px; text-decoration:none; color:#1a1a1a; font-size:14px; font-weight:${on ? 700 : 500}; border-bottom:3px solid ${on ? '#1a1a1a' : 'transparent'}">${l} <span style="font-size:11px; color:#3d3d3d; margin-left:6px">${id}</span></a>`; }).join('')}</nav>`;
const CC_SUB = [['Control Center', 'O14'], ['Session monitoring', 'O15'], ['Incidents', 'O16'], ['Closeout', 'O17']];
const INV_SUB = [['Receiving', 'O09'], ['Sample inventory', 'O10'], ['Storage and movement', 'O11'], ['Returns and reconciliation', 'O18']];
const SELLER_SUB = [['Seller roster', 'O23'], ['Check-in', 'O12'], ['Pre-LIVE readiness', 'O13']];
const BOOTH_SUB = [['Booth inventory', 'O04'], ['Availability calendar', 'O05']];
const PROD_SUB = [['Producer schedule', 'O07'], ['Equipment', 'O08']];
const OVER_SUB = [['This location', 'O01'], ['All locations', 'O02']];
const REP_SUB = [['Studio utilization', 'O19'], ['Location performance', 'O20']];

const S = [];

// ---------------------------------------------------------------- O01–O03
S.push({ id: 'O01', title: 'Operations dashboard', nav: 'Overview', h: 1700, subnav: subnav(OVER_SUB, 'O01'), badges: [badge('MVP'), EX], actions: [btn('Open LIVE Control Center', { primary: true, href: 'O14.dc.html' })],
  notes: { priority: 'MVP', purpose: 'Today at one location: sessions, readiness, staff, stock and open problems.', roles: 'Location Manager (producers and inventory see their own widgets).',
    rules: ['“Today” follows the location’s time zone.', 'Alerts link to the screen that resolves them.', 'Numbers about studio operations are Live; sales numbers are Manual or Delayed and labelled.', 'GMV is brand sales and never shown as Creator Hub revenue.'],
    states: ['No sessions today → next 7 days', 'Data feed down → banner with last update time'], links: ['O14', 'O13', 'O09', 'O07', 'O16'] },
  main: [
    grid([kpi('Sessions today', '5', '2 LIVE · 1 interrupted · 1 pre-LIVE · 1 done'), kpi('Booths in use', '4 of 5', 'Flex Booth 01 free', 'Live'), kpi('Staff on shift', '6', '3 producers · 1 inventory · 1 desk · 1 manager'), kpi('Open incidents', '2', '1 high · 1 low'), kpi('Samples awaiting receipt', '3 shipments', '1 overdue'), kpi('Readiness blocked', '1', 'TechNest earbuds LIVE')], 200),
    card('Today’s sessions', table(['Time', 'Session', 'Seller', 'Booth', 'Producer', 'Status'], [
      ['5:00–6:30 PM', 'Lumen Skin night oil', 'Priya Nair', 'Beauty Booth 02', 'Kim L.', chip('Completed', 'dark')],
      ['6:30–8:30 PM', 'Petal Co. lip tint LIVE', 'Jade Morgan', 'Beauty Booth 02', 'Kim L.', chip('LIVE · connection degraded', 'alert')],
      ['7:00–10:00 PM', '<a href="O14.dc.html">GlowSkin Vitamin C LIVE</a>', 'Sarah Johnson', 'Beauty Booth 01', 'Jordan P.', chip('LIVE', 'dark')],
      ['7:30–9:30 PM', 'Urban Thread denim LIVE', 'Marcus Lee', 'Fashion Booth 01', 'Lee T.', chip('Interrupted', 'alert')],
      ['8:30–10:30 PM', 'TechNest earbuds LIVE', 'Noah Brooks', 'Electronics Booth 01', 'Omar R.', chip('Pre-LIVE · blocked', 'alert')],
    ], { min: 900 })),
    row([
      card('Needs attention', ul(['<b>High:</b> Urban Thread stream dropped at 8:12 PM · <a href="O16.dc.html">INC-0045</a>', '<b>Blocked:</b> TechNest compliance check pending · <a href="O13.dc.html">readiness</a>', '<b>Overdue:</b> Night Cream samples not received (LIVE Thu) · <a href="O09.dc.html">receiving</a>'], { size: 13 }), { style: 'flex:2 1 420px' }),
      card('Next 7 days', ul(['32 sessions booked', '78% booth utilization (planned)', '2 producer gaps: Tue 6–9 PM, Thu 6–8 PM'], { size: 13 }), { style: 'flex:1 1 260px', right: `<a href="O05.dc.html" style="font-size:13px">Calendar</a>` }),
    ], { align: 'stretch', gap: 24 }),
    state('Feed delay', 'Studio network monitor last updated 4 minutes ago', 'Connection statuses may be stale. Producers on the floor have the current picture.'),
  ].join('') });

S.push({ id: 'O02', title: 'All locations', nav: 'Overview', h: 1300, subnav: subnav(OVER_SUB, 'O02'), badges: [badge('P2'), EX],
  notes: { priority: 'P2', purpose: 'Compare locations at a glance (multi-location operations, Phase 2).', roles: 'Creator Hub leadership; Location Managers see only their locations.',
    rules: ['Revenue here is Creator Hub service revenue (fees), not GMV.', 'Utilization = booked LIVE hours ÷ bookable booth hours.', 'A location “Opening soon” can take holds but not confirmed bookings.'],
    states: ['Location offline → last sync time', 'No access to a location → hidden, not greyed'], links: ['O03', 'O20', 'O19'] },
  main: [
    table(['Location', 'Status', 'Booths', 'Sessions (30 days)', 'Utilization', 'Service revenue (30 days)', 'Open incidents'], [
      ['<a href="O03.dc.html">Creator Hub Virginia</a>', chip('Open', 'dark'), '5', '96', '74%', '$71,000 (example)', '2'],
      ['Creator Hub Maryland', chip('Opening soon', 'outline'), '4', '—', '—', '—', '—'],
    ], { min: 900 }),
    ph('Map · location pins', 220),
    state('Phase 2', 'Multi-location view arrives with the second studio', 'MVP runs one location; the location switcher in the top bar is already in place.'),
  ].join('') });

S.push({ id: 'O03', title: 'Location details', nav: 'Locations', h: 1700, crumbs: ['Operations', 'Locations', 'Creator Hub Virginia'], badges: [badge('MVP'), chip('Open', 'dark'), EX], actions: [btn('Edit location')],
  notes: { priority: 'MVP', purpose: 'Everything fixed about a studio: address, hours, booths, staff, rules.', roles: 'Location Manager edits; staff read.',
    rules: ['Address and arrival instructions feed the seller’s Getting there screen (C14).', 'Opening hours bound what can be booked.', 'Booking rules here override platform defaults (O22) for this location only.'],
    states: ['Temporarily closed → all future bookings flagged for rescheduling', 'Missing arrival instructions → warning'], links: ['O04', 'O05', 'O21', 'O22', 'C14'] },
  main: [
    grid([
      card('Address and access', dl([['Address', '[STUDIO ADDRESS], Richmond, VA'], ['Time zone', 'Eastern Time'], ['Parking', '[PARKING DETAILS]'], ['Seller entrance', 'Front desk, ground floor'], ['Deliveries', 'Loading door, rear']])),
      card('Hours', dl([['Mon–Fri', '10:00 AM – 11:00 PM'], ['Sat–Sun', '9:00 AM – 11:00 PM'], ['Holidays', 'Closed Dec 25']])),
    ], 320),
    card('Booths', table(['Booth', 'Type', 'Standard kit', 'Status'], [['Beauty Booth 01', 'Beauty', '2 cameras, ring light, 2 mics, vanity', chip('In use', 'dark')], ['Beauty Booth 02', 'Beauty', '2 cameras, ring light, 2 mics, vanity', chip('In use', 'dark')], ['Fashion Booth 01', 'Fashion', '3 cameras, rail, mirror, 2 mics', chip('In use', 'dark')], ['Electronics Booth 01', 'Electronics', '2 cameras, top-down cam, 2 mics', chip('In use', 'dark')], ['Flex Booth 01', 'Flexible', '2 cameras, 2 mics, modular table', chip('Available')]], { min: 720 }), { right: `<a href="O04.dc.html" style="font-size:13px">Manage booths</a>` }),
    grid([
      card('Facilities', ul(['Control room: 4 monitoring stations', 'Product storage: 6 shelves, 1 locked cabinet', 'Check-in desk', 'Internet: 2 fiber lines + 5G backup'], { size: 13 })),
      card('Team', ul(['Location Manager: Rosa Diaz', 'Producers: Jordan P., Kim L., Lee T., Omar R.', 'Inventory: Sam K.'], { size: 13 }), { right: `<a href="O21.dc.html" style="font-size:13px">Staff</a>` }),
    ], 300),
    card('Booking rules for this location', dl([['Setup buffer', '30 minutes before each LIVE'], ['Teardown buffer', '15 minutes after'], ['Hold window', '[HOLD WINDOW] hours'], ['Check-in opens', '60 minutes before arrival time'], ['No-show threshold', '15 minutes after arrival time']]), { right: `<a href="O22.dc.html" style="font-size:13px">Settings</a>` }),
  ].join('') });

// ---------------------------------------------------------------- O04–O08
S.push({ id: 'O04', title: 'Booth inventory', nav: 'Booths', h: 1500, subnav: subnav(BOOTH_SUB, 'O04'), badges: [badge('MVP')], actions: [btn('Add booth', { primary: true })],
  notes: { priority: 'MVP', purpose: 'The booths a location can sell, with their kit and status.', roles: 'Location Manager.',
    rules: ['Booth type limits which campaign categories it can host (e.g. Beauty, Fashion, Electronics, Flexible).', 'Maintenance blocks remove the booth from availability (O05).', 'A booth can’t be deleted with future bookings; set it to Retired after they end.'],
    states: ['Booth in maintenance with bookings → reassign prompt', 'Kit item missing → booth flagged “Not ready”'], links: ['O05', 'O08', 'O03'] },
  main: [
    table(['Booth', 'Type', 'Categories allowed', 'Standard kit', 'Status', 'Next booking', ''], [
      ['Beauty Booth 01', 'Beauty', 'Beauty, skincare', 'CAM-A1, CAM-A2, LGT-R1, MIC-1, MIC-2', chip('In use', 'dark'), 'Now · GlowSkin', btn('Edit', { ghost: true })],
      ['Beauty Booth 02', 'Beauty', 'Beauty, skincare', 'CAM-B1, CAM-B2, LGT-R2, MIC-3, MIC-4', chip('In use', 'dark'), 'Now · Petal Co.', btn('Edit', { ghost: true })],
      ['Fashion Booth 01', 'Fashion', 'Fashion, accessories', 'CAM-F1–F3, rail, MIC-5, MIC-6', chip('In use', 'dark'), 'Now · Urban Thread', btn('Edit', { ghost: true })],
      ['Electronics Booth 01', 'Electronics', 'Electronics, gadgets', 'CAM-E1, CAM-E2, TOP-1, MIC-7, MIC-8', chip('In use', 'dark'), '8:30 PM · TechNest', btn('Edit', { ghost: true })],
      ['Flex Booth 01', 'Flexible', 'Any', 'CAM-X1, CAM-X2, MIC-9, MIC-10', chip('Available'), 'Sun 12 PM', btn('Edit', { ghost: true })],
    ], { min: 1000 }),
    card('Add or edit booth (side panel)', grid([field('Booth name', 'Flex Booth 02', { req: true }), sel('Type', ['Flexible', 'Beauty', 'Fashion', 'Electronics']), field('Categories allowed', 'Any'), sel('Status', ['Available', 'Maintenance', 'Retired']), field('Maintenance from', '', { type: 'date' }), field('Maintenance until', '', { type: 'date' })], 220)),
    state('Maintenance conflict', 'Fashion Booth 01 has 3 bookings during the maintenance window', 'Move them to Flex Booth 01 (compatible) or reschedule. Brands and sellers are notified of any change.', [btn('Reassign bookings', { primary: true, href: 'O06.dc.html' })]),
  ].join('') });

const slot = (t, tone) => `<div style="font-size:12px; line-height:1.4; padding:6px; border-radius:6px; ${tone === 'book' ? 'background:#1a1a1a; color:#ffffff' : tone === 'hold' ? 'border:1px solid #1a1a1a; background:#ffffff' : tone === 'buf' ? 'background:#e6e6e6; color:#1a1a1a' : tone === 'maint' ? 'border:2px dashed #1a1a1a' : ''}">${t}</div>`;
S.push({ id: 'O05', title: 'Booth availability', nav: 'Booths', h: 1500, subnav: subnav(BOOTH_SUB, 'O05'), badges: [badge('MVP'), EX], actions: [btn('Add maintenance block'), btn('New hold', { primary: true })],
  notes: { priority: 'MVP', purpose: 'Day view of every booth with bookings, holds, buffers and maintenance.', roles: 'Location Manager; producers read-only.',
    rules: ['Buffers (setup 30 min, teardown 15 min) are part of each booking and block the booth.', 'Server-side exclusion constraint: no two bookings or holds may overlap on the same booth, including buffers.', 'Holds expire after the hold window unless confirmed.', 'Drag to move needs a reason and notifies brand and seller.'],
    states: ['Overlap attempt → refused with the conflicting booking named', 'Hold expiring → highlighted', 'Studio closed → greyed'], links: ['O06', 'O04', 'B13'] },
  main: [
    row([tabs(['Day', 'Week'], 0), row([btn('Previous day'), btn('Today'), btn('Next day'), `<b style="font-size:14px">Saturday (example)</b>`], { gap: 8 })], { justify: 'space-between' }),
    table(['Time', 'Beauty 01', 'Beauty 02', 'Fashion 01', 'Electronics 01', 'Flex 01'], [
      ['4:30 PM', '', slot('Setup', 'buf'), '', '', ''],
      ['5:00 PM', '', slot('Lumen Skin · Priya Nair', 'book'), '', '', ''],
      ['6:30 PM', slot('Setup', 'buf'), slot('Petal Co. · Jade Morgan', 'book'), '', '', ''],
      ['7:00 PM', slot('GlowSkin Vitamin C · Sarah Johnson · 7–10 PM', 'book'), '', slot('Setup', 'buf'), '', ''],
      ['7:30 PM', '', '', slot('Urban Thread · Marcus Lee', 'book'), '', ''],
      ['8:00 PM', '', '', '', slot('Setup', 'buf'), ''],
      ['8:30 PM', '', slot('Teardown', 'buf'), '', slot('TechNest · Noah Brooks', 'book'), slot('Hold · Spring serum LIVE · expires in 6 h', 'hold')],
      ['10:00 PM', slot('Teardown', 'buf'), '', '', '', slot('Maintenance · light rig', 'maint')],
    ], { min: 980, rowHead: true }),
    row([slot('Booked', 'book'), slot('Hold', 'hold'), slot('Buffer', 'buf'), slot('Maintenance', 'maint')], { gap: 8 }),
    state('Conflict refused', 'Spring serum LIVE can’t take Beauty Booth 01 8–9 PM', 'It overlaps GlowSkin Vitamin C LIVE (7–10 PM plus 15 min teardown). Flex Booth 01 is free and can host beauty.', [btn('Hold Flex Booth 01', { primary: true }), btn('Suggest other times')]),
  ].join('') });

S.push({ id: 'O06', title: 'Studio bookings', nav: 'Bookings', h: 1700, badges: [badge('MVP'), EX], actions: [btn('Export'), btn('New hold', { primary: true, href: 'O05.dc.html' })],
  notes: { priority: 'MVP', purpose: 'Every booking from hold to completion, with the actions each status allows.', roles: 'Location Manager.',
    rules: ['Booking statuses: Hold → Confirmed → Checked in → In progress → Completed; or Cancelled, No-show, Expired (hold).', 'Confirmed needs: contract signed by both, verified brand, booth free, producer assignable.', 'Rescheduling keeps the booking ID and history; brand and seller are notified.', 'Cancellations apply the signed policy and record who cancelled.'],
    states: ['Hold expiring → reminder to brand and manager', 'Producer not assignable → can’t confirm', 'Seller cancels → re-match request to brand (B12)'], links: ['O05', 'O07', 'O12', 'B14'] },
  main: [
    tabs(['Upcoming 32', 'Today 5', 'Holds 3', 'Needs action 2', 'Past'], 0),
    table(['Booking', 'Brand · campaign', 'Seller', 'Booth', 'When', 'Producer', 'Status', ''], [
      ['BK-2201', 'GlowSkin · Vitamin C LIVE', 'Sarah Johnson', 'Beauty 01', 'Sat 7–10 PM', 'Jordan P.', chip('In progress', 'dark'), btn('Open', { ghost: true, href: 'O15.dc.html' })],
      ['BK-2207', 'GlowSkin · Night Cream LIVE DROP', 'Not booked', 'Beauty 02', 'Thu 6–8 PM', '—', chip('Hold · seller pending', 'outline'), btn('Extend hold', { ghost: true })],
      ['BK-2209', 'GlowSkin · Spring serum LIVE', '—', 'Flex 01', 'Sat 8–9 PM', '—', chip('Hold · expires 6 h', 'outline'), btn('Release', { ghost: true })],
      ['BK-2195', 'TechNest · earbuds LIVE', 'Noah Brooks', 'Electronics 01', 'Sat 8:30–10:30 PM', 'Omar R.', chip('Checked in', 'dark'), btn('Readiness', { ghost: true, href: 'O13.dc.html' })],
      ['BK-2188', 'Petal Co. · lip tint LIVE', 'Jade Morgan', 'Beauty 02', 'Sat 6:30–8:30 PM', 'Kim L.', chip('In progress', 'dark'), btn('Open', { ghost: true })],
      ['BK-2214', 'Lumen Skin · night oil', 'Priya Nair', 'Beauty 02', 'Tue 6–8 PM', chip('No producer', 'alert'), chip('Needs action', 'alert'), btn('Assign', { ghost: true, href: 'O07.dc.html' })],
    ], { min: 1060 }),
    card('Booking BK-2201 · detail panel', grid([dl([['Campaign', '<a href="../brand/B14.dc.html">Vitamin C LIVE — Saturday</a>'], ['Contract', 'v2 signed by both · Tue'], ['Booth', 'Beauty Booth 01 · 6:30 PM setup → 10:15 PM teardown'], ['Producer', 'Jordan P.'], ['Kit', 'CAM-A1, CAM-A2, LGT-R1, MIC-1, MIC-2'], ['Samples', '4 received Wed · shelf S2']]), col([sub('History'), ul(['Hold created Mon 11:41 AM · system', 'Confirmed Tue 4:15 PM · contract signed', 'Producer assigned Thu · Rosa Diaz', 'Checked in Sat 6:12 PM · front desk'], { size: 13 }), row([btn('Reschedule'), btn('Cancel booking')], { gap: 8 })], 10)], 300)),
    state('Can’t confirm', 'BK-2214 has no producer for Tue 6–8 PM', 'All producers are scheduled or off. Assign one from another shift, ask a producer to cover, or offer the brand another time.', [btn('Open producer schedule', { primary: true, href: 'O07.dc.html' })]),
  ].join('') });

S.push({ id: 'O07', title: 'Producer schedule', nav: 'Producers', h: 1500, subnav: subnav(PROD_SUB, 'O07'), badges: [badge('MVP'), EX], actions: [btn('Add shift', { primary: true })],
  notes: { priority: 'MVP', purpose: 'Who produces which session, and gaps before they become problems.', roles: 'Location Manager; producers see their own shifts.',
    rules: ['A producer can run one session at a time (setup to teardown).', 'Assigning checks shift, time off and certifications (e.g. electronics demos).', 'Unassigned confirmed bookings show as gaps 72 h ahead.', 'Producer reassignment notifies the seller and logs a reason.'],
    states: ['Producer calls in sick → affected sessions listed with suggested replacements', 'No replacement → escalate to manager; brand notified if start may move'], links: ['O06', 'O08', 'O21'] },
  main: [
    row([tabs(['Week', 'Day'], 0), `<b style="font-size:14px">Example week</b>`], { justify: 'space-between' }),
    table(['Producer', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], [
      ['Jordan P.', 'Off', '—', '2–10 PM', '2–10 PM', '—', '4–11 PM · GlowSkin 7–10', 'Off'],
      ['Kim L.', '2–10 PM', chip('Sick', 'alert'), '—', '2–10 PM', '2–10 PM', '3–9 PM · Lumen, Petal Co.', '—'],
      ['Lee T.', '—', '2–10 PM', '2–10 PM', '—', '2–10 PM', '5–11 PM · Urban Thread', 'Off'],
      ['Omar R.', '2–10 PM', '—', '—', '2–10 PM', '—', '6–11 PM · TechNest', '12–8 PM'],
      ['<b>Gaps</b>', '—', chip('Tue 6–8 PM · BK-2214', 'alert'), '—', chip('Thu 6–8 PM · BK-2207', 'outline'), '—', '—', '—'],
    ], { min: 1000, rowHead: true }),
    state('Producer unavailable', 'Kim L. is out sick Tuesday', 'BK-2214 (Lumen Skin, 6–8 PM) needs a producer. Lee T. is on shift and free 6–8 PM.', [btn('Assign Lee T.', { primary: true }), btn('Escalate to manager')]),
  ].join('') });

S.push({ id: 'O08', title: 'Equipment', nav: 'Producers', h: 1500, subnav: subnav(PROD_SUB, 'O08'), badges: [badge('MVP'), EX], actions: [btn('Add item', { primary: true })],
  notes: { priority: 'MVP', purpose: 'Track kit per booth and session, and swap failures fast.', roles: 'Producers, Location Manager.',
    rules: ['Each item has an ID, booth, status: OK, Needs check, Repair, Retired.', 'Session kit is copied from the booth standard kit and can be adjusted.', 'Failure logged during a LIVE opens an incident (O16) automatically.', 'Backup kit is reserved per shift, not per session.'],
    states: ['Item marked Repair with upcoming sessions → swap prompt', 'Backup kit already in use → escalate'], links: ['O04', 'O16', 'O13'] },
  main: [
    table(['Item', 'Type', 'Booth / session', 'Status', 'Last check', ''], [
      ['CAM-A1', 'Camera', 'Beauty 01 · GlowSkin', chip('OK', 'dark'), 'Sat 6:45 PM', btn('Log issue', { ghost: true })],
      ['CAM-F2', 'Camera', 'Fashion 01 · Urban Thread', chip('Repair', 'alert'), 'Sat 8:12 PM', btn('Swap', { ghost: true })],
      ['NET-2', 'Fiber line 2', 'Control room', chip('Degraded', 'alert'), 'Live', btn('Switch to 5G backup', { ghost: true })],
      ['MIC-3', 'Microphone', 'Beauty 02 · Petal Co.', chip('OK', 'dark'), 'Sat 6:15 PM', btn('Log issue', { ghost: true })],
      ['BKP-CAM-1', 'Backup camera', 'Shift reserve', chip('Available'), 'Sat 4:00 PM', btn('Assign', { ghost: true })],
    ], { min: 860 }),
    card('Session kit · GlowSkin Vitamin C LIVE', col([check('CAM-A1 · front camera', true), check('CAM-A2 · close-up camera', true), check('LGT-R1 · ring light', true), check('MIC-1, MIC-2 · lapel mics', true), check('Studio phone 01 · TikTok app, charged', true)], 0)),
    state('Failure during LIVE', 'CAM-F2 stopped responding at 8:12 PM', 'Incident INC-0045 opened. Backup camera BKP-CAM-1 is free in the control room.', [btn('Assign backup camera', { primary: true }), btn('Open incident', { href: 'O16.dc.html' })]),
  ].join('') });

// ---------------------------------------------------------------- O09–O11, O18 inventory
S.push({ id: 'O09', title: 'Product receiving', nav: 'Inventory', user: 'inventory', h: 1600, subnav: subnav(INV_SUB, 'O09'), badges: [badge('MVP'), EX], actions: [btn('Receive shipment', { primary: true })],
  notes: { priority: 'MVP', purpose: 'Log what brands send, check it against what’s expected, and store it.', roles: 'Inventory Coordinator.',
    rules: ['Brand registers shipments from the campaign (expected units, tracking).', 'Receiving records count, condition, photo and shelf.', 'Cutoff: samples must arrive [48] hours before the LIVE (configurable).', 'Shortfall at cutoff notifies brand and Location Manager.'],
    states: ['Missing at cutoff → reschedule or cancel by policy (B14)', 'Damaged → photo, brand asked to resend', 'Unexpected item → quarantine shelf'], links: ['O10', 'O11', 'B14'] },
  main: [
    table(['Shipment', 'Brand · campaign', 'Expected', 'Received', 'Tracking', 'Due by', 'Status'], [
      ['SH-310', 'GlowSkin · Vitamin C LIVE', '4 × Vitamin C Face Serum', '4', '[TRACKING]', 'Thu', chip('Received Wed', 'dark')],
      ['SH-318', 'GlowSkin · Night Cream LIVE DROP', '4 × Hydrating Night Cream', '0', '[TRACKING]', 'Tue', chip('Overdue', 'alert')],
      ['SH-321', 'TechNest · earbuds LIVE', '3 × earbuds, 1 × case', '3 + 0', '[TRACKING]', 'Thu', chip('Short by 1', 'alert')],
      ['SH-324', 'Petal Co. · lip tint LIVE', '6 × lip tint set', '6', '[TRACKING]', 'Thu', chip('Received', 'dark')],
    ], { min: 960 }),
    card('Receive SH-321 · TechNest', grid([field('Item', 'TechNest earbuds (TN-EB-2)'), field('Expected', '3', { type: 'number' }), field('Received', '3', { type: 'number' }), sel('Condition', ['Good', 'Damaged', 'Opened']), sel('Shelf', ['S4', 'S1', 'S2', 'S3', 'Locked cabinet']), field('Item', 'Charging case (TN-CC-1)'), field('Expected', '1', { type: 'number' }), field('Received', '0', { type: 'number', err: '1 missing' }), ph('Photo of contents', 96)], 200)),
    grid([state('Missing samples', 'Night Cream samples are 2 days overdue', 'The LIVE is Thursday. Brand and manager notified; if nothing arrives by cutoff, the brand chooses to reschedule or cancel under the policy.', [btn('Message brand'), btn('Flag on booking', { href: 'O06.dc.html' })]), state('Short shipment', 'TechNest case missing', 'Seller can still demo the earbuds. Producer told; brief updated.')], 300),
  ].join('') });

S.push({ id: 'O10', title: 'Sample inventory', nav: 'Inventory', user: 'inventory', h: 1400, subnav: subnav(INV_SUB, 'O10'), badges: [badge('MVP'), EX],
  notes: { priority: 'MVP', purpose: 'What samples are on site, reserved for which session, and when they go back.', roles: 'Inventory Coordinator; producers read.',
    rules: ['On hand = received − returned − disposed − used (opened).', 'Reserved quantity is tied to a booking; can’t be released while booked.', 'Return due date comes from the campaign (return or dispose after LIVE).'],
    states: ['Reserved > on hand → shortage alert to brand and manager', 'Return overdue → reminder'], links: ['O09', 'O11', 'O18'] },
  main: [
    row([`<input type="search" aria-label="Search samples" placeholder="Search SKU, brand or shelf" style="${inputStyle}; flex:2 1 240px; width:auto">`, sel('Brand', ['All brands', 'GlowSkin Beauty', 'TechNest', 'Petal Co.'], { grow: true }), sel('Status', ['All', 'Reserved', 'Return due', 'Shortage'], { grow: true })], { gap: 12, align: 'flex-end' }),
    table(['SKU', 'Item', 'Brand', 'On hand', 'Reserved', 'Shelf', 'After LIVE', 'Status'], [
      ['GS-VC-30', 'Vitamin C Face Serum', 'GlowSkin', '4', '4 · BK-2201', 'Beauty 01 (in use)', 'Return 2 unopened', chip('In session', 'dark')],
      ['TN-EB-2', 'Earbuds', 'TechNest', '3', '3 · BK-2195', 'Electronics 01', 'Return all', chip('In session', 'dark')],
      ['PC-LT-6', 'Lip tint set', 'Petal Co.', '6', '6 · BK-2188', 'Beauty 02', 'Dispose opened', chip('In session', 'dark')],
      ['GS-NC-50', 'Hydrating Night Cream', 'GlowSkin', '0', '4 · BK-2207', '—', '—', chip('Shortage', 'alert')],
    ], { min: 980 }),
    state('Shortage', 'Night Cream LIVE DROP needs 4, 0 on hand', 'Linked to overdue shipment SH-318.', [btn('Open receiving', { href: 'O09.dc.html' })]),
  ].join('') });

S.push({ id: 'O11', title: 'Storage and movement', nav: 'Inventory', user: 'inventory', h: 1300, subnav: subnav(INV_SUB, 'O11'), badges: [badge('MVP'), EX],
  notes: { priority: 'MVP', purpose: 'Chain of custody: where each sample is and who moved it.', roles: 'Inventory Coordinator, producers.',
    rules: ['Every move records from, to, who and when (scan or manual).', 'High-value items live in the locked cabinet; moves need a second person’s confirmation (configurable).', 'Shelf map is editable by the Location Manager.'],
    states: ['Item not found at expected shelf → “Missing” incident', 'Scan fails → manual entry with note'], links: ['O10', 'O18', 'O16'] },
  main: [
    grid([ph('Shelf map · S1–S6 and locked cabinet', 220), card('Move items', col([sel('Item', ['GS-VC-30 · Vitamin C Face Serum ×4', 'TN-EB-2 · Earbuds ×3']), sel('From', ['Shelf S2', 'Beauty Booth 01']), sel('To', ['Beauty Booth 01', 'Shelf S2', 'Return area']), btn('Record move', { primary: true })]))], 320),
    card('Movement log', table(['When', 'Item', 'From', 'To', 'By'], [['Sat 6:20 PM', 'GS-VC-30 ×4', 'Shelf S2', 'Beauty Booth 01', 'Jordan P.'], ['Sat 7:55 PM', 'TN-EB-2 ×3', 'Locked cabinet', 'Electronics Booth 01', 'Omar R. + Sam K.'], ['Wed 2:10 PM', 'GS-VC-30 ×4', 'Receiving', 'Shelf S2', 'Sam K.']], { min: 720 })),
  ].join('') });

// ---------------------------------------------------------------- O12–O13 sellers and readiness
S.push({ id: 'O12', title: 'Seller check-in', nav: 'Sellers', user: 'desk', h: 1500, subnav: subnav(SELLER_SUB, 'O12'), badges: [badge('MVP'), EX],
  notes: { priority: 'MVP', purpose: 'Front desk view of today’s arrivals; the official arrival record.', roles: 'Front desk (Location Manager or delegate), producers.',
    rules: ['Check in by scanning the seller’s code (C15) or entering it; photo ID compared with the profile.', 'Check-in time drives on-time and no-show rules.', 'No-show at arrival + 15 min: producer calls seller; manager decides backup seller, delay or reschedule.', 'Backup seller must hold the campaign’s required certificates.'],
    states: ['Wrong day or location → shows the seller’s actual booking', 'ID doesn’t match → don’t check in; manager review', 'No-show → backup workflow'], links: ['O13', 'O23', 'C15', 'B12'] },
  main: [
    row([field('Scan or enter check-in code', '', { ph: 'VL-0000', grow: true }), btn('Check in', { primary: true })], { align: 'flex-end' }),
    table(['Arrival', 'Seller', 'Session', 'Booth', 'Producer', 'Status', ''], [
      ['4:15 PM', 'Priya Nair', 'Lumen Skin', 'Beauty 02', 'Kim L.', chip('Checked in 4:09', 'dark'), '—'],
      ['5:45 PM', 'Jade Morgan', 'Petal Co.', 'Beauty 02', 'Kim L.', chip('Checked in 5:40', 'dark'), '—'],
      ['6:15 PM', 'Sarah Johnson', 'GlowSkin Vitamin C', 'Beauty 01', 'Jordan P.', chip('Checked in 6:12', 'dark'), '—'],
      ['6:45 PM', 'Marcus Lee', 'Urban Thread', 'Fashion 01', 'Lee T.', chip('Checked in 6:58 · late', 'outline'), '—'],
      ['7:45 PM', 'Noah Brooks', 'TechNest', 'Electronics 01', 'Omar R.', chip('Checked in 7:41', 'dark'), '—'],
    ], { min: 900 }),
    state('No-show', 'A seller hasn’t checked in 15 minutes after arrival time', 'Producer has called twice. Choose: wait 15 more minutes (start may slip), bring in a certified backup seller, or reschedule with the brand.', [btn('Find backup seller', { href: 'O23.dc.html' }), btn('Delay start'), btn('Reschedule')]),
    state('ID mismatch', 'Photo ID doesn’t match the profile', 'Don’t check in. Manager reviews; the brand is told the start may move.'),
  ].join('') });

S.push({ id: 'O13', title: 'Pre-LIVE readiness', nav: 'Sellers', user: 'producer', h: 1800, subnav: subnav(SELLER_SUB, 'O13'), badges: [badge('MVP'), EX],
  notes: { priority: 'MVP', purpose: 'Go / no-go for each session: seller, compliance, tech and product.', roles: 'Studio Producer (decides), Location Manager (overrides with reason).',
    rules: ['Same checklist the seller sees (C17); each item has an owner.', 'Compliance check: producer reviews the seller’s plan against restricted claims (B06).', 'TikTok steps (account login, showcase products) are confirmed by eye on the studio device; Vyralink can’t check them via API in MVP.', 'Go requires all items; a manager override is logged with a reason.'],
    states: ['Item fails → delay start (brand notified) or swap booth/kit', 'Missing certificate → no-go until resolved', 'TikTok account login fails → seller resolves in app; escalate after 10 min'], links: ['O14', 'O08', 'C17', 'B06'] },
  main: [
    sel('Session', ['TechNest earbuds LIVE · 8:30 PM · Electronics 01', 'GlowSkin Vitamin C LIVE · 7:00 PM · Beauty 01']),
    grid([kpi('Readiness', '5 of 8', 'Start 8:30 PM · 6 min to go'), kpi('Seller', 'Checked in 7:41', 'Noah Brooks'), kpi('Network', 'Degraded', 'Line 2 · backup available', 'Live')], 200),
    table(['Item', 'Owner', 'Result', 'When'], [
      ['Seller checked in', 'Front desk', chip('Pass', 'dark'), '7:41 PM'],
      ['Briefing acknowledged', 'Seller', chip('Pass', 'dark'), '7:52 PM'],
      ['TikTok account logged in on studio phone 03', 'Seller · checked by producer', chip('Pass', 'dark'), '8:05 PM'],
      ['Products in TikTok Shop showcase', 'Seller · checked by producer', chip('Pass', 'dark'), '8:08 PM'],
      ['Camera and audio test', 'Producer', chip('Pass', 'dark'), '8:10 PM'],
      ['Network test (upload ≥ [N] Mbps)', 'Producer', chip('Fail · 3.1 Mbps', 'alert'), '8:14 PM'],
      ['Samples at booth', 'Producer', chip('Pending', 'outline'), '—'],
      ['Compliance check', 'Producer', chip('Pending', 'outline'), '—'],
    ], { min: 760 }),
    card('Compliance check', col([p('Seller’s run of show mentions: “noise cancelling”, “30-hour battery”, “waterproof”.', { size: 14 }), table(['Claim', 'Approved?', 'Action'], [['Noise cancelling', 'Yes', '—'], ['30-hour battery (with case)', 'Yes, with case', 'Case missing from samples: say “with charging case”'], ['Waterproof', chip('Not approved', 'alert'), 'Remove; “sweat resistant (IPX4)” is approved']], { min: 560 }), check('Seller briefed on the corrected claims', false)])),
    row([btn('Delay start 10 min'), btn('Switch to 5G backup'), btn('Go LIVE', { primary: true, disabled: true })], { gap: 8 }),
    state('No-go', 'Network test failed', 'Switch to the 5G backup and re-test, or move to Flex Booth 01 (line 1). Delays over 10 minutes notify the brand automatically.'),
  ].join('') });

// ---------------------------------------------------------------- O14 LIVE Control Center
const sessCard = (o) => `<article aria-label="${o.title}" style="border:${o.alert ? '2px dashed #1a1a1a' : '1px solid #8c8c8c'}; border-radius:8px; padding:16px; display:flex; flex-direction:column; gap:12px; min-width:0; background:#ffffff">
${row([chip(o.status, o.statusTone), `<b style="font-size:16px">${o.title}</b>`], { gap: 8 })}
<dl style="margin:0; display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:6px 16px; font-size:13px">${[['Brand', o.brand], ['Product', o.product], ['Host', o.host], ['Location · booth', `CH Virginia · ${o.booth}`], ['Producer', o.producer], ['Start', o.start], ['Elapsed', o.elapsed]].map(([k, v]) => `<div><dt style="color:#3d3d3d; font-weight:600">${k}</dt><dd style="margin:0">${v}</dd></div>`).join('')}</dl>
<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(120px, 1fr)); gap:8px">${o.metrics.map(([k, v, src, note]) => `<div style="border:1px solid #c4c4c4; border-radius:6px; padding:8px; display:flex; flex-direction:column; gap:4px"><span style="display:flex; justify-content:space-between; gap:4px; font-size:11px; font-weight:600; color:#3d3d3d">${k}${prov(src)}</span><b style="font-size:18px">${v}</b>${note ? `<span style="font-size:11px; color:#3d3d3d">${note}</span>` : ''}</div>`).join('')}</div>
${o.issue ? `<div style="font-size:13px; border-left:4px solid #1a1a1a; padding:4px 0 4px 10px"><b>${o.issue}</b></div>` : '<div style="font-size:13px; color:#3d3d3d">No alerts</div>'}
${row([btn('Details', o.detailHref ? { href: o.detailHref } : {}), btn('Message producer'), btn('Log incident', { href: 'O16.dc.html' })], { gap: 8 })}
</article>`;
const sessions = [
  { title: 'GlowSkin Vitamin C LIVE', status: 'LIVE', statusTone: 'dark', brand: 'GlowSkin Beauty', product: 'Vitamin C Face Serum', host: 'Sarah Johnson', booth: 'Beauty Booth 01', producer: 'Jordan P.', start: '7:00 PM (on time)', elapsed: '1:24 of 3:00', detailHref: 'O15.dc.html',
    metrics: [['Connection', 'Good', 'Live', 'Studio network monitor'], ['Viewers', '—', 'Unavailable', 'Not provided to Vyralink'], ['Orders', '64', 'Manual', 'Producer entry 8:20 PM'], ['GMV', '$2,560', 'Manual', '8:20 PM'], ['GMV / hour', '$1,829', 'Manual', '$2,560 ÷ 1.4 h']] },
  { title: 'Petal Co. lip tint LIVE', status: 'LIVE', statusTone: 'dark', brand: 'Petal Co.', product: 'Lip tint set', host: 'Jade Morgan', booth: 'Beauty Booth 02', producer: 'Kim L.', start: '6:30 PM (on time)', elapsed: '1:54 of 2:00', alert: true, issue: 'Connection degraded: upload 3.1 Mbps on line 2 · ending in 6 minutes',
    metrics: [['Connection', 'Degraded', 'Live', 'Line 2'], ['Viewers', '—', 'Unavailable', ''], ['Orders', '41', 'Manual', '8:00 PM'], ['GMV', '—', 'Delayed', 'After closeout'], ['GMV / hour', '—', 'Unavailable', '']] },
  { title: 'Urban Thread denim LIVE', status: 'Interrupted', statusTone: 'alert', brand: 'Urban Thread', product: 'Slim denim jeans', host: 'Marcus Lee', booth: 'Fashion Booth 01', producer: 'Lee T.', start: '7:30 PM (on time)', elapsed: '0:42 + 12 min down', alert: true, issue: 'Stream dropped at 8:12 PM: CAM-F2 failed and encoder restarted. INC-0045 (high). Reconnecting on backup camera.',
    metrics: [['Connection', 'Reconnecting', 'Live', 'Since 8:12 PM'], ['Viewers', '—', 'Unavailable', ''], ['Orders', '17', 'Manual', '8:10 PM'], ['GMV', '—', 'Delayed', ''], ['GMV / hour', '—', 'Unavailable', '']] },
  { title: 'TechNest earbuds LIVE', status: 'Pre-LIVE · blocked', statusTone: 'alert', brand: 'TechNest', product: 'Earbuds TN-EB-2', host: 'Noah Brooks', booth: 'Electronics Booth 01', producer: 'Omar R.', start: '8:30 PM (scheduled)', elapsed: 'Starts in 6 min', alert: true, issue: 'Readiness 5 of 8: network test failed; compliance check pending', detailHref: 'O13.dc.html',
    metrics: [['Connection', 'Degraded', 'Live', 'Line 2'], ['Readiness', '5 / 8', 'Live', ''], ['Orders', '—', 'Unavailable', 'Not started'], ['GMV', '—', 'Unavailable', ''], ['GMV / hour', '—', 'Unavailable', '']] },
];
S.push({ id: 'O14', title: 'LIVE Control Center', nav: 'LIVE Control Center', user: 'manager', h: 3300, subnav: subnav(CC_SUB, 'O14'), badges: [badge('MVP'), badge('P2'), EX], actions: [btn('Escalate to on-call technician'), btn('Emergency stop request')],
  notes: { priority: ['MVP', 'P2'], purpose: 'Watch every simultaneous broadcast at a location and act fast when something breaks.', roles: 'Location Manager, Studio Producers (own sessions editable, others read-only).',
    rules: ['Vyralink does not control TikTok streams. Starting, ending and in-stream actions happen in TikTok on the studio device; this screen tracks studio status and producer inputs.', 'Every number carries its source: Live (studio equipment), Delayed, Manual (producer entry, with time) or Unavailable. Never estimated.', 'Viewers, orders and GMV sync automatically only in Phase 2 and only where TikTok authorizes access; MVP is producer entry.', 'Cards sort by severity: interrupted, blocked, degraded, then normal.', 'Emergency stop is a logged instruction to the producer and seller, not a remote kill switch.'],
    states: ['Studio monitor offline → connection shows Unavailable with last update', 'No sessions → next session countdown', 'Producer hasn’t entered metrics for 30 min → reminder on card'], links: ['O15', 'O16', 'O17', 'O13', 'O08'] },
  main: [
    banner('Vyralink does not control TikTok LIVE streams. Start, end and in-stream actions happen in TikTok on the studio device. This screen shows studio status and producer inputs.'),
    row([tabs(['All 4', 'LIVE 2', 'Interrupted 1', 'Pre-LIVE 1', 'Completed today 1'], 0), `<span style="font-size:13px">Now: Sat 8:24 PM (example) · auto-refresh 15 s</span>`], { justify: 'space-between' }),
    row([`<b style="font-size:13px">Data sources:</b>`, prov('Live'), `<span style="font-size:12px">studio equipment, real time</span>`, prov('Manual'), `<span style="font-size:12px">entered by producer, time shown</span>`, prov('Delayed'), `<span style="font-size:12px">arrives after closeout</span>`, prov('Unavailable'), `<span style="font-size:12px">not provided to Vyralink</span>`], { gap: 6 }),
    grid([sessCard(sessions[2]), sessCard(sessions[3]), sessCard(sessions[1]), sessCard(sessions[0])], 460),
    card('Session detail drawer · GlowSkin Vitamin C LIVE', col([
      tabs(['Overview', 'Readiness', 'Producer notes', 'Incidents', 'Closeout'], 2),
      grid([
        col([sub('Start readiness'), ul(['8 of 8 passed · Go given 6:58 PM by Jordan P.', 'Compliance check passed 6:50 PM', 'Started on time 7:00 PM'], { size: 13 })], 8),
        col([sub('Enter metrics (from the TikTok LIVE dashboard on the studio device)'), grid([field('Orders', '64', { type: 'number' }), field('GMV (USD)', '2,560'), field('As of', '8:20 PM')], 120), btn('Save entry', { primary: true })], 8),
      ], 320),
      col([sub('Producer notes and cue log'), table(['Time', 'Note', 'By'], [['7:00 PM', 'Live on time. Intro and 15% offer.', 'Jordan P.'], ['7:20 PM', 'Demo 1 done. Seller asked about sensitive skin, answered within brief.', 'Jordan P.'], ['8:00 PM', 'Cue: offer reminder at 8:30.', 'Jordan P.']], { min: 520 })], 8),
      col([sub('Incident log'), p('No incidents for this session.', { size: 13, mute: true })], 8),
      row([btn('Escalate technical issue'), btn('Open closeout', { href: 'O17.dc.html' })], { gap: 8 }),
    ])),
    card('Technical issue escalation', `<ol style="margin:0; padding-left:20px; display:flex; flex-direction:column; gap:6px; font-size:14px; line-height:1.5"><li>Producer logs the issue from the card (opens an incident, O16).</li><li>Producer tries the runbook fix: swap kit (O08), switch network line, restart encoder.</li><li>Not fixed in 5 minutes: escalate to the on-call technician (phone and in-app).</li><li>Not fixed in 15 minutes, or the LIVE is down: Location Manager decides to move booth, continue shorter, or end; brand is notified.</li><li>Every step is timestamped in the incident.</li></ol>`),
    card('Emergency stop · workflow', col([
      `<ol style="margin:0; padding-left:20px; display:flex; flex-direction:column; gap:6px; font-size:14px; line-height:1.5"><li>Manager or producer selects <b>Emergency stop request</b> and a reason: safety, harassment, serious compliance breach, equipment hazard.</li><li>Confirmation shows who is told: producer on the floor, seller (in-app alert), brand contact.</li><li>The producer instructs the seller to end the LIVE in the TikTok app; Vyralink cannot end it remotely.</li><li>Producer confirms the stop time; the session becomes “Ended early” and an incident is opened.</li><li>Pay, fees and refunds then follow the contract terms for early ends.</li></ol>`,
      state('Confirm', 'Request an emergency stop of Urban Thread denim LIVE?', 'Reason: equipment hazard (overheating light). Lee T. and Marcus Lee are alerted now; Urban Thread is notified. Ending the stream happens in TikTok on the studio device.', [btn('Cancel'), btn('Send stop instruction', { primary: true })]),
    ])),
    grid([state('Monitor offline', 'Studio network monitor isn’t reporting', 'Connection shows Unavailable on all cards, last updated 8:19 PM. Producers confirm status by radio.'), state('Stale manual data', 'No metric entry for 30 minutes', 'Petal Co. card shows a reminder to Kim L.')], 300),
    state('Phase 2', 'Automatic viewers, orders and GMV', 'Only through access TikTok authorizes for the account in question. Until then these are Manual or Unavailable.'),
  ].join('') });

S.push({ id: 'O15', title: 'Session monitoring', nav: 'LIVE Control Center', user: 'producer', h: 1700, subnav: subnav(CC_SUB, 'O15'), crumbs: ['Operations', '<a href="O14.dc.html">LIVE Control Center</a>', 'GlowSkin Vitamin C LIVE'], badges: [badge('MVP'), chip('LIVE', 'dark'), EX],
  notes: { priority: 'MVP', purpose: 'One session in depth: timeline, cues, metric entries and connection history.', roles: 'Studio Producer (owner), Location Manager.',
    rules: ['Metric entries are append-only with time and author; corrections create a new entry.', 'Timeline merges check-in, readiness, go, cues, incidents and end.', 'Run-of-show cues remind the producer; they don’t control TikTok.'],
    states: ['Entry rejected (orders fell) → confirm correction with note', 'Connection lost → incident prompt'], links: ['O14', 'O16', 'O17'] },
  main: [
    grid([kpi('Elapsed', '1:24:10', 'of 3:00:00'), kpi('Connection', 'Good', 'Upload 18 Mbps', 'Live'), kpi('Orders', '64', '8:20 PM', 'Manual'), kpi('GMV', '$2,560', '8:20 PM', 'Manual')], 200),
    ph('Chart · upload speed over the session (studio monitor)', 160),
    card('Run of show and cues', table(['Time', 'Cue', 'Status'], [['7:00 PM', 'Go LIVE · intro · 15% offer', chip('Done', 'dark')], ['7:20 PM', 'Demo 1', chip('Done', 'dark')], ['7:40 PM', 'Demo 2', chip('Done', 'dark')], ['8:00 PM', 'Demo 3', chip('Done', 'dark')], ['8:30 PM', 'Offer reminder', chip('Next', 'outline')], ['9:55 PM', 'Wrap-up', chip('Later')], ['10:00 PM', 'Cue seller to end LIVE in TikTok', chip('Later')]], { min: 560 })),
    card('Metric entries', table(['As of', 'Orders', 'GMV', 'Source', 'By'], [['7:30 PM', '21', '$840', 'TikTok LIVE dashboard on studio phone 01', 'Jordan P.'], ['8:00 PM', '44', '$1,760', 'Same', 'Jordan P.'], ['8:20 PM', '64', '$2,560', 'Same', 'Jordan P.']], { min: 640 }), { right: btn('Add entry', { primary: true }) }),
    area('Producer notes', 'Seller pacing well. Sensitive-skin question answered within brief.'),
  ].join('') });

S.push({ id: 'O16', title: 'Incidents', nav: 'LIVE Control Center', user: 'manager', h: 1800, subnav: subnav(CC_SUB, 'O16'), badges: [badge('MVP'), EX], actions: [btn('Log incident', { primary: true })],
  notes: { priority: 'MVP', purpose: 'Record, escalate and resolve anything that affects a session.', roles: 'Producers log; Location Manager owns; Super Admin sees all (A08 for disputes).',
    rules: ['Categories: Technical, Connection, Compliance, Seller, Safety, Platform (TikTok or Vyralink).', 'Severity: High (LIVE down or safety), Medium (degraded), Low (no viewer impact).', 'Minutes lost are recorded; they feed pay and fee rules for interrupted sessions.', 'Brand is notified automatically for High, and for any incident that changes start or end time.'],
    states: ['Unresolved at session end → stays open into closeout', 'Linked dispute → read-only once finance starts'], links: ['O14', 'O08', 'O17', 'A08'] },
  main: [
    table(['ID', 'Session', 'Category', 'Severity', 'Opened', 'Minutes lost', 'Status'], [
      ['INC-0045', 'Urban Thread denim LIVE', 'Technical', chip('High', 'alert'), '8:12 PM', '12 (so far)', chip('Open', 'outline')],
      ['INC-0044', 'Petal Co. lip tint LIVE', 'Connection', chip('Medium'), '8:05 PM', '0', chip('Monitoring', 'outline')],
      ['INC-0043', 'TechNest earbuds LIVE', 'Compliance', chip('Low'), '8:14 PM', '0', chip('Resolved', 'dark')],
    ], { min: 860 }),
    card('INC-0045 · Stream dropped', col([
      dl([['Session', 'Urban Thread denim LIVE · Fashion Booth 01'], ['Category', 'Technical · camera and encoder'], ['Severity', 'High: LIVE down'], ['Owner', 'Lee T. → escalated to on-call technician 8:17 PM'], ['Brand notified', '8:13 PM (automatic)']]),
      table(['Time', 'Event', 'By'], [['8:12 PM', 'CAM-F2 stopped; encoder restarted; stream dropped', 'System + Lee T.'], ['8:14 PM', 'Backup camera assigned', 'Lee T.'], ['8:17 PM', 'Escalated to on-call technician', 'Lee T.'], ['8:22 PM', 'Seller restarting LIVE in TikTok', 'Lee T.']], { min: 520 }),
      grid([sel('Resolution', ['Resolved: LIVE resumed', 'Ended early', 'Moved to another booth']), field('Minutes lost', '12', { type: 'number' })], 220),
      area('What happened and follow-up', 'Camera F2 to repair; check encoder firmware.'),
      row([btn('Notify brand'), btn('Resolve incident', { primary: true })], { gap: 8 }),
    ])),
    state('Compliance incident', 'Seller said “waterproof” (not approved)', 'Producer corrected on air at 8:41 PM. Brand notified; claims rules in the contract apply.'),
  ].join('') });

S.push({ id: 'O17', title: 'Session closeout', nav: 'LIVE Control Center', user: 'producer', h: 1900, subnav: subnav(CC_SUB, 'O17'), crumbs: ['Operations', '<a href="O14.dc.html">LIVE Control Center</a>', 'Closeout · GlowSkin Vitamin C LIVE'], badges: [badge('MVP'), chip('Draft'), EX],
  notes: { priority: 'MVP', purpose: 'Close a session with the facts finance and the brand rely on.', roles: 'Studio Producer submits; Location Manager approves.',
    rules: ['Actual start and end come from the timeline; edits need a reason.', 'LIVE hours here drive base pay (C21) and GMV/hour.', 'Results: upload the TikTok Shop report (CSV) or enter manually; source and time recorded; status Pending verification until finance confirms.', 'Zero sales is a valid result, not an error.', 'Submitting moves the campaign to In progress → Completed once finance reconciles (F05).'],
    states: ['Report not available yet → submit with results “Pending”; reminder at +24 h', 'Partial session → minutes lost and reason required', 'Zero sales → confirm, then report is still sent'], links: ['O18', 'F05', 'B15', 'C21'] },
  main: [
    grid([field('Actual start', '7:00 PM'), field('Actual end', '10:00 PM'), field('LIVE hours', '3.0', { hint: 'From the timeline' }), field('Minutes lost to incidents', '0', { type: 'number' })], 180),
    card('Results', col([
      tabs(['Upload TikTok Shop report', 'Enter manually'], 0),
      `<label style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; min-height:100px; border:2px dashed #8c8c8c; border-radius:8px; font-size:14px; padding:16px"><span style="font-weight:700">Drop the CSV exported from TikTok Shop</span><span style="font-size:12px; color:#3d3d3d">Columns mapped: order ID, time, product, amount, status</span><input type="file" style="font-size:13px"></label>`,
      grid([kpi('Orders', '150', 'From report', 'Imported'), kpi('GMV', '$6,000', 'From report', 'Imported'), kpi('Refunds so far', '0', 'Updated later by finance', 'Imported')], 160),
      p('Status after submit: Pending verification (finance F05).', { size: 13, mute: true }),
    ])),
    card('Samples', grid([field('Samples used (opened)', '2', { type: 'number' }), field('Samples to return', '2', { type: 'number' }), sel('Condition', ['Good', 'Damaged'])], 180)),
    card('Seller', col([sel('Seller performance (internal)', ['Met expectations', 'Exceeded', 'Below expectations']), area('Notes', 'On time, followed the brief, strong Q&amp;A.')])),
    row([btn('Save draft'), btn('Submit closeout', { primary: true })], { gap: 8, justify: 'flex-end' }),
    grid([state('Zero sales', 'Confirm: 0 orders', 'Zero sales is recorded as a result. Base pay still applies; commission and performance fee are $0. The brand report explains it.', [btn('Confirm zero sales')]), state('Partial', 'Urban Thread ended 25 minutes early', 'Enter minutes lost and link INC-0045. Pay and fees follow the contract terms for interrupted sessions.'), state('Report delayed', 'TikTok Shop report not available yet', 'Submit now with results Pending. You’ll be reminded in 24 hours; brand analytics shows Delayed meanwhile.')], 260),
  ].join('') });

S.push({ id: 'O18', title: 'Returns and reconciliation', nav: 'Inventory', user: 'inventory', h: 1400, subnav: subnav(INV_SUB, 'O18'), badges: [badge('MVP'), EX], actions: [btn('Create return shipment', { primary: true })],
  notes: { priority: 'MVP', purpose: 'Close the loop on every sample: used, returned or disposed, matching what was received.', roles: 'Inventory Coordinator.',
    rules: ['Received = used + returned + disposed + on hand. Any gap is a discrepancy.', 'Return method and deadline come from the campaign.', 'Discrepancy opens an incident and pauses reconciliation sign-off for that campaign.'],
    states: ['Discrepancy → incident and brand note', 'Return label failed → manual tracking entry'], links: ['O10', 'O16', 'O17'] },
  main: [
    table(['Campaign', 'Received', 'Used', 'Returned', 'Disposed', 'On hand', 'Status'], [
      ['GlowSkin · Vitamin C LIVE', '4', '2', '2 (label created)', '0', '0', chip('Balanced', 'dark')],
      ['Petal Co. · lip tint LIVE', '6', '6', '0', '6', '0', chip('Balanced', 'dark')],
      ['Lumen Skin · night oil', '3', '1', '1', '0', '0', chip('1 missing', 'alert')],
    ], { min: 860 }),
    state('Discrepancy', 'Lumen Skin: 1 sample unaccounted for', 'Last seen: Beauty Booth 02 at 6:30 PM. Incident opened; check the booth and control room before telling the brand.', [btn('Open incident', { href: 'O16.dc.html' })]),
  ].join('') });

// ---------------------------------------------------------------- O19–O24
S.push({ id: 'O19', title: 'Studio utilization', nav: 'Reports', h: 1300, subnav: subnav(REP_SUB, 'O19'), badges: [badge('P2'), EX],
  notes: { priority: 'P2', purpose: 'How well booths and producers are used.', roles: 'Location Manager, leadership.',
    rules: ['Utilization = booked LIVE hours ÷ bookable booth hours (opening hours minus maintenance).', 'Buffers count as used time in a separate column.', 'No-shows and late cancellations shown as lost hours.'],
    states: ['Partial month → labelled'], links: ['O20', 'O05'] },
  main: [
    grid([kpi('Booth utilization · 30 days', '74%', '412 of 557 bookable hours'), kpi('Buffer time', '96 h', 'Setup and teardown'), kpi('Lost hours', '9 h', '2 no-shows, 1 late cancellation'), kpi('Producer utilization', '81%', 'Session hours ÷ shift hours')], 200),
    grid([ph('Heatmap · booth × hour of day', 220), ph('Bar chart · utilization by booth', 220)], 320),
    table(['Booth', 'Bookable h', 'Booked h', 'Utilization', 'Lost h'], [['Beauty 01', '120', '104', '87%', '3'], ['Beauty 02', '120', '98', '82%', '2'], ['Fashion 01', '110', '72', '65%', '4'], ['Electronics 01', '107', '70', '65%', '0'], ['Flex 01', '100', '68', '68%', '0']], { min: 640 }),
  ].join('') });

S.push({ id: 'O20', title: 'Location performance', nav: 'Reports', h: 1400, subnav: subnav(REP_SUB, 'O20'), badges: [badge('P2'), EX],
  notes: { priority: 'P2', purpose: 'Is the location making money? Service revenue against direct costs.', roles: 'Location Manager, Finance Administrator, leadership.',
    rules: ['Revenue = Creator Hub fees invoiced (service, production, performance). GMV is shown only as brand sales context and never added to revenue.', 'Seller compensation is a Creator Hub expense.', 'Contribution = revenue − seller compensation − studio staff − payment fees − other direct costs.', 'Full profitability lives in Finance (F07).'],
    states: ['Invoices not final → figures marked Provisional'], links: ['O19', 'O02', 'F07'] },
  main: [
    grid([kpi('Service revenue · 30 days', '$71,000', 'Fees invoiced to brands'), kpi('Seller compensation', '−$29,400', 'Base, commission, bonus'), kpi('Studio staff', '−$18,200', 'Producers, desk, inventory'), kpi('Payment fees and other direct costs', '−$3,100', ''), kpi('Contribution', '$20,300', 'Before rent and overheads')], 200),
    card('Context: brand sales (not Creator Hub revenue)', grid([kpi('GMV from LIVEs here', '$412,000', 'Brands’ merchandise sales in TikTok Shop', 'Imported'), kpi('LIVE hours', '412', '', 'Verified')], 220)),
    ph('Line chart · revenue and contribution by week', 200),
  ].join('') });

S.push({ id: 'O21', title: 'Staff', nav: 'Staff', h: 1500, badges: [badge('MVP'), EX], actions: [btn('Invite staff', { primary: true })],
  notes: { priority: 'MVP', purpose: 'Who works at the location, in which role, with what access.', roles: 'Location Manager (own location), Super Admin (all).',
    rules: ['Roles: Location Manager, Studio Producer, Inventory Coordinator, Finance Administrator.', 'Access is per location; a person can work at several.', 'Two-step verification required for all staff.', 'Removing staff ends sessions immediately and reassigns their future shifts.'],
    states: ['403 for a role without access → Request access', 'Removing someone with future shifts → reassignment prompt'], links: ['O07', 'O22', 'A03'] },
  main: [
    table(['Name', 'Role', 'Locations', 'Skills', 'Status', ''], [
      ['Rosa Diaz', 'Location Manager', 'Virginia', '—', chip('Active', 'dark'), btn('Edit', { ghost: true })],
      ['Jordan P.', 'Studio Producer', 'Virginia', 'Beauty, fashion', chip('Active', 'dark'), btn('Edit', { ghost: true })],
      ['Kim L.', 'Studio Producer', 'Virginia', 'Beauty', chip('Out sick Tue', 'outline'), btn('Edit', { ghost: true })],
      ['Omar R.', 'Studio Producer', 'Virginia', 'Electronics', chip('Active', 'dark'), btn('Edit', { ghost: true })],
      ['Sam K.', 'Inventory Coordinator', 'Virginia', '—', chip('Active', 'dark'), btn('Edit', { ghost: true })],
      ['Alex M.', 'Finance Administrator', 'All locations', '—', chip('Active', 'dark'), btn('Edit', { ghost: true })],
    ], { min: 860 }),
    card('Role access', table(['Area', 'Location Manager', 'Producer', 'Inventory', 'Finance'], [['Bookings', 'Edit', 'View', '—', 'View'], ['Control Center', 'All sessions', 'Own sessions', '—', '—'], ['Incidents', 'Own and resolve', 'Log', 'Log', 'View'], ['Inventory', 'View', 'Move items', 'Edit', '—'], ['Finance', 'Location summary', '—', '—', 'Edit'], ['Staff and settings', 'Edit', '—', '—', '—']], { min: 720, rowHead: true })),
    state('403', 'Inventory Coordinators can’t open the Control Center', 'Sam K. tried to open O14. Ask Rosa Diaz to change the role if needed.', [btn('Request access')]),
  ].join('') });

S.push({ id: 'O22', title: 'Operations settings', nav: 'Settings', h: 1800, badges: [badge('MVP')], actions: [btn('Save changes', { primary: true })],
  notes: { priority: 'MVP', purpose: 'Rules that make bookings, check-ins and incidents work the same way every time.', roles: 'Location Manager (location), Super Admin (platform defaults).',
    rules: ['Location values override platform defaults; blank inherits the default.', 'Changes apply to new bookings; existing bookings keep the rules they were made under.', 'Every change is audit-logged (A09).'],
    states: ['Value outside allowed range → inline error', 'Change affects signed contracts → blocked; applies to new ones only'], links: ['O03', 'O13', 'O16', 'A12'] },
  main: [
    card('Booking', grid([field('Setup buffer (minutes)', '30', { type: 'number' }), field('Teardown buffer (minutes)', '15', { type: 'number' }), field('Hold window (hours)', '[HOLD WINDOW]'), field('Sample cutoff before LIVE (hours)', '48', { type: 'number' })], 220)),
    card('Check-in and no-show', grid([field('Check-in opens (minutes before arrival)', '60', { type: 'number' }), field('No-show after (minutes past arrival)', '15', { type: 'number' }), field('Auto-notify brand if start slips by (minutes)', '10', { type: 'number' })], 240)),
    card('Readiness checklist template', table(['Item', 'Owner', 'Required'], [['Seller checked in', 'Front desk', check(sr('Required: seller checked in'), true)], ['Briefing acknowledged', 'Seller', check(sr('Required: briefing'), true)], ['TikTok account logged in', 'Seller', check(sr('Required: TikTok login'), true)], ['Products in showcase', 'Seller', check(sr('Required: showcase'), true)], ['Camera and audio test', 'Producer', check(sr('Required: camera and audio'), true)], ['Network test', 'Producer', check(sr('Required: network'), true)], ['Samples at booth', 'Producer', check(sr('Required: samples'), true)], ['Compliance check', 'Producer', check(sr('Required: compliance'), true)]], { min: 560 }), { right: btn('Add item') }),
    card('Incident severity and escalation', table(['Severity', 'Definition', 'Escalate after', 'Notify brand'], [['High', 'LIVE down or safety risk', '5 min', 'Immediately'], ['Medium', 'Degraded stream or compliance slip', '15 min', 'If start or end changes'], ['Low', 'No viewer impact', '—', 'No']], { min: 640 })),
  ].join('') });

S.push({ id: 'O23', title: 'Seller roster', nav: 'Sellers', h: 1600, subnav: subnav(SELLER_SUB, 'O23'), badges: [badge('MVP'), EX], actions: [btn('Sourcing requests (2)', { primary: true })],
  notes: { priority: 'MVP', purpose: 'Sellers who work at this location: readiness, reliability and sourcing for brands (managed service).', roles: 'Location Manager.',
    rules: ['Added because the brief’s Creator Hub navigation lists “Sellers” without a screen.', 'Backup sellers: certified for the category, available, within travel distance.', 'Sourcing requests come from brands (B09 “Ask Creator Hub”); shortlist goes back to the brand’s invitations (B12).', 'Practice LIVE reviews unlock “Studio ready” for new sellers.'],
    states: ['No backup available → reschedule option', 'Seller paused (2 no-shows) → can’t be booked until reviewed'], links: ['O12', 'O13', 'B09', 'B12', 'C05'] },
  main: [
    row([`<input type="search" aria-label="Search sellers" placeholder="Search sellers" style="${inputStyle}; flex:2 1 240px; width:auto">`, sel('Category', ['All', 'Beauty', 'Fashion', 'Electronics'], { grow: true }), check('Available now (backup)', false)], { gap: 12, align: 'flex-end' }),
    table(['Seller', 'Categories', 'Certificates', 'Reliability', 'Sessions here', 'Next booking', 'Status'], [
      ['Sarah Johnson', 'Beauty', 'Fundamentals, Beauty Claims', '98%', '12', 'Now · GlowSkin', chip('Studio ready', 'dark')],
      ['Jade Morgan', 'Beauty', 'Fundamentals', '100%', '2', 'Now · Petal Co.', chip('Studio ready', 'dark')],
      ['Priya Nair', 'Beauty, makeup', 'Fundamentals, Beauty Claims', '96%', '9', 'Tue · Lumen Skin', chip('Studio ready', 'dark')],
      ['Marcus Lee', 'Skincare, fashion', 'Fundamentals', '93%', '3', 'Now · Urban Thread', chip('Studio ready', 'dark')],
      ['Dev Patel', 'Electronics', 'Fundamentals', '—', '0', '—', chip('Practice review due', 'outline')],
    ], { min: 960 }),
    card('Sourcing request · GlowSkin Beauty · Night Cream LIVE DROP', col([dl([['Needs', 'Beauty · Beauty Claims certified · Thu 6–8 PM · English'], ['Requested', 'Tue by Leo Park']]), table(['Candidate', 'Fit', ''], [['Priya Nair', 'Certified, available, 9 sessions', check(sr('Shortlist Priya Nair'), true)], ['Ana Ruiz', 'Needs Beauty Claims first', check(sr('Shortlist Ana Ruiz'), false)]], { min: 480 }), btn('Send shortlist to brand', { primary: true })])),
    state('Backup needed', 'Backup for a no-show, Beauty, now', 'Available and certified on site: none. Within 15 minutes: Priya Nair (on call). Call her or reschedule.', [btn('Call Priya'), btn('Reschedule', { href: 'O06.dc.html' })]),
  ].join('') });

S.push({ id: 'O24', title: 'Brand accounts', nav: 'Brands', h: 1500, badges: [badge('MVP'), EX],
  notes: { priority: ['MVP', 'P2'], purpose: 'Brands this location serves: packages, campaigns, requests and billing status.', roles: 'Location Manager, account managers, Finance Administrator.',
    rules: ['Added because the brief’s Creator Hub navigation lists “Brands” without a screen.', 'Billing columns are summaries; detail lives in Finance (F02).', 'Managed LIVE retainers are Phase 2.', 'Brands see their own data only; this view is internal.'],
    states: ['Overdue invoice → bookings flagged after the grace period', 'Unverified brand → can’t confirm bookings'], links: ['O06', 'O23', 'F02', 'B16'] },
  main: [
    table(['Brand', 'Verification', 'Package', 'Active campaigns', 'Next LIVE', 'Open requests', 'Billing'], [
      ['GlowSkin Beauty', chip('In review', 'outline'), 'Per-session', '2', 'Sat 7 PM (now)', '1 sourcing', chip('INV-1042 issued', 'outline')],
      ['Petal Co.', chip('Verified', 'dark'), 'Per-session', '1', 'Now', '—', chip('Paid', 'dark')],
      ['TechNest', chip('Verified', 'dark'), 'Per-session', '1', 'Sat 8:30 PM', '—', chip('Paid', 'dark')],
      ['Urban Thread', chip('Verified', 'dark'), 'Monthly retainer', '3', 'Now', '1 report', chip('Overdue 5 days', 'alert')],
    ], { min: 960 }),
    card('GlowSkin Beauty · account', grid([dl([['Owner', 'Maya Chen'], ['Account manager', 'Rosa Diaz'], ['Package', 'Per-session: $750 production + 7% performance fee']]), col([sub('Services'), ul(['LIVE production', 'Seller sourcing (managed)', 'Monthly retainer (Phase 2)', 'Short-form clips from LIVEs (Phase 2)'], { size: 13 }), badge('P2')], 8)], 300)),
    state('Overdue', 'Urban Thread is 5 days overdue', 'Bookings stay confirmed during the grace period ([GRACE] days); finance contacts the brand.'),
  ].join('') });

for (const s of S) opsScreen(s);

// ---------------------------------------------------------------- O12 tablet (front desk, 768 px)
const tablet = `<div style="width:1154px; min-height:1100px; box-sizing:border-box; padding:24px; display:flex; gap:32px; align-items:flex-start; background:#ececec; ${FONT}; color:#1a1a1a">
<div style="width:768px; flex-shrink:0; background:#ffffff; border:1px solid #8c8c8c; border-radius:24px; overflow:hidden; display:flex; flex-direction:column">
<header style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 20px; border-bottom:1px solid #c4c4c4"><span style="font-weight:800; letter-spacing:0.1em; font-size:14px">CREATOR HUB · FRONT DESK</span><span style="font-size:13px">Creator Hub Virginia · Sat</span></header>
<main style="padding:24px; display:flex; flex-direction:column; gap:20px">
<h1 style="margin:0; font-size:24px">Check in a seller</h1>
${row([field('Check-in code', 'VL-4827', { grow: true }), btn('Check in', { primary: true })], { align: 'flex-end' })}
${btn('Scan code with camera', { full: true })}
${state('Matched', 'Sarah Johnson · GlowSkin Vitamin C LIVE', 'Arrival 6:15 PM · Beauty Booth 01 · Producer Jordan P. Compare photo ID with the profile photo before confirming.', [btn('ID matches · confirm', { primary: true }), btn('ID doesn’t match')])}
${row([ph('Profile photo', 120, '120px'), dl([['Seller', 'Sarah Johnson'], ['Session', '7:00–10:00 PM'], ['Booth', 'Beauty Booth 01'], ['Producer', 'Jordan P. (notified on confirm)']])], { gap: 16 })}
${sub('Arriving next')}
${table(['Arrival', 'Seller', 'Booth', 'Status'], [['6:45 PM', 'Marcus Lee', 'Fashion 01', chip('Expected', 'outline')], ['7:45 PM', 'Noah Brooks', 'Electronics 01', chip('Expected', 'outline')]], { min: 600 })}
</main>
</div>
${notesBox('O12', { priority: 'MVP', view: 'Tablet · 768 px · front desk. Same rules as O12 desktop.', purpose: 'Fast, touch-friendly check-in at the desk.', roles: 'Front desk.', rules: ['Large targets (≥ 44 px), works in portrait and landscape.', 'Camera scan or typed code.', 'Confirming notifies the producer and starts readiness (O13).'], states: ['Code not found → check spelling or search by name', 'ID mismatch → manager review'], links: ['O12', 'O13'] })}
</div>`;
out('project/ops/O12-tablet.dc.html', doc('O12 Seller check-in (tablet)', 1154, 1100, tablet));

// ---------------------------------------------------------------- canvas.json (merge)
const cpath = path.join(ROOT, 'project/canvas.json');
const canvas = JSON.parse(fs.readFileSync(cpath, 'utf8'));
if (!canvas.pages.some((pg) => pg.id === 'ops')) canvas.pages.push({ id: 'ops', name: '5 · Creator Hub operations (O01–O24)' });
let y = 0;
for (let r = 0; r < S.length; r += 3) {
  const rowS = S.slice(r, r + 3);
  rowS.forEach((s, c) => {
    const file = `ops/${s.id}.dc.html`;
    canvas.boards[file] = { x: c * 1520, y, w: 1440, h: s.h, page: 'ops', expand: 'fill', is_interactive: true, title: `${s.id} · ${s.title}` };
    if (!canvas.order.includes(file)) canvas.order.push(file);
  });
  y += Math.max(...rowS.map((s) => s.h)) + 120;
}
canvas.boards['ops/O12-tablet.dc.html'] = { x: 3 * 1520, y: 0, w: 1154, h: 1100, page: 'ops', title: 'O12 · Seller check-in · tablet 768 px' };
if (!canvas.order.includes('ops/O12-tablet.dc.html')) canvas.order.push('ops/O12-tablet.dc.html');
canvas.notes.opsTitle = { x: 0, y: -300, text: 'D5 · Creator Hub operations · O01–O24', kind: 'title1', maxW: 4480, page: 'ops' };
canvas.notes.opsTip = { x: 3 * 1520, y: 1220, w: 360, text: 'Start at O14 LIVE Control Center: 4 simultaneous sessions, detail drawer, escalation and emergency-stop workflow. Tabs at the top of each section (Control Center, Inventory, Sellers…) link sibling screens in Play.', fill: 'gray', page: 'ops' };
if (canvas.notes.overviewTitle) canvas.notes.overviewTitle.text = 'Vyralink + Creator Hub · Batches 1–3';
fs.writeFileSync(cpath, JSON.stringify(canvas, null, 2));
written.push('project/canvas.json');
fs.writeFileSync(path.join(ROOT, 'batch3-files.json'), JSON.stringify(written));
console.log(written.length, 'files');
