// Generates the Vyralink + Creator Hub blueprint canvas (batch 1) as .dc.html artboards.
// Usage: node gen.mjs <rootDir>   → writes <rootDir>/project/...
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2];
const written = [];
const out = (rel, s) => {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, s);
  written.push(rel);
  const bad = s.replace(/&(amp|lt|gt|quot|#\d+);/g, '').match(/&/g);
  if (bad) console.warn(`WARN raw & in ${rel}`);
  if (s.includes('{{')) console.warn(`WARN {{ in ${rel}`);
};

// ---------------------------------------------------------------- document
const doc = (title, w, h, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&amp;display=swap">
<style>
body{margin:0}
a{color:#1a1a1a}a:hover{color:#000000}
</style>
</helmet>
${body}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":${w},"height":${h}}}'>
class Component extends DCLogic {
renderVals() {
return {};
}
}
</script>
</body>
</html>
`;

// ---------------------------------------------------------------- wireframe primitives (grayscale)
const FONT = 'font-family: Inter, system-ui, sans-serif';
const inputStyle = `min-height:44px; box-sizing:border-box; padding:0 12px; border:1px solid #8c8c8c; border-radius:6px; font-size:14px; font-family:inherit; color:#1a1a1a; background:#ffffff; width:100%`;
const btn = (label, o = {}) => {
  const look = o.primary ? 'background:#1a1a1a; color:#ffffff; border:1px solid #1a1a1a' : o.ghost ? 'background:transparent; color:#1a1a1a; border:1px solid transparent; text-decoration:underline' : 'background:#ffffff; color:#1a1a1a; border:1px solid #1a1a1a';
  const base = `display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:44px; padding:0 16px; border-radius:6px; font-size:14px; font-weight:600; text-decoration:none; cursor:pointer; box-sizing:border-box; font-family:inherit; white-space:nowrap; ${look}${o.disabled ? '; opacity:0.55; cursor:not-allowed' : ''}${o.full ? '; width:100%' : ''}`;
  return o.href ? `<a href="${o.href}" style="${base}">${label}</a>` : `<button type="button"${o.disabled ? ' disabled="disabled"' : ''} style="${base}">${label}</button>`;
};
const badge = (p) => {
  const m = { MVP: 'background:#1a1a1a; color:#ffffff; border:1px solid #1a1a1a', P2: 'background:#ffffff; color:#1a1a1a; border:1px solid #1a1a1a', P3: 'background:#ffffff; color:#1a1a1a; border:1px dashed #1a1a1a' };
  return `<span style="display:inline-block; font-size:11px; font-weight:700; letter-spacing:0.04em; padding:2px 6px; border-radius:4px; white-space:nowrap; ${m[p]}">${p === 'P2' ? 'PHASE 2' : p === 'P3' ? 'PHASE 3' : 'MVP'}</span>`;
};
const chip = (t, tone = '') => {
  const m = { '': 'background:#f2f2f2; color:#1a1a1a; border:1px solid #c4c4c4', dark: 'background:#1a1a1a; color:#ffffff; border:1px solid #1a1a1a', outline: 'background:#ffffff; color:#1a1a1a; border:1px solid #1a1a1a', alert: 'background:#ffffff; color:#1a1a1a; border:2px dashed #1a1a1a' };
  return `<span style="display:inline-flex; align-items:center; font-size:12px; font-weight:600; padding:3px 10px; border-radius:999px; white-space:nowrap; ${m[tone]}">${t}</span>`;
};
const prov = (k) => `<span style="font-size:11px; font-weight:600; color:#3d3d3d; border:1px ${k === 'Unavailable' || k === 'Self-reported' ? 'dashed' : 'solid'} #8c8c8c; border-radius:4px; padding:1px 6px; white-space:nowrap">${k}</span>`;
const lbl = (label, o) => `<span>${label}${o.req ? ' <span style="font-weight:400; color:#4d4d4d">(required)</span>' : ''}</span>`;
const hint = (o) => `${o.hint ? `<span style="font-size:12px; font-weight:400; color:#4d4d4d">${o.hint}</span>` : ''}${o.err ? `<span style="font-size:12px; font-weight:700; color:#1a1a1a">Error: ${o.err}</span>` : ''}`;
const fieldWrap = (o) => `display:flex; flex-direction:column; gap:6px; font-size:13px; font-weight:600; color:#1a1a1a; min-width:0${o.grow ? '; flex:1 1 200px' : ''}`;
const field = (label, val = '', o = {}) => `<label style="${fieldWrap(o)}">${lbl(label, o)}<input type="${o.type || 'text'}"${o.ph ? ` placeholder="${o.ph}"` : ''} value="${val}" style="${inputStyle}${o.err ? '; border:2px solid #1a1a1a' : ''}">${hint(o)}</label>`;
const sel = (label, opts, o = {}) => `<label style="${fieldWrap(o)}">${lbl(label, o)}<select style="${inputStyle}">${opts.map((x, i) => `<option${i === (o.sel || 0) ? ' selected="selected"' : ''}>${x}</option>`).join('')}</select>${hint(o)}</label>`;
const area = (label, val = '', o = {}) => `<label style="${fieldWrap(o)}">${lbl(label, o)}<textarea rows="${o.rows || 3}" style="${inputStyle}; padding:10px 12px; min-height:88px; resize:vertical">${val}</textarea>${hint(o)}</label>`;
const check = (label, on, o = {}) => `<label style="display:flex; align-items:center; gap:10px; font-size:14px; min-height:44px${o.disabled ? '; opacity:0.6' : ''}"><input type="${o.radio ? 'radio' : 'checkbox'}"${o.radio ? ` name="${o.radio}"` : ''}${on ? ' checked="checked"' : ''}${o.disabled ? ' disabled="disabled"' : ''} style="width:20px; height:20px; margin:0; flex-shrink:0"><span>${label}</span></label>`;
const row = (items, o = {}) => `<div style="display:flex; flex-wrap:wrap; gap:${o.gap ?? 16}px; align-items:${o.align || 'center'}${o.justify ? '; justify-content:' + o.justify : ''}">${items.join('')}</div>`;
const col = (items, gap = 16) => `<div style="display:flex; flex-direction:column; gap:${gap}px; min-width:0">${items.join('')}</div>`;
const grid = (items, min = 220, gap = 16) => `<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(${min}px, 1fr)); gap:${gap}px">${items.join('')}</div>`;
const card = (title, body, o = {}) => `<section style="border:1px solid #c4c4c4; border-radius:8px; background:#ffffff; padding:20px; display:flex; flex-direction:column; gap:16px; min-width:0; box-sizing:border-box${o.style ? '; ' + o.style : ''}">${title ? `<div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap"><h2 style="margin:0; font-size:16px; font-weight:700">${title}</h2>${o.right ? `<div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center">${o.right}</div>` : ''}</div>` : ''}${body}</section>`;
const kpi = (label, value, sub = '', p = '') => `<div style="border:1px solid #c4c4c4; border-radius:8px; padding:16px; display:flex; flex-direction:column; gap:6px; min-width:0; background:#ffffff"><div style="display:flex; justify-content:space-between; gap:8px; align-items:center; font-size:12px; font-weight:600; color:#3d3d3d"><span>${label}</span>${p ? prov(p) : ''}</div><div style="font-size:24px; font-weight:700">${value}</div>${sub ? `<div style="font-size:12px; color:#3d3d3d; line-height:1.4">${sub}</div>` : ''}</div>`;
const table = (heads, rows, o = {}) => `<div style="overflow-x:auto; border:1px solid #c4c4c4; border-radius:8px"><table style="width:100%; border-collapse:collapse; font-size:13px; min-width:${o.min || 640}px">${o.caption ? `<caption style="text-align:left; padding:12px 12px 4px; font-weight:700; font-size:14px">${o.caption}</caption>` : ''}<thead><tr>${heads.map((h) => `<th scope="col" style="text-align:left; padding:10px 12px; background:#f2f2f2; border-bottom:1px solid #c4c4c4; font-weight:700; white-space:nowrap">${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => (i === 0 && o.rowHead ? `<th scope="row" style="text-align:left; padding:10px 12px; border-bottom:1px solid #e6e6e6; font-weight:600; vertical-align:top">${c}</th>` : `<td style="padding:10px 12px; border-bottom:1px solid #e6e6e6; vertical-align:top; line-height:1.45">${c}</td>`)).join('')}</tr>`).join('')}</tbody></table></div>`;
const ph = (label, h = 120, w = '100%') => `<div role="img" aria-label="${label} (placeholder)" style="width:${w}; height:${h}px; box-sizing:border-box; background:#e6e6e6; border:1px solid #c4c4c4; border-radius:6px; display:flex; align-items:center; justify-content:center; text-align:center; font-size:12px; font-weight:600; color:#3d3d3d; padding:8px; flex-shrink:0">${label}</div>`;
const stepper = (steps, active) => `<ol aria-label="Steps" style="list-style:none; margin:0; padding:0; display:flex; flex-wrap:wrap; gap:8px">${steps.map((s, i) => `<li${i === active ? ' aria-current="step"' : ''} style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:${i === active ? 700 : 500}; padding:6px 12px 6px 6px; border-radius:999px; border:1px solid ${i === active ? '#1a1a1a' : '#c4c4c4'}; background:${i < active ? '#f2f2f2' : '#ffffff'}"><span style="width:24px; height:24px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; ${i === active ? 'background:#1a1a1a; color:#ffffff' : i < active ? 'background:#4d4d4d; color:#ffffff' : 'background:#e6e6e6; color:#1a1a1a'}">${i + 1}</span><span>${s}</span>${i < active ? '<span style="font-size:11px; color:#3d3d3d">· done</span>' : ''}</li>`).join('')}</ol>`;
const tabs = (list, active) => `<div role="tablist" style="display:flex; flex-wrap:wrap; gap:4px; border-bottom:1px solid #c4c4c4">${list.map((t, i) => `<button type="button" role="tab" aria-selected="${i === active}" style="min-height:44px; padding:0 14px; border:0; border-bottom:3px solid ${i === active ? '#1a1a1a' : 'transparent'}; background:transparent; font-family:inherit; font-size:14px; font-weight:${i === active ? 700 : 500}; color:#1a1a1a; cursor:pointer">${t}</button>`).join('')}</div>`;
const state = (label, title, text, actions = []) => `<div style="border:2px dashed #8c8c8c; border-radius:8px; padding:16px; background:#fafafa; display:flex; flex-direction:column; gap:8px; min-width:0"><div style="font-size:11px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#3d3d3d">State · ${label}</div><div style="font-size:15px; font-weight:700">${title}</div><div style="font-size:13px; color:#333333; line-height:1.5">${text}</div>${actions.length ? row(actions, { gap: 8 }) : ''}</div>`;
const banner = (text, action = '') => `<div style="display:flex; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between; border:1px solid #1a1a1a; border-radius:8px; padding:12px 16px; background:#f2f2f2; font-size:14px"><span>${text}</span>${action}</div>`;
const ul = (items, o = {}) => `<ul style="margin:0; padding-left:20px; display:flex; flex-direction:column; gap:${o.gap ?? 6}px; font-size:${o.size || 14}px; line-height:1.5">${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
const p = (t, o = {}) => `<p style="margin:0; font-size:${o.size || 14}px; line-height:1.55; color:${o.mute ? '#3d3d3d' : '#1a1a1a'}">${t}</p>`;
const dl = (pairs) => `<dl style="margin:0; display:grid; grid-template-columns:minmax(120px, max-content) 1fr; gap:8px 16px; font-size:14px">${pairs.map(([k, v]) => `<dt style="font-weight:600; color:#3d3d3d">${k}</dt><dd style="margin:0">${v}</dd>`).join('')}</dl>`;
const sub = (t) => `<h3 style="margin:0; font-size:14px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#3d3d3d">${t}</h3>`;
const bell = `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.7 21a2 2 0 0 1-3.4 0"></path></svg>`;

// ---------------------------------------------------------------- brand shell
const BRAND_NAV = [['Dashboard', 'B04'], ['Products', 'B05'], ['Campaigns', 'B08'], ['Find Creators', 'B09'], ['LIVE Calendar', 'B13'], ['Analytics', 'B15'], ['Billing', 'B16'], ['Messages', 'B17'], ['Team', 'B18'], ['Settings', 'B18']];
const BRAND_IDS = new Set(Array.from({ length: 18 }, (_, i) => `B${String(i + 1).padStart(2, '0')}`));
const linkTo = (id) => (BRAND_IDS.has(id) ? `<a href="${id}.dc.html">${id}</a>` : `${id}`);

const specRail = (id, n) => `<aside aria-label="Spec notes for ${id}" style="flex:1 1 280px; min-width:0; border:1px dashed #8c8c8c; border-radius:8px; padding:16px; background:#fafafa; font-size:13px; line-height:1.5; display:flex; flex-direction:column; gap:14px; box-sizing:border-box">
<div style="display:flex; justify-content:space-between; align-items:center; gap:8px"><span style="font-size:11px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#3d3d3d">Spec notes · ${id}</span>${badge(n.priority)}</div>
<div><b>Purpose.</b> ${n.purpose}</div>
<div><b>Roles.</b> ${n.roles}</div>
<div style="display:flex; flex-direction:column; gap:6px"><b>Rules</b>${ul(n.rules, { size: 13, gap: 4 })}</div>
<div style="display:flex; flex-direction:column; gap:6px"><b>States and errors</b>${ul(n.states, { size: 13, gap: 4 })}</div>
<div><b>Goes to.</b> ${n.links.map(linkTo).join(' · ')}</div>
</aside>`;

const pageHead = (id, title, badges, actions, crumbs) => `<div style="display:flex; flex-wrap:wrap; gap:16px; align-items:flex-end; justify-content:space-between">
<div style="display:flex; flex-direction:column; gap:8px; min-width:0">
<nav aria-label="Breadcrumb" style="font-size:13px; color:#3d3d3d">${crumbs.join(' / ')}</nav>
<div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center"><span style="font-size:12px; font-weight:700; border:1px solid #1a1a1a; border-radius:4px; padding:2px 6px">${id}</span><h1 style="margin:0; font-size:28px; font-weight:700">${title}</h1>${badges.join('')}</div>
</div>
${actions.length ? row(actions, { gap: 8 }) : ''}
</div>`;

const topbar = `<header style="display:flex; flex-wrap:wrap; align-items:center; gap:16px; padding:12px 24px; border-bottom:1px solid #c4c4c4; background:#ffffff">
<a href="B04.dc.html" style="font-weight:800; letter-spacing:0.1em; text-decoration:none; color:#1a1a1a; font-size:16px">VYRALINK</a>
<button type="button" aria-label="Switch organization. Current: GlowSkin Beauty, Brand Owner" style="min-height:44px; padding:0 12px; border:1px solid #8c8c8c; border-radius:6px; background:#ffffff; font-family:inherit; font-size:14px; font-weight:600; cursor:pointer">GlowSkin Beauty · Brand Owner ▾</button>
<input type="search" aria-label="Search" placeholder="Search campaigns, products, creators" style="${inputStyle}; flex:1 1 240px; width:auto">
<a href="B17.dc.html" aria-label="Notifications, 3 unread" style="display:inline-flex; align-items:center; gap:6px; min-height:44px; min-width:44px; justify-content:center; text-decoration:none; font-size:13px; font-weight:700">${bell}<span>3</span></a>
<span aria-label="Signed in as Maya Chen" style="width:36px; height:36px; border-radius:50%; background:#e6e6e6; border:1px solid #8c8c8c; display:inline-flex; align-items:center; justify-content:center; font-size:13px; font-weight:700">MC</span>
</header>`;

const sidebar = (active) => `<nav aria-label="Brand navigation" style="flex:1 1 220px; min-width:0; background:#f7f7f7; border-right:1px solid #c4c4c4; padding:16px 12px; display:flex; flex-direction:column; gap:4px; box-sizing:border-box">
${BRAND_NAV.map(([label, id]) => { const on = label === active; return `<a href="${id}.dc.html"${on ? ' aria-current="page"' : ''} style="display:flex; align-items:center; min-height:44px; padding:0 12px; border-radius:6px; text-decoration:none; color:#1a1a1a; font-size:14px; font-weight:${on ? 700 : 500}; background:${on ? '#e0e0e0' : 'transparent'}">${label}</a>`; }).join('\n')}
</nav>`;

const brandScreen = (s) => {
  const body = `<div style="width:100%; max-width:1440px; margin:0 auto; ${FONT}; color:#1a1a1a; background:#ffffff; display:flex; flex-direction:column; box-sizing:border-box">
${s.onboarding ? `<header style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:16px; padding:16px 24px; border-bottom:1px solid #c4c4c4"><span style="font-weight:800; letter-spacing:0.1em; font-size:16px">VYRALINK</span>${s.onboardingRight || ''}</header>` : topbar}
<div style="display:flex; flex-wrap:wrap; align-items:stretch">
${s.onboarding ? '' : sidebar(s.nav)}
<main style="flex:999 1 560px; min-width:0; padding:32px; display:flex; flex-direction:column; gap:24px; box-sizing:border-box">
${pageHead(s.id, s.title, s.badges || [], s.actions || [], s.crumbs || ['Brand portal', s.title])}
<div style="display:flex; flex-wrap:wrap; gap:24px; align-items:flex-start">
<div style="flex:999 1 560px; min-width:0; display:flex; flex-direction:column; gap:24px">
${s.main}
</div>
${specRail(s.id, s.notes)}
</div>
</main>
</div>
</div>`;
  out(`project/brand/${s.id}.dc.html`, doc(`${s.id} ${s.title}`, 1440, s.h, body));
};

// ---------------------------------------------------------------- B01–B18
const EX = prov('Example data');
const screens = [];

screens.push({ id: 'B01', title: 'Brand registration', onboarding: true, h: 1500, crumbs: ['Sign up', 'Brand account'],
  onboardingRight: `<span style="font-size:14px">Already have an account? <a href="B04.dc.html">Sign in</a></span>`,
  badges: [badge('MVP')],
  main: row([
    col([`<h2 style="margin:0; font-size:22px">Sell more through LIVE commerce</h2>`, ul(['Find vetted LIVE sellers for your products', 'Book studio time at Creator Hub locations', 'See every session, result and invoice in one place']), ph('Illustration: LIVE session in a studio', 220)], 16).replace('min-width:0', 'min-width:0; flex:1 1 300px'),
    card('Create your brand account', col([
      btn('Continue with Google', { full: true }),
      p('Other sign-in providers can be enabled per region.', { size: 12, mute: true }),
      `<div role="separator" style="display:flex; align-items:center; gap:12px; font-size:12px; color:#3d3d3d"><span style="flex:1; height:1px; background:#c4c4c4"></span>or<span style="flex:1; height:1px; background:#c4c4c4"></span></div>`,
      field('Work email', 'maya@glowskin.example', { req: true, type: 'email' }),
      field('Password', '', { req: true, type: 'password', hint: '12 or more characters' }),
      grid([field('Company name', 'GlowSkin Beauty', { req: true }), field('Business contact', 'Maya Chen', { req: true }), sel('Country', ['United States', 'Canada', 'United Kingdom', 'Other'], { req: true }), sel('Industry', ['Beauty and personal care', 'Fashion', 'Electronics', 'Home and living', 'Food and drink', 'Other'], { req: true }), field('Website', 'https://glowskin.example', { hint: 'Used during company verification' })], 200),
      check('I agree to the <a href="#terms">Terms of Service</a> and the <a href="#brand-agreement">Brand Agreement</a>', false),
      btn('Create account', { primary: true, full: true, href: 'B02.dc.html' }),
    ]), { style: 'flex:1 1 420px' }),
  ], { align: 'flex-start', gap: 32 }) + grid([
    state('Email verification', 'Check your inbox', 'We sent a verification link to maya@glowskin.example. It expires in 24 hours.', [btn('Resend link'), btn('Change email', { ghost: true })]),
    state('Error', 'This email already has an account', 'Sign in instead, or reset the password.', [btn('Sign in', { href: 'B04.dc.html' }), btn('Reset password', { ghost: true })]),
    state('Validation', 'Fix 2 fields', 'Website must start with https:// · Accept the terms to continue. Each error is shown under its field and announced to screen readers.'),
  ], 260),
  notes: { priority: 'MVP', purpose: 'Create a brand organization and its first user.', roles: 'Visitor → Brand Owner.',
    rules: ['Email and password, or a supported social sign-in (Google in MVP).', 'Creates the organization (status: Unverified) and the user with role Brand Owner.', 'Email must be verified before verification documents can be submitted (B02).', 'Password 12+ characters, checked against a breached-password list.', 'Sign-up attempts are rate-limited per IP (limit configurable).'],
    states: ['Duplicate email → sign in or reset password', 'Unverified email → banner on every page with Resend', 'Social sign-in cancelled → back here with a message'],
    links: ['B02', 'B03', 'B04'] } });

screens.push({ id: 'B02', title: 'Company verification', h: 1700, nav: 'Settings', crumbs: ['Settings', 'Company verification'],
  badges: [badge('MVP'), chip('Decision: Rejected', 'alert')], actions: [btn('Save draft'), btn('Resubmit for review', { primary: true, href: 'B03.dc.html' })],
  main: [
    stepper(['Details', 'Documents', 'Submitted', 'In review', 'Decision'], 4),
    state('Rejected · action needed', 'Proof of business address needs replacing', 'Reviewer note: “The utility bill is older than 90 days.” Upload a document dated within the last 90 days, then resubmit. Everything else you entered is kept.', [btn('Upload new document', { primary: true }), btn('Contact support')]),
    card('Legal business information', grid([field('Legal business name', 'GlowSkin Beauty LLC', { req: true }), field('Business registration number', 'VA-0000000 (example)', { req: true }), field('Tax ID / EIN', '00-0000000 (example)', { hint: 'Required where your country uses one' }), sel('Country of registration', ['United States', 'Canada', 'United Kingdom']), field('Registered address', '100 Example St, Richmond, VA', { req: true })], 240)),
    card('Authorized representative', col([grid([field('Full name', 'Maya Chen', { req: true }), field('Job title', 'Founder and CEO', { req: true }), field('Email', 'maya@glowskin.example', { req: true })], 220), check('I confirm I am authorized to act for this business', true)])),
    card('Verification documents', col([
      table(['Document', 'File', 'Status', 'Action'], [
        ['Certificate of formation', 'formation.pdf', chip('Accepted', 'dark'), btn('Replace', { ghost: true })],
        ['Proof of business address', 'utility-bill.pdf', chip('Rejected: older than 90 days', 'alert'), btn('Upload new')],
        ['Representative photo ID', 'id-front.jpg', chip('Accepted', 'dark'), btn('Replace', { ghost: true })],
      ]),
      `<label style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; min-height:120px; border:2px dashed #8c8c8c; border-radius:8px; font-size:14px; text-align:center; padding:16px"><span style="font-weight:700">Drop files here or browse</span><span style="font-size:12px; color:#3d3d3d">PDF, JPG or PNG, up to 10 MB each</span><input type="file" style="font-size:13px"></label>`,
    ])),
    grid([state('Uploading error', 'utility-bill-new.pdf could not be uploaded', 'The file is 14 MB. Files must be 10 MB or smaller.', [btn('Choose another file')]), state('Verified', 'GlowSkin Beauty LLC is verified', 'Publishing campaigns, inviting sellers and booking booths are now unlocked.', [btn('Go to dashboard', { href: 'B04.dc.html' })])], 260),
  ].join(''),
  notes: { priority: 'MVP', purpose: 'Prove the brand is a real business before it can publish campaigns, book booths or be invoiced.', roles: 'Brand Owner submits; platform verifier decides (Super Admin A04).',
    rules: ['Until Verified: products and campaigns can be drafted, but not published, booked or used to invite sellers.', 'Documents are encrypted at rest and visible only to the Brand Owner and platform verifiers.', 'Review target: [REVIEW SLA] business days (set by operations).', 'Each submission is versioned; decision and reviewer note are audit-logged.', 'Statuses: Not submitted → Submitted → In review → Verified, or Rejected → Resubmitted → In review.'],
    states: ['Rejected → reason shown, fields kept, resubmit', 'More information requested → the field is highlighted', 'Upload too large or wrong type → inline error', 'Document expires → re-verification request'],
    links: ['B03', 'B04', 'A04 (Batch 4)'] } });

