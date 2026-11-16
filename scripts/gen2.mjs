// Batch 2: Creator / LIVE Seller portal (C01–C27) as 390 px mobile frames + 3 desktop variants.
// Usage: node gen2.mjs <rootDir>   (reads and extends <rootDir>/project/canvas.json)
import fs from 'node:fs';
import path from 'node:path';
import { doc, FONT, inputStyle, btn, badge, chip, prov, field, sel, area, check, row, col, grid, card, kpi, table, ph, stepper, tabs, state, banner, ul, p, dl, sub, bell } from './lib.mjs';

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

// ---------------------------------------------------------------- links and spec notes
const href = (id) => (/^C\d\d$/.test(id) ? `${id}.dc.html` : /^B\d\d$/.test(id) ? `../brand/${id}.dc.html` : id === 'More' ? 'MoreMenu.dc.html' : null);
const linkTo = (id) => { const h = href(id); return h ? `<a href="${h}">${id}</a>` : id; };
const notesBox = (id, n, extraStyle) => `<aside aria-label="Spec notes for ${id}" style="${extraStyle}; min-width:0; border:1px dashed #8c8c8c; border-radius:8px; padding:16px; background:#fafafa; font-size:13px; line-height:1.5; display:flex; flex-direction:column; gap:14px; box-sizing:border-box">
<div style="display:flex; justify-content:space-between; align-items:center; gap:8px"><span style="font-size:11px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#3d3d3d">Spec notes · ${id}</span>${[].concat(n.priority).map(badge).join(' ')}</div>
${n.view ? `<div style="font-size:12px; color:#3d3d3d">${n.view}</div>` : ''}
<div><b>Purpose.</b> ${n.purpose}</div>
<div><b>Roles.</b> ${n.roles || 'Creator / LIVE Seller.'}</div>
<div style="display:flex; flex-direction:column; gap:6px"><b>Rules</b>${ul(n.rules, { size: 13, gap: 4 })}</div>
<div style="display:flex; flex-direction:column; gap:6px"><b>States and errors</b>${ul(n.states, { size: 13, gap: 4 })}</div>
<div><b>Goes to.</b> ${n.links.map(linkTo).join(' · ')}</div>
</aside>`;

// ---------------------------------------------------------------- mobile frame
const TABS = [['Home', 'C08'], ['Jobs', 'C09'], ['Sessions', 'C13'], ['Earnings', 'C20'], ['More', 'More']];
const tabIcon = {
  Home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"></path>',
  Jobs: '<rect x="3" y="7" width="18" height="13" rx="2"></rect><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>',
  Sessions: '<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 11h18"></path>',
  Earnings: '<path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>',
  More: '<path d="M4 6h16M4 12h16M4 18h16"></path>',
};
const tabBar = (active) => `<nav aria-label="Main" style="display:flex; border-top:1px solid #c4c4c4; background:#ffffff">${TABS.map(([l, id]) => { const on = l === active; return `<a href="${href(id)}"${on ? ' aria-current="page"' : ''} style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; min-height:60px; text-decoration:none; color:#1a1a1a; font-size:11px; font-weight:${on ? 700 : 500}; ${on ? 'background:#e6e6e6' : ''}"><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" stroke-width="${on ? 2.4 : 1.8}" stroke-linecap="round" stroke-linejoin="round">${tabIcon[l]}</svg>${l}</a>`; }).join('')}</nav>`;
const appBar = (title, back, right = '') => `<header style="display:flex; align-items:center; gap:4px; padding:4px 8px; border-bottom:1px solid #c4c4c4; min-height:56px; box-sizing:border-box">${back ? `<a href="${href(back) || back}" aria-label="Back" style="min-width:44px; min-height:44px; display:inline-flex; align-items:center; justify-content:center; text-decoration:none; font-size:24px; color:#1a1a1a">‹</a>` : '<span style="font-weight:800; letter-spacing:0.1em; font-size:14px; padding:0 8px">VYRALINK</span>'}<h1 style="margin:0; font-size:17px; font-weight:700; flex:1; min-width:0">${title}</h1>${right}</header>`;
const bellLink = `<a href="C25.dc.html" aria-label="Notifications, 2 unread" style="display:inline-flex; align-items:center; gap:4px; min-height:44px; min-width:44px; justify-content:center; text-decoration:none; font-size:12px; font-weight:700">${bell}<span>2</span></a>`;
const lrow = (title, subt, right = '', link) => { const inner = `<span style="display:flex; flex-direction:column; gap:2px; min-width:0; flex:1"><b style="font-size:14px">${title}</b>${subt ? `<span style="font-size:12px; color:#3d3d3d; line-height:1.4">${subt}</span>` : ''}</span>${right ? `<span style="display:inline-flex; gap:6px; align-items:center; flex-shrink:0">${right}</span>` : ''}`; const st = 'display:flex; gap:12px; align-items:center; padding:12px 0; border-bottom:1px solid #e6e6e6; min-height:44px; text-decoration:none; color:#1a1a1a'; return link ? `<a href="${href(link) || link}" style="${st}">${inner}</a>` : `<div style="${st}">${inner}</div>`; };
const list = (rows) => `<div style="display:flex; flex-direction:column">${rows.join('')}</div>`;
const sheet = (title, body) => `<div style="border:1px solid #1a1a1a; border-radius:16px 16px 8px 8px; padding:12px 16px 16px; display:flex; flex-direction:column; gap:12px; background:#ffffff"><span aria-hidden="true" style="align-self:center; width:40px; height:4px; border-radius:2px; background:#8c8c8c"></span><div style="font-size:11px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#3d3d3d">Bottom sheet</div><h2 style="margin:0; font-size:16px">${title}</h2>${body}</div>`;
const money = (label, value, basis) => `<div style="display:flex; justify-content:space-between; gap:12px; padding:8px 0; border-bottom:1px solid #e6e6e6; font-size:14px"><span style="display:flex; flex-direction:column; gap:2px"><span>${label}</span>${basis ? `<span style="font-size:12px; color:#3d3d3d">${basis}</span>` : ''}</span><b style="white-space:nowrap">${value}</b></div>`;

const mobile = (s) => {
  const body = `<div style="width:776px; min-height:${s.h}px; box-sizing:border-box; padding:24px; display:flex; gap:32px; align-items:flex-start; background:#ececec; ${FONT}; color:#1a1a1a">
<div style="width:390px; flex-shrink:0; background:#ffffff; border:1px solid #8c8c8c; border-radius:24px; overflow:hidden; display:flex; flex-direction:column">
${appBar(s.title, s.back, s.right ?? (s.back ? '' : bellLink))}
<main style="padding:16px; display:flex; flex-direction:column; gap:16px; flex:1">
${s.badges ? row(s.badges, { gap: 6 }) : ''}
${s.main}
</main>
${s.tab ? tabBar(s.tab) : ''}
</div>
${notesBox(s.id, { view: `Mobile · 390 px${s.tab ? ' · tab: ' + s.tab : ' · no tab bar (onboarding)'}`, ...s.notes }, 'flex:1 1 306px')}
</div>`;
  out(`project/creator/${s.file || s.id}.dc.html`, doc(`${s.id} ${s.title} (mobile)`, 776, s.h, body));
};

// ---------------------------------------------------------------- C01–C27
const M = [];
const onb = (i) => stepper(['Profile', 'Identity and payout', 'Skills', 'Academy'], i);

M.push({ id: 'C01', title: 'Become a LIVE Seller', h: 1500, notes: { priority: 'MVP', purpose: 'Create a personal LIVE Seller account.', roles: 'Visitor → Creator / LIVE Seller.',
  rules: ['Email and password, or Google (MVP). TikTok sign-in only if TikTok approves the integration (Phase 2).', 'Creates a personal creator profile, not an organization.', 'Must be 18 or older; checked again by the identity provider (C03).', 'Sign-up attempts are rate-limited per IP.'],
  states: ['Under 18 → blocked with explanation', 'Email already registered → sign in or reset', 'Email not verified → reminder banner'], links: ['C02', 'C03'] },
  main: [
    `<h2 style="margin:0; font-size:22px">Host LIVE shopping shows at Creator Hub studios</h2>`, p('Find paid LIVE jobs, train in the Academy and get paid through your payout account.', { mute: true }),
    btn('Continue with Google', { full: true }),
    `<div role="separator" style="display:flex; align-items:center; gap:12px; font-size:12px; color:#3d3d3d"><span style="flex:1; height:1px; background:#c4c4c4"></span>or<span style="flex:1; height:1px; background:#c4c4c4"></span></div>`,
    field('Full name', 'Sarah Johnson', { req: true }), field('Email', 'sarah.j@example.com', { req: true, type: 'email' }), field('Password', '', { req: true, type: 'password', hint: '12 or more characters' }),
    sel('Country', ['United States', 'Canada', 'United Kingdom'], { req: true }), field('State / region', 'Virginia'), field('Date of birth', '', { type: 'date', req: true, hint: 'You must be 18 or older' }),
    check('I agree to the <a href="#terms">Terms</a> and the <a href="#creator-agreement">Creator Agreement</a>', false),
    btn('Create account', { primary: true, full: true, href: 'C02.dc.html' }),
    state('Email verification', 'Check your inbox', 'Link sent to sarah.j@example.com. It expires in 24 hours.', [btn('Resend')]),
    state('Blocked', 'You must be 18 or older', 'You can’t create a LIVE Seller account yet.'),
  ].join('') });

