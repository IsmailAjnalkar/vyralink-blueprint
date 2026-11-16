// Shared grayscale wireframe primitives (extracted from gen.mjs, batch 1).
// ---------------------------------------------------------------- document
export const doc = (title, w, h, body) => `<!doctype html>
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
export const FONT = 'font-family: Inter, system-ui, sans-serif';
export const inputStyle = `min-height:44px; box-sizing:border-box; padding:0 12px; border:1px solid #8c8c8c; border-radius:6px; font-size:14px; font-family:inherit; color:#1a1a1a; background:#ffffff; width:100%`;
export const btn = (label, o = {}) => {
  const look = o.primary ? 'background:#1a1a1a; color:#ffffff; border:1px solid #1a1a1a' : o.ghost ? 'background:transparent; color:#1a1a1a; border:1px solid transparent; text-decoration:underline' : 'background:#ffffff; color:#1a1a1a; border:1px solid #1a1a1a';
  const base = `display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:44px; padding:0 16px; border-radius:6px; font-size:14px; font-weight:600; text-decoration:none; cursor:pointer; box-sizing:border-box; font-family:inherit; white-space:nowrap; ${look}${o.disabled ? '; opacity:0.55; cursor:not-allowed' : ''}${o.full ? '; width:100%' : ''}`;
  return o.href ? `<a href="${o.href}" style="${base}">${label}</a>` : `<button type="button"${o.disabled ? ' disabled="disabled"' : ''} style="${base}">${label}</button>`;
};
export const badge = (p) => {
  const m = { MVP: 'background:#1a1a1a; color:#ffffff; border:1px solid #1a1a1a', P2: 'background:#ffffff; color:#1a1a1a; border:1px solid #1a1a1a', P3: 'background:#ffffff; color:#1a1a1a; border:1px dashed #1a1a1a' };
  return `<span style="display:inline-block; font-size:11px; font-weight:700; letter-spacing:0.04em; padding:2px 6px; border-radius:4px; white-space:nowrap; ${m[p]}">${p === 'P2' ? 'PHASE 2' : p === 'P3' ? 'PHASE 3' : 'MVP'}</span>`;
};
export const chip = (t, tone = '') => {
  const m = { '': 'background:#f2f2f2; color:#1a1a1a; border:1px solid #c4c4c4', dark: 'background:#1a1a1a; color:#ffffff; border:1px solid #1a1a1a', outline: 'background:#ffffff; color:#1a1a1a; border:1px solid #1a1a1a', alert: 'background:#ffffff; color:#1a1a1a; border:2px dashed #1a1a1a' };
  return `<span style="display:inline-flex; align-items:center; font-size:12px; font-weight:600; padding:3px 10px; border-radius:999px; white-space:nowrap; ${m[tone]}">${t}</span>`;
};
export const prov = (k) => `<span style="font-size:11px; font-weight:600; color:#3d3d3d; border:1px ${k === 'Unavailable' || k === 'Self-reported' ? 'dashed' : 'solid'} #8c8c8c; border-radius:4px; padding:1px 6px; white-space:nowrap">${k}</span>`;
export const lbl = (label, o) => `<span>${label}${o.req ? ' <span style="font-weight:400; color:#4d4d4d">(required)</span>' : ''}</span>`;
export const hint = (o) => `${o.hint ? `<span style="font-size:12px; font-weight:400; color:#4d4d4d">${o.hint}</span>` : ''}${o.err ? `<span style="font-size:12px; font-weight:700; color:#1a1a1a">Error: ${o.err}</span>` : ''}`;
export const fieldWrap = (o) => `display:flex; flex-direction:column; gap:6px; font-size:13px; font-weight:600; color:#1a1a1a; min-width:0${o.grow ? '; flex:1 1 200px' : ''}`;
export const field = (label, val = '', o = {}) => `<label style="${fieldWrap(o)}">${lbl(label, o)}<input type="${o.type || 'text'}"${o.ph ? ` placeholder="${o.ph}"` : ''} value="${val}" style="${inputStyle}${o.err ? '; border:2px solid #1a1a1a' : ''}">${hint(o)}</label>`;
export const sel = (label, opts, o = {}) => `<label style="${fieldWrap(o)}">${lbl(label, o)}<select style="${inputStyle}">${opts.map((x, i) => `<option${i === (o.sel || 0) ? ' selected="selected"' : ''}>${x}</option>`).join('')}</select>${hint(o)}</label>`;
export const area = (label, val = '', o = {}) => `<label style="${fieldWrap(o)}">${lbl(label, o)}<textarea rows="${o.rows || 3}" style="${inputStyle}; padding:10px 12px; min-height:88px; resize:vertical">${val}</textarea>${hint(o)}</label>`;
export const check = (label, on, o = {}) => `<label style="display:flex; align-items:center; gap:10px; font-size:14px; min-height:44px${o.disabled ? '; opacity:0.6' : ''}"><input type="${o.radio ? 'radio' : 'checkbox'}"${o.radio ? ` name="${o.radio}"` : ''}${on ? ' checked="checked"' : ''}${o.disabled ? ' disabled="disabled"' : ''} style="width:20px; height:20px; margin:0; flex-shrink:0"><span>${label}</span></label>`;
export const row = (items, o = {}) => `<div style="display:flex; flex-wrap:wrap; gap:${o.gap ?? 16}px; align-items:${o.align || 'center'}${o.justify ? '; justify-content:' + o.justify : ''}">${items.join('')}</div>`;
export const col = (items, gap = 16) => `<div style="display:flex; flex-direction:column; gap:${gap}px; min-width:0">${items.join('')}</div>`;
export const grid = (items, min = 220, gap = 16) => `<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(${min}px, 1fr)); gap:${gap}px">${items.join('')}</div>`;
export const card = (title, body, o = {}) => `<section style="border:1px solid #c4c4c4; border-radius:8px; background:#ffffff; padding:20px; display:flex; flex-direction:column; gap:16px; min-width:0; box-sizing:border-box${o.style ? '; ' + o.style : ''}">${title ? `<div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap"><h2 style="margin:0; font-size:16px; font-weight:700">${title}</h2>${o.right ? `<div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center">${o.right}</div>` : ''}</div>` : ''}${body}</section>`;
export const kpi = (label, value, sub = '', p = '') => `<div style="border:1px solid #c4c4c4; border-radius:8px; padding:16px; display:flex; flex-direction:column; gap:6px; min-width:0; background:#ffffff"><div style="display:flex; justify-content:space-between; gap:8px; align-items:center; font-size:12px; font-weight:600; color:#3d3d3d"><span>${label}</span>${p ? prov(p) : ''}</div><div style="font-size:24px; font-weight:700">${value}</div>${sub ? `<div style="font-size:12px; color:#3d3d3d; line-height:1.4">${sub}</div>` : ''}</div>`;
export const table = (heads, rows, o = {}) => `<div style="overflow-x:auto; border:1px solid #c4c4c4; border-radius:8px"><table style="width:100%; border-collapse:collapse; font-size:13px; min-width:${o.min || 640}px">${o.caption ? `<caption style="text-align:left; padding:12px 12px 4px; font-weight:700; font-size:14px">${o.caption}</caption>` : ''}<thead><tr>${heads.map((h) => `<th scope="col" style="text-align:left; padding:10px 12px; background:#f2f2f2; border-bottom:1px solid #c4c4c4; font-weight:700; white-space:nowrap">${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => (i === 0 && o.rowHead ? `<th scope="row" style="text-align:left; padding:10px 12px; border-bottom:1px solid #e6e6e6; font-weight:600; vertical-align:top">${c}</th>` : `<td style="padding:10px 12px; border-bottom:1px solid #e6e6e6; vertical-align:top; line-height:1.45">${c}</td>`)).join('')}</tr>`).join('')}</tbody></table></div>`;
export const ph = (label, h = 120, w = '100%') => `<div role="img" aria-label="${label} (placeholder)" style="width:${w}; height:${h}px; box-sizing:border-box; background:#e6e6e6; border:1px solid #c4c4c4; border-radius:6px; display:flex; align-items:center; justify-content:center; text-align:center; font-size:12px; font-weight:600; color:#3d3d3d; padding:8px; flex-shrink:0">${label}</div>`;
export const stepper = (steps, active) => `<ol aria-label="Steps" style="list-style:none; margin:0; padding:0; display:flex; flex-wrap:wrap; gap:8px">${steps.map((s, i) => `<li${i === active ? ' aria-current="step"' : ''} style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:${i === active ? 700 : 500}; padding:6px 12px 6px 6px; border-radius:999px; border:1px solid ${i === active ? '#1a1a1a' : '#c4c4c4'}; background:${i < active ? '#f2f2f2' : '#ffffff'}"><span style="width:24px; height:24px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; ${i === active ? 'background:#1a1a1a; color:#ffffff' : i < active ? 'background:#4d4d4d; color:#ffffff' : 'background:#e6e6e6; color:#1a1a1a'}">${i + 1}</span><span>${s}</span>${i < active ? '<span style="font-size:11px; color:#3d3d3d">· done</span>' : ''}</li>`).join('')}</ol>`;
export const tabs = (list, active) => `<div role="tablist" style="display:flex; flex-wrap:wrap; gap:4px; border-bottom:1px solid #c4c4c4">${list.map((t, i) => `<button type="button" role="tab" aria-selected="${i === active}" style="min-height:44px; padding:0 14px; border:0; border-bottom:3px solid ${i === active ? '#1a1a1a' : 'transparent'}; background:transparent; font-family:inherit; font-size:14px; font-weight:${i === active ? 700 : 500}; color:#1a1a1a; cursor:pointer">${t}</button>`).join('')}</div>`;
export const state = (label, title, text, actions = []) => `<div style="border:2px dashed #8c8c8c; border-radius:8px; padding:16px; background:#fafafa; display:flex; flex-direction:column; gap:8px; min-width:0"><div style="font-size:11px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#3d3d3d">State · ${label}</div><div style="font-size:15px; font-weight:700">${title}</div><div style="font-size:13px; color:#333333; line-height:1.5">${text}</div>${actions.length ? row(actions, { gap: 8 }) : ''}</div>`;
export const banner = (text, action = '') => `<div style="display:flex; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between; border:1px solid #1a1a1a; border-radius:8px; padding:12px 16px; background:#f2f2f2; font-size:14px"><span>${text}</span>${action}</div>`;
export const ul = (items, o = {}) => `<ul style="margin:0; padding-left:20px; display:flex; flex-direction:column; gap:${o.gap ?? 6}px; font-size:${o.size || 14}px; line-height:1.5">${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
export const p = (t, o = {}) => `<p style="margin:0; font-size:${o.size || 14}px; line-height:1.55; color:${o.mute ? '#3d3d3d' : '#1a1a1a'}">${t}</p>`;
export const dl = (pairs) => `<dl style="margin:0; display:grid; grid-template-columns:minmax(120px, max-content) 1fr; gap:8px 16px; font-size:14px">${pairs.map(([k, v]) => `<dt style="font-weight:600; color:#3d3d3d">${k}</dt><dd style="margin:0">${v}</dd>`).join('')}</dl>`;
export const sub = (t) => `<h3 style="margin:0; font-size:14px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#3d3d3d">${t}</h3>`;
export const bell = `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.7 21a2 2 0 0 1-3.4 0"></path></svg>`;