screens.push({ id: 'B03', title: 'Brand onboarding', onboarding: true, h: 1700, crumbs: ['Set up', 'Step 3 of 6'],
  onboardingRight: `<a href="B04.dc.html" style="font-size:14px">Finish later, go to dashboard</a>`, badges: [badge('MVP')],
  main: [
    stepper(['Company profile', 'Product category', 'Commerce channels', 'Campaign objectives', 'Budget preferences', 'Team invitations'], 2),
    card('Where do you sell?', col([
      p('Choose every channel you use. This sets how LIVE results reach your reports.', { mute: true }),
      `<div style="border:1px solid #1a1a1a; border-radius:8px; padding:16px; display:flex; flex-direction:column; gap:12px">${check('<b>TikTok Shop</b>', true)}${field('TikTok Shop name', 'GlowSkin Beauty Official')}${row([btn('Connect TikTok Shop account', { disabled: true }), badge('P2')], { gap: 8 })}${p('MVP: after each LIVE, results are entered or imported from TikTok Shop reports. Phase 2: automatic sync, only through access TikTok authorizes.', { size: 13, mute: true })}</div>`,
      row([check('Shopify', false, { disabled: true }), badge('P3'), check('Amazon', false, { disabled: true }), badge('P3'), check('Own website', false)], { gap: 12 }),
      banner('Vyralink does not take customer payments. Checkout, orders, refunds and settlement stay in TikTok Shop under your merchant agreement.'),
    ])),
    grid([
      card('Done · Company profile', dl([['Company', 'GlowSkin Beauty'], ['Industry', 'Beauty and personal care'], ['Country', 'United States']])),
      card('Done · Product category', row([chip('Skincare', 'outline'), chip('Makeup', 'outline')], { gap: 8 })),
    ], 280),
    grid([
      card('Next · Campaign objectives', col([check('Launch a new product', true), check('Grow sales of existing products', true), check('Clear inventory', false), check('Test LIVE selling', false)], 0)),
      card('Next · Budget preferences', col([sel('Typical monthly LIVE budget', ['$1,000 – $5,000', 'Under $1,000', '$5,000 – $20,000', 'Over $20,000']), sel('Preferred pricing', ['Per-session packages', 'Monthly retainer (Phase 2)'])])),
      card('Next · Team invitations', col([field('Email', 'leo@glowskin.example'), sel('Role', ['Brand Marketing Manager', 'Brand Owner']), btn('Add another')])),
    ], 260),
    row([btn('Back'), btn('Skip for now', { ghost: true }), btn('Continue', { primary: true })], { gap: 8, justify: 'flex-end' }),
    state('Phase 2 · connection failed', 'We could not connect to TikTok Shop', 'Your reporting stays Manual. Try again later from Team and settings (B18).', [btn('Retry'), btn('Continue with manual reporting', { ghost: true })]),
  ].join(''),
  notes: { priority: 'MVP', purpose: 'Collect what Vyralink needs to recommend sellers and studios, in short steps.', roles: 'Brand Owner (Marketing Manager can complete steps 2–4 if invited first).',
    rules: ['Each step saves on Continue; leave and resume any time.', 'Only Company profile is required; other steps can be skipped.', 'Commerce channel sets reporting mode: Manual (MVP) or Connected (Phase 2, where TikTok authorizes).', 'Team invites send an email; invitee gets Brand Marketing Manager or Brand Owner.'],
    states: ['Invite email bounces → shown in B18 with Resend', 'Channel connection fails (Phase 2) → stays Manual', 'Unverified brand → reminder card linking to B02'],
    links: ['B02', 'B04', 'B18'] } });

screens.push({ id: 'B04', title: 'Dashboard', h: 1900, nav: 'Dashboard', crumbs: ['Brand portal', 'Dashboard'],
  badges: [badge('MVP'), EX], actions: [btn('Add product', { href: 'B05.dc.html' }), btn('Create campaign', { primary: true, href: 'B07.dc.html' })],
  main: [
    banner('Verification in review. You can draft campaigns now; publishing unlocks when your company is verified.', btn('View status', { href: 'B02.dc.html' })),
    grid([
      kpi('Active campaigns', '2', '1 Scheduled · 1 Recruiting'),
      kpi('Upcoming LIVE sessions', '3', 'Next: Sat 7:00 PM, Creator Hub Virginia'),
      kpi('Attributable GMV · 30 days', '$6,000', 'Your merchandise sales in TikTok Shop from LIVE sessions', 'Manual'),
      kpi('Orders · 30 days', '150', 'From imported TikTok Shop report', 'Manual'),
      kpi('LIVE hours · 30 days', '3', 'From studio session log', 'Verified'),
      kpi('Campaign spend', '$1,170', '$750 service fee (invoiced) + $420 performance fee (pending)'),
      kpi('GMV ÷ campaign spend', '5.1×', 'A ratio, not profit: excludes product cost and returns'),
      kpi('Avg seller rating given', '5.0', '1 completed session'),
    ], 220),
    card('Upcoming LIVE sessions', table(['When', 'Campaign', 'Seller', 'Location / booth', 'Status'], [
      ['Sat · 7:00–10:00 PM', '<a href="B14.dc.html">Vitamin C LIVE — Saturday</a>', 'Sarah Johnson', 'Creator Hub Virginia · Beauty Booth 01', chip('Confirmed', 'dark')],
      ['Thu · 6:00–8:00 PM', 'Night Cream LIVE DROP', 'Not booked yet (2 applications)', 'Creator Hub Virginia · Beauty Booth 02 (held)', chip('Recruiting', 'outline')],
      ['Sat +1 wk · 12:00–2:00 PM', 'SPF summer LIVE', '—', '—', chip('Draft')],
    ]), { right: `<a href="B13.dc.html" style="font-size:14px">Open calendar</a>` }),
    row([
      card('Seller performance', table(['Seller', 'Sessions', 'GMV', 'GMV / hour', 'Orders'], [['<a href="B10.dc.html">Sarah Johnson</a>', '1', '$6,000', '$2,000', '150']], { min: 420 }), { style: 'flex:2 1 420px' }),
      card('Recent activity', ul(['Sarah Johnson signed the contract · Tue', 'Creator Hub Virginia received 4 samples · Wed', 'Producer Jordan P. assigned · Thu', 'Invoice INV-1042 issued, $750 · Thu'], { size: 13 }), { style: 'flex:1 1 280px' }),
    ], { align: 'stretch', gap: 24 }),
    card('Notifications', ul(['<b>Approval needed:</b> Spring serum LIVE budget $2,400 is over your $1,000 threshold', '<b>Booking confirmed:</b> Beauty Booth 01, Sat 7–10 PM', '<b>Results imported:</b> Spring serum LIVE (last month)'], { size: 13 }), { right: `<a href="B17.dc.html" style="font-size:14px">All notifications</a>` }),
    grid([state('Empty · new brand', 'No campaigns yet', 'Add a product, then create your first LIVE campaign.', [btn('Add product', { href: 'B05.dc.html' }), btn('Create campaign', { primary: true, href: 'B07.dc.html' })]), state('Delayed data', 'Sales for Thursday’s LIVE are not in yet', 'KPIs show “Delayed” with the last-updated time until results are imported.')], 280),
  ].join(''),
  notes: { priority: 'MVP', purpose: 'One glance at campaigns, upcoming LIVEs, results and what needs action.', roles: 'Brand Owner, Brand Marketing Manager (spend hidden if billing permission is off).',
    rules: ['Attributable GMV = merchandise sales TikTok Shop attributes to this brand’s LIVE sessions. It is the brand’s sales, never Vyralink or Creator Hub revenue.', 'Every metric shows its source: Live, Delayed, Manual, Imported, Verified or Unavailable.', 'Campaign spend = Vyralink / Creator Hub fees only. Seller pay is Creator Hub’s cost and is not added again.', 'GMV ÷ spend is shown as a ratio and never labelled profit or ROI.'],
    states: ['No data yet → “Results appear after your first LIVE”', 'Import delayed → Delayed tag with timestamp', 'Unverified → publish actions disabled with reason'],
    links: ['B07', 'B13', 'B14', 'B15', 'B17'] } });