M.push({ id: 'C02', title: 'Your profile', back: 'C01', h: 1800, notes: { priority: 'MVP', purpose: 'The profile brands see in discovery (B09) and on the profile page (B10).',
  rules: ['Photo must show your face; no other brands’ logos.', 'Followers and past results are labelled Self-reported until verified on Vyralink.', 'Rate expectation can be shown, or shown as “On request”.', 'Profile completeness is shown to brands.'],
  states: ['Photo rejected → reason and re-upload', 'TikTok handle already linked to another account → contact support', 'Leave mid-way → progress saved'], links: ['C03', 'B10'] },
  main: [
    onb(0), banner('Profile 40% complete'),
    row([ph('Photo', 88, '88px'), btn('Upload photo')], { gap: 12 }),
    field('Display name', 'Sarah Johnson', { req: true }), area('Bio', 'Bilingual beauty host. Skincare demos and live Q&amp;A.', { hint: 'Up to 300 characters' }), field('City', 'Richmond, VA'),
    sub('Categories'), row([check('Beauty', true), check('Skincare', true), check('Fashion', false), check('Electronics', false), check('Home', false)], { gap: 4 }),
    sub('Languages'), row([check('English', true), check('Spanish', true), check('Other', false)], { gap: 4 }),
    field('TikTok handle', '@sarah.lives (example)'), field('Followers', '85K', { hint: 'Shown to brands as Self-reported' }),
    grid([field('Rate per hour (USD)', '30', { type: 'number' }), field('Commission (%)', '5', { type: 'number' })], 150),
    sel('Show my rate to brands', ['Visible to verified brands', 'On request']),
    btn('Continue', { primary: true, full: true, href: 'C03.dc.html' }),
    state('Photo rejected', 'Face not visible', 'Use a clear photo of your face without sunglasses or other brands’ logos.', [btn('Upload again')]),
  ].join('') });

M.push({ id: 'C03', title: 'Identity and payout', back: 'C02', h: 1600, notes: { priority: 'MVP', purpose: 'Confirm who the seller is and where to pay them, using provider-hosted checks.',
  rules: ['Identity (photo ID and selfie) runs with an identity provider; Vyralink stores only the result.', 'Payout account is set up on the payment provider’s page; Vyralink stores a token and last 4 digits.', 'Tax form (W-9 in the US, W-8BEN elsewhere) collected by the payment provider where required.', 'Browsing and applying are allowed before verification; accepting a paid booking is not.'],
  states: ['Identity failed (name mismatch) → retry or support', 'Bank account could not be verified → add another', 'Tax form missing → payouts held, jobs still allowed'], links: ['C04', 'C27'] },
  main: [
    onb(1), banner('You can browse and apply now. To accept a paid booking, finish identity and payout.'),
    card('Identity', col([row([chip('Verified', 'dark')]), p('Photo ID and selfie checked by our identity provider. Vyralink keeps only the result.', { size: 13, mute: true })], 8)),
    card('Payout account', col([row([chip('Action needed', 'alert')]), p('Set up your bank account on the payment provider’s secure page. Vyralink never sees the full account number.', { size: 13, mute: true }), btn('Set up payout account', { primary: true, full: true })], 8)),
    card('Tax information', col([row([chip('Not started')]), p('US sellers: W-9. Others: W-8BEN. Collected by the payment provider where required.', { size: 13, mute: true }), btn('Add tax details', { full: true })], 8)),
    btn('Continue', { full: true, href: 'C04.dc.html' }),
    state('Payout setup failed', 'We couldn’t verify that bank account', 'Check the details or add a different account. Your job applications are not affected.', [btn('Try again')]),
  ].join('') });

M.push({ id: 'C04', title: 'LIVE skills and experience', back: 'C03', h: 1600, notes: { priority: 'MVP', purpose: 'Capture experience so brands and Creator Hub can match the seller to jobs.',
  rules: ['Everything here is Self-reported until sessions are completed on Vyralink.', 'No equipment needed: studios provide cameras, lighting and producers.', 'Sample LIVE link is reviewed by Creator Hub for new sellers (practice review).'],
  states: ['Sample link unreachable → ask for another', 'Skip → profile completeness lower'], links: ['C05', 'C26'] },
  main: [
    onb(2),
    sel('LIVE selling experience', ['Some experience (10–50 LIVEs)', 'New to LIVE selling', 'Experienced (50+ LIVEs)']),
    field('LIVE sessions hosted before Vyralink', '30', { type: 'number', hint: 'Self-reported' }),
    sub('Skills'), col([check('Product demos', true), check('Live Q&amp;A with viewers', true), check('Bilingual hosting', true), check('Makeup application on camera', false), check('Unboxing', false)], 0),
    field('Link to a past LIVE or clip', 'https://example.com/sarah-live-replay'),
    area('Best result so far', '“$4,950 in a 3-hour lip tint LIVE.”', { hint: 'Self-reported; verified results replace this later' }),
    btn('Continue to the Academy', { primary: true, full: true, href: 'C05.dc.html' }),
  ].join('') });

M.push({ id: 'C05', title: 'Creator Hub Academy', tab: 'More', h: 1400, notes: { priority: ['MVP', 'P2'], purpose: 'Courses that unlock jobs; required training per category.',
  rules: ['LIVE Fundamentals is required for every paid job.', 'Category courses (e.g. Beauty Claims Compliance) are required by jobs in that category.', 'Certificates can expire; jobs needing an expired one can’t be accepted.', 'Advanced certification is Phase 2.'],
  states: ['Certificate expiring in 30 days → reminder', 'Course required by an invite → shown at the top', 'Offline → downloaded lessons only'], links: ['C06', 'C07', 'C09'] },
  main: [
    banner('2 of 3 required courses done'),
    list([
      lrow('LIVE Fundamentals', 'Required for all jobs · passed', chip('Passed', 'dark')),
      lrow('Beauty Claims Compliance', 'Required for beauty jobs · renews in 11 months', chip('Passed', 'dark')),
      lrow('TikTok Shop LIVE tools', 'Required by Petal Co. lip tint job · 60% done', chip('In progress', 'outline'), 'C06'),
      lrow('In-studio practice LIVE', 'New sellers: 30-minute practice with a producer', btn('Book', { ghost: true })),
      lrow('Advanced: pacing and conversion', 'Advanced certification', badge('P2')),
    ]),
    state('Expiring', 'Beauty Claims Compliance expires in 30 days', 'Renew it to keep accepting beauty jobs.', [btn('Start renewal', { href: 'C06.dc.html' })]),
  ].join('') });

M.push({ id: 'C06', title: 'Lesson 3 of 6', back: 'C05', tab: 'More', h: 1500, notes: { priority: 'MVP', purpose: 'One training lesson: video, transcript, key points.',
  rules: ['Video has captions and a full transcript.', 'Progress saves per lesson; resume where you left off.', 'The assessment unlocks when all lessons are complete.'],
  states: ['Video fails to load → transcript still available, retry', 'Lesson locked → finish the previous one'], links: ['C05', 'C07'] },
  main: [
    `<span style="font-size:13px; color:#3d3d3d">Beauty Claims Compliance</span><h2 style="margin:0; font-size:20px">Words you can’t use on a LIVE</h2>`,
    ph('Video player · captions on', 200),
    card('Key points', ul(['Never say a product treats, cures or prevents a condition.', 'Only use the brand’s approved selling points.', 'If a viewer asks a medical question, suggest they ask a doctor.'], { size: 13 })),
    card('Transcript', p('“In this lesson we look at claims that sound harmless but count as medical claims…”', { size: 13, mute: true })),
    list([lrow('1 · Why claims matter', 'Done', chip('Done', 'dark')), lrow('2 · Approved selling points', 'Done', chip('Done', 'dark')), lrow('3 · Words you can’t use', 'Now', chip('Now', 'outline')), lrow('4 · Answering tricky questions', 'Locked', chip('Locked')), lrow('5 · Practice', 'Locked', chip('Locked')), lrow('6 · Final check', 'Assessment', chip('Locked'))]),
    btn('Mark complete and continue', { primary: true, full: true, href: 'C07.dc.html' }),
  ].join('') });

