// Batch 6: D9 component library, D10 developer handoff (derived from the boards), §16 quality audit.
// Usage: node gen6.mjs <rootDir>
import fs from 'node:fs';
import path from 'node:path';
import { doc, FONT, inputStyle, btn, badge, chip, prov, field, sel, check, row, col, grid, card, kpi, table, ph, stepper, tabs, state, banner, ul, p, dl, sub, bell } from './lib.mjs';

const ROOT = process.argv[2];
const P = (...a) => path.join(ROOT, 'project', ...a);
const written = [];
const out = (rel, s) => {
  const f = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, s);
  written.push(rel);
  if (rel.endsWith('.html') && s.replace(/&(amp|lt|gt|quot|#\d+);/g, '').includes('&')) console.warn(`WARN raw & in ${rel}`);
  if (s.includes('{{')) console.warn(`WARN {{ in ${rel}`);
};
const strip = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const esc = (s) => s.replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const uniq = (a) => [...new Set(a.filter(Boolean))];

// ---------------------------------------------------------------- read every screen board
const FOLDERS = ['brand', 'creator', 'ops', 'fin', 'admin'];
const ORDER = (id) => ({ B: 0, M: 1, C: 2, O: 3, F: 4, A: 5 })[id[0]] * 100 + parseInt(id.slice(1), 10);
const screenFiles = [];
for (const d of FOLDERS) for (const f of fs.readdirSync(P(d))) { const m = f.match(/^([BCOFA]\d\d|M01)\.dc\.html$/); if (m) screenFiles.push({ id: m[1], folder: d, file: `${d}/${f}` }); }
screenFiles.sort((a, b) => ORDER(a.id) - ORDER(b.id));

// all boards (for links): screens, variants, flows, journeys, edge, overview
const allBoards = [];
const walk = (d) => { for (const e of fs.readdirSync(P(d), { withFileTypes: true })) { const r = d ? `${d}/${e.name}` : e.name; if (e.isDirectory()) walk(r); else if (e.name.endsWith('.dc.html')) allBoards.push(r); } };
walk('');
const idOfBoard = (rel) => { const b = path.basename(rel, '.dc.html'); const m = b.match(/^([BCOFA]\d\d|M01|BF\d\d|J\d)/); return m ? m[1] : b; };
const linksFrom = {};
for (const b of allBoards) {
  const s = fs.readFileSync(P(b), 'utf8');
  linksFrom[b] = uniq([...s.matchAll(/href="([^"#:]+\.dc\.html)"/g)].map((m) => path.posix.normalize(path.posix.join(path.posix.dirname(b), m[1]))));
}
const inbound = {};
for (const [src, targets] of Object.entries(linksFrom)) for (const t of targets) { (inbound[t] ||= new Set()).add(src); }

const COMPONENTS = [
  ['Top navigation', /<header style="display:flex; flex-wrap:wrap; align-items:center; gap:16px; padding:12px 24px/],
  ['Sidebar', /aria-label="(Brand|Operations|Creator|Admin) navigation"/],
  ['Mobile tab bar', /<nav aria-label="Main"/],
  ['App bar', /min-height:56px; box-sizing:border-box">/],
  ['Section tabs', /<nav aria-label="Section"/],
  ['Breadcrumb', /aria-label="Breadcrumb"/],
  ['Wizard stepper', /aria-label="Steps"/],
  ['Tabs', /role="tablist"/],
  ['KPI cards', /font-size:24px; font-weight:700/],
  ['Data table', /<table/],
  ['Filters', /aria-label="Filters"|<select/],
  ['Search', /type="search"/],
  ['Form fields', /<input type="(text|email|password|number|date)"|<textarea/],
  ['Checkboxes / radios', /type="(checkbox|radio)"/],
  ['File upload', /type="file"/],
  ['Status chips', /border-radius:999px; white-space:nowrap/],
  ['Data-source tags', />(Live|Manual|Delayed|Imported|Verified|Self-reported|Unavailable|Example data)<\/span>/],
  ['Priority badges', />(MVP|PHASE 2|PHASE 3)<\/span>/],
  ['Banner', /border:1px solid #1a1a1a; border-radius:8px; padding:12px 16px; background:#f2f2f2/],
  ['State panels (error / empty / edge)', /State · /],
  ['Bottom sheet', /Bottom sheet/],
  ['Session cards', /<article aria-label=/],
  ['Calendar grid', /<th scope="col"[^>]*>Mon<\/th>/],
  ['Chart placeholder', /aria-label="[^"]*(chart|Chart|Heatmap)[^"]*placeholder/],
  ['Media placeholder', /\(placeholder\)"/],
];
const API = [
  [/campaign/i, '/campaigns'], [/product|SKU/i, '/products'], [/seller|creator profile|host/i, '/sellers'], [/invit|application|counter/i, '/invitations'], [/contract|sign/i, '/contracts'],
  [/booking|booth|hold/i, '/bookings, /booths'], [/shipment|sample|receiv/i, '/shipments, /samples'], [/producer|shift|rota/i, '/staff-shifts'], [/equipment|kit|camera/i, '/equipment'], [/incident/i, '/incidents'],
  [/session|LIVE/, '/live-sessions'], [/GMV|orders|results|report/i, '/session-results'], [/invoice|credit note/i, '/invoices'], [/ledger|earning|commission|base pay|bonus/i, '/ledger-entries'], [/payout/i, '/payouts'],
  [/dispute/i, '/disputes'], [/verif|document/i, '/verifications'], [/message|conversation/i, '/messages'], [/notification/i, '/notifications'], [/audit/i, '/audit-log'], [/feature flag|flag/i, '/feature-flags'],
  [/member|user|role/i, '/users, /memberships'], [/location|studio/i, '/locations'], [/course|academy|certific|lesson/i, '/courses, /certificates'], [/availability/i, '/availability'], [/expense/i, '/expenses'], [/check-in|check in/i, '/check-ins'],
];
const EXT = [[/payment provider|card|payout account|bank/i, 'Payment provider (hosted checkout, payouts, webhooks)'], [/identity provider|photo ID|selfie/i, 'Identity provider'], [/TikTok/i, 'TikTok Shop: CSV report import (MVP); authorized API in Phase 2'], [/email/i, 'Email service'], [/map|directions/i, 'Device maps app (deep link)']];

const portalOf = { brand: 'Brand portal', creator: 'Creator portal (mobile first)', ops: 'Creator Hub operations', fin: 'Creator Hub operations · Finance', admin: 'Super Admin console' };
const navNote = { brand: 'Brand sidebar', creator: 'Mobile tab bar or More menu', ops: 'Operations sidebar', fin: 'Operations sidebar → Finance', admin: 'Admin sidebar' };
const permBase = { brand: 'Signed-in member of the brand organization; organization and role checked on the server for every request.', creator: 'Signed-in LIVE Seller; can only read and change their own data.', ops: 'Creator Hub staff with access to this location; role checked on the server.', fin: 'Finance Administrator (Location Managers: read-only summaries for their locations).', admin: 'Platform Super Administrator with single sign-on and two-step verification; all actions audit-logged.' };

const specs = screenFiles.map(({ id, folder, file }) => {
  const s = fs.readFileSync(P(file), 'utf8');
  const title = strip((s.match(/<title>(.*?)<\/title>/) || [])[1] || id).replace(/^\S+\s/, '').replace(/ \((mobile|desktop)\)$/, '');
  const aside = (s.match(/<aside aria-label="Spec notes for[\s\S]*?<\/aside>/) || [''])[0];
  const body = s.replace(aside, '');
  const grab = (label) => strip((aside.match(new RegExp(`<b>${label}<\\/b>([\\s\\S]*?)<\\/div>`)) || [])[1] || '');
  const list = (label) => [...((aside.match(new RegExp(`<b>${label}<\\/b><ul[\\s\\S]*?<\\/ul>`)) || [''])[0].matchAll(/<li>([\s\S]*?)<\/li>/g))].map((m) => strip(m[1]));
  const prio = uniq([...aside.matchAll(/>(MVP|PHASE 2|PHASE 3)<\/span>/g)].map((m) => m[1]));
  const labels = uniq([...body.matchAll(/<label[^>]*><span>([\s\S]*?)<\/span><(input|select|textarea)/g)].map((m) => strip(m[1])));
  const dts = uniq([...body.matchAll(/<dt style="[^"]*">([\s\S]*?)<\/dt>/g)].map((m) => strip(m[1])));
  const kpis = uniq([...body.matchAll(/font-size:12px; font-weight:600; color:#3d3d3d"><span>([\s\S]*?)<\/span>/g)].map((m) => strip(m[1])));
  const moneyL = uniq([...body.matchAll(/<span style="display:flex; flex-direction:column; gap:2px"><span>([\s\S]*?)<\/span>/g)].map((m) => strip(m[1])));
  const rowsL = uniq([...body.matchAll(/<b style="font-size:14px">([\s\S]*?)<\/b>/g)].map((m) => strip(m[1])));
  const heads = uniq([...body.matchAll(/<th scope="col"[^>]*>([\s\S]*?)<\/th>/g)].map((m) => strip(m[1])));
  const buttons = [...body.matchAll(/<(button) type="button"(?![^>]*role="tab")(?![^>]*aria-label="Switch)[^>]*style="([^"]*)">([\s\S]*?)<\/button>|<a href="[^"]*" style="(display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:44px[^"]*)">([\s\S]*?)<\/a>/g)].map((m) => ({ text: strip(m[3] || m[5]), primary: /background:#1a1a1a; color:#ffffff/.test(m[2] || m[4] || '') }));
  const actions = uniq([...buttons.filter((b) => b.primary), ...buttons.filter((b) => !b.primary)].map((b) => b.text)).filter((t) => t.length > 1);
  const states = uniq([...body.matchAll(/State · ([\s\S]*?)<\/div><div style="font-size:15px; font-weight:700">([\s\S]*?)<\/div>/g)].map((m) => `${strip(m[1])}: ${strip(m[2])}`));
  const hints = uniq([...body.matchAll(/<span style="font-size:12px; font-weight:400; color:#4d4d4d">([\s\S]*?)<\/span>/g)].map((m) => strip(m[1])));
  const errors = uniq([...body.matchAll(/Error: ([\s\S]*?)<\/span>/g)].map((m) => strip(m[1])));
  const comps = COMPONENTS.filter(([, re]) => re.test(body)).map(([n]) => n);
  const rules = list('Rules'), stateNotes = list('States and errors');
  const text = [title, grab('Purpose.'), ...rules, ...labels, ...heads].join(' ');
  const api = uniq(API.filter(([re]) => re.test(text)).map(([, r]) => r));
  const ext = uniq(EXT.filter(([re]) => re.test(text + ' ' + rules.join(' '))).map(([, r]) => r));
  const me = file;
  const variants = allBoards.filter((b) => idOfBoard(b) === id && b !== file);
  const inb = uniq([...(inbound[me] || [])].filter((b) => b !== me).map(idOfBoard)).filter((x) => x !== id);
  const fromScreens = inb.filter((x) => /^([BCOFA]\d\d|M01)$/.test(x));
  const dests = uniq((linksFrom[me] || []).map(idOfBoard)).filter((x) => x !== id);
  return {
    id, folder, file, title, portal: portalOf[folder], priority: prio.map((x) => x.replace('PHASE ', 'Phase ')).join(' + ') || 'MVP',
    purpose: grab('Purpose.'), roles: grab('Roles.'),
    entry: [`${navNote[folder]}`, ...(fromScreens.length ? [`linked from ${fromScreens.slice(0, 10).join(', ')}${fromScreens.length > 10 ? ' …' : ''}`] : []), ...inb.filter((x) => /^(BF|J)/.test(x)).slice(0, 4).map((x) => `flow ${x}`)].join('; '),
    components: comps, dataFields: uniq([...labels, ...heads.map((h) => `${h} (column)`), ...dts, ...kpis.map((k) => `${k} (metric)`), ...moneyL, ...rowsL.map((r) => `${r} (list item)`)]).filter((x) => x && x !== '(column)'),
    actions, validation: uniq([...labels.filter((l) => /\(required\)/.test(l)).map((l) => `${l.replace(' (required)', '')}: required`), ...hints, ...errors.map((e) => `Error shown: ${e}`)]),
    transitions: uniq([...rules, ...stateNotes].filter((r) => r.includes('→') && /status|statuses|→ (Locked|Paid|Pending|Approved|Draft|Published|Confirmed|Checked|Expired|Rejected|Verified)|Draft|Hold|Provisional/i.test(r))),
    errors: uniq([...stateNotes, ...states]), permissions: `${grab('Roles.')} ${permBase[folder]}`,
    api: `Proposed REST resources: ${api.length ? api.join(', ') : 'none beyond the session'}${ext.length ? `. External: ${ext.join('; ')}` : ''}.`,
    destinations: dests, variants,
    acceptance: [...rules.map((r) => `Rule holds: ${r}`), ...(states.length ? [`Each state panel (${states.length}) is reachable and shows its recovery action.`] : []), 'All actions work by keyboard; inputs have labels; text contrast at least 4.5:1; targets at least 44 px.', folder === 'creator' ? 'Works at 390 px; desktop layout matches the desktop variant where drawn.' : 'Usable at 390 px: menu stacks, toolbars wrap, wide tables scroll inside their box.'],
  };
});
// machine-readable exports
out('project/handoff/handoff.json', JSON.stringify(specs.map(({ folder, file, ...r }) => ({ ...r, board: `project/${file}` })), null, 2));
const csvCell = (v) => `"${String(Array.isArray(v) ? v.join(' | ') : v).replace(/"/g, '""')}"`;
const CSV_COLS = ['id', 'title', 'portal', 'priority', 'purpose', 'roles', 'entry', 'components', 'dataFields', 'actions', 'validation', 'transitions', 'errors', 'permissions', 'api', 'destinations', 'acceptance'];
out('project/handoff/handoff.csv', [CSV_COLS.join(','), ...specs.map((s) => CSV_COLS.map((c) => csvCell(s[c] ?? '')).join(','))].join('\n'));

// ---------------------------------------------------------------- D10 handoff boards
const relFromHandoff = (file) => `../${file}`;
const lim = (a, n) => (a.length > n ? [...a.slice(0, n), `… +${a.length - n} more (see JSON)`] : a);
const fieldRow = (k, v) => `<div style="display:grid; grid-template-columns:150px 1fr; gap:12px; padding:6px 0; border-bottom:1px solid #e6e6e6; font-size:12px; line-height:1.45"><dt style="font-weight:700; color:#3d3d3d; margin:0">${k}</dt><dd style="margin:0">${v}</dd></div>`;
const listOrDash = (a) => (a.length ? `<ul style="margin:0; padding-left:16px">${a.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '—');
const specCard = (s) => `<article aria-label="${s.id} handoff" style="border:1px solid #8c8c8c; border-radius:8px; padding:16px; display:flex; flex-direction:column; gap:8px; min-width:0; background:#ffffff">
<div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center"><a href="${relFromHandoff(s.file)}" style="font-size:12px; font-weight:700; border:1px solid #1a1a1a; border-radius:4px; padding:2px 6px; text-decoration:none; color:#1a1a1a">${s.id}</a><h2 style="margin:0; font-size:17px">${esc(s.title)}</h2>${s.priority.split(' + ').map((x) => badge(x === 'Phase 2' ? 'P2' : x === 'Phase 3' ? 'P3' : 'MVP')).join(' ')}</div>
<dl style="margin:0">
${fieldRow('Screen ID', `${s.id}${s.variants.length ? ` · variants: ${s.variants.map((v) => `<a href="../${v}">${path.basename(v, '.dc.html')}</a>`).join(', ')}` : ''}`)}
${fieldRow('Purpose', esc(s.purpose))}
${fieldRow('User role', esc(s.roles))}
${fieldRow('Entry point', esc(s.entry))}
${fieldRow('Main components', esc(s.components.join(', ')))}
${fieldRow('Data fields', listOrDash(lim(s.dataFields, 14)))}
${fieldRow('Primary actions', listOrDash(lim(s.actions, 10)))}
${fieldRow('Validation rules', listOrDash(lim(s.validation, 8)))}
${fieldRow('Status transitions', listOrDash(s.transitions))}
${fieldRow('Error states', listOrDash(lim(s.errors, 8)))}
${fieldRow('Permission requirements', esc(s.permissions))}
${fieldRow('API / data dependencies', esc(s.api))}
${fieldRow('Navigation destinations', s.destinations.length ? s.destinations.join(', ') : '—')}
${fieldRow('Acceptance criteria', listOrDash(lim(s.acceptance, 8)))}
${fieldRow('Priority', s.priority)}
</dl>
</article>`;
const PER = 10;
const handoffBoards = [];
for (let i = 0; i < specs.length; i += PER) {
  const chunk = specs.slice(i, i + PER);
  const n = handoffBoards.length + 1;
  const name = `H${String(n).padStart(2, '0')}`;
  const h = Math.min(8000, 420 + Math.ceil(chunk.length / 2) * 1400);
  const body = `<div style="width:100%; max-width:1440px; margin:0 auto; ${FONT}; color:#1a1a1a; background:#ffffff; padding:48px; box-sizing:border-box; display:flex; flex-direction:column; gap:24px">
<span style="font-size:13px; font-weight:800; letter-spacing:0.12em">D10 · DEVELOPER HANDOFF · ${name}</span>
<h1 style="margin:0; font-size:34px">${chunk[0].id}–${chunk[chunk.length - 1].id}</h1>
${p(`Derived from the published wireframes: spec notes, form fields, table columns, buttons, state panels and the links between boards. API resources are proposals for the engineering team to confirm. Full data for all ${specs.length} screens: <a href="handoff.json">handoff.json</a> · <a href="handoff.csv">handoff.csv</a>.`, { size: 14 })}
<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(560px, 1fr)); gap:24px; align-items:start">
${chunk.map(specCard).join('\n')}
</div>
</div>`;
  out(`project/handoff/${name}.dc.html`, doc(`Handoff ${name}`, 1440, h, body));
  handoffBoards.push({ name, h, first: chunk[0].id, last: chunk[chunk.length - 1].id });
}

// ---------------------------------------------------------------- D9 component library
const sw = (label, inner, notes) => card(label, col([`<div style="border:1px dashed #c4c4c4; border-radius:8px; padding:16px; background:#fafafa; overflow-x:auto">${inner}</div>`, ul(notes, { size: 13, gap: 3 })], 12));
const navDemo = `<nav aria-label="Demo sidebar" style="width:220px; background:#f7f7f7; border:1px solid #c4c4c4; padding:12px; display:flex; flex-direction:column; gap:4px"><a href="#c" aria-current="page" style="display:flex; align-items:center; min-height:44px; padding:0 12px; border-radius:6px; text-decoration:none; color:#1a1a1a; font-weight:700; background:#e0e0e0">Dashboard</a><a href="#c" style="display:flex; align-items:center; min-height:44px; padding:0 12px; border-radius:6px; text-decoration:none; color:#1a1a1a">Products</a><a href="#c" style="display:flex; align-items:center; justify-content:space-between; min-height:44px; padding:0 12px; border-radius:6px; text-decoration:none; color:#1a1a1a">LIVE Control Center <span style="font-size:11px; font-weight:700; border:1px solid #1a1a1a; border-radius:999px; padding:0 6px">2 LIVE</span></a></nav>`;
const topDemo = `<header style="display:flex; flex-wrap:wrap; align-items:center; gap:16px; padding:12px 16px; border:1px solid #c4c4c4; background:#ffffff"><b style="letter-spacing:0.1em">VYRALINK</b><button type="button" style="min-height:44px; padding:0 12px; border:1px solid #8c8c8c; border-radius:6px; background:#ffffff; font-family:inherit; font-weight:600">GlowSkin Beauty · Brand Owner ▾</button><input type="search" aria-label="Search demo" placeholder="Search" style="${inputStyle}; flex:1 1 200px; width:auto"><span style="display:inline-flex; gap:4px; align-items:center">${bell} 3</span></header>`;
const skeleton = `<div aria-busy="true" aria-label="Loading" style="display:flex; flex-direction:column; gap:10px">${[80, 60, 90, 40].map((w) => `<div style="height:14px; width:${w}%; background:#e6e6e6; border-radius:4px"></div>`).join('')}</div>`;
const dialog = `<div role="dialog" aria-modal="true" aria-labelledby="dlg-t" style="max-width:440px; border:1px solid #1a1a1a; border-radius:12px; padding:20px; background:#ffffff; display:flex; flex-direction:column; gap:12px; box-shadow:0 8px 24px rgba(0,0,0,0.15)"><h3 id="dlg-t" style="margin:0; font-size:17px">Cancel “Vitamin C LIVE — Saturday”?</h3>${p('50% of the production fee ($375) applies. Seller and studio are notified.', { size: 14 })}${row([btn('Keep campaign'), btn('Cancel campaign', { primary: true })], { gap: 8, justify: 'flex-end' })}</div>`;
const toast = `<div role="status" style="display:inline-flex; gap:12px; align-items:center; border:1px solid #1a1a1a; border-radius:8px; padding:12px 16px; background:#1a1a1a; color:#ffffff; font-size:14px">Booking confirmed · Beauty Booth 01 <a href="#c" style="color:#ffffff">View</a></div>`;
const jobCard = `<article style="border:1px solid #c4c4c4; border-radius:8px; padding:14px; display:flex; flex-direction:column; gap:8px; max-width:340px">${row([chip('Invited · 41 h left', 'outline')])}<b>Vitamin C LIVE — Saturday</b>${ul(['GlowSkin Beauty · Vitamin C Face Serum', 'Creator Hub Virginia · Sat 7–10 PM', '$30 / h + 5% · $100 bonus'], { size: 13, gap: 2 })}</article>`;
const productCard = `<article style="border:1px solid #c4c4c4; border-radius:8px; padding:14px; display:flex; gap:12px; max-width:380px">${ph('Image', 72, '72px')}<div style="display:flex; flex-direction:column; gap:4px"><b>Vitamin C Face Serum</b><span style="font-size:13px">GS-VC-30 · $40 · 10,000 in stock</span>${row([chip('Approved', 'dark'), chip('4 samples')], { gap: 6 })}</div></article>`;
const creatorCard = `<article style="border:1px solid #c4c4c4; border-radius:8px; padding:14px; display:flex; flex-direction:column; gap:8px; max-width:340px">${row([ph('Photo', 48, '48px'), `<b>Sarah Johnson</b>`], { gap: 10 })}${ul([`GMV / hour $1,850 ${prov('Verified')}`, 'Reliability 98%', 'Rating 4.9 (11)'], { size: 13, gap: 2 })}${row([btn('View'), btn('Invite', { primary: true })], { gap: 8 })}</article>`;
const campaignCard = `<article style="border:1px solid #c4c4c4; border-radius:8px; padding:14px; display:flex; flex-direction:column; gap:8px; max-width:340px">${row([chip('Scheduled', 'dark'), `<b>Vitamin C LIVE — Saturday</b>`], { gap: 8 })}<span style="font-size:13px">LIVE Shopping · Sat 7:00 PM · Sarah Johnson</span><div role="progressbar" aria-label="Timeline progress" aria-valuenow="6" aria-valuemin="0" aria-valuemax="11" style="height:6px; background:#e6e6e6; border-radius:3px"><div style="width:55%; height:6px; background:#1a1a1a; border-radius:3px"></div></div><span style="font-size:12px">6 of 11 timeline steps done</span></article>`;
const slots = row([['Booked', 'background:#1a1a1a; color:#ffffff'], ['Hold', 'border:1px solid #1a1a1a'], ['Buffer', 'background:#e6e6e6'], ['Maintenance', 'border:2px dashed #1a1a1a'], ['Conflict', 'border:2px dashed #1a1a1a; font-weight:700']].map(([t, s]) => `<div style="font-size:12px; padding:8px 10px; border-radius:6px; min-width:110px; ${s}">${t}</div>`), { gap: 8 });
const tabBarDemo = `<nav aria-label="Demo tab bar" style="display:flex; width:390px; border:1px solid #c4c4c4">${['Home', 'Jobs', 'Sessions', 'Earnings', 'More'].map((l, i) => `<a href="#c" style="flex:1; display:flex; align-items:center; justify-content:center; min-height:60px; text-decoration:none; color:#1a1a1a; font-size:12px; font-weight:${i === 1 ? 700 : 500}; ${i === 1 ? 'background:#e6e6e6' : ''}">${l}</a>`).join('')}</nav>`;
const tokens = table(['Token', 'Value', 'Use'], [['color.ink', '#1a1a1a', 'Text, primary buttons, active states'], ['color.ink-secondary', '#3d3d3d', 'Secondary text (passes 4.5:1 on white)'], ['color.border', '#c4c4c4 / #8c8c8c', 'Dividers / input borders'], ['color.fill', '#f2f2f2 / #e6e6e6', 'Panels, placeholders, active nav'], ['type.family', 'Inter, system-ui', 'All text'], ['type.scale', '12 / 13 / 14 / 16 / 18 / 22 / 28 / 40 px', 'Caption → page title'], ['space.scale', '4 / 8 / 12 / 16 / 24 / 32 / 48 px', 'Gaps and padding'], ['radius', '4 / 6 / 8 / 12 / 24 / 999 px', 'Badges / inputs / cards / dialogs / phones / chips'], ['size.target', '44 px minimum', 'Every interactive element']], { min: 640 });
const lib = `<div style="width:100%; max-width:1440px; margin:0 auto; ${FONT}; color:#1a1a1a; background:#ffffff; padding:48px; box-sizing:border-box; display:flex; flex-direction:column; gap:24px">
<span style="font-size:13px; font-weight:800; letter-spacing:0.12em">D9 · COMPONENT LIBRARY</span>
<h1 style="margin:0; font-size:40px">Components (wireframe stage)</h1>
${p('Every component used across the 90 screens, with its rules. Grayscale on purpose: Phase C maps these to the chosen design system without changing behaviour.', { size: 16 })}
${card('Tokens', tokens)}
${grid([
  sw('Top navigation', topDemo, ['Logo, organization / location switcher, search, notifications, avatar.', 'Switcher lists every membership; switching changes menu and data scope.']),
  sw('Sidebar', navDemo, ['One per portal; active item uses aria-current="page".', 'Stacks above content below ~560 px; never sticky.']),
  sw('Mobile tab bar', tabBarDemo, ['Creator portal only: Home, Jobs, Sessions, Earnings, More.', '60 px tall; labels always visible.']),
  sw('Buttons', row([btn('Primary', { primary: true }), btn('Secondary'), btn('Tertiary', { ghost: true }), btn('Disabled', { disabled: true })], { gap: 8 }), ['One primary per area.', 'Disabled buttons say why nearby (state panel or hint).', 'Links that navigate are &lt;a&gt; styled as buttons.']),
  sw('Status indicators', row([chip('Default'), chip('Confirmed', 'dark'), chip('Pending', 'outline'), chip('Needs action', 'alert')], { gap: 6 }), ['Status text always written out; never colour alone.', 'Statuses come from the shared lists (B08, O06, F02, F03).']),
  sw('Priority badges', row([badge('MVP'), badge('P2'), badge('P3')], { gap: 6 }), ['On every screen header and future feature.', 'Phase 2 / 3 controls render disabled until their flag is on (A11).']),
  sw('Data-source tags', row(['Live', 'Manual', 'Delayed', 'Imported', 'Verified', 'Self-reported', 'Unavailable', 'Example data'].map(prov), { gap: 6 }), ['Next to every metric.', 'Unavailable is never shown as 0.', 'Manual shows who entered it and when.']),
  sw('KPI cards', grid([kpi('GMV', '$6,000', 'Brand sales, not revenue', 'Manual'), kpi('GMV / hour', '$2,000', '$6,000 ÷ 3 h')], 200), ['Label, value, basis line, source tag.', 'Calculated values show their formula.']),
  sw('Campaign card', campaignCard, ['Status, name, type, next session, progress.']),
  sw('Product card', productCard, ['Image, name, SKU, price, stock, status, samples.']),
  sw('Creator card', creatorCard, ['Verified vs self-reported labels on every figure.', 'Primary action: Invite.']),
  sw('Job card (mobile)', jobCard, ['Brand, product, location, time, pay summary, required training.']),
  sw('Calendar and booking slots', slots, ['Day, week, month views; one column per booth in day view.', 'Buffers drawn; conflicts dashed and named.']),
  sw('Data table', table(['Invoice', 'Basis', 'Amount', 'Status'], [['INV-1042', 'Per-session package', '$750.00', chip('Issued', 'outline')], ['INV-1043', '7% × $5,840', '$408.80', chip('Draft')]], { min: 480 }), ['Header row uses th scope; row headers where rows are labelled.', 'Scrolls inside its box on small screens.', 'Money columns include a Basis column.']),
  sw('Filters and search', row([`<input type="search" aria-label="Search demo" placeholder="Search" style="${inputStyle}; flex:2 1 200px; width:auto">`, sel('Status', ['All', 'Draft', 'Scheduled'], { grow: true }), btn('Apply', { primary: true })], { gap: 12, align: 'flex-end' }), ['Filters reflect in the URL so views can be shared.', 'Clear filters is always available on empty results.']),
  sw('Form fields', col([field('Work email', 'maya@glowskin.example', { req: true, type: 'email' }), field('Samples you can send', '0', { type: 'number', err: 'Send at least 2 samples per booked LIVE' }), check('I agree to the terms', false)], 8), ['Visible label above every input; required marked in words.', 'Errors under the field, in words, announced to screen readers.']),
  sw('Wizard', stepper(['Objective', 'Type', 'Products', 'Date', 'Budget'], 2), ['Saves a draft after every step.', 'Current step uses aria-current="step".']),
  sw('Tabs', tabs(['Overview', 'Readiness', 'Notes'], 0), ['role=tablist / tab with aria-selected.', 'Section tabs that change page are links instead.']),
  sw('Modal and confirmation dialog', dialog, ['Confirm destructive or money-changing actions; state the consequence and amount.', 'Focus moves into the dialog and returns on close; Escape closes.']),
  sw('Notifications', col([banner('Verification in review. Publishing unlocks when verified.', btn('View status')), toast], 12), ['Banner: persistent page-level message with an action.', 'Toast: short confirmation, role=status, auto-hides after 6 s but stays in the notification list.']),
  sw('Bottom sheet (mobile)', `<div style="max-width:390px; border:1px solid #1a1a1a; border-radius:16px 16px 8px 8px; padding:12px 16px 16px; display:flex; flex-direction:column; gap:10px"><span aria-hidden="true" style="align-self:center; width:40px; height:4px; border-radius:2px; background:#8c8c8c"></span><b>Accept this job?</b>${btn('Accept and review contract', { primary: true, full: true })}</div>`, ['Used for Accept, Counter, Decline, Running late.', 'Behaves as a modal dialog.']),
  sw('Charts', ph('Line chart · GMV per session (placeholder)', 140), ['Every chart has a data table alternative.', 'Series told apart by lightness and labels, not hue alone.', 'Source tag on the chart title.']),
  sw('Empty state', state('Empty', 'No campaigns yet', 'Add a product, then create your first LIVE campaign.', [btn('Create campaign', { primary: true })]), ['Says why it is empty and the next step.']),
  sw('Error state', state('Error', 'Campaigns could not load', 'Check your connection and try again.', [btn('Retry')]), ['Names what failed; offers retry or alternative; keeps user input.']),
  sw('Loading state', skeleton, ['Skeleton shaped like the content; aria-busy on the region.', 'After 10 s, explain the delay and offer retry.']),
  sw('Flow diagram elements', row([`<div style="padding:12px 20px; background:#1a1a1a; color:#ffffff; border-radius:24px; font-size:13px; font-weight:700">Start / End</div>`, `<div style="padding:12px; border:1px solid #8c8c8c; border-radius:10px; font-size:13px">Step</div>`, `<div style="width:120px; height:72px; background:#dcdcdc; clip-path:polygon(50% 0, 100% 50%, 50% 100%, 0 50%); display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700">Decision</div>`, `<div style="padding:12px; border:1px dashed #4d4d4d; background:#f2f2f2; border-radius:8px; font-size:13px">Failure path</div>`], { gap: 12 }), ['Used in the master flow, BF01–BF21 and journeys J1–J8.']),
], 560, 24)}
${card('Accessibility rules for every component', ul(['Real buttons, links and inputs; no clickable divs.', 'Text contrast at least 4.5:1 (secondary text #3d3d3d on white).', 'Touch targets at least 44 × 44 px.', 'Visible focus outline on every interactive element (Phase C: 2 px, offset 2 px).', 'Icons that carry meaning have labels; decorative icons are hidden from screen readers.', 'Status and data source are written in words, never colour alone.']))}
</div>`;
out('project/library/Components.dc.html', doc('Component library', 1440, 6200, lib));

// ---------------------------------------------------------------- §16 quality audit (computed where possible)
const screenIds = specs.map((s) => s.id);
const isolated = specs.filter((s) => !s.entry.includes('linked from')).map((s) => s.id);
let broken = 0; const nonLinkNav = [];
for (const [src, targets] of Object.entries(linksFrom)) for (const t of targets) if (!fs.existsSync(P(t))) broken++;
for (const b of allBoards) { const s = fs.readFileSync(P(b), 'utf8'); if (/Batch 4<\/span>/.test(s)) nonLinkNav.push(b); }
const flows = allBoards.filter((b) => b.startsWith('flows/'));
const flowStats = flows.map((b) => { const s = fs.readFileSync(P(b), 'utf8'); return { id: idOfBoard(b), start: />Start: /.test(s), end: />End: /.test(s), decisions: (s.match(/clip-path: polygon\(50% 0/g) || []).length }; });
const flowsOk = flowStats.filter((f) => f.start && f.end && f.decisions >= 1).length;
const pr = (x) => specs.filter((s) => s.priority.includes(x)).length;
const mvpOnly = specs.filter((s) => s.priority === 'MVP').length;
const counts = { B: specs.filter((s) => s.id[0] === 'B').length, C: specs.filter((s) => s.id[0] === 'C').length, O: specs.filter((s) => s.id[0] === 'O').length, F: specs.filter((s) => s.id[0] === 'F').length, A: specs.filter((s) => s.id[0] === 'A').length };
const verdict = (v) => chip(v, v === 'Pass' ? 'dark' : 'alert');
const link = (rel, t) => `<a href="../${rel}">${t}</a>`;
const audit = [
  ['Every user role has a complete journey', 'Pass', `8 roles, 8 journeys: ${['J1', 'J2', 'J3', 'J4', 'J5', 'J6', 'J7', 'J8'].map((j) => link(`journeys/${j}.dc.html`, j)).join(' ')}`],
  ['Every primary action has a corresponding screen', 'Pass', 'Primary actions either open another board (linked) or change state on the same screen; state panels show the result. Handoff lists actions per screen.'],
  ['Every workflow has an entry and exit', flowsOk === flows.length ? 'Pass' : 'Partial', `${flowsOk} of ${flows.length} flowcharts have Start, End and at least one decision.`],
  ['All campaign statuses are consistent', 'Pass', `One list of 10 statuses (${link('brand/B08.dc.html', 'B08')}) used by flows BF04, BF08, BF13, BF19; booking, invoice and ledger statuses are separate, named lists.`],
  ['Booking conflicts are handled', 'Pass', `Server-side exclusion incl. buffers: ${link('ops/O05.dc.html', 'O05')}, ${link('brand/B13.dc.html', 'B13')}, ${link('flows/BF08.dc.html', 'BF08')}, edge case 9.`],
  ['Seller compensation is transparent', 'Pass', `Terms (${link('creator/C10.dc.html', 'C10')}), contract (${link('creator/C12.dc.html', 'C12')}), line-by-line breakdown (${link('creator/C21.dc.html', 'C21')}), ledger (${link('fin/F03.dc.html', 'F03')}).`],
  ['Brand billing is separate from customer checkout', 'Pass', `${link('brand/B16.dc.html', 'B16')} banner, ${link('flows/BF14.dc.html', 'BF14')} entirely external, ${link('admin/A07.dc.html', 'A07')}.`],
  ['GMV is not misrepresented as company revenue', 'Pass', `GMV labelled brand sales on ${link('brand/B04.dc.html', 'B04')}, ${link('brand/B15.dc.html', 'B15')}, ${link('ops/O20.dc.html', 'O20')}, ${link('fin/F01.dc.html', 'F01')}, ${link('fin/F07.dc.html', 'F07')}; revenue = fees only.`],
  ['TikTok Shop integration limitations are acknowledged', 'Pass', `${link('ops/O14.dc.html', 'O14')} banner, ${link('creator/C18.dc.html', 'C18')}, ${link('admin/A06.dc.html', 'A06')}, ${link('flows/BF13.dc.html', 'BF13')}: no remote stream control; MVP manual import; Phase 2 only via authorized access.`],
  ['No major screen is isolated', isolated.length ? 'Partial' : 'Pass', isolated.length ? `Screens with no link from another screen: ${isolated.join(', ')} (reachable from navigation or flows).` : `All ${specs.length} screens are linked from at least one other screen.`],
  ['Every navigation action has a destination', broken === 0 && !nonLinkNav.length ? 'Pass' : 'Partial', `${broken} broken links across ${allBoards.length} boards; ${nonLinkNav.length} placeholder nav items.`],
  ['Every financial calculation has a defined basis', 'Partial', 'Every money line has a Basis column. Still open: subscription and package prices, returns window, hold window, payout timing, grace period ([PLACEHOLDERS]); intercompany split [TO DEFINE].'],
  ['Every workflow supports relevant failure states', 'Pass', `${flowStats.reduce((a, f) => a + f.decisions, 0)} decision points with failure paths across ${flows.length} flows; 25 edge cases with recovery (${link('edge/EdgeCases.dc.html', 'catalog')}).`],
  ['Every screen is suitable for developer implementation', 'Partial', `Handoff covers all ${specs.length} screens with 15 fields. API resources are proposals; data model and endpoints need an engineering pass.`],
  ['Mobile and desktop layouts are considered', 'Partial', 'Creator portal drawn mobile-first (27 phone screens + 3 desktop); one tablet screen (O12). Brand, operations, finance and admin screens are fluid and stack at phone width but are not drawn as phone frames.'],
  ['The MVP is realistic and not overloaded', 'Partial', `${mvpOnly} of ${specs.length} screens are MVP-only and ${pr('Phase 2')} touch Phase 2. That is a large first release; see the launch slice below.`],
  ['Screens are not silently omitted', 'Pass', `Brand ${counts.B} + M01 (brief 18), creator ${counts.C} (brief 27), operations ${counts.O} (brief 22 + 2 added), finance ${counts.F} and admin ${counts.A} (added for navigation the brief lists).`],
];
const qa = `<div style="width:100%; max-width:1440px; margin:0 auto; ${FONT}; color:#1a1a1a; background:#ffffff; padding:48px; box-sizing:border-box; display:flex; flex-direction:column; gap:24px">
<span style="font-size:13px; font-weight:800; letter-spacing:0.12em">§16 · FINAL QUALITY VALIDATION</span>
<h1 style="margin:0; font-size:40px">Quality audit</h1>
${p('Checked against the brief’s §16 list. Link, isolation and flow counts are computed from the published boards; the rest cite where each rule is shown. “Partial” items are open decisions, not hidden gaps.', { size: 16 })}
${grid([kpi('Screens', String(specs.length), 'Plus 4 variants (3 desktop, 1 tablet)'), kpi('Boards on canvas', String(allBoards.length)), kpi('Broken links', String(broken)), kpi('Flowcharts with failure paths', `${flowsOk} / ${flows.length}`)], 220)}
${table(['Check', 'Result', 'Evidence'], audit.map(([c, v, e]) => [c, verdict(v), e]), { min: 960, rowHead: true })}
${card('Recommended launch slice (MVP-1) · for your decision', col([p('To keep the first release small, ship the money path for one location with manual data, and add the rest of MVP in fast follow-ups:', { size: 14 }), ul(['<b>Brand:</b> B01–B08, B12, B14, B15, B16', '<b>Seller:</b> C01–C03, C08–C22 (Academy C05–C07 can start as one required course)', '<b>Operations:</b> O01, O05, O06, O09, O12, O13, O14 (manual metrics), O16, O17', '<b>Finance:</b> F02, F03, F04, F05', '<b>Admin:</b> A02, A03, A04, A08, A09', '<b>Defer to MVP-2:</b> B11, B17 messaging (keep notifications), O07–O08 rota/kit, O10–O11 and O18 detail, O21–O24, F01, A05, A07, A10–A12 UI (settings in code first)'], { size: 14 })])) }
${card('Open decisions before Phase C (high fidelity)', ul(['Fill the [PLACEHOLDERS]: prices, review SLA, hold window, returns window, payout timing, grace period.', 'Define the Vyralink ↔ Creator Hub revenue arrangement.', 'Confirm revenue recognition with your accountant.', 'Choose a design system for Phase C (a new Vyralink system, or one of ChatbotReply / ChatMint AI).', 'Approve or change the launch slice above.'], { size: 14 }))}
</div>`;
out('project/library/QA.dc.html', doc('Quality audit', 1440, 2600, qa));

// ---------------------------------------------------------------- canvas.json (merge)
const cpath = P('canvas.json');
const canvas = JSON.parse(fs.readFileSync(cpath, 'utf8'));
if (!canvas.pages.some((x) => x.id === 'handoff')) canvas.pages.push({ id: 'handoff', name: '9 · Components, developer handoff, QA' });
const add = (file, b) => { canvas.boards[file] = b; if (!canvas.order.includes(file)) canvas.order.push(file); };
add('library/QA.dc.html', { x: 0, y: 0, w: 1440, h: 2600, page: 'handoff', expand: 'fill', is_interactive: true, title: '§16 · Quality audit' });
add('library/Components.dc.html', { x: 1520, y: 0, w: 1440, h: 6200, page: 'handoff', expand: 'fill', title: 'D9 · Component library' });
let y = 6200 + 420;
for (let i = 0; i < handoffBoards.length; i += 3) {
  const rowB = handoffBoards.slice(i, i + 3);
  rowB.forEach((b, c) => add(`handoff/${b.name}.dc.html`, { x: c * 1520, y, w: 1440, h: b.h, page: 'handoff', expand: 'fill', is_interactive: true, title: `D10 · Handoff ${b.first}–${b.last}` }));
  y += Math.max(...rowB.map((b) => b.h)) + 120;
}
canvas.notes.handoffTitle = { x: 0, y: -300, text: '§16 audit · D9 components', kind: 'title1', maxW: 2960, page: 'handoff' };
canvas.notes.handoffTitle2 = { x: 0, y: 6200 + 420 - 300, text: 'D10 · Developer handoff · all 90 screens', kind: 'title1', maxW: 4480, page: 'handoff' };
if (canvas.notes.overviewTitle) canvas.notes.overviewTitle.text = 'Vyralink + Creator Hub · complete blueprint';
fs.writeFileSync(cpath, JSON.stringify(canvas, null, 2));
written.push('project/canvas.json');
fs.writeFileSync(path.join(ROOT, 'batch6-files.json'), JSON.stringify(written));
console.log(written.length, 'files;', specs.length, 'screens;', 'isolated:', isolated.join(',') || 'none', '; broken:', broken, '; flowsOk', flowsOk, '/', flows.length, '; mvpOnly', mvpOnly);
console.log('sample', JSON.stringify(specs.find((s) => s.id === 'C10'), null, 1).slice(0, 2500));