screens.push({ id: 'B05', title: 'Product catalog', h: 1500, nav: 'Products', crumbs: ['Brand portal', 'Products'],
  badges: [badge('MVP'), EX], actions: [btn('Import CSV'), btn('Add product', { primary: true })],
  main: [
    row([`<input type="search" aria-label="Search products" placeholder="Search by name or SKU" style="${inputStyle}; flex:2 1 240px; width:auto">`, sel('Category', ['All categories', 'Skincare', 'Sun care', 'Makeup'], { grow: true }), sel('Status', ['All statuses', 'Draft', 'Pending review', 'Approved', 'Rejected', 'Archived'], { grow: true }), sel('Samples', ['Any', 'Available', 'Needed', 'In transit'], { grow: true })], { align: 'flex-end', gap: 12 }),
    table(['', 'Product', 'SKU', 'Price', 'Category', 'Inventory', 'Samples', 'Status', 'Commission', ''], [
      [ph('Image', 40, '40px'), '<a href="B06.dc.html">Vitamin C Face Serum</a>', 'GS-VC-30', '$40.00', 'Skincare', '10,000', '4 at Creator Hub Virginia', chip('Approved', 'dark'), '5%', btn('Edit', { ghost: true })],
      [ph('Image', 40, '40px'), 'Hydrating Night Cream', 'GS-NC-50', '$36.00', 'Skincare', '2,400', chip('Samples needed', 'alert'), chip('Pending review'), '6%', btn('Edit', { ghost: true })],
      [ph('Image', 40, '40px'), 'Daily SPF 50 Sunscreen', 'GS-SPF-50', '$28.00', 'Sun care', '5,800', '2 in transit', chip('Rejected', 'alert'), '5%', btn('Fix', { ghost: true })],
      [ph('Image', 40, '40px'), 'Glow Lip Oil', 'GS-LO-10', '$18.00', 'Makeup', '0', '—', chip('Archived'), '—', btn('Restore', { ghost: true })],
    ], { min: 960 }),
    row([
      card('Add product (side panel)', col([
        grid([field('Product name', 'Hydrating Night Cream', { req: true }), field('SKU', 'GS-NC-50', { req: true, hint: 'Unique within your brand' }), field('Retail price (USD)', '36.00', { req: true }), sel('Category', ['Skincare', 'Sun care', 'Makeup'], { req: true }), field('Inventory on hand', '2400', { type: 'number' }), field('Samples you can send', '0', { type: 'number', err: 'Send at least 2 samples per booked LIVE' }), sel('Ship samples to', ['Creator Hub Virginia', 'Decide per campaign']), field('Default seller commission (%)', '6', { type: 'number', hint: 'A campaign can override this' })], 220),
        area('Description', 'Overnight moisturizing cream, 50 ml.'),
        ph('Product images · drag to reorder · first is the cover', 96),
        row([btn('Save draft'), btn('Submit for review', { primary: true })], { gap: 8, justify: 'flex-end' }),
      ]), { style: 'flex:2 1 480px' }),
      col([
        state('Rejected', 'Daily SPF 50 Sunscreen was not approved', 'Reviewer note: “The claim ‘reef-safe’ needs supporting evidence.” Remove the claim or upload evidence, then resubmit.', [btn('Edit product')]),
        state('Empty', 'No products yet', 'Add your first product or import a CSV file.', [btn('Add product', { primary: true })]),
        state('CSV import', '18 of 20 rows imported', 'Row 7: duplicate SKU · Row 12: price missing. Download the error report to fix them.', [btn('Download report')]),
      ]).replace('min-width:0', 'min-width:0; flex:1 1 280px'),
    ], { align: 'flex-start', gap: 24 }),
  ].join(''),
  notes: { priority: 'MVP', purpose: 'Keep every product a brand may sell in LIVE, with stock, samples and default commission.', roles: 'Brand Owner, Brand Marketing Manager.',
    rules: ['Statuses: Draft → Pending review → Approved or Rejected; Approved → Archived.', 'Only Approved products can be added to a campaign (B07).', 'SKU unique per brand; price > 0; inventory ≥ 0.', 'Commission here is the default; a campaign can override it.', 'Archive is blocked while the product is in a Scheduled or In-progress campaign.'],
    states: ['Rejected → reviewer note and Edit', 'Inventory 0 → warning when chosen for a campaign', 'CSV errors → row-level report'],
    links: ['B06', 'B07'] } });

screens.push({ id: 'B06', title: 'Product detail', h: 2100, nav: 'Products', crumbs: ['Brand portal', '<a href="B05.dc.html">Products</a>', 'Vitamin C Face Serum'],
  badges: [badge('MVP'), chip('Approved', 'dark'), EX], actions: [btn('Archive'), btn('Edit'), btn('Use in a campaign', { primary: true, href: 'B07.dc.html' })],
  main: [
    row([ph('Product image', 220, '220px'), dl([['Name', 'Vitamin C Face Serum'], ['SKU', 'GS-VC-30'], ['Retail price', '$40.00'], ['Category', 'Skincare'], ['Inventory', '10,000 units'], ['Samples', '4 at Creator Hub Virginia (received Wed)'], ['Default commission', '5% of eligible attributable sales']])], { align: 'flex-start', gap: 24 }),
    tabs(['Overview', 'Selling points and claims', 'Media', 'Inventory and pricing', 'Performance'], 0),
    grid([
      card('Description', p('Daily face serum with 15% vitamin C in a 30 ml dropper bottle.')),
      card('Features', ul(['15% vitamin C', '30 ml dropper bottle', 'Fragrance-free', 'For morning use before sunscreen'])),
    ], 300),
    grid([
      card('Approved selling points', col([ul(['Contains 15% vitamin C', 'Fragrance-free formula', 'Use every morning before sunscreen', 'Returns follow TikTok Shop’s returns policy']), p('Approved by Maya Chen (Brand Owner). Shown in the seller briefing (C16).', { size: 12, mute: true })])),
      card('Restricted claims · sellers must not say', col([ul(['Cures or treats acne, melasma or any condition', 'Removes wrinkles or reverses ageing', 'Dermatologist recommended (no evidence on file)', 'Guaranteed results in a set number of days']), p('Used in the producer’s compliance check (O13) before going LIVE.', { size: 12, mute: true })]), { style: 'border:2px solid #1a1a1a' }),
    ], 300),
    card('Media', row([ph('Image 1', 96, '96px'), ph('Image 2', 96, '96px'), ph('Image 3', 96, '96px'), ph('Demo video', 96, '160px')], { gap: 12 })),
    grid([
      card('Inventory and pricing', dl([['Retail price', '$40.00'], ['In stock', '10,000 units (updated by brand)'], ['Samples', '4 at studio · 0 in transit'], ['Promotion', 'LIVE-only 15% off · set up in TikTok Shop, recorded here for the briefing']])),
      card('Performance by seller', table(['Seller', 'Sessions', 'Orders', 'GMV', 'GMV / hour'], [['Sarah Johnson', '1', '150', '$6,000', '$2,000']], { min: 420 }), { right: prov('Manual') }),
    ], 300),
    card('Sales history', table(['Date', 'Source', 'Orders', 'GMV', 'Data'], [['Sat', 'LIVE · Vitamin C LIVE — Saturday', '150', '$6,000', prov('Manual')], ['Last month', 'LIVE · Spring serum LIVE', '—', '—', prov('Delayed')]])),
    grid([state('Edit after approval', 'Changing claims sends the product back to review', 'Campaigns already Scheduled keep the approved version until the new one is approved.'), state('Stock warning', 'Inventory is below the campaign’s expected units', 'Night Cream LIVE DROP expects 3,000 units; 2,400 in stock. Brand and operations are notified.')], 280),
  ].join(''),
  notes: { priority: 'MVP', purpose: 'Single source of truth for what sellers may say and show about a product.', roles: 'Brand Owner, Brand Marketing Manager; read-only for assigned seller and Creator Hub staff.',
    rules: ['Editing selling points or claims on an Approved product sends it back to Pending review.', 'A restricted-claims list is required for regulated categories (beauty, supplements).', 'Promotions are configured in TikTok Shop; Vyralink only stores them for briefings.', 'Every sales figure carries its source and last-updated time.'],
    states: ['Archived → read-only banner', 'Stock below campaign need → warning to brand and operations', 'No sales yet → “No LIVE sessions yet”'],
    links: ['B05', 'B07', 'C16 (Batch 2)', 'O13 (Batch 3)'] } });

const comp = table(['Line', 'Basis', 'Amount', 'Paid by', 'Paid to'], [
  ['Production / service fee', 'Fixed per package', '$750', 'GlowSkin Beauty', 'Creator Hub'],
  ['Performance fee', '7% × eligible attributable GMV ($10,000)', '$700', 'GlowSkin Beauty', 'Creator Hub'],
  ['Seller base pay', '$30 / hour × 3 hours', '$90', 'Creator Hub', 'Sarah Johnson'],
  ['Seller commission', '5% × eligible attributable sales ($10,000)', '$500', 'Creator Hub', 'Sarah Johnson'],
  ['Seller bonus', 'Only if the bonus condition is met', '$100', 'Creator Hub', 'Sarah Johnson'],
  ['Customer purchases (GMV)', 'Orders in TikTok Shop', '$10,000', 'Customers', 'GlowSkin Beauty, via TikTok Shop settlement'],
], { min: 760, caption: 'Who pays whom · example at the $10,000 target' });

screens.push({ id: 'B07', title: 'Create campaign', h: 2500, nav: 'Campaigns', crumbs: ['Brand portal', '<a href="B08.dc.html">Campaigns</a>', 'New campaign (Draft)'],
  badges: [badge('MVP'), chip('Draft'), EX], actions: [btn('Save draft'), btn('Next: Seller requirements', { primary: true })],
  main: [
    stepper(['Objective', 'Campaign type', 'Products', 'LIVE date and duration', 'Budget and compensation', 'Seller requirements', 'Studio requirements', 'Review and publish'], 4),
    card('Step 2 · Campaign type', grid([
      `<div style="border:2px solid #1a1a1a; border-radius:8px; padding:12px">${check('<b>LIVE Shopping</b>', true, { radio: 'type' })}${badge('MVP')}</div>`,
      `<div style="border:1px solid #c4c4c4; border-radius:8px; padding:12px">${check('<b>Product Launch / LIVE DROP</b>', false, { radio: 'type' })}${badge('MVP')}</div>`,
      `<div style="border:1px solid #c4c4c4; border-radius:8px; padding:12px">${check('Managed LIVE Retainer', false, { radio: 'type', disabled: true })}${badge('P2')}</div>`,
      `<div style="border:1px solid #c4c4c4; border-radius:8px; padding:12px">${check('Affiliate Campaign', false, { radio: 'type', disabled: true })}${badge('P2')}</div>`,
      `<div style="border:1px solid #c4c4c4; border-radius:8px; padding:12px">${check('UGC Video', false, { radio: 'type', disabled: true })}${badge('P3')}</div>`,
      `<div style="border:1px solid #c4c4c4; border-radius:8px; padding:12px">${check('Influencer Post', false, { radio: 'type', disabled: true })}${badge('P3')}</div>`,
    ], 200), { right: btn('Edit', { ghost: true }) }),
    card('Step 5 · Budget and compensation', col([
      sub('Seller compensation · paid by Creator Hub under the seller contract'),
      grid([field('Base rate per hour (USD)', '30', { type: 'number', req: true }), field('LIVE duration (from step 4)', '3 hours'), field('Commission on eligible attributable sales (%)', '5', { type: 'number', req: true }), field('Bonus amount (USD)', '100', { type: 'number' }), sel('Bonus condition', ['Attributable GMV reaches a target', 'Orders reach a target', 'No bonus']), field('Bonus target', '$5,000 GMV', { hint: 'Example condition, set per campaign' })], 220),
      banner('Base pay $30 × 3 h = <b>$90</b> · Commission at the $10,000 target = <b>$500</b> · Bonus if earned = <b>$100</b>'),
      sub('Creator Hub fees · invoiced to GlowSkin Beauty'),
      grid([field('Production / service fee (USD)', '750', { hint: 'Set by the studio package' }), field('Performance fee (% of eligible attributable GMV)', '7', { hint: 'Invoiced after the returns window' })], 260),
      banner('At the $10,000 target: $750 + $700 = <b>$1,450</b> invoiced to the brand'),
      sub('Budget, timing and policy'),
      grid([field('Campaign budget cap (USD)', '2,000', { req: true, hint: 'Over $1,000 needs Brand Owner approval (threshold configurable)' }), sel('Seller payment timing', ['[N] days after results are reconciled', 'Custom (needs approval)']), sel('Cancellation policy', ['Free until 72 h before; 50% of production fee within 72 h; 100% within 24 h (example)', 'Custom (needs approval)'])], 260),
      comp,
      p('Seller pay is Creator Hub’s cost, so it never appears on the brand’s invoice as well. If TikTok Shop’s own affiliate commission also applies, the contract says whether it replaces or reduces this commission, never both.', { size: 13, mute: true }),
    ])),
    card('Other steps · summary', table(['Step', 'Your answer', ''], [
      ['1 · Objective', 'Grow sales of Vitamin C Face Serum · target $10,000 GMV', btn('Edit', { ghost: true })],
      ['3 · Products', 'Vitamin C Face Serum · 10,000 in stock · 4 samples', btn('Edit', { ghost: true })],
      ['4 · LIVE date and duration', 'Saturday 7:00–10:00 PM (3 hours), studio local time', btn('Edit', { ghost: true })],
      ['6 · Seller requirements', 'Beauty · 10+ LIVE sessions · English · near Virginia · Beauty Claims certificate', btn('Edit', { ghost: true })],
      ['7 · Studio requirements', 'Creator Hub Virginia · Beauty booth · 2 cameras, ring light · producer included', btn('Edit', { ghost: true })],
      ['8 · Review and publish', 'Checks: verified brand, approved product, studio slot held, budget approved', btn('Edit', { ghost: true })],
    ], { min: 640 })),
    grid([
      state('Validation', 'Budget is below the minimum', 'A 3-hour LIVE at Creator Hub Virginia needs at least $750 (the production fee).'),
      state('Approval required', 'Sent to Maya Chen (Brand Owner) for approval', 'Status becomes Pending approval. The approver can approve, decline with comments, or edit.'),
      state('No studio capacity', 'Beauty booths are full on Saturday 7–10 PM', 'Pick Sunday 7–10 PM, Saturday 3–6 PM, or another location (step 7).', [btn('See open slots')]),
    ], 260),
  ].join(''),
  notes: { priority: 'MVP', purpose: 'Define what is sold, when, by what kind of seller, at which studio, and on what money terms.', roles: 'Brand Marketing Manager creates; Brand Owner approves over threshold.',
    rules: ['Saves a Draft after every step.', 'Only Approved products can be selected.', 'Publishing needs a Verified brand (B02) and approval when budget exceeds the threshold.', 'Money terms are copied into the contract (B14, C12) when a seller is booked; later edits need both parties to re-sign.', 'Every calculation shows its basis: rate × hours, % × eligible attributable sales.'],
    states: ['No studio capacity → suggest slots or locations', 'Inventory below expected units → warning', 'Unverified brand → Publish disabled with link to B02'],
    links: ['B05', 'B08', 'B09', 'B14'] } });