M.push({ id: 'C07', title: 'Final check', back: 'C06', tab: 'More', h: 1500, notes: { priority: ['MVP', 'P2'], purpose: 'Short assessment that grants the certificate.',
  rules: ['Pass mark 80%; questions shuffled from a pool.', 'Retake after 24 hours if failed.', 'Passing updates the profile (B10) and unlocks matching jobs immediately.', 'Advanced, proctored certification is Phase 2.'],
  states: ['Passed → certificate issued', 'Failed → lessons to review, retake time', 'Connection lost → answers saved, resume'], links: ['C05', 'C09', 'B10'] },
  main: [
    `<span style="font-size:13px; color:#3d3d3d">Beauty Claims Compliance · question 7 of 10</span>`,
    `<div role="progressbar" aria-valuenow="70" aria-valuemin="0" aria-valuemax="100" aria-label="Assessment progress" style="height:8px; background:#e6e6e6; border-radius:4px"><div style="width:70%; height:8px; background:#1a1a1a; border-radius:4px"></div></div>`,
    `<fieldset style="border:0; padding:0; margin:0; display:flex; flex-direction:column; gap:8px"><legend style="font-size:16px; font-weight:700; margin-bottom:8px">A viewer asks: “Will this serum clear my acne?” What do you say?</legend>${check('“Yes, most people see results in a week.”', false, { radio: 'q7' })}${check('“It has 15% vitamin C and is fragrance-free. For acne, please ask a doctor.”', true, { radio: 'q7' })}${check('“Dermatologists recommend it for acne.”', false, { radio: 'q7' })}${check('Ignore the question.', false, { radio: 'q7' })}</fieldset>`,
    btn('Next question', { primary: true, full: true }),
    state('Passed', '9 of 10 correct · certificate issued', 'Beauty jobs that need this certificate are now open to you.', [btn('Find beauty jobs', { href: 'C09.dc.html' })]),
    state('Not passed', '6 of 10 correct', 'Review lessons 3 and 4. You can retake the check in 24 hours.', [btn('Review lesson 3', { href: 'C06.dc.html' })]),
  ].join('') });

M.push({ id: 'C08', title: 'Hi, Sarah', tab: 'Home', h: 1500, badges: [EX], notes: { priority: 'MVP', purpose: 'What’s next, what needs doing, and what you’ve earned.',
  rules: ['Next session card appears from 7 days before.', 'To-dos come from real blockers (unsigned contract, unread briefing, missing payout account).', 'Earnings show Provisional until the returns window closes.'],
  states: ['No sessions → “Find LIVE jobs”', 'Blocker to-do → shown first', 'Data delayed → Delayed tag'], links: ['C14', 'C16', 'C09', 'C20', 'C05'] },
  main: [
    card('Next LIVE · Saturday', col([dl([['Job', 'Vitamin C LIVE · GlowSkin Beauty'], ['Time', '7:00–10:00 PM · arrive 6:15 PM'], ['Studio', 'Creator Hub Virginia · Beauty Booth 01'], ['Check-in opens', '5:15 PM']]), row([btn('Briefing', { href: 'C16.dc.html' }), btn('Directions', { href: 'C14.dc.html' })], { gap: 8 })])),
    card('To do', list([lrow('Read the product briefing', 'Before Sat 6:15 PM', '', 'C16'), lrow('Finish TikTok Shop LIVE tools', '60% · needed for 1 job', '', 'C06')])),
    grid([kpi('Earnings · provisional', '$482', 'Vitamin C LIVE, until returns close', 'Manual'), kpi('Next payout', '[DATE]', 'Bank ending 6789')], 150),
    card('New for you', list([lrow('Night Cream LIVE DROP', 'GlowSkin Beauty · Thu 6–8 PM · invited', chip('Invited', 'outline'), 'C10'), lrow('Lumen Skin night oil', 'Sun 3–5 PM · you applied', chip('Applied'), 'C11')]), { right: `<a href="C09.dc.html" style="font-size:13px">All jobs</a>` }),
  ].join('') });

const job = (title, lines, chips, link) => `<a href="${href(link) || '#'}" style="display:flex; flex-direction:column; gap:8px; border:1px solid #c4c4c4; border-radius:8px; padding:14px; text-decoration:none; color:#1a1a1a">${row(chips, { gap: 6 })}<b style="font-size:15px">${title}</b>${ul(lines, { size: 13, gap: 2 })}</a>`;
const jobsList = [
  job('Vitamin C LIVE — Saturday', ['GlowSkin Beauty · Vitamin C Face Serum', 'Creator Hub Virginia · 12 mi', 'Sat 7:00–10:00 PM · 3 h', '$30 / h + 5% commission · $100 bonus', 'Needs: Beauty Claims (you have it)'], [chip('Invited · 41 h left', 'outline')], 'C10'),
  job('Night Cream LIVE DROP', ['GlowSkin Beauty · Hydrating Night Cream', 'Creator Hub Virginia · 12 mi', 'Thu 6:00–8:00 PM · 2 h', '$30 / h + 6% commission · no bonus', 'Needs: Beauty Claims (you have it)'], [chip('Open')], 'C10'),
  job('Lip tint set LIVE', ['Petal Co. · Lip tint set', 'Creator Hub Virginia · 12 mi', 'Wed 7:00–9:00 PM · 2 h', '$25 / h + 7% commission', 'Needs: TikTok Shop LIVE tools (60% done)'], [chip('Training needed', 'alert')], 'C05'),
];
M.push({ id: 'C09', title: 'Find LIVE jobs', tab: 'Jobs', h: 1600, badges: [EX], notes: { priority: 'MVP', purpose: 'Browse open jobs and invitations that fit you.',
  rules: ['Each card shows brand, product, location, date, duration, base pay, commission, bonus and required training.', 'Jobs needing training you don’t have show “Training needed” and link to the course.', 'Sorted by your filters; personalized recommendations are Phase 3.', 'Only verified brands’ published campaigns appear.'],
  states: ['No jobs → widen filters or set availability (C26)', 'Payout not set up → Apply allowed, Accept blocked', 'Job filled while viewing → “No longer available”'], links: ['C10', 'C05', 'C26'] },
  main: [
    `<input type="search" aria-label="Search jobs" placeholder="Search brand or product" style="${inputStyle}">`,
    row([chip('Beauty', 'dark'), chip('Within 25 mi', 'outline'), chip('This week', 'outline'), chip('$25+ / h', 'outline'), chip('Training I have')], { gap: 6 }),
    sel('Sort by', ['Soonest', 'Highest base pay', 'Nearest']),
    ...jobsList,
    state('Empty', 'No jobs match', 'Try a wider distance, or add more availability so brands can invite you.', [btn('Edit availability', { href: 'C26.dc.html' })]),
  ].join('') });