screens.push({ id: 'B08', title: 'Campaigns', h: 1700, nav: 'Campaigns', crumbs: ['Brand portal', 'Campaigns'],
  badges: [badge('MVP'), EX], actions: [btn('Create campaign', { primary: true, href: 'B07.dc.html' })],
  main: [
    tabs(['All 12', 'Draft 2', 'Pending approval 1', 'Published 0', 'Recruiting 1', 'Scheduled 1', 'In progress 0', 'Completed 5', 'Cancelled 1', 'Disputed 1', 'Archived 0'], 0),
    row([`<input type="search" aria-label="Search campaigns" placeholder="Search campaigns" style="${inputStyle}; flex:2 1 240px; width:auto">`, sel('Type', ['All types', 'LIVE Shopping', 'Product Launch / LIVE DROP'], { grow: true }), sel('Date', ['Next 30 days', 'Last 30 days', 'Custom range'], { grow: true })], { align: 'flex-end', gap: 12 }),
    table(['Campaign', 'Type', 'Product', 'Status', 'Next session', 'Seller', 'Budget', ''], [
      ['<a href="B14.dc.html">Vitamin C LIVE — Saturday</a>', 'LIVE Shopping', 'Vitamin C Face Serum', chip('Scheduled', 'dark'), 'Sat 7:00 PM', 'Sarah Johnson', '$2,000', btn('Open', { ghost: true, href: 'B14.dc.html' })],
      ['Night Cream LIVE DROP', 'Product Launch', 'Hydrating Night Cream', chip('Recruiting', 'outline'), 'Thu 6:00 PM', '2 applications', '$1,500', btn('Review', { ghost: true, href: 'B12.dc.html' })],
      ['Spring serum LIVE', 'LIVE Shopping', 'Vitamin C Face Serum', chip('Pending approval'), '—', '—', '$2,400', btn('Approve', { ghost: true })],
      ['SPF summer LIVE', 'LIVE Shopping', 'Daily SPF 50 Sunscreen', chip('Draft'), '—', '—', '—', btn('Continue', { ghost: true, href: 'B07.dc.html' })],
      ['Holiday bundle LIVE', 'LIVE Shopping', 'Bundle', chip('Disputed', 'alert'), '—', 'Priya Nair', '$1,200', btn('View dispute', { ghost: true })],
      ['Winter LIVE', 'LIVE Shopping', 'Glow Lip Oil', chip('Cancelled'), '—', '—', '$900', btn('Archive', { ghost: true })],
    ], { min: 960 }),
    card('Campaign lifecycle', table(['Status', 'Meaning', 'Can move to', 'Who / what moves it'], [
      ['Draft', 'Being written; not visible to sellers', 'Pending approval, Published', 'Marketing Manager, Owner'],
      ['Pending approval', 'Budget over threshold', 'Published, Draft (declined)', 'Brand Owner'],
      ['Published', 'Visible in the seller job marketplace', 'Recruiting, Cancelled', 'System on first invite or application'],
      ['Recruiting', 'Invitations and applications open', 'Scheduled, Cancelled', 'System when contract signed and booth confirmed'],
      ['Scheduled', 'Seller, booth and producer set', 'In progress, Cancelled', 'System at seller check-in'],
      ['In progress', 'LIVE day', 'Completed (or partially completed)', 'Producer closeout (O17)'],
      ['Completed', 'Results reconciled, report sent', 'Archived, Disputed', 'Finance (F05)'],
      ['Cancelled', 'Stopped before the LIVE; policy fees may apply', 'Archived', 'Brand Owner or admin'],
      ['Disputed', 'Results or deliverables contested', 'Completed', 'Platform admin (A08)'],
      ['Archived', 'Read-only', '—', 'Brand Owner'],
    ], { min: 760, rowHead: true })),
    grid([state('Empty filter', 'No campaigns in “In progress”', 'Clear filters or create a campaign.', [btn('Clear filters')]), state('Error', 'Campaigns could not load', 'Check your connection and try again.', [btn('Retry')])], 280),
  ].join(''),
  notes: { priority: 'MVP', purpose: 'Every campaign and its status in one list, with the next action for each.', roles: 'Brand Owner, Brand Marketing Manager.',
    rules: ['Status names and order are shared across brand, seller and operations portals.', 'Cancelled is only possible before In progress; Disputed only after Completed.', 'Transitions are server-side and audit-logged; the table refreshes on change.', 'Partially completed sessions (interrupted LIVE) complete with a “Partial” flag.'],
    states: ['Empty → create campaign', 'Load error → retry', 'Pending approval → Approve action for Owner only'],
    links: ['B07', 'B12', 'B14'] } });

const sellerCard = (name, line, stats, chips, actions) => `<article style="border:1px solid #c4c4c4; border-radius:8px; padding:16px; display:flex; flex-direction:column; gap:12px; min-width:0">${row([ph('Photo', 56, '56px'), col([`<h3 style="margin:0; font-size:16px">${name}</h3>`, `<span style="font-size:13px; color:#3d3d3d">${line}</span>`], 2)], { gap: 12, align: 'center' })}${row(chips, { gap: 6 })}${ul(stats, { size: 13, gap: 2 })}${row(actions, { gap: 8 })}</article>`;
screens.push({ id: 'B09', title: 'Find creators', h: 1800, nav: 'Find Creators', crumbs: ['Brand portal', 'Find creators'],
  badges: [badge('MVP'), EX], actions: [btn('Ask Creator Hub to source sellers')],
  main: row([
    `<aside aria-label="Filters" style="flex:1 1 240px; min-width:0; border:1px solid #c4c4c4; border-radius:8px; padding:16px; display:flex; flex-direction:column; gap:12px">${[sub('Filters'), sel('Product category', ['Beauty and skincare', 'Fashion', 'Electronics']), sel('LIVE experience', ['10+ sessions', 'Any', '25+ sessions']), field('Location', 'Virginia, US'), sel('Distance', ['Within 50 miles of a Creator Hub', 'Any']), sel('Language', ['English', 'Spanish', 'Any']), field('Available on', 'Sat, 7–10 PM'), sel('Rate expectation', ['Up to $40 / hour', 'Any']), field('Min. verified GMV / hour', '$1,000'), sel('Reliability', ['95%+ on time', 'Any']), sel('Rating', ['4.5 and up', 'Any']), check('Verified performance only', false), check('Include new sellers (no sales yet)', true), row([btn('Reset', { ghost: true }), btn('Apply', { primary: true })], { gap: 8 })].join('')}</aside>`,
    col([
      row([`<span style="font-size:14px"><b>24 sellers</b> match</span>`, sel('Sort by', ['Verified GMV / hour', 'Reliability', 'Rating', 'Rate (low to high)'])], { justify: 'space-between', align: 'flex-end' }),
      banner(`${badge('P3')} AI match scores come in Phase 3. Until enough verified data exists, results are sorted by the filters you choose.`),
      grid([
        sellerCard('<a href="B10.dc.html">Sarah Johnson</a>', 'Beauty, skincare · English, Spanish · Richmond, VA', ['42 LIVE sessions, 12 verified on Vyralink', `GMV / hour $1,850 ${prov('Verified')}`, 'Reliability 98% on time, 0 no-shows', 'Rating 4.9 from 11 brands', 'Expects $30 / h + 5%'], [chip('Available Sat 7–10 PM', 'outline'), chip('Beauty Claims certified')], [btn('View', { href: 'B10.dc.html' }), check('Compare', true), btn('Invite', { primary: true, href: 'B12.dc.html' })]),
        sellerCard('Priya Nair', 'Beauty, makeup · English, Hindi · Baltimore, MD', ['28 LIVE sessions, 9 verified', `GMV / hour $1,420 ${prov('Verified')}`, 'Reliability 96% on time', 'Rating 4.7 from 8 brands', 'Expects $28 / h + 5%'], [chip('Available Sat 7–10 PM', 'outline')], [btn('View'), check('Compare', true), btn('Invite', { primary: true })]),
        sellerCard('Marcus Lee', 'Skincare · English · Norfolk, VA', ['15 LIVE sessions, none on Vyralink yet', `GMV / hour $1,600 ${prov('Self-reported')}`, 'Reliability: no data yet', 'Rating 4.6 from 3 brands', 'Expects $35 / h + 4%'], [chip('Busy Sat evening')], [btn('View'), check('Compare', false), btn('Invite', { primary: true })]),
        sellerCard('Ana Ruiz', 'Beauty · English, Spanish · Richmond, VA', ['New seller: no sales history yet', 'Academy: LIVE Fundamentals passed', 'Practice LIVE reviewed by Creator Hub', 'Expects $22 / h + 5%'], [chip('New seller', 'outline'), chip('Available Sat 7–10 PM', 'outline')], [btn('View'), check('Compare', false), btn('Invite', { primary: true })]),
      ], 300),
      banner('2 sellers selected', btn('Compare', { primary: true, href: 'B11.dc.html' })),
      state('No results', 'No sellers match all filters', 'Try a wider distance or fewer LIVE sessions, or ask Creator Hub to source sellers for you.', [btn('Widen distance'), btn('Ask Creator Hub')]),
    ], 16).replace('min-width:0', 'min-width:0; flex:999 1 480px'),
  ], { align: 'flex-start', gap: 24 }),
  notes: { priority: 'MVP', purpose: 'Find and shortlist LIVE sellers with manual filters (AI matching is Phase 3, see M01).', roles: 'Brand Owner, Brand Marketing Manager.',
    rules: ['Verified = computed from session data confirmed on Vyralink. Self-reported is labelled and never mixed into verified sorts.', 'New sellers appear with Academy results and a “New seller” label, not hidden.', 'Sellers can hide rate expectations (“On request”).', 'Invite requires a Published campaign; otherwise “Save to shortlist”.'],
    states: ['No results → widen filters or request sourcing', 'Seller busy on campaign date → warning on Invite', 'Unverified brand → Invite disabled'],
    links: ['B10', 'B11', 'B12', 'M01 (Batch 4)'] } });

screens.push({ id: 'B10', title: 'Creator profile', h: 2000, nav: 'Find Creators', crumbs: ['Brand portal', '<a href="B09.dc.html">Find creators</a>', 'Sarah Johnson'],
  badges: [badge('MVP'), chip('Academy certified', 'dark'), EX], actions: [btn('Add to compare', { href: 'B11.dc.html' }), btn('Message', { href: 'B17.dc.html' }), btn('Invite to campaign', { primary: true, href: 'B12.dc.html' })],
  main: [
    row([ph('Profile photo', 160, '160px'), col([`<h2 style="margin:0; font-size:22px">Sarah Johnson</h2>`, p('Bilingual beauty host based in Richmond, Virginia. Focus on skincare demos and Q&amp;A-style LIVEs.'), row([chip('Beauty', 'outline'), chip('Skincare', 'outline'), chip('English', 'outline'), chip('Spanish', 'outline')], { gap: 6 }), dl([['Skills', 'Product demos, live Q&amp;A, bilingual hosting'], ['Location', 'Richmond, VA · 12 miles from Creator Hub Virginia'], ['Rate expectation', '$30 / hour + 5% commission']])], 10).replace('min-width:0', 'min-width:0; flex:1 1 360px')], { align: 'flex-start', gap: 24 }),
    grid([
      kpi('Verified LIVE sessions', '12', 'Of 42 total; 30 before Vyralink are self-reported', 'Verified'),
      kpi('Verified GMV', '$22,200', 'Across 12 sessions', 'Verified'),
      kpi('GMV / hour', '$1,850', 'Verified sessions only', 'Verified'),
      kpi('Reliability', '98%', 'On time · 0 no-shows · 0 cancellations', 'Verified'),
      kpi('Brand rating', '4.9', 'From 11 brands'),
      kpi('Followers', '85K', 'Shown as the seller entered it', 'Self-reported'),
    ], 200),
    card('Certifications', table(['Course', 'Result', 'Date', 'Expires'], [['LIVE Fundamentals', 'Passed', 'Mar', '—'], ['Beauty Claims Compliance', 'Passed', 'Apr', 'In 12 months'], ['TikTok Shop LIVE tools', 'In progress', '—', '—']], { min: 480 })),
    card('Previous LIVE jobs', table(['Date', 'Brand', 'Product', 'Hours', 'GMV', 'Rating', 'Data'], [['Last month', 'Lumen Skin', 'Night repair oil', '2', '$3,600', '5.0', prov('Verified')], ['2 months ago', 'Petal Co.', 'Lip tint set', '3', '$4,950', '4.8', prov('Verified')], ['Before Vyralink', 'Various', '—', '—', '—', '—', prov('Self-reported')]], { min: 640 })),
    grid([
      card('Availability · next 7 days', grid(['Mon · evenings', 'Tue · off', 'Wed · evenings', 'Thu · off', 'Fri · evenings', 'Sat · 12–10 PM', 'Sun · afternoons'].map((d) => `<div style="border:1px solid #c4c4c4; border-radius:6px; padding:8px; font-size:12px; text-align:center">${d}</div>`), 90, 8)),
      card('Portfolio', row([ph('Clip 1', 120, '72px'), ph('Clip 2', 120, '72px'), ph('Clip 3', 120, '72px'), ph('Clip 4', 120, '72px')], { gap: 8 })),
    ], 320),
    card('Brand reviews', ul(['“Prepared, on time, and kept every claim inside our brief.” · Lumen Skin', '“Great with live questions in Spanish and English.” · Petal Co.'])),
    state('Incomplete profile', 'Data completeness: 60%', 'No portfolio and no verified sessions yet. Brands see this label next to the seller’s name.'),
  ].join(''),
  notes: { priority: 'MVP', purpose: 'Let a brand judge a seller on verified facts before inviting.', roles: 'Brand Owner, Brand Marketing Manager (seller edits it in C02 / C24).',
    rules: ['Verified figures link to the sessions they came from; Self-reported figures are labelled.', 'Seller controls visibility of rate expectation and portfolio.', 'No personal email or phone shown; contact goes through Messages (B17).', 'Ratings only from brands with a completed session.'],
    states: ['Seller unavailable on the campaign date → warning on Invite', 'Profile incomplete → completeness label', 'Seller suspended → profile hidden from discovery'],
    links: ['B09', 'B11', 'B12', 'B17'] } });

screens.push({ id: 'B11', title: 'Compare sellers', h: 1400, nav: 'Find Creators', crumbs: ['Brand portal', '<a href="B09.dc.html">Find creators</a>', 'Compare (3 of 5)'],
  badges: [badge('P2'), EX], actions: [btn('Add seller', { href: 'B09.dc.html' })],
  main: [
    table(['', 'Sarah Johnson', 'Priya Nair', 'Ana Ruiz (new seller)'], [
      ['Rate expectation', '$30 / h + 5%', '$28 / h + 5%', '$22 / h + 5%'],
      ['Seller pay for 3 h at $10,000 GMV', '$590 + bonus', '$584 + bonus', '$566 + bonus'],
      ['Verified sessions', '<b>12</b>', '9', '0'],
      ['Verified GMV / hour', '<b>$1,850</b>', '$1,420', 'No data yet'],
      ['Reliability', '<b>98%</b>', '96%', 'No data yet'],
      ['Brand rating', '4.9 (11)', '4.7 (8)', 'No data yet'],
      ['Languages', 'English, Spanish', 'English, Hindi', 'English, Spanish'],
      ['Distance to Creator Hub Virginia', '12 mi', '<b>95 mi</b>', '8 mi'],
      ['Available Sat 7–10 PM', 'Yes', 'Yes', 'Yes'],
      ['Certifications', 'Fundamentals, Beauty Claims', 'Fundamentals, Beauty Claims', '<b>Fundamentals only</b>'],
      ['Data completeness', 'High', 'High', 'Low'],
      ['', btn('Invite', { primary: true, href: 'B12.dc.html' }), btn('Invite', { primary: true }), btn('Invite', { primary: true })],
    ], { min: 760, rowHead: true }),
    p('Differences are bold. Missing data reads “No data yet”, never zero. Seller pay = base rate × hours + commission % × eligible attributable sales; bonus shown separately.', { size: 13, mute: true }),
    grid([state('Limit', 'You can compare up to 5 sellers', 'Remove one to add another.'), state('Certification gap', 'Ana Ruiz lacks Beauty Claims Compliance', 'Required by this campaign. Inviting sends her the course first; the booking can’t be confirmed until she passes.')], 280),
  ].join(''),
  notes: { priority: 'P2', purpose: 'Side-by-side comparison of 2–5 shortlisted sellers.', roles: 'Brand Owner, Brand Marketing Manager.',
    rules: ['Rows are fixed so sellers line up; bold marks the best or the riskiest value.', 'Cost row is calculated from the campaign’s terms, not the seller’s profile.', 'Comparison persists per campaign for 30 days.', 'MVP fallback: open profiles in tabs (B10).'],
    states: ['Only 1 seller → prompt to add another', 'Seller becomes unavailable → column greyed with reason'],
    links: ['B09', 'B10', 'B12'] } });

screens.push({ id: 'B12', title: 'Invitations and applications', h: 1700, nav: 'Campaigns', crumbs: ['Brand portal', '<a href="B08.dc.html">Campaigns</a>', 'Invitations and applications'],
  badges: [badge('MVP'), EX], actions: [btn('Invite seller', { primary: true, href: 'B09.dc.html' })],
  main: [
    tabs(['Invitations sent (3)', 'Applications received (2)'], 0),
    table(['Seller', 'Campaign', 'Sent', 'Status', 'Expires', ''], [
      ['Sarah Johnson', 'Vitamin C LIVE — Saturday', 'Mon', chip('Accepted · confirm booking', 'dark'), '—', btn('Confirm booking', { primary: true, href: 'B14.dc.html' })],
      ['Priya Nair', 'Night Cream LIVE DROP', 'Tue', chip('Viewed'), 'In 31 h', btn('Withdraw', { ghost: true })],
      ['Marcus Lee', 'Night Cream LIVE DROP', 'Tue', chip('Declined', 'alert'), '—', btn('Invite next', { ghost: true })],
    ], { min: 760 }),
    card('Sarah Johnson · Vitamin C LIVE — Saturday', col([
      table(['Term', 'Your invite', 'Sarah’s counter', 'Agreed'], [['Base rate', '$30 / h', '$35 / h', '<b>$30 / h</b>'], ['Commission', '5%', '5%', '<b>5%</b>'], ['Bonus', '$100 at $5,000 GMV', '$100 at $5,000 GMV', '<b>$100 at $5,000 GMV</b>'], ['Arrival', '6:15 PM', '6:30 PM', '<b>6:15 PM</b>']], { min: 560, rowHead: true }),
      ul(['Mon · Invitation sent by Leo Park', 'Mon · Sarah countered: $35 / h, arrive 6:30 PM', 'Tue · You countered: $30 / h, arrive 6:15 PM, bonus unchanged', 'Tue · Sarah accepted'], { size: 13 }),
      row([btn('Message Sarah', { href: 'B17.dc.html' }), btn('Confirm booking', { primary: true, href: 'B14.dc.html' })], { gap: 8, justify: 'flex-end' }),
      p('Confirm booking creates the contract for both to sign (B14, C12) and turns the studio hold into a reservation.', { size: 13, mute: true }),
    ])),
    card('Applications received · preview', table(['Seller', 'Campaign', 'Message', ''], [['Ana Ruiz (new seller)', 'Night Cream LIVE DROP', '“I live 8 miles from the studio and host in Spanish too.”', row([btn('Decline', { ghost: true }), btn('Accept', { primary: true })], { gap: 8 })]], { min: 640 })),
    card('Status flow', p('Invited → Viewed → Accepted, Declined, Countered or Expired (48 h). The brand may Withdraw before acceptance. Accepted → Booked when both sign and the booth is confirmed.', { size: 13 })),
    grid([state('Declined', 'Marcus Lee declined', 'Reason: unavailable that date. Suggested next: Priya Nair, Ana Ruiz.', [btn('Invite Priya'), btn('Back to discovery', { ghost: true, href: 'B09.dc.html' })]), state('Expired', 'Invitation expired after 48 hours', 'Send it again or invite another seller.', [btn('Resend')]), state('Slot lost', 'The studio hold expired before booking', 'Pick a new slot; the seller is asked to re-confirm.', [btn('Choose slot', { href: 'B13.dc.html' })])], 240),
  ].join(''),
  notes: { priority: 'MVP', purpose: 'Run invitations, applications and counter-offers until a booking is confirmed.', roles: 'Brand Marketing Manager, Brand Owner; seller side in C11.',
    rules: ['Invites expire after 48 h (configurable); expiry and response notify both sides.', 'Each counter is a new version; only the latest can be accepted.', 'One seller per LIVE slot: confirming one withdraws other open invites for that slot.', 'Booking needs the studio hold still valid; else re-select the slot.'],
    states: ['Declined → suggested next sellers', 'Expired → resend', 'Hold expired → choose slot', 'Missing certification → booking blocked until passed'],
    links: ['B09', 'B13', 'B14', 'B17', 'C11 (Batch 2)'] } });

const calCell = (t) => `<div style="font-size:12px; line-height:1.4">${t}</div>`;
screens.push({ id: 'B13', title: 'LIVE calendar', h: 1500, nav: 'LIVE Calendar', crumbs: ['Brand portal', 'LIVE calendar'],
  badges: [badge('MVP'), EX], actions: [btn('Create campaign', { primary: true, href: 'B07.dc.html' })],
  main: [
    row([tabs(['Day', 'Week', 'Month'], 1), row([btn('Previous week'), btn('Today'), btn('Next week'), `<span style="font-size:14px; font-weight:700">Example week · Mon–Sun</span>`], { gap: 8 })], { justify: 'space-between' }),
    row([sel('Location', ['All locations', 'Creator Hub Virginia'], { grow: true }), sel('Booth', ['All booths', 'Beauty Booth 01', 'Beauty Booth 02'], { grow: true }), sel('Seller', ['All sellers', 'Sarah Johnson'], { grow: true })], { gap: 12, align: 'flex-end' }),
    table(['Time', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], [
      ['12–2 PM', '', '', '', '', '', '', ''],
      ['2–4 PM', '', '', '', '', '', '', ''],
      ['4–6 PM', '', '', '', '', '', '', ''],
      ['6–8 PM', '', '', '', calCell(`${chip('Tentative', 'outline')}<br>Night Cream LIVE DROP<br>Seller not booked · Beauty Booth 02 held`), '', calCell(`${chip('Confirmed', 'dark')}<br><a href="B14.dc.html">Vitamin C LIVE 7–10 PM</a><br>Sarah Johnson · CH Virginia · Beauty Booth 01`), ''],
      ['8–10 PM', '', '', '', '', '', calCell(`(continues)<br>${chip('Conflict', 'alert')}<br>Spring serum LIVE asked for Beauty Booth 01, 8–9 PM`), ''],
    ], { min: 960, rowHead: true }),
    row([chip('Confirmed', 'dark'), chip('Tentative · hold or seller pending', 'outline'), chip('Conflict', 'alert')], { gap: 8 }),
    state('Conflict', 'Beauty Booth 01 is already booked Saturday 7–10 PM', 'Choose Beauty Booth 02 (free), another time, or another location. Overlapping bookings are refused when you save.', [btn('Use Beauty Booth 02', { primary: true }), btn('Pick another time')]),
    grid([card('Day view', p('One column per booth at the selected location, 30-minute rows, setup and teardown buffers shown in grey.', { size: 13 })), card('Month view', p('One line per session per day; days with conflicts are outlined with a dashed border.', { size: 13 }))], 280),
  ].join(''),
  notes: { priority: 'MVP', purpose: 'See every LIVE by seller, location and booth, and fix conflicts before they happen.', roles: 'Brand Owner, Brand Marketing Manager (own campaigns only).',
    rules: ['Studio holds expire after [HOLD WINDOW] hours unless confirmed (configurable).', 'The server refuses overlapping bookings for the same booth, producer or seller, including setup and teardown buffers.', 'Times show in the studio’s time zone; the viewer’s zone appears on hover and focus.', 'Brands see only their own sessions; booth availability shows as free or busy, never other brands’ names.'],
    states: ['Conflict → alternatives offered', 'Hold expiring in 2 h → reminder', 'Studio closed day → greyed out'],
    links: ['B07', 'B12', 'B14'] } });

screens.push({ id: 'B14', title: 'Campaign detail', h: 2100, nav: 'Campaigns', crumbs: ['Brand portal', '<a href="B08.dc.html">Campaigns</a>', 'Vitamin C LIVE — Saturday'],
  badges: [badge('MVP'), chip('Scheduled', 'dark'), EX], actions: [btn('Message seller', { href: 'B17.dc.html' }), btn('Edit terms'), btn('Cancel campaign')],
  main: [
    card('Timeline', `<ol style="margin:0; padding-left:20px; display:flex; flex-direction:column; gap:6px; font-size:14px; line-height:1.5">${[['Published', 'Mon', 1], ['Seller accepted: Sarah Johnson', 'Tue', 1], ['Contract signed by Maya Chen and Sarah Johnson', 'Tue', 1], ['Booth reserved: Creator Hub Virginia · Beauty Booth 01', 'Tue', 1], ['Samples received: 4 of 4', 'Wed', 1], ['Producer assigned: Jordan P. (by Creator Hub)', 'Thu', 1], ['Seller check-in', 'Sat 6:15 PM', 0], ['LIVE on TikTok', 'Sat 7:00–10:00 PM', 0], ['Results imported', 'After the LIVE', 0], ['Reconciliation', 'After the returns window ([N] days)', 0], ['Performance report', 'After reconciliation', 0]].map(([t, d, done]) => `<li><b>${done ? 'Done' : 'Upcoming'}</b> · ${t} <span style="color:#3d3d3d">· ${d}</span></li>`).join('')}</ol>`),
    grid([
      card('Product', dl([['Product', '<a href="B06.dc.html">Vitamin C Face Serum</a>'], ['Samples', '4 at studio'], ['Stock', '10,000 units'], ['Target', '$10,000 GMV']])),
      card('Seller', dl([['Seller', '<a href="B10.dc.html">Sarah Johnson</a>'], ['Contract', 'v2 signed Tue · <a href="#contract">View</a>'], ['Arrival', '6:15 PM'], ['LIVE account', 'Set in contract: seller’s TikTok account or brand account']])),
      card('Studio', dl([['Location', 'Creator Hub Virginia'], ['Booth', 'Beauty Booth 01'], ['Producer', 'Jordan P. (assigned by Creator Hub)'], ['Kit', '2 cameras, ring light, 2 mics']])),
    ], 260),
    card('Payment terms · at example results', table(['Line', 'Basis', 'Amount', 'Paid by → to'], [
      ['Production / service fee', 'Fixed', '$750', 'Brand → Creator Hub'],
      ['Performance fee', '7% × $6,000 eligible attributable GMV', '$420', 'Brand → Creator Hub'],
      ['Seller base pay', '$30 × 3 h', '$90', 'Creator Hub → Seller'],
      ['Seller commission', '5% × $6,000 eligible attributable sales', '$300 (provisional)', 'Creator Hub → Seller'],
      ['Seller bonus', 'GMV ≥ $5,000: met', '$100', 'Creator Hub → Seller'],
    ], { min: 640 }), { right: prov('Example data') }),
    grid([
      card('Deliverables', col([check('3-hour LIVE, 7:00–10:00 PM', false), check('Demo the product at least every 20 minutes', false), check('Pin the product link throughout', false), check('Use approved selling points only', false), check('Producer closeout report within 2 h', false)], 0)),
      card('Status history', ul(['Draft · Mon 9:02 AM · Leo Park', 'Published · Mon 11:40 AM · Maya Chen', 'Recruiting · Mon 11:41 AM · system', 'Scheduled · Tue 4:15 PM · system'], { size: 13 })),
    ], 300),
    state('Confirm cancellation', 'Cancel “Vitamin C LIVE — Saturday”?', 'It is 52 hours before the LIVE. Under the example policy, 50% of the production fee ($375) applies. Sarah Johnson and Creator Hub Virginia are notified and the booth is released.', [btn('Keep campaign'), btn('Cancel campaign', { primary: true })]),
    grid([state('Edit terms', 'Changing money terms needs both signatures', 'The contract becomes v3; the booking stays held until Sarah re-signs or 24 h pass.'), state('Partial completion', 'The LIVE ended after 2 h 10 min', 'Producer logged a network outage. Base pay prorated per contract; dispute available for 7 days.')], 280),
  ].join(''),
  notes: { priority: 'MVP', purpose: 'Everything about one campaign: who, where, when, terms, progress and messages.', roles: 'Brand Owner, Brand Marketing Manager; matching views for seller (C10) and operations (O06).',
    rules: ['Timeline steps come from real events (signatures, receiving logs, check-in), never manual ticks by the brand.', 'Commission is provisional until returns are reconciled.', 'Cancellation shows the fee before confirming; fees follow the signed policy.', 'Edits to money terms create a new contract version.'],
    states: ['Seller cancels → re-match flow (B12) and brand notified', 'Samples missing at cutoff → reschedule or cancel', 'Partial completion → prorated per contract'],
    links: ['B06', 'B10', 'B12', 'B15', 'B17', 'C12 (Batch 2)', 'O06 (Batch 3)'] } });