M.push({ id: 'C10', title: 'Job detail', back: 'C09', tab: 'Jobs', h: 2600, badges: [chip('Invited · expires in 41 h', 'outline'), EX], notes: { priority: 'MVP', purpose: 'Everything a seller needs to decide, in plain terms.',
  rules: ['Must show: brand, product, location, date, duration, base pay, commission, bonus conditions, cancellation policy, required training, payment timing, responsibilities.', 'Pay terms here are the ones copied into the contract (C12).', 'Example earnings use the job’s own terms and are labelled as an example.', 'Accept is blocked if training or payout setup is missing, with the reason.'],
  states: ['Missing certificate → Accept disabled, link to course', 'Payout not set up → Accept disabled, link to C03', 'Job withdrawn by brand → read-only banner'], links: ['C11', 'C12', 'C05', 'C03'] },
  main: [
    `<h2 style="margin:0; font-size:20px">Vitamin C LIVE — Saturday</h2>`,
    card('Brand and product', dl([['Brand', 'GlowSkin Beauty · verified'], ['Product', 'Vitamin C Face Serum · $40'], ['Type', 'TikTok LIVE Shopping'], ['Goal', '$10,000 GMV (brand’s target)']])),
    card('Where and when', dl([['Studio', 'Creator Hub Virginia · Beauty Booth 01'], ['Address', '[STUDIO ADDRESS], Richmond, VA'], ['Date', 'Saturday'], ['LIVE', '7:00–10:00 PM · 3 hours'], ['Arrive', '6:15 PM for check-in and briefing']])),
    card('Pay', col([money('Base pay', '$90', '$30 / hour × 3 hours'), money('Commission', '5%', 'Of eligible attributable sales: orders TikTok Shop credits to this LIVE, minus refunds and cancellations after the returns window'), money('Bonus', '$100', 'If eligible GMV reaches $5,000'), `<div style="background:#f2f2f2; border-radius:6px; padding:12px; font-size:13px; line-height:1.5"><b>Example:</b> if eligible sales are $6,000 you’d earn $90 + $300 + $100 = <b>$490</b> before adjustments.</div>`], 0)),
    card('Payment timing', p('Paid to your payout account [N] days after the returns window closes and results are reconciled.', { size: 14 })),
    card('Cancellation policy', ul(['You can cancel free of charge until 72 hours before.', 'Cancelling within 72 hours lowers your reliability score.', 'No-show (not checked in 15 minutes after arrival time): booking cancelled, reliability affected; 2 no-shows can pause your account.', 'If the brand or studio cancels within 24 hours, you receive [N]% of base pay.'], { size: 13 })),
    card('Required training', list([lrow('LIVE Fundamentals', '', chip('Passed', 'dark')), lrow('Beauty Claims Compliance', '', chip('Passed', 'dark'))])),
    card('What you’re expected to do', ul(['Arrive by 6:15 PM and check in.', 'Read and acknowledge the product briefing.', 'Host the full 3 hours; demo the product at least every 20 minutes.', 'Use only approved selling points; never restricted claims.', 'Follow the producer’s cues; end the LIVE when cued.'], { size: 13 })),
    row([btn('Decline', { href: 'C11.dc.html' }), btn('Counter', { href: 'C11.dc.html' }), btn('Accept', { primary: true, href: 'C11.dc.html' })], { gap: 8 }),
    state('Blocked', 'You can’t accept yet', 'Set up your payout account first. It takes about 5 minutes.', [btn('Set up payout', { href: 'C03.dc.html' })]),
  ].join('') });

M.push({ id: 'C11', title: 'My applications', back: 'C10', tab: 'Jobs', h: 2000, badges: [EX], notes: { priority: 'MVP', purpose: 'Respond to invitations, apply to open jobs, and track every response.',
  rules: ['Statuses: Invited, Applied, Countered, Accepted, Booked, Declined, Expired, Withdrawn by brand.', 'Invitations expire after 48 hours (configurable).', 'Accept leads straight to the contract (C12); Booked only after both sign and the booth is confirmed.', 'A counter replaces the previous offer; only the latest can be accepted.'],
  states: ['Expired → read-only, brand can resend', 'Brand withdrew → explanation', 'Counter declined → original offer still open until expiry'], links: ['C10', 'C12', 'B12'] },
  main: [
    tabs(['Active (3)', 'Past'], 0),
    list([lrow('Vitamin C LIVE — Saturday', 'GlowSkin Beauty · Sat 7–10 PM', chip('Accepted · sign contract', 'dark'), 'C12'), lrow('Lumen Skin night oil', 'Sun 3–5 PM', chip('Applied')), lrow('Night Cream LIVE DROP', 'Thu 6–8 PM', chip('Invited', 'outline'), 'C10')]),
    sheet('Accept this job?', col([p('Vitamin C LIVE · Sat 7–10 PM · $30 / h + 5% + $100 bonus', { size: 13 }), p('Next you’ll review and sign the contract.', { size: 13, mute: true }), btn('Accept and review contract', { primary: true, full: true, href: 'C12.dc.html' })], 10)),
    sheet('Counter-offer', col([field('Base rate per hour (USD)', '35', { type: 'number' }), sel('Arrival time', ['6:30 PM', '6:15 PM']), area('Message to the brand', 'Happy to do it at $35/h since it’s a Saturday evening.'), btn('Send counter', { primary: true, full: true })], 10)),
    sheet('Decline', col([check('Not available that day', true, { radio: 'why' }), check('Pay is too low', false, { radio: 'why' }), check('Not my category', false, { radio: 'why' }), check('Other', false, { radio: 'why' }), btn('Decline job', { full: true })], 0)),
    sheet('Apply to an open job', col([area('Why you’re a good fit', 'I live 8 miles from the studio and host in Spanish too.'), check('I’m available for the full session', true), btn('Send application', { primary: true, full: true })], 10)),
  ].join('') });

M.push({ id: 'C12', title: 'Contract', back: 'C11', tab: 'Jobs', h: 2300, badges: [chip('Signed by GlowSkin Beauty · waiting for you', 'outline'), EX], notes: { priority: 'MVP', purpose: 'The agreed terms, signed by both sides before a booking is final.',
  rules: ['Built from the campaign terms (B07) and any agreed counter (B12).', 'Versioned: any change to money terms creates a new version needing both signatures.', 'E-signature records name, time, IP and version; both parties get a PDF.', 'Booking becomes final when both have signed and the booth is confirmed.'],
  states: ['Terms changed → “v3 needs your signature”', 'Signing failed → retry, nothing lost', 'Brand withdrew before signing → contract void'], links: ['C13', 'B14'] },
  main: [
    `<h2 style="margin:0; font-size:18px">Vitamin C LIVE — Saturday · version 2</h2>`,
    card('Parties', dl([['Seller', 'Sarah Johnson'], ['Brand', 'GlowSkin Beauty LLC'], ['Studio operator', 'Creator Hub (Virginia)'], ['Platform', 'Vyralink']])),
    card('Pay', col([money('Base pay', '$90', '$30 / h × 3 h, paid by Creator Hub'), money('Commission', '5%', 'Of eligible attributable sales'), money('Bonus', '$100', 'If eligible GMV ≥ $5,000'), p('Eligible attributable sales = orders TikTok Shop attributes to this LIVE, minus refunds, cancellations and excluded orders, counted after the returns window ([N] days).', { size: 12, mute: true }), p('If a TikTok Shop affiliate commission is also paid to you for these orders, it replaces this commission for those orders; you are not paid twice.', { size: 12, mute: true })], 0)),
    card('Other terms', ul(['Payment: [N] days after reconciliation, to your payout account.', 'Cancellation and no-show: as shown on the job (C10).', 'Claims: use approved selling points only; restricted claims may forfeit the commission.', 'Recording use: the brand may reuse clips from this LIVE for [TERM] days.', 'Disputes: raise within 7 days of results through Vyralink.'], { size: 13 })),
    card('Sign', col([check('I have read the contract', true), field('Type your full name', 'Sarah Johnson'), btn('Sign contract', { primary: true, full: true, href: 'C13.dc.html' }), btn('Download PDF', { full: true })])),
    state('New version', 'Version 3 needs your signature', 'The brand changed the arrival time to 6:00 PM. Nothing else changed.', [btn('Review changes')]),
  ].join('') });

M.push({ id: 'C13', title: 'My LIVE sessions', tab: 'Sessions', h: 1300, badges: [EX], notes: { priority: 'MVP', purpose: 'Upcoming sessions and their readiness, in order.',
  rules: ['Shows booked sessions and pending applications separately.', 'Times are in the studio’s time zone.', 'Reminders: 24 h and 2 h before (in-app and email; SMS Phase 2).'],
  states: ['Session moved → change highlighted until opened', 'Session cancelled → explanation and any compensation'], links: ['C14', 'C15', 'C19', 'C26'] },
  main: [
    tabs(['List', 'Calendar'], 0),
    sub('This week'),
    list([lrow('Sat · Vitamin C LIVE', '7:00–10:00 PM · Creator Hub Virginia · Booth 01', chip('Booked', 'dark'), 'C14')]),
    sub('Waiting for the brand'),
    list([lrow('Sun · Lumen Skin night oil', '3:00–5:00 PM · applied', chip('Applied'))]),
    `<a href="C19.dc.html" style="font-size:14px; min-height:44px; display:inline-flex; align-items:center">Completed sessions</a>`,
    state('Moved', 'Your Saturday LIVE moved to Beauty Booth 02', 'Same time and studio. Open to confirm you’ve seen it.', [btn('Got it')]),
  ].join('') });