screens.push({ id: 'B15', title: 'Analytics', h: 1800, nav: 'Analytics', crumbs: ['Brand portal', 'Analytics'],
  badges: [badge('MVP'), EX], actions: [btn('Export CSV')],
  main: [
    row([sel('Date range', ['Last 30 days', 'Last 7 days', 'Custom'], { grow: true }), sel('Campaign', ['All campaigns', 'Vitamin C LIVE — Saturday'], { grow: true }), sel('Seller', ['All sellers', 'Sarah Johnson'], { grow: true })], { gap: 12, align: 'flex-end' }),
    banner(`Sales data: manual import from the TikTok Shop report by Creator Hub · last updated Sun 9:12 AM ${prov('Manual')}`, `<span style="display:inline-flex; gap:8px; align-items:center; font-size:13px">${badge('P2')} Automatic sync where TikTok authorizes</span>`),
    grid([
      kpi('GMV', '$6,000', 'Merchandise sales attributed to the LIVE', 'Manual'),
      kpi('Orders', '150', '', 'Manual'),
      kpi('LIVE hours', '3', 'From the studio session log', 'Verified'),
      kpi('GMV / hour', '$2,000', '$6,000 ÷ 3 h'),
      kpi('Conversion rate', '—', 'Not in the imported report', 'Unavailable'),
      kpi('Average order value', '$40', '$6,000 ÷ 150 orders'),
      kpi('Refunds and cancellations', '4 orders · $160', 'Returns window still open', 'Manual'),
      kpi('Campaign cost', '$1,170', '$750 service + $420 performance fee'),
      kpi('Net sales', '$5,840', 'GMV − refunds and cancellations so far'),
    ], 200),
    grid([ph('Line chart · GMV per session over time', 200), ph('Bar chart · orders by LIVE hour (7, 8, 9 PM)', 200)], 320),
    card('Seller comparison', table(['Seller', 'Sessions', 'Hours', 'GMV', 'GMV / hour', 'Orders', 'AOV', 'Refund rate'], [['Sarah Johnson', '1', '3', '$6,000', '$2,000', '150', '$40', '2.7%']], { min: 720 })),
    card('Definitions', dl([['GMV', 'Value of customer orders in TikTok Shop attributed to the LIVE. The brand’s sales, not Vyralink or Creator Hub revenue.'], ['Eligible attributable sales', 'GMV minus refunded, cancelled and excluded orders, after the returns window. Base for commission and performance fee.'], ['Net sales', 'GMV minus refunds and cancellations known so far.'], ['Campaign cost', 'Fees invoiced by Vyralink / Creator Hub for this campaign.']])),
    grid([state('Delayed', 'Night Cream LIVE DROP results are not imported yet', 'Sessions show “Pending” until data arrives, expected within [N] hours after the LIVE.'), state('Attribution question', 'Think orders are missing?', 'Open a data review with the order IDs; finance holds the disputed amount until resolved.', [btn('Open data review')])], 280),
  ].join(''),
  notes: { priority: 'MVP', purpose: 'Show campaign results honestly, with their source and limits.', roles: 'Brand Owner, Brand Marketing Manager.',
    rules: ['Every metric shows source and last-updated time.', 'Metrics the source doesn’t provide show “Unavailable”, never zero or an estimate.', 'GMV / hour = GMV ÷ LIVE hours from the studio log.', 'Exports include the source column.'],
    states: ['Delayed → Pending with expected time', 'Attribution dispute → data review', 'No sessions in range → empty state'],
    links: ['B04', 'B14', 'B16'] } });

screens.push({ id: 'B16', title: 'Billing', h: 1700, nav: 'Billing', crumbs: ['Brand portal', 'Billing'],
  badges: [badge('MVP'), EX], actions: [btn('Dispute an invoice')],
  main: [
    banner('Customer payments for products are made in TikTok Shop and settled to you by TikTok Shop. They never pass through Vyralink and are not shown here.'),
    grid([
      card('Subscription', col([dl([['Plan', '[PLAN NAME]'], ['Price', '[PRICE] / month'], ['Renews', '[DATE]']]), row([btn('Change plan'), btn('Cancel plan', { ghost: true })], { gap: 8 })])),
      card('Payment method', col([dl([['Card', 'Ending 4242 (stored by the payment provider)'], ['Billing email', 'billing@glowskin.example']]), row([btn('Update card'), btn('Add bank transfer', { ghost: true })], { gap: 8 })])),
    ], 300),
    card('Invoices', table(['Invoice', 'Description', 'Basis', 'Amount', 'Status', 'Due'], [
      ['INV-1042', 'Vitamin C LIVE — production / service fee', 'Fixed per package', '$750.00', chip('Issued', 'outline'), 'Net 15'],
      ['INV-1043', 'Vitamin C LIVE — performance fee', '7% × $6,000 eligible attributable GMV', '$420.00', chip('Draft · after returns window'), '—'],
      ['INV-1031', 'Subscription', 'Plan', '[PRICE]', chip('Paid', 'dark'), 'Paid'],
      ['CR-0007', 'Credit note · Spring serum LIVE', '7% × $160 refunded after invoicing', '−$11.20', chip('Applied', 'dark'), '—'],
    ], { min: 860 })),
    card('Transaction history', table(['Date', 'Type', 'Reference', 'Amount'], [['Thu', 'Invoice issued', 'INV-1042', '$750.00'], ['Last month', 'Payment', 'INV-1031', '[PRICE]'], ['Last month', 'Credit applied', 'CR-0007', '−$11.20']], { min: 560 })),
    grid([
      state('Payment failed', 'Card ending 4242 was declined for INV-1042', 'Update the card or pay by bank transfer. Retry in 3 days; bookings stay confirmed for [GRACE] days.', [btn('Update card', { primary: true })]),
      state('Dispute', 'Dispute INV-1043', 'Choose the line, explain, attach evidence. Disputed amounts are paused, not cancelled; finance replies within [N] days.', [btn('Start dispute')]),
    ], 280),
  ].join(''),
  notes: { priority: 'MVP', purpose: 'Fees the brand owes Vyralink / Creator Hub, with the basis of every line.', roles: 'Brand Owner (Marketing Manager has no access by default; see B18).',
    rules: ['Cards are stored by the payment provider; Vyralink stores only a token and last 4 digits.', 'Performance fee is invoiced after the returns window; later refunds create credit notes.', 'GMV never appears as an amount owed.', 'Every invoice line names its basis.'],
    states: ['Payment failed → retry and grace period', 'Dispute → amount paused', 'No access → 403 with Request access'],
    links: ['B15', 'B18', 'F02 (Batch 4)'] } });

const bubble = (who, t, mine) => `<div style="align-self:${mine ? 'flex-end' : 'flex-start'}; max-width:75%; border:1px solid #c4c4c4; background:${mine ? '#f2f2f2' : '#ffffff'}; border-radius:8px; padding:10px 12px; font-size:13px; line-height:1.5"><b>${who}</b><br>${t}</div>`;
screens.push({ id: 'B17', title: 'Messages and notifications', h: 1400, nav: 'Messages', crumbs: ['Brand portal', 'Messages'],
  badges: [badge('MVP'), EX], actions: [btn('New message')],
  main: [
    tabs(['Messages', 'Notifications (3)'], 0),
    row([
      `<nav aria-label="Conversations" style="flex:1 1 240px; min-width:0; display:flex; flex-direction:column; gap:8px">${[['Sarah Johnson', 'See you Saturday. I’ll arrive 6:15.', 'Vitamin C LIVE', true], ['Creator Hub Virginia support', '4 samples received and stored.', 'Vitamin C LIVE', false], ['Priya Nair', 'Viewed your invitation.', 'Night Cream LIVE DROP', false]].map(([n, m, c, on]) => `<button type="button" style="text-align:left; border:1px solid ${on ? '#1a1a1a' : '#c4c4c4'}; background:${on ? '#f2f2f2' : '#ffffff'}; border-radius:8px; padding:10px 12px; font-family:inherit; font-size:13px; cursor:pointer; min-height:44px"><b>${n}</b><br>${m}<br><span style="color:#3d3d3d">${c}</span></button>`).join('')}</nav>`,
      `<section aria-label="Conversation with Sarah Johnson" style="flex:999 1 400px; min-width:0; border:1px solid #c4c4c4; border-radius:8px; padding:16px; display:flex; flex-direction:column; gap:10px">${bubble('Leo Park', 'Confirmed for Saturday. Samples are at the studio.', true)}${bubble('Sarah Johnson', 'See you Saturday. I’ll arrive 6:15 for the briefing.', false)}${area('Message', '', { hint: 'Phone numbers and emails are hidden automatically' })}${row([btn('Attach file'), btn('Send', { primary: true })], { gap: 8, justify: 'flex-end' })}</section>`,
      `<aside aria-label="Conversation context" style="flex:1 1 220px; min-width:0">${card('Campaign', dl([['Campaign', '<a href="B14.dc.html">Vitamin C LIVE</a>'], ['LIVE', 'Sat 7–10 PM'], ['Studio', 'CH Virginia · Booth 01']]))}</aside>`,
    ], { align: 'flex-start', gap: 16 }),
    card('Notifications', col([
      row([sel('Show', ['All', 'Approvals', 'Bookings', 'Campaigns', 'Billing'], { grow: true }), btn('Mark all as read')], { align: 'flex-end' }),
      table(['Type', 'Notification', 'When', ''], [['Approval', 'Spring serum LIVE needs your approval ($2,400 budget)', '2 h ago', btn('Review', { ghost: true, href: 'B08.dc.html' })], ['Booking', 'Beauty Booth 01 confirmed for Sat 7–10 PM', 'Tue', btn('Open', { ghost: true, href: 'B14.dc.html' })], ['Campaign', 'Results imported for Spring serum LIVE', 'Last week', btn('View', { ghost: true, href: 'B15.dc.html' })]], { min: 600 }),
    ])),
    grid([state('Send failed', 'Message not sent', 'Connection lost. Your text is kept.', [btn('Retry')]), state('Empty', 'No messages yet', 'Conversations start from a seller profile or a campaign.')], 280),
  ].join(''),
  notes: { priority: 'MVP', purpose: 'Talk to sellers and Creator Hub in the context of a campaign; see everything that needs attention.', roles: 'Brand Owner, Brand Marketing Manager.',
    rules: ['Every conversation is tied to a campaign or seller; history is kept for disputes.', 'Phone numbers and emails are masked to keep contracting on-platform.', 'Notification channels: in-app and email (MVP); SMS and push in Phase 2.', 'Approval notifications go only to users who can approve.'],
    states: ['Send failed → retry, text kept', 'Recipient left the organization → read-only thread', 'Empty → how to start'],
    links: ['B08', 'B14', 'B15', 'B18'] } });

screens.push({ id: 'B18', title: 'Team and settings', h: 2000, nav: 'Team', crumbs: ['Brand portal', 'Team and settings'],
  badges: [badge('MVP'), EX], actions: [btn('Invite member', { primary: true })],
  main: [
    tabs(['Members', 'Roles and permissions', 'Connected channels', 'Security', 'Notifications', 'Company verification'], 0),
    card('Members', col([
      table(['Name', 'Email', 'Role', 'Status', ''], [['Maya Chen', 'maya@glowskin.example', 'Brand Owner', chip('Active', 'dark'), '—'], ['Leo Park', 'leo@glowskin.example', 'Brand Marketing Manager', chip('Active', 'dark'), btn('Change role', { ghost: true })], ['—', 'dana@glowskin.example', 'Brand Marketing Manager', chip('Invited · expires in 6 days', 'outline'), btn('Resend', { ghost: true })]], { min: 720 }),
      row([field('Invite by email', '', { ph: 'name@company.com', grow: true }), sel('Role', ['Brand Marketing Manager', 'Brand Owner'], { grow: true }), btn('Send invite', { primary: true })], { align: 'flex-end', gap: 12 }),
    ])),
    card('Roles and permissions', table(['Action', 'Brand Owner', 'Brand Marketing Manager'], [
      ['Manage billing and payment methods', 'Yes', 'No'], ['Invite or remove members', 'Yes', 'No'], ['Create and edit products', 'Yes', 'Yes'], ['Create campaigns', 'Yes', 'Yes'], ['Publish over the budget threshold', 'Yes', 'Request approval'], ['Sign seller contracts', 'Yes', 'If delegated'], ['Cancel a Scheduled campaign', 'Yes', 'No'], ['View analytics', 'Yes', 'Yes'], ['Connect commerce channels (Phase 2)', 'Yes', 'No'],
    ], { min: 560, rowHead: true })),
    grid([
      card('Connected channels', col([dl([['TikTok Shop', 'GlowSkin Beauty Official'], ['Reporting mode', 'Manual (MVP)']]), row([btn('Connect account', { disabled: true }), badge('P2')], { gap: 8 }), p('Only data TikTok authorizes through its official access is synced. Vyralink cannot control your LIVE or your shop.', { size: 13, mute: true })])),
      card('Security', col([check('Require two-step verification for all members', true), dl([['Active sessions', '3 · <a href="#sessions">Review</a>'], ['Organizations', 'Members of several organizations switch from the top bar; permissions apply per organization.']])])),
    ], 300),
    card('Notification preferences', table(['Event', 'In-app', 'Email'], [['Approvals', check('In-app', true), check('Email', true)], ['Booking changes', check('In-app', true), check('Email', true)], ['Results imported', check('In-app', true), check('Email', false)], ['Invoices', check('In-app', true), check('Email', true)]], { min: 480, rowHead: true })),
    grid([state('Last owner', 'You can’t remove the only Brand Owner', 'Make someone else Brand Owner first.'), state('403 · no access', 'You don’t have access to Billing', 'Brand Marketing Managers can’t view billing. Ask Maya Chen (Brand Owner) for access.', [btn('Request access')])], 280),
  ].join(''),
  notes: { priority: 'MVP', purpose: 'Members, roles, channels, security and notification settings for one organization.', roles: 'Brand Owner (Marketing Manager: own notification settings only).',
    rules: ['Permissions are enforced on the server per organization and role; hidden buttons are not the control.', 'At least one Brand Owner must remain.', 'Role changes and removals are audit-logged (A09).', 'Invites expire after 7 days.'],
    states: ['Last owner → blocked with explanation', 'No permission → 403 with Request access', 'Invite bounced → Resend or edit email'],
    links: ['B02', 'B03', 'B16', 'A09 (Batch 4)'] } });

for (const s of screens) brandScreen(s);

// ---------------------------------------------------------------- overview pages (Main, IA)
const docPage = (inner) => `<div style="width:100%; max-width:1440px; margin:0 auto; ${FONT}; color:#1a1a1a; background:#ffffff; padding:48px; box-sizing:border-box; display:flex; flex-direction:column; gap:32px">${inner}</div>`;