M.push({ id: 'C14', title: 'Getting there', back: 'C13', tab: 'Sessions', h: 1500, notes: { priority: 'MVP', purpose: 'Address, arrival time and what to bring.',
  rules: ['Opens the phone’s map app for directions.', '“Running late” notifies the producer with your ETA.', 'Studio contact is in-app only.'],
  states: ['Location changed → banner', 'Running late → producer notified, ETA shown to them'], links: ['C15', 'C25'] },
  main: [
    ph('Map', 180), dl([['Studio', 'Creator Hub Virginia'], ['Address', '[STUDIO ADDRESS], Richmond, VA'], ['Booth', 'Beauty Booth 01'], ['Producer', 'Jordan P.'], ['Arrive', '6:15 PM · check-in opens 5:15 PM'], ['Parking and entrance', '[PARKING AND ENTRANCE DETAILS]']]),
    btn('Open in maps', { primary: true, full: true }),
    card('Bring', ul(['Photo ID', 'Plain-colored outfit; no other brands’ logos', 'Your phone, charged, if the LIVE runs on your TikTok account'], { size: 13 })),
    btn('I’m running late', { full: true }), btn('Message the studio', { full: true, href: 'C25.dc.html' }),
    sheet('Tell the producer', col([sel('I’ll arrive in', ['10 minutes', '20 minutes', '30 minutes or more']), btn('Send', { primary: true, full: true })], 10)),
  ].join('') });

M.push({ id: 'C15', title: 'Check in', back: 'C14', tab: 'Sessions', h: 1600, notes: { priority: 'MVP', purpose: 'Confirm arrival at the studio front desk.',
  rules: ['Check-in opens 60 minutes before the arrival time.', 'Show the code at the desk, or enter the desk code shown there.', 'Check-in time is the official arrival record (reliability, no-show).', 'Not checked in 15 minutes after arrival time: producer calls you and the backup process starts.'],
  states: ['Too early → opens at 5:15 PM', 'Wrong studio → shows the right address', 'Late → producer notified automatically'], links: ['C16', 'C17'] },
  main: [
    `<h2 style="margin:0; font-size:18px">Creator Hub Virginia · Sat 6:15 PM</h2>`,
    `<div role="img" aria-label="Check-in code VL-4827 as a scannable code (placeholder)" style="align-self:center; width:200px; height:200px; background:#e6e6e6; border:1px solid #8c8c8c; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:600">Scannable code</div>`,
    `<div style="text-align:center; font-size:22px; font-weight:800; letter-spacing:0.2em">VL-4827</div>`,
    p('Show this at the front desk, or enter the code shown at the desk:', { size: 13, mute: true }),
    field('Desk code', '', { ph: '6 characters' }), btn('Check in', { primary: true, full: true }),
    state('Checked in', '6:12 PM · you’re on time', 'Booth: Beauty Booth 01 · Producer: Jordan P. Next: read the briefing.', [btn('Open briefing', { primary: true, href: 'C16.dc.html' })]),
    state('Too early', 'Check-in opens at 5:15 PM', 'It’s 4:50 PM.'),
    state('Late', 'It’s 6:24 PM', 'We’ve let the producer know. Check in as soon as you arrive.'),
  ].join('') });

M.push({ id: 'C16', title: 'Product briefing', back: 'C15', tab: 'Sessions', h: 2100, badges: [EX], notes: { priority: 'MVP', purpose: 'What to say, what never to say, and the run of show.',
  rules: ['Content comes from the product’s approved selling points and restricted claims (B06).', 'Acknowledgement is required before the pre-LIVE checklist.', 'If the brand changes the briefing after acknowledgement, re-acknowledgement is required.', 'The producer runs a compliance check in parallel (O13).'],
  states: ['Briefing updated → acknowledge again', 'Briefing missing → producer and brand notified, start may be delayed'], links: ['C17', 'B06'] },
  main: [
    row([ph('Product', 72, '72px'), col([`<b>Vitamin C Face Serum</b>`, `<span style="font-size:13px">$40 · LIVE-only 15% off in TikTok Shop</span>`], 4)], { gap: 12 }),
    card('Say this', ul(['Contains 15% vitamin C', 'Fragrance-free formula', 'Use every morning before sunscreen', 'Returns follow TikTok Shop’s returns policy'], { size: 13 })),
    card('Never say', ul(['That it treats or clears acne, melasma or any condition', 'That it removes wrinkles or reverses ageing', '“Dermatologist recommended”', 'Results in a set number of days'], { size: 13 }), { style: 'border:2px solid #1a1a1a' }),
    card('Run of show', list([lrow('6:30 PM', 'Briefing with producer Jordan P.'), lrow('6:45 PM', 'Camera, audio and network test'), lrow('7:00 PM', 'Go LIVE · intro and offer'), lrow('Every 20 min', 'Product demo'), lrow('8:30 PM', 'Offer reminder'), lrow('9:55 PM', 'Wrap-up'), lrow('10:00 PM', 'End LIVE when the producer cues')])),
    card('Likely questions', ul(['“Is it OK for sensitive skin?” → “It’s fragrance-free. Patch test first, and ask a doctor if unsure.”', '“How long does a bottle last?” → “About [N] weeks with daily use.” (brand to confirm)'], { size: 13 })),
    check('I’ve read the briefing and will use approved claims only', true),
    btn('Continue to checklist', { primary: true, full: true, href: 'C17.dc.html' }),
  ].join('') });

M.push({ id: 'C17', title: 'Ready to go LIVE?', back: 'C16', tab: 'Sessions', h: 1600, notes: { priority: 'MVP', purpose: 'One checklist shared by seller and producer; LIVE starts only when all items pass.',
  rules: ['Items are owned by You or the Producer; you can only tick your own.', 'Vyralink cannot log in to TikTok or add products to a showcase; those steps happen in the TikTok app.', 'The producer gives the go signal; the app shows it.'],
  states: ['Network test failed → producer switches line or booth; start may move; brand notified', 'Item overdue at 6:55 PM → producer alerted'], links: ['C18', 'O13'] },
  main: [
    banner('6 of 8 done'),
    list([lrow('Checked in', '6:12 PM', chip('Done', 'dark')), lrow('Briefing acknowledged', 'You · 6:20 PM', chip('Done', 'dark')), lrow('TikTok account logged in on the studio phone', 'You · in the TikTok app', chip('Done', 'dark')), lrow('Serum added to your TikTok Shop showcase', 'You · in the TikTok app', chip('Done', 'dark')), lrow('Camera and audio test', 'Producer', chip('Done', 'dark')), lrow('Samples at booth (4)', 'Producer', chip('Done', 'dark')), lrow('Network test', 'Producer', chip('Pending', 'outline')), lrow('Compliance check', 'Producer', chip('Pending', 'outline'))]),
    btn('Waiting for producer', { full: true, disabled: true }),
    state('Problem', 'Network test failed', 'Jordan is switching to the backup line. Start may move to 7:10 PM; the brand has been told.'),
    state('Ready', 'Producer says: go LIVE at 7:00 PM', 'Start the LIVE in the TikTok app when Jordan cues you.', [btn('Open session', { primary: true, href: 'C18.dc.html' })]),
  ].join('') });

M.push({ id: 'C18', title: 'On air', back: 'C13', tab: 'Sessions', h: 1600, badges: [chip('LIVE', 'dark'), EX], notes: { priority: 'MVP', purpose: 'Calm, glanceable status during the LIVE.',
  rules: ['Vyralink cannot start, stop or control the TikTok LIVE; start and end happen in the TikTok app when the producer cues.', 'Numbers show their source: viewers aren’t available here; orders are entered by the producer (Manual).', 'Help request alerts the producer silently.'],
  states: ['Stream dropped → producer reconnecting, stay on set; incident logged (O16)', 'Break requested → producer approves', 'Session over → closeout pending'], links: ['C19', 'O14', 'O16'] },
  main: [
    `<div style="text-align:center; display:flex; flex-direction:column; gap:4px"><span style="font-size:13px; color:#3d3d3d">Elapsed</span><span style="font-size:40px; font-weight:800">1:24:10</span><span style="font-size:13px">of 3:00:00 · ends 10:00 PM</span></div>`,
    card('Producer cue', p('Next demo at 7:40 PM. Mention the 15% LIVE offer.', { size: 15 })),
    grid([kpi('Viewers', '—', 'See the TikTok app', 'Unavailable'), kpi('Orders', '64', 'Producer entry · 8:20 PM', 'Manual'), kpi('GMV', '—', 'After the LIVE', 'Delayed')], 100),
    btn('Ask producer for help', { primary: true, full: true }), btn('Request a 5-minute break', { full: true }),
    state('Stream dropped', 'The producer is reconnecting', 'Stay on set. If the LIVE restarts in TikTok, keep going from the last demo.'),
    state('Finished', 'LIVE ended at 10:00 PM', 'Producer closeout in progress. Results usually arrive within [N] hours.', [btn('See completed sessions', { href: 'C19.dc.html' })]),
  ].join('') });