const main = docPage([
  col([`<span style="font-size:13px; font-weight:800; letter-spacing:0.12em">VYRALINK + CREATOR HUB</span>`, `<h1 style="margin:0; font-size:44px; line-height:1.1">LIVE Commerce Blueprint</h1>`, p('Phase A · low-fidelity wireframes and business flows · Batch 1 of 6', { size: 18 }), row([prov('Example data throughout: not actual business results'), badge('MVP'), badge('P2'), badge('P3')], { gap: 8 })], 10),
  card('In this batch', grid([
    `<a href="MasterFlow.dc.html" style="display:flex; flex-direction:column; gap:4px; border:1px solid #1a1a1a; border-radius:8px; padding:16px; text-decoration:none; min-height:44px"><b>D1 · Master business flow</b><span style="font-size:13px">28 steps, 6 swimlanes, failure branches</span></a>`,
    `<a href="IA.dc.html" style="display:flex; flex-direction:column; gap:4px; border:1px solid #1a1a1a; border-radius:8px; padding:16px; text-decoration:none; min-height:44px"><b>D2 · Information architecture</b><span style="font-size:13px">8 roles, 4 portals, screen map</span></a>`,
    `<a href="brand/B04.dc.html" style="display:flex; flex-direction:column; gap:4px; border:1px solid #1a1a1a; border-radius:8px; padding:16px; text-decoration:none; min-height:44px"><b>D3 · Brand portal wireframes</b><span style="font-size:13px">B01–B18, linked by the sidebar in Play</span></a>`,
  ], 260)),
  card('Three businesses, one platform', grid([
    col([sub('Vyralink'), p('SaaS marketplace and management platform: onboarding, catalog, campaigns, matching, contracts, scheduling, payments, analytics.', { size: 13 })], 8),
    col([sub('Creator Hub'), p('Physical LIVE studios: booths, cameras, lighting, producers, control room, storage, check-in.', { size: 13 })], 8),
    col([sub('Managed LIVE services'), p('Planning, seller sourcing, training, production, TikTok Shop LIVE operations, reporting.', { size: 13 })], 8),
    col([sub('External · TikTok Shop'), p('Customer checkout, orders, refunds and settlement stay with TikTok Shop under the merchant’s agreement.', { size: 13 })], 8),
  ], 240)),
  card('Who pays whom · illustrative completed session', col([
    table(['Line', 'Basis', 'Amount', 'From → to', 'Whose revenue'], [
      ['Customer purchases (GMV)', '150 orders in TikTok Shop', '$6,000', 'Customers → GlowSkin Beauty via TikTok Shop', 'Brand’s sales (not Creator Hub revenue)'],
      ['Production / service fee', 'Fixed per package', '$750', 'GlowSkin Beauty → Creator Hub', 'Creator Hub revenue'],
      ['Performance fee', '7% × $6,000 eligible attributable GMV', '$420', 'GlowSkin Beauty → Creator Hub', 'Creator Hub revenue'],
      ['Seller base pay', '$30 / h × 3 h', '$90', 'Creator Hub → Sarah Johnson', 'Creator Hub expense'],
      ['Seller commission', '5% × $6,000 eligible attributable sales', '$300 (provisional)', 'Creator Hub → Sarah Johnson', 'Creator Hub expense'],
      ['Seller bonus', 'If the bonus condition is met', '$100', 'Creator Hub → Sarah Johnson', 'Creator Hub expense'],
    ], { min: 900 }),
    grid([kpi('Creator Hub revenue', '$1,170', '$750 + $420, before expenses'), kpi('Seller compensation', 'Up to $490', '$90 + $300 + $100, before adjustments'), kpi('Contribution before other costs', '$680', '$1,170 − $490; studio, staff and payment fees not yet deducted')], 240),
  ])),
  grid([
    card('Legend', col([
      row([badge('MVP'), badge('P2'), badge('P3'), `<span style="font-size:13px">Priority on every screen and feature</span>`], { gap: 8 }),
      row([prov('Live'), prov('Delayed'), prov('Manual'), prov('Imported'), prov('Verified'), prov('Self-reported'), prov('Unavailable')], { gap: 6 }),
      p('Data source tags sit next to every number. “Unavailable” is never shown as zero.', { size: 13, mute: true }),
      row([chip('Status'), chip('Confirmed', 'dark'), chip('Pending', 'outline'), chip('Needs action', 'alert')], { gap: 6 }),
      p('Dashed panels labelled “State ·” show error, empty and edge states. The dashed rail on the right of each screen holds its spec notes.', { size: 13, mute: true }),
    ])),
    card('Sample campaign · example data', dl([['Brand', 'GlowSkin Beauty'], ['Product', 'Vitamin C Face Serum · $40 · 10,000 units'], ['Type', 'TikTok LIVE · target $10,000 GMV'], ['Session', 'Saturday 7–10 PM'], ['Seller', 'Sarah Johnson · $30 / h + 5% + $100 bonus'], ['Studio', 'Creator Hub Virginia · Beauty Booth 01'], ['Producer', 'Assigned by Creator Hub']])),
  ], 380),
  card('Batch plan', table(['Batch', 'Deliverables', 'Contents', 'Status'], [
    ['1', 'D1 master flow · D2 IA · D3 brand portal', '1 flow, IA, B01–B18', chip('This batch', 'dark')],
    ['2', 'D4 creator portal · D8 mobile screens', 'C01–C27, mobile-first at 390 px', chip('Next', 'outline')],
    ['3', 'D5 Creator Hub operations', 'O01–O24 incl. LIVE Control Center', chip('Planned')],
    ['4', 'D6 finance and Super Admin · §9 AI matching', 'F01–F08, A01–A12, M01', chip('Planned')],
    ['5', '§10 21 business flowcharts · §11 edge cases · D7 journeys', '21 flows, 25 edge cases, happy and error paths', chip('Planned')],
    ['6', 'D9 component library · D10 developer handoff · §16 audit', 'Spec table for every screen', chip('Planned')],
  ], { min: 760 }), { right: p('Phase C high-fidelity UI follows wireframe approval.', { size: 13, mute: true }) }),
  card('Assumptions to confirm', ul([
    'Seller pay is paid by Creator Hub under the seller contract and is a Creator Hub expense (the brief lists it under Creator Hub finance), so it is never billed to the brand twice.',
    'The 5% seller commission is a Vyralink contract term, separate from any TikTok Shop affiliate commission; the contract says whether one replaces or reduces the other.',
    'The performance fee is invoiced after the returns window on eligible attributable GMV; later refunds create credit notes.',
    'Subscription prices, review SLA, hold window, payment timing and grace periods are not in the brief and show as [PLACEHOLDERS].',
    'MVP results are entered or imported from TikTok Shop reports; automatic sync is Phase 2 and only through access TikTok authorizes.',
    'The bonus condition “attributable GMV ≥ $5,000” and the cancellation policy are examples.',
    'IDs O23–O24 (seller roster, brand accounts), F01–F08 (finance) and A01–A12 (admin) were added to cover navigation items that the brief lists without screens.',
  ], { size: 14 })),
  card('Design system', p('Wireframes are grayscale on purpose. Your account has two design systems (ChatbotReply, ChatMint AI) made for other products; Phase C needs a Vyralink system, or you can choose one of those.', { size: 14 })),
].join(''));
out('project/Main.dc.html', doc('Blueprint overview', 1440, 3000, main));

const navCard = (title, items) => card(title, `<ul style="list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px">${items.map(([label, ids, pr]) => `<li style="display:flex; flex-wrap:wrap; gap:6px; align-items:center; justify-content:space-between; border-bottom:1px solid #e6e6e6; padding-bottom:8px; font-size:14px"><b>${label}</b><span style="display:inline-flex; gap:6px; align-items:center; font-size:12px; color:#3d3d3d">${ids}${[].concat(pr).map(badge).join('')}</span></li>`).join('')}</ul>`);
const ia = docPage([
  col([`<span style="font-size:13px; font-weight:800; letter-spacing:0.12em">DELIVERABLE 2</span>`, `<h1 style="margin:0; font-size:40px">Information architecture</h1>`, p('Roles, portals, navigation and the screens behind every menu item.', { size: 18 })], 8),
  card('Roles', table(['Role', 'Portal', 'Scope', 'Can (MVP)', 'Cannot'], [
    ['Brand Owner', 'Brand portal', 'Whole brand organization', 'Everything for the brand: billing, team, approvals, contracts', 'See other brands, operate studios'],
    ['Brand Marketing Manager', 'Brand portal', 'Brand organization', 'Products, campaigns, invitations, analytics', 'Billing, team roles, approve over threshold'],
    ['Creator / LIVE Seller', 'Creator portal (mobile first)', 'Own profile and jobs', 'Apply, accept, sign, check in, see earnings', 'See other sellers’ pay or brands’ invoices'],
    ['Creator Hub Location Manager', 'Operations portal', 'Assigned locations', 'Booths, bookings, staff, readiness, incidents', 'Other locations (unless assigned), platform settings'],
    ['Studio Producer', 'Operations portal', 'Assigned sessions', 'Check-in, checklists, control center, incidents, closeout', 'Bookings, pricing, finance'],
    ['Inventory Coordinator', 'Operations portal', 'Assigned locations', 'Receiving, sample inventory, storage, returns', 'Sessions, finance'],
    ['Finance Administrator', 'Operations portal · Finance', 'Creator Hub finance', 'Invoices, seller ledger, payouts, reconciliation', 'Edit session results without a data review'],
    ['Platform Super Administrator', 'Admin console', 'All organizations', 'Verifications, moderation, disputes, audit, flags', 'Act as a user without a logged, read-only impersonation'],
  ], { min: 1000, rowHead: true })),
  grid([
    navCard('Brand portal', [['Onboarding', 'B01 · B02 · B03', 'MVP'], ['Dashboard', '<a href="brand/B04.dc.html">B04</a>', 'MVP'], ['Products', '<a href="brand/B05.dc.html">B05</a> · <a href="brand/B06.dc.html">B06</a>', 'MVP'], ['Campaigns', '<a href="brand/B07.dc.html">B07</a> · <a href="brand/B08.dc.html">B08</a> · <a href="brand/B12.dc.html">B12</a> · <a href="brand/B14.dc.html">B14</a>', 'MVP'], ['Find Creators', '<a href="brand/B09.dc.html">B09</a> · <a href="brand/B10.dc.html">B10</a>', 'MVP'], ['· Compare', '<a href="brand/B11.dc.html">B11</a>', 'P2'], ['· AI matching', 'M01', 'P3'], ['LIVE Calendar', '<a href="brand/B13.dc.html">B13</a>', 'MVP'], ['Analytics', '<a href="brand/B15.dc.html">B15</a>', 'MVP'], ['Billing', '<a href="brand/B16.dc.html">B16</a>', 'MVP'], ['Messages', '<a href="brand/B17.dc.html">B17</a>', 'MVP'], ['Team · Settings', '<a href="brand/B18.dc.html">B18</a>', 'MVP']]),
    navCard('Creator portal', [['Onboarding', 'C01 · C02 · C03 · C04', 'MVP'], ['Dashboard', 'C08', 'MVP'], ['Find LIVE Jobs', 'C09 · C10', 'MVP'], ['My Applications', 'C11 · C12', 'MVP'], ['My LIVE Sessions', 'C13–C19', 'MVP'], ['Calendar', 'C13 · C26', 'MVP'], ['Academy', 'C05 · C06 · C07', ['MVP', 'P2']], ['Earnings', 'C20 · C21 · C22', ['MVP', 'P2']], ['Performance', 'C23', 'MVP'], ['Messages', 'C25', 'MVP'], ['Profile', 'C02 · C04 · C24', 'MVP'], ['Settings', 'C27 · C03', 'MVP']]),
    navCard('Creator Hub operations', [['Overview', 'O01', 'MVP'], ['· All locations', 'O02', 'P2'], ['LIVE Control Center', 'O14 · O15 · O16 · O17', ['MVP', 'P2']], ['Locations', 'O03', 'MVP'], ['Booths', 'O04 · O05', 'MVP'], ['Bookings', 'O06', 'MVP'], ['Producers', 'O07 · O08', 'MVP'], ['Inventory', 'O09 · O10 · O11 · O18', 'MVP'], ['Sellers', 'O23 · O12 · O13', 'MVP'], ['Brands', 'O24', 'MVP'], ['Finance', 'F01–F05', 'MVP'], ['· Profitability, expenses', 'F06 · F07 · F08', 'P2'], ['Reports', 'O19 · O20', 'P2'], ['Staff', 'O21', 'MVP'], ['Settings', 'O22', 'MVP']]),
    navCard('Super Admin console', [['Platform Overview', 'A01', 'MVP'], ['Organizations', 'A02', 'MVP'], ['Users', 'A03', 'MVP'], ['Verifications', 'A04', 'MVP'], ['Campaign Moderation', 'A05', 'MVP'], ['Commerce Integrations', 'A06', 'P2'], ['Payments', 'A07', 'MVP'], ['Disputes', 'A08', 'MVP'], ['Audit Logs', 'A09', 'MVP'], ['Security', 'A10', 'MVP'], ['Feature Flags', 'A11', 'MVP'], ['Platform Settings', 'A12', 'MVP']]),
  ], 300),
  card('How each role gets in', table(['Role', 'Entry path', 'Lands on'], [
    ['Brand Owner', 'B01 sign-up → verify email → B02 verification → B03 onboarding', 'B04'],
    ['Brand Marketing Manager', 'Email invite → set password or Google → accept invite', 'B04 (billing hidden)'],
    ['Creator / LIVE Seller', 'C01 sign-up → C02 profile → C03 identity and payout → C04 skills → C05 Academy', 'C08'],
    ['Creator Hub staff (manager, producer, inventory, finance)', 'Invited by a Location Manager or admin → set password, two-step verification', 'O01, menu filtered by role'],
    ['Platform Super Administrator', 'Provisioned by the platform team → single sign-on and two-step verification', 'A01'],
  ], { min: 760, rowHead: true })),
  card('Organization switching and permissions', ul([
    'One user can hold several memberships; each membership is an (organization, role) pair.',
    'The top-bar switcher lists memberships. Switching changes the menu, the data scope and the URL’s organization.',
    'The server checks organization and role on every request. Hiding a button is never the only control.',
    'A seller profile is personal, not an organization; the same person can also be invited into a brand organization.',
    'Creator Hub staff are scoped to locations; a Location Manager sees only assigned locations.',
    'Unauthorized access shows a 403 page with “Request access”, which notifies the organization’s owner.',
    'Super Admin impersonation is read-only by default, time-limited, and written to the audit log (A09).',
  ])),
  card('Screen inventory', table(['Portal', 'Screen IDs', 'Count', 'Batch'], [
    ['Brand portal', 'B01–B18', '18', '1 · this batch'], ['Creator portal and mobile', 'C01–C27', '27', '2'], ['Creator Hub operations', 'O01–O24 (O23–O24 added)', '24', '3'], ['Creator Hub finance', 'F01–F08 (added)', '8', '4'], ['Super Admin', 'A01–A12 (added)', '12', '4'], ['AI matching', 'M01', '1', '4'],
  ], { min: 640, rowHead: true })),
].join(''));
out('project/IA.dc.html', doc('Information architecture', 1440, 2900, ia));