M.push({ id: 'C19', title: 'Completed sessions', back: 'C13', tab: 'Sessions', h: 1500, badges: [EX], notes: { priority: 'MVP', purpose: 'Every finished session with its result and pay status.',
  rules: ['Results show their source (Manual, Imported, Verified).', 'Rate the brand after each session (1–5, optional comment); ratings visible after both sides rate or 7 days.', 'Disputes can be raised for 7 days after results arrive.'],
  states: ['Results pending → “Waiting for results”', 'Partial session → duration and contract outcome shown'], links: ['C21', 'C20', 'C23'] },
  main: [
    list([
      lrow('Vitamin C LIVE · GlowSkin Beauty', `Sat · 3 h · 150 orders · $6,000 ${prov('Manual')}`, chip('Provisional $482'), 'C21'),
      lrow('Lip tint set · Petal Co.', '2 months ago · 3 h · $4,950', chip('Paid', 'dark')),
      lrow('Night repair oil · Lumen Skin', 'Last month · 2 h · $3,600', chip('Paid', 'dark')),
    ]),
    sheet('Rate GlowSkin Beauty', col([`<fieldset style="border:0; padding:0; margin:0; display:flex; gap:4px; flex-wrap:wrap"><legend style="font-size:13px; font-weight:600; margin-bottom:6px">Your rating</legend>${[1, 2, 3, 4, 5].map((n) => check(String(n), n === 5, { radio: 'rate' })).join('')}</fieldset>`, area('Comment (optional)', 'Clear brief, samples ready on time.'), btn('Submit rating', { primary: true, full: true })], 8)),
    state('Partial session', 'A LIVE ended after 2 h 10 min', 'The producer logged a studio network outage. Pay follows your contract’s terms for interrupted sessions.'),
  ].join('') });

const ledger = list([
  lrow('Vitamin C LIVE · base pay', '$30 × 3 h (studio log)', `<b>$90</b> ${chip('Locked', 'dark')}`, 'C21'),
  lrow('Vitamin C LIVE · commission', '5% × $5,840 eligible so far', `<b>$292</b> ${chip('Provisional')}`, 'C21'),
  lrow('Vitamin C LIVE · bonus', 'Eligible GMV ≥ $5,000: met so far', `<b>$100</b> ${chip('Provisional')}`, 'C21'),
  lrow('Payout P-0012', 'Last month · bank ending 6789', `<b>$210</b> ${chip('Paid', 'dark')}`, 'C22'),
]);
M.push({ id: 'C20', title: 'Earnings', tab: 'Earnings', h: 1500, badges: [EX], notes: { priority: ['MVP', 'P2'], purpose: 'What you’ve earned, what’s still provisional, and when it’s paid.',
  rules: ['Ledger statuses: Provisional → Locked → Scheduled → Paid; plus Adjusted and On hold (dispute).', 'Base pay locks when studio hours are confirmed; commission and bonus lock after the returns window.', 'Paid by Creator Hub through the payment provider.', 'Instant payouts are Phase 2.'],
  states: ['Payout account missing → earnings held, banner', 'On hold → dispute link', 'No earnings yet → find jobs'], links: ['C21', 'C22', 'C03'] },
  main: [
    grid([kpi('Provisional', '$482', 'Until returns close [DATE]', 'Manual'), kpi('Locked, to be paid', '$0', 'Next payout [DATE]'), kpi('Paid this year', '$1,465', '6 sessions')], 110),
    card('Payout account', row([p('Bank ending 6789 · verified', { size: 14 }), btn('Change', { ghost: true, href: 'C03.dc.html' })], { justify: 'space-between' })),
    card('Ledger', ledger),
    state('Held', 'Payout account needs attention', 'Your bank asked to re-confirm the account. Earnings keep adding up; we pay once it’s fixed.', [btn('Fix payout account', { href: 'C03.dc.html' })]),
  ].join('') });

M.push({ id: 'C21', title: 'Pay breakdown', back: 'C20', tab: 'Earnings', h: 1800, badges: [chip('Provisional'), EX], notes: { priority: 'MVP', purpose: 'Show exactly how a session’s pay is calculated.',
  rules: ['Every line names its basis and source.', 'Commission = 5% × eligible attributable sales; eligible = GMV − refunds, cancellations and excluded orders.', 'Figures update as refunds arrive and lock when the returns window closes.', 'The brand’s performance fee uses the same eligible base.', 'A dispute holds only the disputed amount.'],
  states: ['Refund after lock → adjustment on the next payout', 'Dispute open → On hold', 'Results corrected → change shown with reason'], links: ['C20', 'C22', 'C25'] },
  main: [
    `<h2 style="margin:0; font-size:18px">Vitamin C LIVE · GlowSkin Beauty · Sat</h2>`,
    card('Sales', col([money('GMV attributed to the LIVE', '$6,000', `150 orders · TikTok Shop report`), money('Refunds and cancellations so far', '−$160', '4 orders'), money('Eligible attributable sales so far', '$5,840', 'Final after the returns window closes [DATE]')], 0), { right: prov('Manual') }),
    card('Your pay', col([money('Base pay', '$90', '$30 × 3 h confirmed by the studio log'), money('Commission', '$292', '5% × $5,840 (was $300 before refunds)'), money('Bonus', '$100', 'Eligible GMV $5,840 ≥ $5,000'), money('Adjustments', '$0', ''), money('<b>Estimated total</b>', '$482', 'Before any later refunds')], 0)),
    card('Timeline', list([lrow('Results imported', 'Sun 9:12 AM', chip('Done', 'dark')), lrow('Returns window closes', '[DATE]', chip('Waiting', 'outline')), lrow('Locked and scheduled', 'Next payout after lock'), lrow('Paid', 'Bank ending 6789')])),
    btn('Question this figure', { full: true }),
    sheet('Question this figure', col([sel('What looks wrong?', ['Orders are missing', 'Hours are wrong', 'Bonus not applied', 'Other']), area('Details', 'I counted 152 orders in my TikTok Shop dashboard.'), p('Only the amount in question is held while finance checks.', { size: 12, mute: true }), btn('Send to finance', { primary: true, full: true })], 10)),
  ].join('') });

M.push({ id: 'C22', title: 'Payouts', back: 'C20', tab: 'Earnings', h: 1400, badges: [EX], notes: { priority: ['MVP', 'P2'], purpose: 'Every payout with its status, and tax documents.',
  rules: ['Payouts run on a schedule set by Creator Hub finance (F04).', 'Failed payouts retry after the account is fixed; nothing is lost.', 'Year-end tax forms are issued by the payment provider where required.', 'Instant payout for a fee is Phase 2.'],
  states: ['Failed → reason and fix', 'Processing → expected arrival date'], links: ['C20', 'C03'] },
  main: [
    list([lrow('P-0013 · [DATE]', 'Vitamin C LIVE (after lock)', `<b>$482</b> ${chip('Scheduled', 'outline')}`), lrow('P-0012 · last month', 'Lumen Skin', `<b>$210</b> ${chip('Paid', 'dark')}`), lrow('P-0011 · 2 months ago', 'Petal Co. · retried after failure', `<b>$338</b> ${chip('Paid', 'dark')}`)]),
    state('Failed payout', 'The bank returned P-0011', 'Reason from the bank: account closed. Add a new payout account and we’ll send it again.', [btn('Update payout account', { primary: true, href: 'C03.dc.html' })]),
    card('Tax documents', list([lrow('Tax form on file', 'W-9 · via the payment provider', chip('On file', 'dark')), lrow('Year-end form', 'Issued by the payment provider where required', '')])),
    row([btn('Instant payout', { disabled: true }), badge('P2')], { gap: 8 }),
  ].join('') });

M.push({ id: 'C23', title: 'Performance', tab: 'More', h: 1500, badges: [EX], notes: { priority: 'MVP', purpose: 'The verified track record brands see.',
  rules: ['Only sessions completed on Vyralink count as Verified.', 'GMV / hour = GMV ÷ LIVE hours from studio logs.', 'Reliability = on-time check-ins ÷ booked sessions; cancellations within 72 h and no-shows count against it.', 'Same numbers appear on the brand-facing profile (B10).'],
  states: ['Fewer than 3 sessions → “Building your track record”', 'Result corrected → history note'], links: ['B10', 'C19', 'C24'] },
  main: [
    sel('Period', ['Last 90 days', 'All time']),
    grid([kpi('Sessions', '3', '', 'Verified'), kpi('LIVE hours', '8', '', 'Verified'), kpi('GMV', '$14,550', '', 'Verified'), kpi('GMV / hour', '$1,819', '$14,550 ÷ 8 h'), kpi('Reliability', '100%', '3 of 3 on time'), kpi('Brand rating', '4.9', '3 ratings')], 150),
    ph('Chart · GMV per session', 160),
    `<a href="../brand/B10.dc.html" style="font-size:14px; min-height:44px; display:inline-flex; align-items:center">See your profile as brands see it</a>`,
  ].join('') });

M.push({ id: 'C24', title: 'Portfolio and reviews', tab: 'More', h: 1500, badges: [EX], notes: { priority: 'MVP', purpose: 'Clips and reviews that help brands choose you.',
  rules: ['Upload only clips you have the right to share; if a clip shows a brand’s product, that brand must allow it.', 'You can reply to a review once; replies are public.', 'Report a review that breaks the rules; it stays visible until moderated (A05).'],
  states: ['Clip rejected (rights unclear) → reason', 'Upload failed → retry'], links: ['B10', 'C23'] },
  main: [
    grid([ph('Clip 1', 160), ph('Clip 2', 160), ph('Clip 3', 160), ph('Add clip', 160)], 150),
    check('I have the right to share these clips', true),
    sel('Portfolio visibility', ['Verified brands', 'Only brands I’ve worked with']),
    card('Reviews', col([p('“Prepared, on time, and kept every claim inside our brief.” · Lumen Skin', { size: 13 }), row([btn('Reply'), btn('Report', { ghost: true })], { gap: 8 }), p('“Great with live questions in Spanish and English.” · Petal Co.', { size: 13 })], 10)),
  ].join('') });

M.push({ id: 'C25', title: 'Inbox', tab: 'More', h: 1300, badges: [EX], notes: { priority: 'MVP', purpose: 'Messages with brands and the studio, plus every notification.',
  rules: ['Threads are tied to a job or session.', 'Phone numbers and emails are masked.', 'Notification channels set in Settings (C27).'],
  states: ['Send failed → retry, text kept', 'Empty → how messages start'], links: ['C27', 'C12', 'C15', 'C22'] },
  main: [
    tabs(['Messages', 'Notifications (2)'], 1),
    list([lrow('Contract ready to sign', 'Vitamin C LIVE · Tue', '', 'C12'), lrow('Check-in opens at 5:15 PM today', 'Creator Hub Virginia · Sat', '', 'C15'), lrow('Payout P-0012 sent: $210', 'Last month', '', 'C22'), lrow('New invitation: Night Cream LIVE DROP', 'GlowSkin Beauty', '', 'C10')]),
    sub('Messages'),
    list([lrow('GlowSkin Beauty · Leo Park', 'Confirmed for Saturday. Samples are at the studio.'), lrow('Creator Hub Virginia', 'Parking: use the rear lot after 6 PM.')]),
  ].join('') });

M.push({ id: 'C26', title: 'Availability', tab: 'More', h: 1700, notes: { priority: 'MVP', purpose: 'Tell brands when you can be booked.',
  rules: ['Weekly pattern plus blocked dates.', 'Booked slots can’t be removed here; cancel the booking instead (policy applies).', 'Brands see Available or Busy, never the reason.', 'Times are in your time zone.'],
  states: ['Removing a booked slot → blocked with explanation', 'No availability → you won’t receive invitations'], links: ['C09', 'C13', 'C10'] },
  main: [
    sel('Time zone', ['Eastern Time (US)', 'Central Time (US)']),
    table(['Day', 'Morning', 'Afternoon', 'Evening'], ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => [d, check(sr(d + ' morning'), d === 'Sat'), check(sr(d + ' afternoon'), d === 'Sat' || d === 'Sun'), check(sr(d + ' evening'), !['Tue', 'Thu'].includes(d))]), { min: 300, rowHead: true }),
    card('Blocked dates', col([lrow('Dec 24–26', 'Holiday', btn('Remove', { ghost: true })), btn('Add blocked dates')], 8)),
    sel('Most LIVEs per week', ['3', '1', '2', '5', 'No limit']), sel('Travel distance', ['Up to 25 miles', 'Up to 50 miles']),
    state('Booked', 'You’re booked Saturday 7–10 PM', 'To free this time, cancel the booking from the session. The cancellation policy applies.'),
  ].join('') });

M.push({ id: 'C27', title: 'Settings', tab: 'More', h: 1500, notes: { priority: 'MVP', purpose: 'Account, security, payout, notifications and privacy.',
  rules: ['Two-step verification can be required by Creator Hub for sellers with bookings.', 'Account deletion is blocked while there are bookings or unpaid earnings.', 'If the user is also a member of a brand organization, switch accounts from here.'],
  states: ['Delete blocked → what to finish first', 'Email change → confirm both addresses'], links: ['C03', 'C25', 'C02'] },
  main: [
    list([lrow('Personal details', 'Name, email, phone', '', 'C02'), lrow('Sign-in and security', 'Two-step verification on', ''), lrow('Payout and tax', 'Bank ending 6789 · W-9 on file', '', 'C03'), lrow('Privacy', 'Profile visible to verified brands · rate on request', '')]),
    card('Notifications', table(['Event', 'In-app', 'Email'], [['Invitations', true, true], ['Contract and booking changes', true, true], ['Session reminders', true, false], ['Payouts', true, true]].map(([e, a, b]) => [e, check(sr(e + ' in-app'), a), check(sr(e + ' email'), b)]), { min: 300, rowHead: true })),
    card('Accounts', p('You’re not a member of any brand organization. If you join one, switch between accounts here.', { size: 13 })),
    btn('Sign out', { full: true }), btn('Delete account', { full: true, ghost: true }),
    state('Can’t delete yet', 'You have 1 upcoming booking and $482 unpaid', 'Finish or cancel the booking and wait for the final payout first.'),
  ].join('') });

// More menu (navigation sheet behind the "More" tab)
M.push({ id: 'More', file: 'MoreMenu', title: 'More', tab: 'More', h: 1000, notes: { priority: 'MVP', purpose: 'Mobile home for the creator menu items that don’t fit the 5-tab bar.',
  rules: ['Tabs: Home, Jobs, Sessions, Earnings, More. More holds the remaining items of the desktop sidebar.', 'Badges show counts (unread, actions needed).'], states: ['Unread messages → count badge'], links: ['C11', 'C26', 'C05', 'C23', 'C24', 'C25', 'C02', 'C27'] },
  main: list([lrow('My applications', '3 active', '', 'C11'), lrow('Availability', 'Sat and Sun open', '', 'C26'), lrow('Academy', '1 course in progress', '', 'C05'), lrow('Performance', '', '', 'C23'), lrow('Portfolio and reviews', '', '', 'C24'), lrow('Inbox', '2 unread', chip('2', 'dark'), 'C25'), lrow('Profile', '', '', 'C02'), lrow('Settings', '', '', 'C27'), lrow('Help', '', '')]) });

for (const s of M) mobile(s);