// ---------------------------------------------------------------- master flow diagram
let mk = 0;
const arrowSvg = ({ left, top, w, h, d, head, dashed, aria }) => {
  const id = head ? `dc-arrow-head-filled-${++mk}` : '';
  const a11y = aria ? `role="img" aria-label="${aria}"` : 'aria-hidden="true"';
  return `<svg ${a11y} width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="position: absolute; left: ${left}px; top: ${top}px; width: ${w}px; height: ${h}px; overflow: visible; fill: none; stroke: #5c5c5c; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round${dashed ? '; stroke-dasharray: 6 6' : ''}">${head ? `<defs><marker id="${id}" orient="auto" markerWidth="5" markerHeight="5" refX="2" refY="2" overflow="visible"><path d="M0 0 L4 2 L0 4 Z" fill="#5c5c5c" stroke="none" style="stroke: none; fill: #5c5c5c; fill: context-stroke"/></marker></defs>` : ''}<path d="${d}"${head ? ` marker-end="url(#${id})"` : ''}></path></svg>`;
};
const hRight = (x, tipX, y, o = {}) => { const n = tipX - x, hh = o.head ? 4 : 0; return arrowSvg({ left: x, top: y - 4, w: n, h: 8, d: `M 0 4 L ${n - hh} 4`, ...o }); };
const vDown = (x, y, tipY, o = {}) => { const n = tipY - y, hh = o.head ? 4 : 0; return arrowSvg({ left: x - 4, top: y, w: 8, h: n, d: `M 4 0 L 4 ${n - hh}`, ...o }); };
const vLine = (x, y1, y2) => { const t = Math.min(y1, y2), n = Math.abs(y2 - y1); return arrowSvg({ left: x - 4, top: t, w: 8, h: n, d: `M 4 0 L 4 ${n}` }); };

const LANES = ['Brand', 'Vyralink platform', 'LIVE Seller', 'Creator Hub', 'TikTok Shop · external', 'Customer · external'];
const COLW = 240, CW = 176, CH = 112, X0 = 288, LANEH = 280;
const FW = X0 + 14 * COLW + CW + 64; // 3888
const S = (n, lane, title, detail, ids, o = {}) => ({ n, lane, title, detail, ids, ...o });
const part1 = [
  S(1, 0, 'Brand registers', 'Account and organization', 'B01 · MVP'),
  S(2, 1, 'Brand verification', 'Documents reviewed', 'B02 · A04 · MVP', { fail: '<b>If rejected:</b> brand fixes documents and resubmits (B02)' }),
  S(3, 0, 'Brand adds products', 'SKUs, claims, samples', 'B05 · B06 · MVP', { fail: '<b>If product or claim rejected:</b> edit and resubmit' }),
  S(4, 0, 'Connects commerce channel', 'TikTok Shop name; link in P2', 'B03 · B18', { fail: '<b>If connection fails:</b> retry, or keep manual reporting' }),
  S(5, 0, 'Creates campaign', 'Type, product, date, terms', 'B07 · MVP'),
  S(6, 0, 'Budget and approval', 'Owner approves over threshold', 'B07 · B08 · MVP', { fail: '<b>If declined:</b> back to Draft with comments' }),
  S(7, 1, 'Finds qualified sellers', 'Filters; AI match in P3', 'B09 · B11 · M01', { fail: '<b>If none qualify:</b> widen filters or Creator Hub sources sellers' }),
  S(8, 0, 'Invites or selects seller', 'Invite or accept application', 'B12 · MVP'),
  S(9, 2, 'Reviews and accepts job', 'Accept, decline or counter', 'C10 · C11 · MVP', { fail: '<b>If declined or expired (48 h):</b> invite next candidate' }),
  S(10, 1, 'Contract and terms confirmed', 'Both parties sign', 'B14 · C12 · MVP', { fail: '<b>If terms disputed:</b> counter-offer, then re-sign' }),
  S(11, 3, 'Location selected', 'Studio that fits the brief', 'B07 · O03 · MVP'),
  S(12, 3, 'Booth reserved', 'Hold becomes booking', 'O05 · O06 · MVP', { fail: '<b>If fully booked:</b> next slot or another location' }),
  S(13, 3, 'Products and samples received', 'Logged at receiving', 'O09 · O10 · MVP', { fail: '<b>If missing at cutoff:</b> notify brand; reschedule or cancel by policy' }),
  S(14, 3, 'Producer and equipment assigned', 'Rota and kit list', 'O07 · O08 · MVP', { fail: '<b>If producer unavailable:</b> reassign from pool; escalate' }),
  { conn: 'Continues in Part 2 at step 15', lane: 3 },
];
const part2 = [
  { conn: 'From Part 1 · step 14', lane: 3 },
  S(15, 2, 'Seller arrives, checks in', 'Code or QR at front desk', 'C15 · O12 · MVP', { fail: '<b>If no-show (+15 min):</b> backup seller or reschedule; policy applies' }),
  S(16, 3, 'Briefing and compliance check', 'Approved points only', 'C16 · O13 · MVP', { fail: '<b>If restricted claim found:</b> corrected brief before go-live' }),
  S(17, 3, 'Pre-LIVE technical test', 'Camera, audio, network, links', 'C17 · O13 · MVP', { fail: '<b>If test fails:</b> swap kit or backup booth; delay start, tell brand' }),
  S(18, 4, 'TikTok LIVE session', 'Seller hosts, Creator Hub produces', 'O14 · C18 · MVP', { ext: true, fail: '<b>If interrupted:</b> incident logged (O16); reconnect and resume' }),
  S(19, 5, 'Customers view products', 'Pinned products in the LIVE', 'Outside Vyralink', { ext: true }),
  S(20, 4, 'Purchase in TikTok Shop', 'Checkout and payment', 'Outside Vyralink', { ext: true }),
  S(21, 0, 'Merchant fulfils orders', 'In TikTok Shop Seller Center', 'Outside Vyralink', { ext: true }),
  S(22, 1, 'LIVE results imported', 'MVP manual or CSV; P2 sync', 'O17 · B15 · MVP', { fail: '<b>If delayed or missing:</b> mark Pending; manual entry with audit trail' }),
  S(23, 1, 'Fees and commission reconciled', 'After returns window', 'F05 · MVP', { fail: '<b>If attribution disputed:</b> dispute case (A08); hold the disputed part' }),
  S(24, 1, 'Seller pay processed', 'Through the payment provider', 'C20 · C22 · F04', { fail: '<b>If payout fails:</b> seller updates payout details; retry' }),
  S(25, 0, 'Performance report received', 'Results, costs, sources', 'B15 · MVP'),
  S(26, 1, 'Seller profile updated', 'Verified stats and rating', 'C23 · B10 · MVP'),
  S(27, 1, 'Next campaign suggested', 'MVP duplicate; P3 AI', 'B04 · B08'),
  S(28, 0, 'Repeat and scale', 'More LIVEs, more locations', 'B07 · P2 multi-location'),
];
const bands = [], arrows = [], cards = [], labels = [];
const cardLabel = (s) => (s.conn ? s.conn : `${s.n} · ${s.title}`);
const drawPart = (list, top, heading) => {
  labels.push(`<div style="position: absolute; left: 64px; top: ${top - 56}px; font-size: 22px; font-weight: 700; line-height: 32px">${heading}</div>`);
  LANES.forEach((name, k) => {
    const lt = top + k * LANEH;
    bands.push(`<div style="position: absolute; left: 64px; top: ${lt}px; width: ${FW - 128}px; height: ${LANEH}px; background: ${k % 2 ? '#ffffff' : '#f5f5f5'}; border-top: 1px solid #d4d4d4${k === LANES.length - 1 ? '; border-bottom: 1px solid #d4d4d4' : ''}"></div>`);
    labels.push(`<div style="position: absolute; left: 80px; top: ${lt + 16}px; width: 176px; font-size: 14px; font-weight: 700; line-height: 20px">${name}</div>`);
  });
  list.forEach((s, i) => {
    const lt = top + s.lane * LANEH;
    const left = X0 + i * COLW, ctop = lt + 20;
    s._left = left; s._cy = lt + 76;
    if (s.conn) {
      cards.push(`<div style="position: absolute; left: ${left}px; top: ${ctop + 24}px; width: ${CW}px; height: 64px; box-sizing: border-box; padding: 8px; display: flex; align-items: center; justify-content: center; text-align: center; background: #1a1a1a; color: #ffffff; border-radius: 32px; font-size: 13px; font-weight: 700; line-height: 18px">${s.conn}</div>`);
    } else {
      cards.push(`<div style="position: absolute; left: ${left}px; top: ${ctop}px; width: ${CW}px; height: ${CH}px; box-sizing: border-box; padding: 8px 10px; display: flex; align-items: center; justify-content: center; text-align: center; background: ${s.ext ? '#f7f7f7' : '#ffffff'}; border: ${s.ext ? '1px dashed #4d4d4d' : '1px solid #8c8c8c'}; border-radius: 10px; font-size: 13px; line-height: 18px; color: #1a1a1a"><span><b>${s.n} · ${s.title}</b><br>${s.detail}<br><span style="color: #3d3d3d; font-size: 12px">${s.ids}</span></span></div>`);
      if (s.fail) {
        const cx = left + CW / 2;
        arrows.push(vDown(cx, ctop + CH, lt + 179, { head: true, dashed: true, aria: `From ${s.n} · ${s.title} down to its failure path` }));
        cards.push(`<div style="position: absolute; left: ${left}px; top: ${lt + 180}px; width: ${CW}px; height: 84px; box-sizing: border-box; padding: 6px 8px; display: flex; align-items: center; justify-content: center; text-align: center; background: #f2f2f2; border: 1px dashed #4d4d4d; border-radius: 8px; font-size: 12px; line-height: 16px; color: #1a1a1a"><span>${s.fail}</span></div>`);
      }
    }
  });
  for (let i = 0; i + 1 < list.length; i++) {
    const a = list[i], b = list[i + 1];
    const sx = a._left + CW, tipX = b._left - 1, gx = sx + 32;
    const aria = `From ${cardLabel(a)} to ${cardLabel(b)}`;
    if (a._cy === b._cy) arrows.push(hRight(sx, tipX, a._cy, { head: true, aria }));
    else {
      arrows.push(hRight(sx, gx, a._cy));
      arrows.push(vLine(gx, a._cy, b._cy));
      arrows.push(hRight(gx, tipX, b._cy, { head: true, aria }));
    }
  }
};
drawPart(part1, 300, 'Part 1 · Steps 1–14 · onboarding, campaign, booking and studio preparation');
drawPart(part2, 2120, 'Part 2 · Steps 15–28 · LIVE day, sales, settlement and repeat business');
const FH = 2120 + 6 * LANEH + 64;
labels.push(`<div style="position: absolute; left: 64px; top: 64px; font-size: 40px; font-weight: 700; line-height: 48px">Master business flow</div>`);
labels.push(`<div style="position: absolute; left: 64px; top: 124px; width: 2300px; font-size: 16px; line-height: 24px; color: #3d3d3d">Deliverable 1 · how brands, Vyralink, LIVE sellers, Creator Hub, TikTok Shop and customers interact. Each step names its screens and priority. Example data: GlowSkin Beauty · Vitamin C Face Serum · Sarah Johnson · Creator Hub Virginia.</div>`);
cards.push(`<div style="position: absolute; left: 2560px; top: 72px; width: 240px; height: 72px; box-sizing: border-box; padding: 8px; display: flex; align-items: center; justify-content: center; text-align: center; background: #ffffff; border: 1px solid #8c8c8c; border-radius: 10px; font-size: 13px; line-height: 18px"><span><b>Step on Vyralink</b><br>screen IDs · priority</span></div>`);
cards.push(`<div style="position: absolute; left: 2848px; top: 72px; width: 240px; height: 72px; box-sizing: border-box; padding: 8px; display: flex; align-items: center; justify-content: center; text-align: center; background: #f7f7f7; border: 1px dashed #4d4d4d; border-radius: 10px; font-size: 13px; line-height: 18px"><span><b>External step</b><br>happens in TikTok Shop</span></div>`);
cards.push(`<div style="position: absolute; left: 3136px; top: 72px; width: 240px; height: 72px; box-sizing: border-box; padding: 8px; display: flex; align-items: center; justify-content: center; text-align: center; background: #f2f2f2; border: 1px dashed #4d4d4d; border-radius: 8px; font-size: 13px; line-height: 18px"><span><b>Failure path</b><br>and how it recovers</span></div>`);
labels.push(`<div style="position: absolute; left: 3424px; top: 80px; width: 400px; font-size: 13px; line-height: 20px; color: #3d3d3d">Solid arrows: main path. Dashed arrows: failure branch. Steps 19–21 happen outside Vyralink; Vyralink only imports their results.</div>`);
const flow = `<div style="position: relative; width: ${FW}px; height: ${FH}px; background: #ffffff; ${FONT}; color: #1a1a1a">
${[...bands, ...arrows, ...cards, ...labels].join('\n')}
</div>`;
out('project/MasterFlow.dc.html', doc('Master business flow', FW, FH, flow));

// ---------------------------------------------------------------- canvas.json
const boards = {};
const order = [];
const add = (file, b) => { boards[file] = b; order.push(file); };
add('Main.dc.html', { x: 0, y: 0, w: 1440, h: 3000, page: 'overview', expand: 'fill', title: 'Read me · blueprint overview' });
add('IA.dc.html', { x: 1520, y: 0, w: 1440, h: 2900, page: 'overview', expand: 'fill', title: 'D2 · Information architecture' });
add('MasterFlow.dc.html', { x: 0, y: 0, w: FW, h: FH, page: 'flows', title: 'D1 · Master business flow' });
let y = 0;
for (let r = 0; r < screens.length; r += 3) {
  const rowS = screens.slice(r, r + 3);
  const rh = Math.max(...rowS.map((s) => s.h));
  rowS.forEach((s, c) => add(`brand/${s.id}.dc.html`, { x: c * 1520, y, w: 1440, h: s.h, page: 'brand', expand: 'fill', is_interactive: true, title: `${s.id} · ${s.title}` }));
  y += rh + 120;
}
const canvas = {
  v: 3,
  createdOnFiles: { v: 1, at: new Date().toISOString().replace(/\.\d+Z$/, 'Z') },
  title: 'Vyralink + Creator Hub — LIVE Commerce Blueprint',
  launch: { view: 'canvas', page: 'overview' },
  pages: [{ id: 'overview', name: '1 · Overview and IA' }, { id: 'flows', name: '2 · Master business flow' }, { id: 'brand', name: '3 · Brand portal (B01–B18)' }],
  boards,
  order,
  notes: {
    overviewTitle: { x: 0, y: -300, text: 'Vyralink + Creator Hub · Batch 1', kind: 'title1', maxW: 2960, page: 'overview' },
    brandTitle: { x: 0, y: -300, text: 'D3 · Brand portal wireframes · B01–B18', kind: 'title1', maxW: 4480, page: 'brand' },
    brandTip: { x: 4560, y: 0, w: 320, text: 'Press Play on any brand screen: the sidebar and buttons move between screens. Dashed “State ·” panels show errors and edge cases; the dashed rail on the right holds spec notes.', fill: 'gray', page: 'brand' },
  },
  designSystems: [],
};
out('project/canvas.json', JSON.stringify(canvas, null, 2));
console.log(written.length, 'files');