// ---------------------------------------------------------------- desktop variants
const CNAV = [['Dashboard', 'C08'], ['Find LIVE Jobs', 'C09'], ['My Applications', 'C11'], ['My LIVE Sessions', 'C13'], ['Calendar', 'C26'], ['Academy', 'C05'], ['Earnings', 'C20'], ['Performance', 'C23'], ['Messages', 'C25'], ['Profile', 'C02'], ['Settings', 'C27']];
const desktop = (s) => {
  const navHref = (id) => (s.desktopIds.includes(id) ? `${id}-desktop.dc.html` : `${id}.dc.html`);
  const body = `<div style="width:100%; max-width:1440px; margin:0 auto; ${FONT}; color:#1a1a1a; background:#ffffff; display:flex; flex-direction:column">
<header style="display:flex; flex-wrap:wrap; align-items:center; gap:16px; padding:12px 24px; border-bottom:1px solid #c4c4c4">
<a href="C08-desktop.dc.html" style="font-weight:800; letter-spacing:0.1em; text-decoration:none; color:#1a1a1a; font-size:16px">VYRALINK</a>
<span style="font-size:14px; font-weight:600; border:1px solid #8c8c8c; border-radius:6px; padding:10px 12px">Sarah Johnson · LIVE Seller</span>
<input type="search" aria-label="Search jobs" placeholder="Search jobs, brands, products" style="${inputStyle}; flex:1 1 240px; width:auto">
${bellLink}
</header>
<div style="display:flex; flex-wrap:wrap; align-items:stretch">
<nav aria-label="Creator navigation" style="flex:1 1 220px; min-width:0; background:#f7f7f7; border-right:1px solid #c4c4c4; padding:16px 12px; display:flex; flex-direction:column; gap:4px; box-sizing:border-box">
${CNAV.map(([l, id]) => { const on = l === s.nav; return `<a href="${navHref(id)}"${on ? ' aria-current="page"' : ''} style="display:flex; align-items:center; min-height:44px; padding:0 12px; border-radius:6px; text-decoration:none; color:#1a1a1a; font-size:14px; font-weight:${on ? 700 : 500}; background:${on ? '#e0e0e0' : 'transparent'}">${l}</a>`; }).join('\n')}
</nav>
<main style="flex:999 1 560px; min-width:0; padding:32px; display:flex; flex-direction:column; gap:24px; box-sizing:border-box">
<div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center"><span style="font-size:12px; font-weight:700; border:1px solid #1a1a1a; border-radius:4px; padding:2px 6px">${s.id}</span><h1 style="margin:0; font-size:28px">${s.title}</h1>${EX}<span style="font-size:13px; color:#3d3d3d">Desktop · <a href="${s.id}.dc.html">mobile version</a></span></div>
<div style="display:flex; flex-wrap:wrap; gap:24px; align-items:flex-start">
<div style="flex:999 1 560px; min-width:0; display:flex; flex-direction:column; gap:24px">${s.main}</div>
${notesBox(s.id, s.notes, 'flex:1 1 280px')}
</div>
</main>
</div>
</div>`;
  out(`project/creator/${s.id}-desktop.dc.html`, doc(`${s.id} ${s.title} (desktop)`, 1440, s.h, body));
};
const D = ['C08', 'C09', 'C20'];
const dNotes = (id, extra) => ({ ...M.find((m) => m.id === id).notes, view: `Desktop · 1440 px. ${extra}` });
desktop({ id: 'C08', title: 'Dashboard', nav: 'Dashboard', h: 1300, desktopIds: D, notes: dNotes('C08', 'Same content as mobile; two columns.'),
  main: [
    row([
      card('Next LIVE · Saturday', col([dl([['Job', 'Vitamin C LIVE · GlowSkin Beauty'], ['Time', '7:00–10:00 PM · arrive 6:15 PM'], ['Studio', 'Creator Hub Virginia · Beauty Booth 01'], ['Check-in opens', '5:15 PM']]), row([btn('Briefing', { href: 'C16.dc.html' }), btn('Directions', { href: 'C14.dc.html' })], { gap: 8 })]), { style: 'flex:2 1 420px' }),
      card('To do', ul(['Read the product briefing · before Sat 6:15 PM', 'Finish TikTok Shop LIVE tools · 60%'], { size: 14 }), { style: 'flex:1 1 280px' }),
    ], { align: 'stretch', gap: 24 }),
    grid([kpi('Earnings · provisional', '$482', 'Until returns close', 'Manual'), kpi('Next payout', '[DATE]', 'Bank ending 6789'), kpi('Verified GMV / hour', '$1,819', 'Last 90 days', 'Verified'), kpi('Reliability', '100%', '3 of 3 on time')], 200),
    card('New for you', table(['Job', 'Brand', 'When', 'Pay', 'Status'], [['<a href="C10.dc.html">Night Cream LIVE DROP</a>', 'GlowSkin Beauty', 'Thu 6–8 PM', '$30 / h + 6%', chip('Invited', 'outline')], ['Lumen Skin night oil', 'Lumen Skin', 'Sun 3–5 PM', '$28 / h + 5%', chip('Applied')]], { min: 640 }), { right: `<a href="C09-desktop.dc.html" style="font-size:14px">All jobs</a>` }),
  ].join('') });
desktop({ id: 'C09', title: 'Find LIVE jobs', nav: 'Find LIVE Jobs', h: 1300, desktopIds: D, notes: dNotes('C09', 'Filters move to a left column; cards become a grid.'),
  main: row([
    `<aside aria-label="Filters" style="flex:1 1 240px; min-width:0; border:1px solid #c4c4c4; border-radius:8px; padding:16px; display:flex; flex-direction:column; gap:12px">${[sub('Filters'), sel('Category', ['Beauty', 'Any']), sel('Distance', ['Within 25 miles', 'Within 50 miles']), sel('When', ['This week', 'Next 30 days']), field('Min. base pay per hour', '$25'), check('Only jobs I’m trained for', false), btn('Apply', { primary: true })].join('')}</aside>`,
    col([sel('Sort by', ['Soonest', 'Highest base pay', 'Nearest']), grid(jobsList, 280)], 16).replace('min-width:0', 'min-width:0; flex:999 1 480px'),
  ], { align: 'flex-start', gap: 24 }) });
desktop({ id: 'C20', title: 'Earnings', nav: 'Earnings', h: 1300, desktopIds: D, notes: dNotes('C20', 'Ledger becomes a table with filters and export.'),
  main: [
    grid([kpi('Provisional', '$482', 'Until returns close [DATE]', 'Manual'), kpi('Locked, to be paid', '$0', 'Next payout [DATE]'), kpi('Paid this year', '$1,465', '6 sessions'), kpi('Payout account', 'Ending 6789', 'Verified')], 200),
    row([sel('Period', ['This year', 'Last 90 days'], { grow: true }), sel('Status', ['All', 'Provisional', 'Locked', 'Paid', 'On hold'], { grow: true }), btn('Export CSV')], { align: 'flex-end', gap: 12 }),
    table(['Date', 'Session', 'Line', 'Basis', 'Amount', 'Status'], [
      ['Sat', '<a href="C21.dc.html">Vitamin C LIVE</a>', 'Base pay', '$30 × 3 h (studio log)', '$90', chip('Locked', 'dark')],
      ['Sat', 'Vitamin C LIVE', 'Commission', '5% × $5,840 eligible so far', '$292', chip('Provisional')],
      ['Sat', 'Vitamin C LIVE', 'Bonus', 'Eligible GMV ≥ $5,000', '$100', chip('Provisional')],
      ['Last month', 'Lumen Skin', 'Payout P-0012', 'Bank ending 6789', '$210', chip('Paid', 'dark')],
    ], { min: 860 }),
  ].join('') });

// ---------------------------------------------------------------- canvas.json (merge)
const cpath = path.join(ROOT, 'project/canvas.json');
const canvas = JSON.parse(fs.readFileSync(cpath, 'utf8'));
if (!canvas.pages.some((pg) => pg.id === 'creator')) canvas.pages.push({ id: 'creator', name: '4 · Creator portal (C01–C27) · mobile and desktop' });
const PER = 5, MW = 776, GAP = 80;
let y = 0;
for (let r = 0; r < M.length; r += PER) {
  const rowS = M.slice(r, r + PER);
  rowS.forEach((s, c) => {
    const file = `creator/${s.file || s.id}.dc.html`;
    canvas.boards[file] = { x: c * (MW + GAP), y, w: MW, h: s.h, page: 'creator', title: s.id === 'More' ? 'Mobile · More menu' : `${s.id} · ${s.title} · mobile` };
    if (!canvas.order.includes(file)) canvas.order.push(file);
  });
  y += Math.max(...rowS.map((s) => s.h)) + 120;
}
const dy = y + 300;
['C08', 'C09', 'C20'].forEach((id, c) => {
  const file = `creator/${id}-desktop.dc.html`;
  canvas.boards[file] = { x: c * 1520, y: dy, w: 1440, h: 1300, page: 'creator', expand: 'fill', is_interactive: true, title: `${id} · ${{ C08: 'Dashboard', C09: 'Find LIVE jobs', C20: 'Earnings' }[id]} · desktop` };
  if (!canvas.order.includes(file)) canvas.order.push(file);
});
canvas.notes.creatorTitle = { x: 0, y: -300, text: 'D4 + D8 · Creator portal · mobile first (390 px)', kind: 'title1', maxW: PER * MW + (PER - 1) * GAP, page: 'creator' };
canvas.notes.creatorDesktopTitle = { x: 0, y: dy - 300, text: 'Creator portal · desktop (1440 px)', kind: 'title1', maxW: 4480, page: 'creator' };
canvas.notes.creatorTip = { x: PER * (MW + GAP), y: 0, w: 320, text: 'Phone frames show each screen at full length. The tab bar (Home, Jobs, Sessions, Earnings, More) links between screens in Play. Bottom-sheet panels show overlays such as Accept, Counter and Decline.', fill: 'gray', page: 'creator' };
canvas.notes.overviewTitle && (canvas.notes.overviewTitle.text = 'Vyralink + Creator Hub · Batches 1–2');
fs.writeFileSync(cpath, JSON.stringify(canvas, null, 2));
written.push('project/canvas.json');
console.log(written.length, 'files');
fs.writeFileSync(path.join(ROOT, 'batch2-files.json'), JSON.stringify(written));
