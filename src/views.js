import { sb, S, $, $$, esc, kes, DP, longDate, toStarts, PILLARS, PNAMES, ico, imgUrl, act, toast, go, store, errMsg, requireAuth, isAdmin, addCart, saveCart, cartTotal, uploadImage, qr, copy, wait, openAuth, actions } from './lib/core.js';
import { eventsMap, staticMap, pickerMap, placeSearch, kmBetween, reverse } from './lib/maps.js';

/* ---------- shared bits ---------- */
const tierLeft = t => t.quantity - t.sold;
const evLeft = e => (e.ticket_tiers || []).reduce((a, t) => a + tierLeft(t), 0);
const minPrice = e => e.ticket_tiers?.length ? Math.min(...e.ticket_tiers.map(t => t.price_kes)) : 0;
const empty = (msg, cta = '') => `<div class="empty"><img class="eye" src="/img/mono.png" alt=""><p>${msg}</p>${cta}</div>`;
const EVQ = '*, ticket_tiers(*)';
const COLORS = { Charcoal: '#2A2B30', Black: '#0E0E10', Bone: '#E8E8E3' };
const SH = { tee: ['<path d="M62 30L86 22Q100 38 114 22L138 30L174 60L152 84L138 74V172H62V74L48 84L26 60Z"/>', '24%', '42%'], hoodie: ['<path d="M60 36L84 24Q100 46 116 24L140 36L178 72L162 150L144 146L142 176H58L56 146L38 150L22 72Z"/>', '22%', '42%'], cap: ['<path d="M34 118Q36 52 100 50Q164 52 166 118Z"/><path d="M34 118Q100 130 192 124Q170 146 100 142Q50 142 34 118Z" opacity=".8"/>', '20%', '38%'], tote: ['<path d="M46 72H154L162 180H38Z"/><path d="M76 72Q76 26 100 26Q124 26 124 72" fill="none" stroke="currentColor" stroke-width="6"/>', '30%', '58%'], mug: ['<path d="M54 52H136V152Q136 170 118 170H72Q54 170 54 152Z"/><path d="M136 72Q170 72 170 102Q170 130 136 130" fill="none" stroke="currentColor" stroke-width="10"/>', '22%', '56%'], print: ['<path d="M44 26H156V174H44Z"/><path d="M54 36H146V164H54Z" fill="#0A0A0B" stroke="rgba(255,255,255,.2)"/>', '34%', '46%'], pin: ['<circle cx="100" cy="100" r="58"/>', '34%', '50%'] };
const colorHex = c => COLORS[c] || '#5a5b63';
function pimg(p, color) {
  if (p.image_path) return `<div class="pimg-real"><img src="${esc(imgUrl(p.image_path))}" alt="${esc(p.name)}" loading="lazy"></div>`;
  const col = color || p.product_variants?.[0]?.color || 'Black', hex = colorHex(col), s = SH[p.shape] || SH.tee;
  return `<div class="pimg ${col === 'Bone' ? 'light' : ''}" style="--mw:${s[1]};--my2:${s[2]}"><svg class="shape" viewBox="0 0 200 200" fill="${hex}" stroke="rgba(255,255,255,.22)" stroke-width="1.2" style="color:${hex};filter:drop-shadow(0 12px 20px rgba(0,0,0,.5))" aria-hidden="true">${s[0]}</svg><img class="mark" src="/img/mono.png" alt=""><span class="back">Beyond what<br>meets the eye</span></div>`;
}
function ecard(e, i = 0) {
  const p = DP(e.starts_at), lf = evLeft(e), out = e.ticket_tiers?.length && lf === 0;
  return `<article class="ecard rise" style="--i:${i}" data-go="event-${e.id}" tabindex="0" role="link" aria-label="${esc(e.title)}"><div class="ph"><img src="${esc(imgUrl(e.cover_path))}" alt="" loading="lazy"><div class="date"><b>${p.d}</b><small>${p.m}</small></div><div class="tagc"><span class="pill ${out ? 'warn' : lf <= 15 ? 'v' : ''}">${out ? 'Sold out' : lf <= 15 && e.ticket_tiers?.length ? lf + ' left' : esc(e.pillar)}</span></div></div>
  <div class="body"><span class="label v">${esc(e.pillar)}</span><h3>${esc(e.title)}</h3><div class="meta">${p.w} ${p.t} · ${esc(e.town)}${e._km != null ? ` · <span class="near">${Math.round(e._km)} km away</span>` : ''}</div><div class="foot"><span class="price ${minPrice(e) === 0 ? 'v' : ''}">${minPrice(e) === 0 ? 'Free' : 'From ' + kes(minPrice(e))}</span><span class="btn sm ghost">${minPrice(e) === 0 ? 'RSVP' : 'Reserve'}</span></div></div></article>`;
}
function pcard(p, i = 0) {
  const stock = (p.product_variants || []).reduce((a, v) => a + v.stock, 0);
  return `<article class="pcard rise" style="--i:${i}"><button style="display:block" data-go="product-${p.id}" aria-label="View ${esc(p.name)}">${pimg(p)}</button><div class="pb"><span class="label">${esc(p.category)}</span><h3>${esc(p.name)}</h3><div class="pf"><span class="price v">${kes(p.price_kes)}</span>${stock ? `<button class="btn sm" data-go="product-${p.id}">Choose</button>` : '<span class="pill">Sold out</span>'}</div>${stock && stock <= 5 ? `<span class="label v">Only ${stock} left</span>` : ''}</div></article>`;
}
function tile(p, i = 0) { return `<button class="tile rise" style="--i:${i % 6};height:${[180, 230, 270, 210][i % 4]}px" data-act="lb" data-id="${p.id}" aria-label="Open photo: ${esc(p.caption || 'Photo')}"><img src="${esc(imgUrl(p.path))}" alt="${esc(p.caption || 'Event photo')}" loading="lazy">${p.status === 'pending' ? '<span class="badge pill warn">Pending review</span>' : ''}<span class="cap">${esc(p.caption || '')}</span></button>`; }
const pageHead = (l, h, p = '') => `<div class="pagehead"><span class="label v">${l}</span><h1>${h}</h1>${p ? `<p>${p}</p>` : ''}</div>`;
const needSignIn = (t) => `<div class="wrap">${pageHead('Account', 'Sign in')}<div class="panel" style="max-width:520px"><p class="muted" style="margin-bottom:18px">${t}</p><button class="btn" data-act="signin">Sign in or create account</button></div></div>`;

export const V = {};
const photoCache = {}; export const photoById = id => photoCache[id];
const keep = ps => (ps || []).forEach(p => photoCache[p.id] = p);

/* ---------- home ---------- */
V.home = {
  async load() {
    const now = new Date().toISOString();
    const [ev, ph, pr] = await Promise.all([sb.from('events').select(EVQ).eq('status', 'published').gte('starts_at', now).order('starts_at').limit(8), sb.from('photos').select('*').eq('status', 'approved').order('created_at', { ascending: false }).limit(8), sb.from('products').select('*, product_variants(*)').eq('active', true).order('sort').limit(4)]);
    keep(ph.data); return { ev: ev.data || [], ph: ph.data || [], pr: pr.data || [] };
  },
  html(d) {
    return `<section class="hero" id="hero"><div class="hero-bg" style="background-image:url(/img/sun.jpg)"></div><div class="hero-lit" style="background-image:url(/img/sun.jpg)"></div><div class="hero-fade"></div><img class="hero-mark" src="/img/logo.png" alt="">
    <div class="wrap"><span class="label v rise">Nature is our setting, medium &amp; foundation</span><h1 class="rise" style="--i:1;margin-top:18px">Unseen Kenya</h1><div class="rule rise" style="--i:2"><i></i></div><p class="tag rise" style="--i:3">Beyond what meets the eye.</p><div class="cta rise" style="--i:4"><a class="btn" href="#events">Discover events</a><a class="btn ghost" href="#shop">Shop the collection</a></div><p class="label hint rise" style="--i:5">Move your cursor to look closer</p></div></section>
    <section class="band"><div class="wrap intro rise"><span class="label v">Who we are</span><p><b>Unseen Kenya</b> is a platform built on the belief that there is more to Kenya than what we have grown accustomed to seeing. Rooted in nature, we uncover the country through its people, culture, creativity, food, fashion, music, communities, hidden gems and the natural world, with experiences that bring people together and invite us to see Kenya from a different lens.</p></div></section>
    <section class="band" style="padding-top:0"><div class="wrap"><div class="sechead"><div><span class="label v">Ten ways in</span><h2>The pillars</h2></div><span class="muted" style="max-width:340px">Pick a lens. Each one opens the events that explore it.</span></div><div class="pillars">${PILLARS.map(([n, k, t], i) => `<button class="pillar rise" style="--i:${i}" data-act="pillar" data-p="${n}"><img src="/img/${k}.jpg" alt="" loading="lazy"><span>${ico(n)}</span><div><h3>${n}</h3><span>${t}</span></div></button>`).join('')}</div></div></section>
    <section class="band" style="padding-top:0"><div class="wrap"><div class="sechead"><div><span class="label v">Coming up</span><h2>Upcoming events</h2></div><a class="link" href="#events">See all</a></div>${d.ev.length ? `<div class="hscroll">${d.ev.map((e, i) => ecard(e, i)).join('')}</div>` : empty('No events are listed yet. Be the first to host one.', '<a class="btn" href="#create">Create an event</a>')}</div></section>
    ${d.ph.length ? `<section class="band" style="padding-top:0"><div class="wrap"><div class="sechead"><div><span class="label v">From the community</span><h2>Seen, at last</h2></div><a class="link" href="#gallery">Open the gallery</a></div><div class="masonry">${d.ph.map((p, i) => tile(p, i)).join('')}</div></div></section>` : ''}
    ${d.pr.length ? `<section class="band" style="padding-top:0"><div class="wrap"><div class="sechead"><div><span class="label v">The collection</span><h2>Wear the eye</h2></div><a class="link" href="#shop">Shop everything</a></div><div class="pgrid">${d.pr.map((p, i) => pcard(p, i)).join('')}</div></div></section>` : ''}
    <section class="band" style="padding-top:0"><div class="wrap"><div class="hostband"><div><span class="label v">Host with us</span><h2 style="margin:14px 0 20px">Bring your corner of Kenya to the table</h2><div style="display:flex;gap:12px;flex-wrap:wrap"><a class="btn" href="#create">Create an event</a><a class="btn ghost" href="#host">Host dashboard</a></div></div><ul><li>Build a listing in five short steps</li><li>Sell tickets with M-Pesa or card</li><li>Collect photos from your guests</li><li>Sell merchandise alongside your tickets</li></ul></div></div></section>`;
  },
  mount() { const h = $('#hero'); h?.addEventListener('pointermove', e => { const r = h.getBoundingClientRect(); h.style.setProperty('--mx', (e.clientX - r.left) + 'px'); h.style.setProperty('--my', (e.clientY - r.top) + 'px'); }); }
};
V.about = { async load() { return {}; }, html: () => `<div class="wrap">${pageHead('About', 'Unseen Kenya')}<div class="about2"><div><p class="label" style="margin-bottom:18px">Nature is our setting, medium &amp; foundation</p><p style="font-family:var(--display);font-size:clamp(24px,3vw,34px);line-height:1.35">Unseen Kenya is a platform built on the belief that there is more to Kenya than what we have grown accustomed to seeing. Rooted in nature as our setting, medium and foundation, we seek to uncover Kenya through its people, culture, creativity, food, fashion, music, communities, hidden gems and the natural world, creating meaningful experiences that bring people together, inspire discovery and invite us to see and experience Kenya from a different lens.</p><p class="label" style="margin-top:30px;letter-spacing:.4em">Discover. Connect. Belong.</p><div style="display:flex;gap:12px;margin-top:28px;flex-wrap:wrap"><a class="btn" href="#events">Find an event</a><a class="btn ghost" href="#create">Host one</a></div></div><img src="/img/bird.jpg" alt="A hornbill in the trees"></div><div style="height:80px"></div></div>` };

/* ---------- events ---------- */
const EF = { pillar: 'All', when: 'any', loc: 'any', price: 'any', view: 'grid', near: null };
V.events = {
  async load() { const { data } = await sb.from('events').select(EVQ).eq('status', 'published').gte('starts_at', new Date(Date.now() - 6 * 3600e3).toISOString()).order('starts_at'); return data || []; },
  html(all) {
    const f = EF, now = Date.now(); const towns = [...new Set(all.map(e => e.town))].sort();
    let list = all.filter(e => (f.pillar === 'All' || e.pillar === f.pillar) && (f.loc === 'any' || e.town === f.loc) && (f.when === 'any' || (new Date(e.starts_at) - now) / 864e5 <= +f.when) && (f.price === 'any' || (f.price === 'free' ? minPrice(e) === 0 : f.price === 'u2' ? minPrice(e) > 0 && minPrice(e) < 2000 : minPrice(e) >= 2000)));
    list.forEach(e => e._km = f.near && e.lat != null ? kmBetween([f.near.lat, f.near.lng], [e.lat, e.lng]) : null);
    if (f.near) list.sort((a, b) => (a._km ?? 1e9) - (b._km ?? 1e9));
    V.events._list = list;
    const o = (v, t, c) => `<option value="${v}" ${c === v ? 'selected' : ''}>${t}</option>`;
    let body;
    if (!list.length) body = empty('Nothing matches those filters yet.', '<button class="btn ghost sm" data-act="clearf">Clear filters</button>');
    else if (f.view === 'list') body = `<div class="elist">${list.map(e => { const p = DP(e.starts_at); return `<article class="erow" data-go="event-${e.id}" tabindex="0" role="link"><img src="${esc(imgUrl(e.cover_path))}" alt=""><div><span class="label v">${esc(e.pillar)} · ${p.w} ${p.d} ${p.m}</span><h3>${esc(e.title)}</h3><span class="muted">${esc(e.venue)}, ${esc(e.town)}</span></div><div style="text-align:right"><div class="price">${minPrice(e) === 0 ? 'Free' : 'From ' + kes(minPrice(e))}</div><span class="muted" style="font-size:12px">${evLeft(e)} left</span></div></article>`; }).join('')}</div>`;
    else if (f.view === 'map') body = `<div id="nearsearch"></div><div class="map tall" id="evmap"></div><p class="muted" style="font-size:12px;margin:8px 0 20px">Search a town to centre the map and sort events by distance.${f.near ? ` Showing distance from <b>${esc(f.near.name)}</b>. <button class="link" data-act="clearnear">Clear</button>` : ''}</p><div class="egrid">${list.map((e, i) => ecard(e, i)).join('')}</div>`;
    else body = `<div class="egrid">${list.map((e, i) => ecard(e, i)).join('')}</div>`;
    return `<div class="wrap">${pageHead('Events', 'What’s on', 'Gatherings across the ten pillars. Filter by what moves you, where you are and what you want to spend.')}<div class="chips" style="margin-bottom:22px">${['All', ...PNAMES].map(p => `<button class="chip ${f.pillar === p ? 'on' : ''}" data-act="fpillar" data-p="${p}">${p}</button>`).join('')}</div>
    <div class="toolbar"><div class="sel"><select id="f-when" data-f="when" aria-label="When">${o('any', 'Any date', f.when)}${o('30', 'Next 30 days', f.when)}${o('90', 'Next 90 days', f.when)}</select><select id="f-loc" data-f="loc" aria-label="Location">${o('any', 'Anywhere', f.loc)}${towns.map(t => o(t, t, f.loc)).join('')}</select><select id="f-price" data-f="price" aria-label="Price">${o('any', 'Any price', f.price)}${o('free', 'Free', f.price)}${o('u2', 'Under KES 2,000', f.price)}${o('o2', 'KES 2,000 and up', f.price)}</select></div><div class="seg" role="group" aria-label="View">${['grid', 'list', 'map'].map(v => `<button class="${f.view === v ? 'on' : ''}" data-act="fview" data-v="${v}">${v}</button>`).join('')}</div></div>
    <p class="muted tnum" style="margin-bottom:18px">${list.length} ${list.length === 1 ? 'event' : 'events'}</p>${body}<div style="height:60px"></div></div>`;
  },
  mount() {
    if (EF.view !== 'map') return;
    const m = eventsMap($('#evmap'), V.events._list, EF.near);
    placeSearch($('#nearsearch'), p => { EF.near = p; repaint(); }, 'Search a town to find events near it');
    V.events._m = m;
  }
};
act({
  pillar: el => { EF.pillar = el.dataset.p; EF.view = 'grid'; go('events'); }, fpillar: el => { EF.pillar = el.dataset.p; repaint(); }, fview: el => { EF.view = el.dataset.v; repaint(); },
  clearf: () => { Object.assign(EF, { pillar: 'All', when: 'any', loc: 'any', price: 'any', near: null }); repaint(); }, clearnear: () => { EF.near = null; repaint(); },
});
export const onChange = { f: el => { EF[el.dataset.f] = el.value; repaint(); } };

/* ---------- event detail ---------- */
const TIX = {};
V.event = {
  async load(id) {
    const { data: e } = await sb.from('events').select(EVQ).eq('id', id).maybeSingle();
    if (!e) return null;
    const { data: ph } = await sb.from('photos').select('*').eq('event_id', id).eq('status', 'approved').order('created_at', { ascending: false }); keep(ph);
    return { e, ph: ph || [] };
  },
  html(d) {
    if (!d) return `<div class="wrap">${empty('That event is no longer listed.', '<a class="btn" href="#events">Back to events</a>')}</div>`;
    const { e, ph } = d, p = DP(e.starts_at), tix = TIX[e.id] ||= {}, tiers = (e.ticket_tiers || []).sort((a, b) => a.sort - b.sort || a.price_kes - b.price_kes);
    const total = tiers.reduce((a, t) => a + (tix[t.id] || 0) * t.price_kes, 0), count = Object.values(tix).reduce((a, b) => a + b, 0);
    const past = new Date(e.starts_at) < new Date(), cancelled = e.status === 'cancelled';
    const tierHTML = tiers.map(t => { const lf = tierLeft(t); return `<div class="tier"><div><b>${esc(t.name)}</b></div><div class="price ${t.price_kes === 0 ? 'v' : ''}">${kes(t.price_kes)}</div><small>${lf > 0 ? (lf <= 10 ? `<span style="color:var(--volt)">${lf} left</span>` : lf + ' available') : 'Sold out'}</small>${lf > 0 && !past && !cancelled ? `<div class="qty"><button data-act="tq" data-t="${t.id}" data-d="-1" aria-label="Fewer">−</button><span class="tnum">${tix[t.id] || 0}</span><button data-act="tq" data-t="${t.id}" data-d="1" aria-label="More">+</button></div>` : '<span></span>'}</div>`; }).join('');
    const label = past ? 'This event has passed' : cancelled ? 'Cancelled' : count ? `${total === 0 ? 'RSVP' : 'Reserve'} · ${count} ${count > 1 ? 'tickets' : 'ticket'} · ${kes(total)}` : 'Choose tickets';
    const mine = S.user && (e.host_id === S.user.id || isAdmin());
    return `<div class="edhero"><img src="${esc(imgUrl(e.cover_path))}" alt=""><div class="wrap"><a class="crumb" href="#events">← All events</a><br><span class="pill v">${esc(e.pillar)}</span>${cancelled ? ' <span class="pill warn">Cancelled</span>' : ''}<h1>${esc(e.title)}</h1></div></div>
    <div class="wrap edlayout"><div><div class="facts"><div><span class="label">Date</span><b>${p.w} ${p.d} ${p.m}</b></div><div><span class="label">Time</span><b>${p.t}</b></div><div><span class="label">Where</span><b>${esc(e.town)}</b></div><div><span class="label">Host</span><b>${esc(e.host_name || 'Unseen Kenya')}</b></div></div>
    <h2 style="font-size:36px;margin-bottom:14px">About this event</h2><p style="max-width:62ch;color:#d8d8d4;font-size:16px;white-space:pre-line">${esc(e.description)}</p><p class="muted" style="margin-top:14px">${esc(e.venue)}</p>
    ${mine ? `<p style="margin-top:18px"><a class="btn ghost sm" href="#edit-${e.id}">Edit this event</a></p>` : ''}
    ${e.lat != null ? `<div class="sep"></div><div class="sechead" style="margin-bottom:16px"><h2 style="font-size:36px">Location</h2><div style="display:flex;gap:14px;flex-wrap:wrap"><a class="link" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${e.lat},${e.lng}">Directions (Google)</a><a class="link" target="_blank" rel="noopener" href="https://www.openstreetmap.org/directions?to=${e.lat},${e.lng}">Directions (OSM)</a></div></div><div class="map" id="evmap1"></div>` : ''}
    <div class="sep"></div><div class="sechead" style="margin-bottom:20px"><h2 style="font-size:36px">Photos from this event</h2><div style="display:flex;gap:10px"><button class="btn ghost sm" data-act="share">Copy link</button><a class="btn sm" href="#gallery" data-act="upfor" data-e="${e.id}">Add yours</a></div></div>${ph.length ? `<div class="masonry">${ph.map((x, i) => tile(x, i)).join('')}</div>` : `<div class="empty panel"><p>No photos yet. Be the first to add one after the event.</p></div>`}</div>
    <aside class="buy panel"><span class="label v">Tickets</span><h3 style="font-size:30px;margin:6px 0 4px">${esc(e.title)}</h3><p class="muted" style="font-size:13px">${p.w} ${p.d} ${p.m} · ${p.t}</p><div style="margin:10px 0 18px">${tierHTML || '<p class="muted">Tickets are not on sale yet.</p>'}</div><button class="btn block" data-act="reserve" ${count && !past && !cancelled ? '' : 'disabled'}>${label}</button><p class="muted" style="font-size:12px;margin-top:12px;text-align:center">Pay with M-Pesa or card. Add merch in the same checkout.</p></aside></div>
    <div class="mobilebuy"><div><div class="price">${count ? kes(total) : 'From ' + kes(minPrice(e))}</div><span class="muted" style="font-size:12px">${count ? count + ' selected' : 'Choose tickets above'}</span></div><button class="btn" data-act="reserve" ${count && !past && !cancelled ? '' : 'disabled'}>Reserve</button></div>`;
  },
  mount(d) { if (d?.e.lat != null) staticMap($('#evmap1'), d.e.lat, d.e.lng); }
};
act({
  tq: el => { const e = V.event._d.e, t = e.ticket_tiers.find(x => x.id === el.dataset.t), tix = TIX[e.id] ||= {}; tix[t.id] = Math.max(0, Math.min(10, tierLeft(t), (tix[t.id] || 0) + +el.dataset.d)); repaint(); },
  reserve: () => { const e = V.event._d.e, tix = TIX[e.id] || {}; e.ticket_tiers.forEach(t => { if (tix[t.id] > 0) addCart({ key: 't-' + t.id, kind: 'ticket', id: t.id, qty: tix[t.id], title: e.title, detail: `${t.name} · ${longDate(e.starts_at)}`, price: t.price_kes, img: imgUrl(e.cover_path) }); }); TIX[e.id] = {}; repaint(); toast('Tickets added to your cart'); actions.cart(); },
  share: () => copy(location.href),
});

/* ---------- gallery + upload ---------- */
const GF = { mode: 'latest', pillar: 'All', queue: [], pre: '' };
let UQ = 1;
V.gallery = {
  async load() {
    const [ph, ev] = await Promise.all([sb.from('photos').select('*, events(title)').neq('status', 'removed').order('created_at', { ascending: false }).limit(200), sb.from('events').select('id,title,pillar').eq('status', 'published').order('starts_at', { ascending: false })]);
    keep(ph.data); return { ph: ph.data || [], ev: ev.data || [] };
  },
  html(d) {
    const g = GF; V.gallery._ev = d.ev; V.gallery._pillars = Object.fromEntries(d.ev.map(e => [e.id, e.pillar]));
    const list = d.ph.filter(p => g.pillar === 'All' || p.pillar === g.pillar);
    let body = empty('No photos here yet.');
    if (list.length && g.mode === 'latest') body = `<div class="masonry">${list.map((p, i) => tile(p, i)).join('')}</div>`;
    else if (list.length) { const groups = {}; list.forEach(p => (groups[g.mode === 'event' ? (p.events?.title || 'Other') : (p.pillar || 'Other')] ||= []).push(p)); body = Object.entries(groups).map(([k, v]) => `<h3 style="font-size:30px;margin:30px 0 16px">${esc(k)} <span class="label">${v.length}</span></h3><div class="masonry">${v.map((p, i) => tile(p, i)).join('')}</div>`).join(''); }
    return `<div class="wrap">${pageHead('Gallery', 'Seen, at last', 'Photos from the people who were there. Add yours and tag the event it belongs to.')}
    <div class="panel" style="margin-bottom:36px" id="upbox"><div class="sechead" style="margin-bottom:18px"><h2 style="font-size:32px">Add your photos</h2><span class="muted" style="font-size:13px">New uploads wait for host approval before they appear publicly.</span></div>${S.user ? uploaderHTML('gal') : `<p class="muted" style="margin-bottom:16px">Sign in to add photos so hosts can credit and approve them.</p><button class="btn" data-act="signin">Sign in</button>`}</div>
    <div class="toolbar"><div class="chips">${['All', ...PNAMES].map(p => `<button class="chip ${g.pillar === p ? 'on' : ''}" data-act="gpillar" data-p="${p}">${p}</button>`).join('')}</div><div class="seg" role="group" aria-label="Grouping">${[['latest', 'Latest'], ['event', 'By event'], ['pillar', 'By pillar']].map(([v, t]) => `<button class="${g.mode === v ? 'on' : ''}" data-act="gmode" data-v="${v}">${t}</button>`).join('')}</div></div>${body}<div style="height:60px"></div></div>`;
  }
};
export function uploaderHTML(ctx, q = ctx === 'gal' ? GF.queue : DR.files, events = V.gallery._ev || []) {
  const pending = q.filter(f => f.state !== 'done').length;
  return `<label class="drop" data-ctx="${ctx}"><svg viewBox="0 0 24 24"><path d="M12 16V5M7 9l5-5 5 5M4 17v3h16v-3"/></svg><b>Drag photos here or tap to choose</b><span class="muted" style="font-size:13px">JPG, PNG or WebP. On a phone this opens your camera roll or camera. Photos are resized before upload.</span><input type="file" accept="image/*" multiple data-ctx="${ctx}"></label>
  <div class="uplist">${q.map(f => `<div class="up" id="up-${f.id}"><img src="${f.src}" alt=""><div class="meta"><input type="text" id="cap-${f.id}" placeholder="Add a caption" value="${esc(f.cap)}" data-ucap="${f.id}" data-ctx="${ctx}" aria-label="Caption" ${f.state === 'done' ? 'disabled' : ''}>${ctx === 'gal' ? `<select id="ev-${f.id}" data-uev="${f.id}" aria-label="Event" ${f.state === 'done' ? 'disabled' : ''}><option value="">Tag an event</option>${events.map(e => `<option value="${e.id}" ${f.ev === e.id ? 'selected' : ''}>${esc(e.title)}</option>`).join('')}</select>` : ''}<span class="st ${f.state === 'done' ? 'ok' : f.state === 'error' ? 'bad' : ''}">${f.state === 'done' ? f.note || 'Uploaded' : f.state === 'error' ? esc(f.note) : f.state === 'up' ? 'Uploading…' : 'Ready'}</span></div>
  <div class="acts">${f.state === 'done' ? '' : `<button class="mini" data-act="updel" data-id="${f.id}" data-ctx="${ctx}" aria-label="Remove">✕</button>`}${ctx === 'ev' ? `<button class="mini" data-act="upmove" data-id="${f.id}" data-d="-1" aria-label="Move earlier">↑</button>` : ''}</div></div>`).join('')}</div>
  ${ctx === 'gal' && q.length ? `<div style="display:flex;gap:12px;justify-content:flex-end;margin-top:16px;align-items:center;flex-wrap:wrap"><span class="muted" style="font-size:13px">${pending} waiting</span><button class="btn" data-act="submitq" ${pending ? '' : 'disabled'}>Upload ${pending || ''} photo${pending === 1 ? '' : 's'}</button></div>` : ''}`;
}
export function addFiles(files, ctx) {
  const arr = [...files].filter(f => f.type.startsWith('image/')); if (!arr.length) return toast('Choose image files (JPG, PNG or WebP)');
  const q = ctx === 'gal' ? GF.queue : DR.files;
  arr.forEach(file => q.push({ id: 'u' + UQ++, file, src: URL.createObjectURL(file), cap: file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 120), ev: ctx === 'gal' ? GF.pre : '', state: 'ready' }));
  refreshUp(ctx);
}
export function refreshUp(ctx) { if (ctx === 'gal') repaint(); else { const b = $('#evupload'); if (b) b.innerHTML = evUploadHTML(); save(); } }
export const gcap = (el) => { const q = el.dataset.ctx === 'gal' ? GF.queue : DR.files, f = q.find(x => x.id === el.dataset.ucap); if (f) f.cap = el.value; };
export const gev = el => { const f = GF.queue.find(x => x.id === el.dataset.uev); if (f) f.ev = el.value; };
act({
  gpillar: el => { GF.pillar = el.dataset.p; repaint(); }, gmode: el => { GF.mode = el.dataset.v; repaint(); }, upfor: el => { GF.pre = el.dataset.e; },
  updel: el => { const q = el.dataset.ctx === 'gal' ? GF.queue : DR.files, i = q.findIndex(f => f.id === el.dataset.id); if (i > -1) q.splice(i, 1); refreshUp(el.dataset.ctx); },
  upmove: el => { const q = DR.files, i = q.findIndex(f => f.id === el.dataset.id); if (i > 0) { [q[i - 1], q[i]] = [q[i], q[i - 1]]; refreshUp('ev'); } },
  submitq: async () => {
    if (!requireAuth('Sign in to upload photos.')) return;
    const btn = $('[data-act=submitq]'); btn.disabled = true; let ok = 0, auto = false;
    for (const f of GF.queue.filter(x => x.state !== 'done')) {
      f.state = 'up'; paintRow(f);
      try {
        const ev = V.gallery._ev.find(e => e.id === f.ev), path = await uploadImage(f.file, S.user.id);
        const { data, error } = await sb.from('photos').insert({ path, caption: f.cap || null, event_id: f.ev || null, pillar: pillarOf(f.ev) }).select('status').single();
        if (error) throw error; f.state = 'done'; f.note = data.status === 'approved' ? 'Published' : 'Sent for review'; auto = auto || data.status === 'approved'; ok++;
      } catch (e) { f.state = 'error'; f.note = await errMsg(e); }
      paintRow(f);
    }
    toast(ok ? `${ok} photo${ok > 1 ? 's' : ''} uploaded. Hosts approve new photos before they appear publicly.` : 'Upload failed. See the messages next to each photo.');
    GF.queue = GF.queue.filter(f => f.state !== 'done'); if (ok) { await wait(400); render(); } else repaint();
  }
});
const pillarOf = id => V.gallery._pillars?.[id] || null;
function paintRow(f) { const r = $('#up-' + f.id); if (r) { const s = $('.st', r); s.className = 'st ' + (f.state === 'done' ? 'ok' : f.state === 'error' ? 'bad' : ''); s.textContent = f.state === 'done' ? f.note : f.state === 'error' ? f.note : 'Uploading…'; } }

/* ---------- shop ---------- */
const SF = { cat: 'All', sort: 'feat' }, SEL = { pid: null, size: null, color: null, qty: 1, err: false };
V.shop = {
  async load() { const { data } = await sb.from('products').select('*, product_variants(*)').eq('active', true).order('sort'); return data || []; },
  html(all) {
    const cats = ['All', ...new Set(all.map(p => p.category))]; let l = all.filter(p => SF.cat === 'All' || p.category === SF.cat);
    if (SF.sort === 'lo') l = l.slice().sort((a, b) => a.price_kes - b.price_kes); if (SF.sort === 'hi') l = l.slice().sort((a, b) => b.price_kes - a.price_kes);
    return `<div class="wrap">${pageHead('Shop', 'The collection', 'Merchandise from the Unseen Kenya studio. Add it to your event tickets and pay once.')}<div class="toolbar"><div class="chips">${cats.map(c => `<button class="chip ${SF.cat === c ? 'on' : ''}" data-act="scat" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div><select id="sort" data-sort aria-label="Sort" style="width:auto;min-width:170px;min-height:40px;padding:8px 12px"><option value="feat" ${SF.sort === 'feat' ? 'selected' : ''}>Featured</option><option value="lo" ${SF.sort === 'lo' ? 'selected' : ''}>Price: low to high</option><option value="hi" ${SF.sort === 'hi' ? 'selected' : ''}>Price: high to low</option></select></div>${l.length ? `<div class="pgrid">${l.map((p, i) => pcard(p, i)).join('')}</div>` : empty('The shop is being stocked. Check back soon.')}<div style="height:70px"></div></div>`;
  }
};
export const onSort = el => { SF.sort = el.value; repaint(); };
V.product = {
  async load(id) { const { data } = await sb.from('products').select('*, product_variants(*)').eq('id', id).maybeSingle(); const { data: rel } = await sb.from('products').select('*, product_variants(*)').eq('active', true).neq('id', id).order('sort').limit(3); return data ? { p: data, rel: rel || [] } : null; },
  html(d) {
    if (!d) return `<div class="wrap">${empty('Product not found.', '<a class="btn" href="#shop">Back to shop</a>')}</div>`;
    const { p, rel } = d, vs = p.product_variants || [], colors = [...new Set(vs.map(v => v.color))], s = SEL;
    if (s.pid !== p.id) Object.assign(s, { pid: p.id, color: colors[0], size: null, qty: 1, err: false });
    const sizes = [...new Set(vs.filter(v => v.color === s.color).map(v => v.size))]; if (sizes.length === 1 && !s.size) s.size = sizes[0];
    const v = vs.find(x => x.color === s.color && x.size === s.size), stockOf = sz => vs.find(x => x.color === s.color && x.size === sz)?.stock || 0, any = vs.some(x => x.stock > 0);
    return `<div class="wrap" style="padding-top:24px"><a class="crumb" href="#shop">← Back to shop</a><div class="pdetail"><div style="border:1px solid var(--line)">${pimg(p, s.color)}</div><div><span class="label v">${esc(p.category)}</span><h1 style="font-size:clamp(40px,6vw,68px);margin:10px 0 12px">${esc(p.name)}</h1><div class="price v" style="font-size:24px">${kes(p.price_kes)}</div><p style="margin:18px 0;color:#d8d8d4;max-width:56ch">${esc(p.description)}</p>
    ${colors.length > 1 ? `<div class="field" style="margin-bottom:20px"><span class="lab">Colour: ${esc(s.color)}</span><div class="swatches">${colors.map(c => `<button class="sw ${s.color === c ? 'on' : ''}" style="background:${colorHex(c)}" data-act="pcolor" data-c="${esc(c)}" aria-label="${esc(c)}"></button>`).join('')}</div></div>` : ''}
    <div class="field ${s.err ? 'bad' : ''}" style="margin-bottom:20px"><span class="lab">Size</span><div class="sizes">${sizes.map(z => `<button class="${s.size === z ? 'on' : ''}" ${stockOf(z) ? '' : 'disabled style="opacity:.35;text-decoration:line-through"'} data-act="psize" data-z="${esc(z)}">${esc(z)}</button>`).join('')}</div>${s.err ? '<span class="err" role="alert">Choose a size first.</span>' : ''}</div>
    <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-bottom:18px"><div class="qty"><button data-act="pq" data-d="-1" aria-label="Fewer">−</button><span class="tnum">${s.qty}</span><button data-act="pq" data-d="1" aria-label="More">+</button></div>${!any ? '<span class="pill">Sold out</span>' : v && v.stock <= 5 ? `<span class="label v">Only ${v.stock} left</span>` : '<span class="muted" style="font-size:13px">In stock</span>'}</div>
    <button class="btn block" data-act="padd" ${any ? '' : 'disabled'}>${any ? `Add to cart · ${kes(p.price_kes * s.qty)}` : 'Sold out'}</button><p class="muted" style="font-size:13px;margin-top:14px">Free delivery over ${kes(S.settings.free_shipping_over_kes)}, or collect at any Unseen Kenya event.</p></div></div>
    ${rel.length ? `<h2 style="font-size:36px;margin:20px 0">You may also like</h2><div class="pgrid">${rel.map((x, i) => pcard(x, i)).join('')}</div>` : ''}<div style="height:70px"></div></div>`;
  }
};
act({
  scat: el => { SF.cat = el.dataset.c; repaint(); }, pcolor: el => { SEL.color = el.dataset.c; SEL.size = null; repaint(); }, psize: el => { SEL.size = el.dataset.z; SEL.err = false; repaint(); },
  pq: el => { SEL.qty = Math.max(1, Math.min(10, SEL.qty + +el.dataset.d)); repaint(); },
  padd: () => {
    const { p } = V.product._d; if (!SEL.size) { SEL.err = true; return repaint(); }
    const v = p.product_variants.find(x => x.color === SEL.color && x.size === SEL.size); if (!v || v.stock < SEL.qty) { toast('Not enough stock for that choice.'); return; }
    addCart({ key: 'p-' + v.id, kind: 'product', id: v.id, qty: SEL.qty, title: p.name, detail: `${v.color} · ${v.size}`, price: p.price_kes, img: p.image_path ? imgUrl(p.image_path) : '/img/mono.png' }); toast('Added to cart'); actions.cart();
  }
});

/* ---------- checkout + order ---------- */
const CO = { name: '', email: '', phone: '', method: 'ship', town: '', addr: '', err: {}, busy: false, msg: '' };
V.checkout = {
  async load() { if (S.user && !CO.name) { CO.name = S.profile?.full_name || ''; CO.email = S.user.email || ''; CO.phone = S.profile?.phone || ''; } return {}; },
  html() {
    if (!S.cart.length) return `<div class="wrap" style="padding-top:60px">${empty('Your cart is empty.', '<a class="btn" href="#events">Browse events</a>')}</div>`;
    const hasP = S.cart.some(i => i.kind === 'product'), sub = cartTotal(), merch = S.cart.filter(i => i.kind === 'product').reduce((a, i) => a + i.price * i.qty, 0), st = S.settings;
    const ship = hasP && CO.method === 'ship' ? (merch >= st.free_shipping_over_kes ? 0 : st.shipping_fee_kes) : 0, E = CO.err;
    const f = (k, l, t, ph) => `<div class="field ${E[k] ? 'bad' : ''}"><label for="c-${k}">${l}</label><input type="${t}" id="c-${k}" data-c="${k}" placeholder="${ph}" value="${esc(CO[k])}" autocomplete="${{ name: 'name', email: 'email', phone: 'tel', town: 'address-level2', addr: 'street-address' }[k]}">${E[k] ? `<span class="err" role="alert">${E[k]}</span>` : ''}</div>`;
    return `<div class="wrap">${pageHead('Checkout', 'Almost there')}<div class="cogrid"><div class="form">${CO.msg ? `<div class="banner" role="alert">${esc(CO.msg)}</div>` : ''}
    <div class="panel form"><h3 style="font-size:28px">Your details ${S.user ? '' : '<span class="label">guest checkout</span>'}</h3><div class="row2">${f('name', 'Full name', 'text', 'Amina Otieno')}${f('email', 'Email (tickets are sent here)', 'email', 'you@example.com')}</div>${f('phone', 'Phone', 'tel', '0712 345 678')}${S.user ? '' : '<p class="muted" style="font-size:13px"><a class="link" data-act="signin">Sign in</a> to keep your tickets in your account.</p>'}</div>
    ${hasP ? `<div class="panel form"><h3 style="font-size:28px">Merchandise</h3><label class="radio ${CO.method === 'ship' ? 'on' : ''}"><input type="radio" name="dl" value="ship" data-dl ${CO.method === 'ship' ? 'checked' : ''}><span><b>Deliver to me</b><br><span class="muted" style="font-size:13px">${kes(st.shipping_fee_kes)}, free over ${kes(st.free_shipping_over_kes)}</span></span></label><label class="radio ${CO.method === 'pickup' ? 'on' : ''}"><input type="radio" name="dl" value="pickup" data-dl ${CO.method === 'pickup' ? 'checked' : ''}><span><b>Collect at the event</b><br><span class="muted" style="font-size:13px">Free, ready at the Unseen Kenya desk</span></span></label>${CO.method === 'ship' ? `<div class="row2">${f('town', 'Town or city', 'text', 'Nairobi')}${f('addr', 'Delivery address', 'text', 'Street, building, landmark')}</div>` : ''}</div>` : ''}
    <div class="panel"><h3 style="font-size:28px;margin-bottom:8px">Payment</h3><p class="muted" style="font-size:14px">${sub + ship === 0 ? 'This order is free. No payment needed.' : 'You will pay on Paystack’s secure page with M-Pesa (STK push to your phone) or card, then return here for your tickets.'}</p></div></div>
    <aside class="panel buy"><span class="label v">Order summary</span><div style="margin:14px 0">${S.cart.map((i, x) => `<div class="sumline"><span>${esc(i.title)} <span class="muted">× ${i.qty}</span><br><span class="muted" style="font-size:12px">${esc(i.detail)}</span></span><span class="tnum">${kes(i.price * i.qty)}</span></div>`).join('')}</div><div class="sumline"><span class="muted">Subtotal</span><span class="tnum">${kes(sub)}</span></div>${hasP ? `<div class="sumline"><span class="muted">Delivery</span><span class="tnum">${ship ? kes(ship) : 'Free'}</span></div>` : ''}<div class="sumline t"><span>Total</span><span class="tnum">${kes(sub + ship)}</span></div>
    <button class="btn block" style="margin-top:18px" data-act="place" ${CO.busy ? 'disabled' : ''}>${CO.busy ? 'Starting payment…' : sub + ship === 0 ? 'Confirm RSVP' : 'Pay ' + kes(sub + ship)}</button><button class="link" style="margin-top:14px;display:block;text-align:center;width:100%" data-act="cart">Edit cart</button></aside></div></div>`;
  }
};
export const onCheckoutInput = el => { CO[el.dataset.c] = el.value; };
export const onDelivery = el => { CO.method = el.value; repaint(); };
document.addEventListener('cartchange', () => { if (location.hash === '#checkout') repaint(); });
act({
  place: async () => {
    const E = {}, hasP = S.cart.some(i => i.kind === 'product');
    if (CO.name.trim().length < 2) E.name = 'Enter your full name.'; if (!/^\S+@\S+\.\S{2,}$/.test(CO.email)) E.email = 'Enter a valid email address.'; if (CO.phone.replace(/\D/g, '').length < 9) E.phone = 'Enter a phone number.';
    if (hasP && CO.method === 'ship') { if (!CO.town.trim()) E.town = 'Add your town.'; if (!CO.addr.trim()) E.addr = 'Add a delivery address.'; }
    CO.err = E; CO.msg = ''; if (Object.keys(E).length) { repaint(); return $('.field.bad input')?.focus(); }
    CO.busy = true; repaint();
    const { data, error } = await sb.functions.invoke('checkout', { body: { items: S.cart.map(i => ({ kind: i.kind, id: i.id, qty: i.qty })), customer: { name: CO.name.trim(), email: CO.email.trim(), phone: CO.phone.trim() }, delivery: { method: hasP ? CO.method : 'none', town: CO.town, address: CO.addr } } });
    CO.busy = false;
    if (error || !data) { CO.msg = await errMsg(error); return repaint(); }
    store.set('lastref', data.reference);
    if (data.status === 'paid') { S.cart = []; saveCart(); return go('order-' + data.reference); }
    location.href = data.authorization_url;
  }
});
V.order = {
  async load(ref) {
    const run = async () => { const { data, error } = await sb.functions.invoke('verify-payment', { body: { reference: ref } }); return error ? { error: await errMsg(error) } : data; };
    let d = await run();
    for (let i = 0; i < 12 && d.status === 'pending'; i++) { await wait(4000); d = await run(); if (!location.hash.includes(ref)) break; }
    if (d.status === 'paid') { S.cart = []; saveCart(); d.qrs = await Promise.all((d.tickets || []).map(t => qr(t.code))); }
    return d;
  },
  html(d) {
    if (d.error) return `<div class="wrap" style="padding-block:80px;max-width:640px">${empty(esc(d.error), '<a class="btn" href="#home">Home</a>')}</div>`;
    const ok = d.status === 'paid';
    return `<div class="wrap" style="max-width:760px;padding-block:60px 80px;text-align:center"><img class="eye" src="/img/mono.png" alt="" style="margin:0 auto 24px;width:110px"><span class="label v">${ok ? 'Order confirmed' : d.status === 'pending' ? 'Waiting for payment' : d.status === 'refund_due' ? 'Needs attention' : 'Payment not completed'}</span>
    <h1 style="font-size:clamp(40px,7vw,72px);margin:12px 0">${ok ? 'You’re in.' : d.status === 'pending' ? 'Still confirming' : d.status === 'refund_due' ? 'We’ll sort this out' : 'No payment taken'}</h1><p class="muted">Order <b class="tnum" style="color:var(--bone)">${esc(d.reference)}</b> · ${kes(d.total_kes)}</p>
    ${d.status === 'refund_due' ? '<p style="margin-top:14px">Your payment arrived but the order could not be completed (for example, the last tickets sold while you paid). You will be refunded. Contact us with your order number if you do not hear back.</p>' : ''}
    ${d.status === 'pending' ? '<p style="margin-top:14px">If you have approved the payment on your phone, this page updates within a minute.</p><p style="margin-top:20px"><button class="btn" data-act="refresh">Check again</button></p>' : ''}
    ${!ok && d.status !== 'pending' && d.status !== 'refund_due' ? '<p style="margin-top:20px"><a class="btn" href="#checkout">Try again</a></p>' : ''}
    ${ok ? `<div class="panel" style="text-align:left;margin:30px 0">${d.items.map(i => `<div class="sumline"><span>${esc(i.title)} <span class="muted">× ${i.qty}</span><br><span class="muted" style="font-size:12px">${esc(i.detail || '')}</span></span><span class="tnum">${kes(i.unit_price_kes * i.qty)}</span></div>`).join('')}</div>
    ${d.tickets.length ? `<h2 style="font-size:34px;margin:30px 0 16px">Your tickets</h2><div style="display:grid;gap:14px;text-align:left">${d.tickets.map((t, i) => `<div class="ticketcard"><img class="qr" src="${d.qrs[i]}" alt="Ticket QR code ${esc(t.code)}"><div><b style="font-family:var(--display);font-size:26px">${esc(t.events?.title || 'Event')}</b><div class="muted">${t.events ? longDate(t.events.starts_at) + ' · ' + esc(t.events.venue) : ''}</div><code>${esc(t.code)}</code><div class="muted" style="font-size:12px">${esc(t.holder_name || '')}</div></div></div>`).join('')}</div>` : ''}
    <p class="muted" style="margin:24px 0">${d.delivery_method === 'pickup' ? 'Collect your merchandise at the event desk.' : d.delivery_method === 'ship' ? 'We will contact you about delivery.' : ''} Keep this page or find your tickets under Account.</p><div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap"><a class="btn" href="#account">My tickets</a><a class="btn ghost" href="#events">Find another event</a></div>` : ''}</div>`;
  }
};
act({ refresh: () => render() });

/* ---------- account ---------- */
const AT = { tab: 'tickets' };
V.account = {
  async load() {
    if (!S.user) return null;
    const [t, o] = await Promise.all([sb.from('tickets').select('id,code,holder_name,checked_in_at,events(id,title,starts_at,venue,town),orders!inner(user_id)').eq('orders.user_id', S.user.id).order('created_at', { ascending: false }), sb.from('orders').select('*, order_items(title,detail,qty,unit_price_kes)').eq('user_id', S.user.id).order('created_at', { ascending: false })]);
    const tickets = t.data || []; const qrs = await Promise.all(tickets.map(x => qr(x.code))); return { tickets, qrs, orders: o.data || [] };
  },
  html(d) {
    if (!d) return needSignIn('Sign in to see your tickets, orders and events.');
    const body = AT.tab === 'tickets' ? (d.tickets.length ? `<div style="display:grid;gap:14px">${d.tickets.map((t, i) => `<div class="ticketcard"><img class="qr" src="${d.qrs[i]}" alt="QR code for ticket ${esc(t.code)}"><div><b style="font-family:var(--display);font-size:26px">${esc(t.events?.title || 'Event')}</b><div class="muted">${t.events ? longDate(t.events.starts_at) + ' · ' + esc(t.events.venue) + ', ' + esc(t.events.town) : ''}</div><code>${esc(t.code)}</code> ${t.checked_in_at ? '<span class="pill">Checked in</span>' : ''}</div></div>`).join('')}</div>` : empty('No tickets yet.', '<a class="btn" href="#events">Browse events</a>'))
      : AT.tab === 'orders' ? (d.orders.length ? `<div class="tablewrap"><table><thead><tr><th>Order</th><th>Items</th><th>Total</th><th>Status</th></tr></thead><tbody>${d.orders.map(o => `<tr><td class="tnum"><a class="link" href="#order-${esc(o.reference)}">${esc(o.reference)}</a><br><span class="muted" style="font-size:12px">${longDate(o.created_at)}</span></td><td>${o.order_items.map(i => `${esc(i.title)} × ${i.qty}`).join('<br>')}</td><td class="tnum">${kes(o.total_kes)}</td><td><span class="pill ${o.status === 'paid' ? '' : 'v'}">${esc(o.status.replace('_', ' '))}</span></td></tr>`).join('')}</tbody></table></div>` : empty('No orders yet.'))
        : `<form id="profform" class="panel form" style="max-width:520px"><div class="field"><label for="p-name">Full name</label><input type="text" id="p-name" value="${esc(S.profile?.full_name || '')}"></div><div class="field"><label for="p-phone">Phone</label><input type="tel" id="p-phone" value="${esc(S.profile?.phone || '')}"></div><div class="field"><label>Email</label><input type="text" value="${esc(S.user.email)}" disabled></div><div style="display:flex;gap:12px"><button class="btn">Save</button><button type="button" class="btn ghost" data-act="signout">Sign out</button></div></form>`;
    return `<div class="wrap">${pageHead('Account', esc((S.profile?.full_name || 'Your account').split(' ')[0]))}<div class="tabs">${[['tickets', 'Tickets'], ['orders', 'Orders'], ['profile', 'Profile']].map(([k, t]) => `<button class="${AT.tab === k ? 'on' : ''}" data-act="atab" data-t="${k}">${t}</button>`).join('')}<a class="tabs-link" style="margin-left:auto;padding:12px 16px" href="#host"><span class="link">Host dashboard</span></a></div>${body}<div style="height:70px"></div></div>`;
  }
};
act({ atab: el => { AT.tab = el.dataset.t; repaint(); } });
document.addEventListener('submit', async e => { if (e.target.id !== 'profform') return; e.preventDefault(); const { error } = await sb.from('profiles').update({ full_name: $('#p-name').value.trim(), phone: $('#p-phone').value.trim() }).eq('id', S.user.id); if (error) return toast(error.message); const { data } = await sb.from('profiles').select('*').eq('id', S.user.id).single(); S.profile = data; toast('Profile saved'); });

/* ---------- create / edit event ---------- */
const STEPS = ['Basics', 'When & where', 'Tickets', 'Photos', 'Publish'];
const blank = () => ({ title: '', pillar: '', description: '', date: '', time: '18:00', venue: '', town: '', lat: null, lng: null, free: false, cap: 100, tiers: [{ name: 'General', price: 1500, qty: 100 }], coverPath: 'site:dusk', coverFile: null, files: [], editing: null });
let DR = Object.assign(blank(), store.get('draft', {}), { files: [], coverFile: null, editing: null }); let step = 1, errs = {}, publishing = false;
const save = () => { const { files, coverFile, ...rest } = DR; if (!DR.editing) store.set('draft', rest); const s = $('#savedtxt'); if (s) s.textContent = 'Draft saved'; };
const validate = s => { const e = {}, d = DR; if (s === 1) { if (d.title.trim().length < 4) e.title = 'Give your event a name of at least 4 characters.'; if (!d.pillar) e.pillar = 'Choose the pillar that fits best.'; if (d.description.trim().length < 30) e.description = 'Describe it in at least 30 characters so people know what to expect.'; }
  if (s === 2) { if (!d.date) e.date = 'Pick a date.'; else if (!d.editing && new Date(toStarts(d.date, d.time)) < new Date()) e.date = 'Choose a date in the future.'; if (!d.time) e.time = 'Pick a start time.'; if (!d.town.trim()) e.town = 'Add the town or city.'; if (!d.venue.trim()) e.venue = 'Add the venue or meeting point.'; }
  if (s === 3) { if (d.free) { if (!(d.cap > 0)) e.cap = 'Capacity must be at least 1.'; } else d.tiers.forEach((t, i) => { if (!t.name.trim()) e['tn' + i] = 'Name this tier.'; if (!(t.price >= 0) || t.price === '') e['tp' + i] = 'Enter a price.'; if (!(t.qty > 0)) e['tq' + i] = 'At least 1.'; if (t.sold > t.qty) e['tq' + i] = `At least ${t.sold} (already sold).`; }); }
  return e; };
const fld = (k, l, inner) => `<div class="field ${errs[k] ? 'bad' : ''}"><label for="d-${k}">${l}</label>${inner}${errs[k] ? `<span class="err" role="alert">${errs[k]}</span>` : ''}</div>`;
const evUploadHTML = () => `<p class="muted">Choose a cover image, then add any photos you already have. Guests can add more after the event.</p>${uploaderHTML('ev', DR.files)}<div class="field" style="margin-top:22px"><span class="lab">Cover image</span><div class="starters">${DR.coverFile ? `<button type="button" class="on" aria-label="Your cover"><img src="${DR.coverFile.src}" alt=""></button>` : ''}${DR.files.map(f => `<button type="button" data-act="cover-up" data-id="${f.id}" aria-label="Use as cover"><img src="${f.src}" alt=""></button>`).join('')}${['dusk', 'sun', 'lake', 'deer', 'bird', 'tower'].map(k => `<button type="button" class="${!DR.coverFile && DR.coverPath === 'site:' + k ? 'on' : ''}" data-act="cover" data-k="${k}" aria-label="Starter ${k}"><img src="/img/${k}.jpg" alt=""></button>`).join('')}</div></div>`;
function stepBody() {
  const d = DR;
  if (step === 1) return `${fld('title', 'Event name', `<input type="text" id="d-title" data-d="title" maxlength="120" value="${esc(d.title)}" placeholder="e.g. Dusk Listening in Karura">`)}<div class="field ${errs.pillar ? 'bad' : ''}"><span class="lab" id="pl">Pillar</span><div class="chips" role="group" aria-labelledby="pl">${PNAMES.map(p => `<button type="button" class="chip ${d.pillar === p ? 'on' : ''}" data-act="dpillar" data-p="${p}">${p}</button>`).join('')}</div>${errs.pillar ? `<span class="err" role="alert">${errs.pillar}</span>` : ''}</div>${fld('description', 'Description', `<textarea id="d-description" data-d="description" placeholder="What will people see, hear, taste or learn?">${esc(d.description)}</textarea>`)}`;
  if (step === 2) return `<div class="row2">${fld('date', 'Date (Nairobi time)', `<input type="date" id="d-date" data-d="date" value="${d.date}">`)}${fld('time', 'Start time', `<input type="time" id="d-time" data-d="time" value="${d.time}">`)}</div><div class="field"><span class="lab">Find the place</span><div id="psearch"></div></div><div class="map" id="pickmap"></div><p class="muted" style="font-size:12px" id="pinnote">${d.lat != null ? `Pin set at ${d.lat.toFixed(4)}, ${d.lng.toFixed(4)}. Drag it or click the map to adjust.` : 'Search above, or click the map to drop a pin. The pin shows on your event page with directions.'}</p><div class="row2">${fld('town', 'Town or city', `<input type="text" id="d-town" data-d="town" value="${esc(d.town)}" placeholder="e.g. Naivasha">`)}${fld('venue', 'Venue or meeting point', `<input type="text" id="d-venue" data-d="venue" value="${esc(d.venue)}" placeholder="e.g. Hell's Gate main gate">`)}</div>`;
  if (step === 3) return `<label class="toggle"><input type="checkbox" id="d-free" data-act="dfree" ${d.free ? 'checked' : ''}><i></i><span>This is a free event (RSVP only)</span></label>${d.free ? fld('cap', 'Capacity', `<input type="number" id="d-cap" data-d="cap" min="1" value="${d.cap}">`) : `<div class="form">${d.tiers.map((t, i) => `<div class="tierrow"><div class="field ${errs['tn' + i] ? 'bad' : ''}"><label for="t-n${i}">Tier name</label><input type="text" id="t-n${i}" data-tier="${i}" data-k="name" value="${esc(t.name)}">${errs['tn' + i] ? `<span class="err">${errs['tn' + i]}</span>` : ''}</div><div class="field"><label for="t-p${i}">Price (KES)</label><input type="number" id="t-p${i}" min="0" data-tier="${i}" data-k="price" value="${t.price}"></div><div class="field ${errs['tq' + i] ? 'bad' : ''}"><label for="t-q${i}">Capacity</label><input type="number" id="t-q${i}" min="1" data-tier="${i}" data-k="qty" value="${t.qty}">${errs['tq' + i] ? `<span class="err">${errs['tq' + i]}</span>` : ''}</div>${d.tiers.length > 1 && !t.sold ? `<button class="mini" style="height:46px;width:40px" data-act="rmtier" data-i="${i}" aria-label="Remove tier">✕</button>` : '<span></span>'}</div>`).join('')}<div><button class="btn ghost sm" data-act="addtier" type="button">+ Add a tier</button></div></div><p class="muted" style="font-size:13px">Guests pay with M-Pesa or card through Paystack. Prices are in Kenya shillings.</p>`}`;
  if (step === 4) return `<div id="evupload">${evUploadHTML()}</div>`;
  const e = DR, tiers = e.free ? [{ name: 'RSVP', price: 0, qty: +e.cap }] : e.tiers;
  return `<div class="panel"><h3 style="font-size:30px;margin-bottom:10px">Ready to ${DR.editing ? 'save' : 'publish'}</h3><p class="muted">Check the preview. You can change details from the dashboard later.</p><div class="sep"></div><div class="sumline"><span class="muted">Pillar</span><span>${esc(e.pillar)}</span></div><div class="sumline"><span class="muted">When</span><span>${e.date ? longDate(toStarts(e.date, e.time)) + ', ' + DP(toStarts(e.date, e.time)).t : '-'}</span></div><div class="sumline"><span class="muted">Where</span><span>${esc(e.venue)}, ${esc(e.town)}${e.lat != null ? '' : ' (no map pin)'}</span></div><div class="sumline"><span class="muted">Tickets</span><span>${tiers.map(t => esc(t.name) + ' ' + kes(+t.price)).join(', ')}</span></div><div class="sumline"><span class="muted">Photos</span><span>${e.files.length} to upload</span></div></div>`;
}
const coverSrc = () => DR.coverFile ? DR.coverFile.src : imgUrl(DR.coverPath);
const previewHTML = () => { const d = DR, p = d.date ? DP(toStarts(d.date, d.time)) : { d: '--', m: '---', w: '', t: '' }, mp = d.free ? 0 : Math.min(...d.tiers.map(t => +t.price || 0)); return `<span class="label">Live preview</span><div style="margin-top:12px"><div class="ecard" style="cursor:default"><div class="ph"><img src="${esc(coverSrc())}" alt=""><div class="date"><b>${p.d}</b><small>${p.m}</small></div><div class="tagc"><span class="pill">${esc(d.pillar || 'Pillar')}</span></div></div><div class="body"><h3>${esc(d.title || 'Your event title')}</h3><div class="meta">${p.w} ${p.t} · ${esc(d.town || 'Town')}</div><div class="foot"><span class="price ${mp === 0 ? 'v' : ''}">${mp === 0 ? 'Free' : 'From ' + kes(mp)}</span><span class="btn sm ghost">${mp === 0 ? 'RSVP' : 'Reserve'}</span></div></div></div></div>`; };
const prev = () => { const b = $('#preview'); if (b) b.innerHTML = previewHTML(); };
V.create = {
  async load(id) {
    if (!S.user) return null;
    if (id && DR.editing !== id) { const { data: e } = await sb.from('events').select(EVQ).eq('id', id).maybeSingle(); if (!e || (e.host_id !== S.user.id && !isAdmin())) return { denied: true };
      const dt = new Date(e.starts_at), z = o => dt.toLocaleString('en-CA', { timeZone: 'Africa/Nairobi', ...o }); const hh = dt.toLocaleTimeString('en-GB', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit' });
      DR = { ...blank(), editing: id, title: e.title, pillar: e.pillar, description: e.description, date: z({ year: 'numeric', month: '2-digit', day: '2-digit' }), time: hh, venue: e.venue, town: e.town, lat: e.lat, lng: e.lng, coverPath: e.cover_path || 'site:dusk', free: e.ticket_tiers.length === 1 && e.ticket_tiers[0].price_kes === 0, cap: e.ticket_tiers.reduce((a, t) => a + t.quantity, 0), tiers: e.ticket_tiers.sort((a, b) => a.sort - b.sort).map(t => ({ id: t.id, name: t.name, price: t.price_kes, qty: t.quantity, sold: t.sold })) }; step = 1; errs = {}; }
    else if (!id && DR.editing) { DR = blank(); step = 1; }
    return {};
  },
  html(d) {
    if (!S.user) return needSignIn('Sign in to create and manage events.');
    if (d?.denied) return `<div class="wrap">${empty('You can only edit your own events.', '<a class="btn" href="#host">Host dashboard</a>')}</div>`;
    return `<div class="wrap"><div class="pagehead" style="padding-bottom:20px"><span class="label v">${DR.editing ? 'Edit event' : 'Host an event'}</span><h1>${DR.editing ? 'Edit your event' : 'Create an event'}</h1></div><div class="stepper" role="list">${STEPS.map((s, i) => `<button role="listitem" class="${step === i + 1 ? 'on' : step > i + 1 ? 'done' : ''}" data-act="step" data-s="${i + 1}">${i + 1}. ${s}</button>`).join('')}</div>
    <div style="display:flex;justify-content:space-between;margin-bottom:26px;gap:10px;flex-wrap:wrap"><span class="saved" id="savedtxt">${DR.editing ? 'Editing a live event' : 'Drafts save automatically'}</span>${DR.editing ? '' : '<button class="link" data-act="resetdraft">Start over</button>'}</div>
    <div class="create"><div><div class="panel"><div class="form" id="stepbody">${stepBody()}</div><div class="stepnav"><button class="btn ghost" data-act="back" ${step === 1 ? 'disabled' : ''}>Back</button>${step < 5 ? '<button class="btn" data-act="next">Continue</button>' : `<button class="btn" data-act="publish" ${publishing ? 'disabled' : ''}>${publishing ? 'Publishing…' : DR.editing ? 'Save changes' : 'Publish event'}</button>`}</div></div></div><aside class="prevbox" id="preview">${previewHTML()}</aside></div></div>`;
  },
  mount() {
    if (step !== 2) return;
    const apply = async (lat, lng, fly) => { DR.lat = lat; DR.lng = lng; save(); const n = $('#pinnote'); if (n) n.textContent = `Pin set at ${lat.toFixed(4)}, ${lng.toFixed(4)}. Drag it or click the map to adjust.`; if (!fly && !DR.town.trim()) { const r = await reverse(lat, lng); if (r?.town && !DR.town.trim()) { DR.town = r.town; const i = $('#d-town'); if (i) i.value = r.town; save(); } } };
    const pm = pickerMap($('#pickmap'), DR, apply);
    placeSearch($('#psearch'), p => { pm.set(p.lat, p.lng, true); if (!DR.venue.trim()) { DR.venue = p.name; const v = $('#d-venue'); if (v) v.value = p.name; } if (p.town && !DR.town.trim()) { DR.town = p.town; const t = $('#d-town'); if (t) t.value = p.town; } save(); prev(); });
  }
};
export const onDraft = el => { const k = el.dataset.d; DR[k] = el.type === 'number' ? +el.value : el.value; save(); prev(); };
export const onTier = el => { DR.tiers[+el.dataset.tier][el.dataset.k] = el.type === 'number' ? +el.value : el.value; save(); prev(); };
act({
  dpillar: el => { DR.pillar = el.dataset.p; save(); render(false); }, dfree: el => { DR.free = el.checked; save(); render(false); },
  addtier: () => { DR.tiers.push({ name: 'New tier', price: 1000, qty: 20 }); save(); render(false); }, rmtier: el => { DR.tiers.splice(+el.dataset.i, 1); save(); render(false); },
  cover: el => { DR.coverPath = 'site:' + el.dataset.k; DR.coverFile = null; save(); $('#evupload').innerHTML = evUploadHTML(); prev(); },
  'cover-up': el => { const f = DR.files.find(x => x.id === el.dataset.id); DR.coverFile = f; $('#evupload').innerHTML = evUploadHTML(); prev(); },
  step: el => { const t = +el.dataset.s; if (t > step) for (let s = step; s < t; s++) { const e = validate(s); if (Object.keys(e).length) { step = s; errs = e; return render(false); } } errs = {}; step = t; render(false); scrollTo(0, 0); },
  next: () => { const e = validate(step); errs = e; if (Object.keys(e).length) { render(false); return $('.field.bad input,.field.bad textarea')?.focus(); } step++; render(false); scrollTo(0, 0); },
  back: () => { errs = {}; step--; render(false); scrollTo(0, 0); },
  resetdraft: () => { DR = blank(); step = 1; errs = {}; save(); render(false); toast('Draft cleared'); },
  publish: async () => {
    for (let s = 1; s <= 3; s++) { const e = validate(s); if (Object.keys(e).length) { step = s; errs = e; render(false); return toast('Fix the highlighted fields first'); } }
    publishing = true; render(false);
    try {
      const d = DR, uid = S.user.id, row = { title: d.title.trim(), pillar: d.pillar, description: d.description.trim(), starts_at: toStarts(d.date, d.time), venue: d.venue.trim(), town: d.town.trim(), lat: d.lat, lng: d.lng };
      let cover = d.coverPath; if (d.coverFile) cover = await uploadImage(d.coverFile.file, uid + '/covers'); row.cover_path = cover;
      let id = d.editing;
      if (id) { const { error } = await sb.from('events').update(row).eq('id', id); if (error) throw error; }
      else { const { data, error } = await sb.from('events').insert({ ...row, host_id: uid, host_name: S.profile?.full_name || null }).select('id').single(); if (error) throw error; id = data.id; }
      const tiers = d.free ? [{ name: 'RSVP', price: 0, qty: +d.cap, id: d.tiers[0]?.id }] : d.tiers;
      const keepIds = tiers.map(t => t.id).filter(Boolean);
      if (d.editing) { const { data: cur } = await sb.from('ticket_tiers').select('id,sold').eq('event_id', id); for (const c of cur || []) if (!keepIds.includes(c.id) && c.sold === 0) await sb.from('ticket_tiers').delete().eq('id', c.id); }
      for (let i = 0; i < tiers.length; i++) { const t = tiers[i], v = { name: t.name.trim(), price_kes: Math.round(+t.price), quantity: Math.round(+t.qty), sort: i }; const r = t.id ? await sb.from('ticket_tiers').update(v).eq('id', t.id) : await sb.from('ticket_tiers').insert({ event_id: id, ...v }); if (r.error) throw r.error; }
      for (const f of d.files) { const path = await uploadImage(f.file, uid); await sb.from('photos').insert({ path, caption: f.cap || null, event_id: id, pillar: d.pillar }); }
      const wasEdit = !!d.editing; DR = blank(); store.set('draft', null); step = 1; errs = {}; publishing = false; toast(wasEdit ? 'Event updated' : 'Your event is live'); go('event-' + id);
    } catch (e) { publishing = false; toast(await errMsg(e)); render(false); }
  }
});

/* ---------- host dashboard ---------- */
V.host = {
  async load() {
    if (!S.user) return null;
    let q = sb.from('events').select(EVQ).order('starts_at', { ascending: false }); if (!isAdmin()) q = q.eq('host_id', S.user.id);
    const [ev, st, ph] = await Promise.all([q, sb.rpc('my_event_stats'), sb.from('photos').select('*, events(title,host_id)').eq('status', 'pending').order('created_at')]);
    keep(ph.data); const stats = Object.fromEntries((st.data || []).map(s => [s.event_id, s]));
    return { ev: ev.data || [], stats, pend: (ph.data || []).filter(p => p.events && (isAdmin() || p.events.host_id === S.user.id)) };
  },
  html(d) {
    if (!d) return needSignIn('Sign in to manage your events.');
    const tp = Object.values(d.stats).reduce((a, s) => a + s.tickets_paid, 0), rv = Object.values(d.stats).reduce((a, s) => a + s.revenue_kes, 0);
    return `<div class="wrap">${pageHead('Host dashboard', 'Your events')}<div class="stats"><div><span class="label">Events</span><b>${d.ev.filter(e => e.status !== 'cancelled').length}</b></div><div><span class="label">Tickets sold</span><b>${tp}</b></div><div><span class="label">Revenue</span><b style="color:var(--volt)">${kes(rv)}</b></div><div><span class="label">Photos to review</span><b>${d.pend.length}</b></div></div>
    <div class="sechead" style="margin-bottom:16px"><h2 style="font-size:34px">Events</h2><a class="btn sm" href="#create" data-act="newevent">New event</a></div>
    ${d.ev.length ? `<div class="tablewrap"><table><thead><tr><th>Event</th><th>Date</th><th>Sold</th><th>Revenue</th><th>Actions</th></tr></thead><tbody>${d.ev.map(e => { const s = d.stats[e.id] || { tickets_paid: 0, revenue_kes: 0, capacity: 0 }, cap = s.capacity || 1; return `<tr><td><b>${esc(e.title)}</b><br><span class="muted" style="font-size:12px">${esc(e.town)} ${e.status === 'cancelled' ? '· <span style="color:var(--volt)">Cancelled</span>' : ''}</span></td><td class="tnum">${longDate(e.starts_at)}</td><td class="tnum">${s.tickets_paid} / ${s.capacity}<div class="prog"><i style="width:${Math.min(100, s.tickets_paid / cap * 100)}%"></i></div></td><td class="tnum">${kes(s.revenue_kes)}</td><td><div class="rowacts"><button class="btn ghost sm" data-go="event-${e.id}">View</button><button class="btn ghost sm" data-act="attendees" data-id="${e.id}">Guests</button><button class="btn ghost sm" data-go="edit-${e.id}">Edit</button><button class="btn ghost sm" data-act="dup" data-id="${e.id}">Duplicate</button>${e.status === 'cancelled' ? '' : HC === e.id ? `<button class="btn sm" data-act="cancelyes" data-id="${e.id}">Confirm cancel</button><button class="btn ghost sm" data-act="cancelno">Keep</button>` : `<button class="btn ghost sm" data-act="cancel" data-id="${e.id}">Cancel</button>`}</div></td></tr>`; }).join('')}</tbody></table></div>` : empty('You have not created an event yet.', '<a class="btn" href="#create">Create your first event</a>')}
    <h2 style="font-size:34px;margin:50px 0 16px">Photo moderation <span class="label">${d.pend.length} waiting</span></h2>${d.pend.length ? `<div class="modgrid">${d.pend.map(p => `<div class="mod"><img src="${esc(imgUrl(p.path))}" alt="${esc(p.caption || '')}"><div><span>${esc(p.caption || 'No caption')}</span><span class="muted" style="font-size:12px">${esc(p.events?.title || '')}</span><div style="display:flex;gap:8px"><button class="btn sm" data-act="approve" data-id="${p.id}">Approve</button><button class="btn ghost sm" data-act="remove" data-id="${p.id}">Remove</button></div></div></div>`).join('')}</div>` : `<div class="empty panel"><p>Nothing to review. New uploads from guests land here first.</p></div>`}${isAdmin() ? '<p style="margin-top:40px"><a class="link" href="#admin">Open admin: products and orders</a></p>' : ''}<div style="height:70px"></div></div>`;
  }
};
let HC = null;
act({
  newevent: () => { DR = blank(); step = 1; errs = {}; }, cancel: el => { HC = el.dataset.id; repaint(); }, cancelno: () => { HC = null; repaint(); },
  cancelyes: async el => { const { error } = await sb.from('events').update({ status: 'cancelled' }).eq('id', el.dataset.id); HC = null; toast(error ? error.message : 'Event cancelled. Refund ticket holders from your Paystack dashboard.'); render(); },
  approve: async el => { const { error } = await sb.from('photos').update({ status: 'approved' }).eq('id', el.dataset.id); toast(error ? error.message : 'Photo approved'); render(); },
  remove: async el => { const { error } = await sb.from('photos').update({ status: 'removed' }).eq('id', el.dataset.id); toast(error ? error.message : 'Photo removed'); render(); },
  dup: async el => { const { data: e } = await sb.from('events').select(EVQ).eq('id', el.dataset.id).single(); const { data: n, error } = await sb.from('events').insert({ host_id: S.user.id, host_name: e.host_name, title: e.title + ' (copy)', pillar: e.pillar, description: e.description, starts_at: new Date(new Date(e.starts_at).getTime() + 7 * 864e5).toISOString(), venue: e.venue, town: e.town, lat: e.lat, lng: e.lng, cover_path: e.cover_path }).select('id').single(); if (error) return toast(error.message); await sb.from('ticket_tiers').insert(e.ticket_tiers.map((t, i) => ({ event_id: n.id, name: t.name, price_kes: t.price_kes, quantity: t.quantity, sort: i }))); toast('Duplicated one week later. Edit to change the date.'); go('edit-' + n.id); },
  attendees: async el => {
    const { data } = await sb.from('tickets').select('id,code,holder_name,checked_in_at').eq('event_id', el.dataset.id).order('created_at'); const m = $('#modal');
    m.innerHTML = `<div class="box" style="width:min(560px,100%)"><button class="iconbtn x" data-act="modal-close" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button><h2 style="font-size:34px">Guests</h2>${data?.length ? `<div class="tablewrap" style="margin-top:14px"><table style="min-width:0"><tbody>${data.map(t => `<tr><td>${esc(t.holder_name || '')}<br><code style="color:var(--volt)">${esc(t.code)}</code></td><td style="text-align:right"><button class="btn sm ${t.checked_in_at ? 'ghost' : ''}" data-act="checkin" data-id="${t.id}" data-on="${t.checked_in_at ? '' : '1'}" data-e="${el.dataset.id}">${t.checked_in_at ? 'Undo check-in' : 'Check in'}</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted" style="margin-top:12px">No tickets sold yet.</p>'}</div>`; m.classList.add('open');
  },
  checkin: async el => { await sb.from('tickets').update({ checked_in_at: el.dataset.on ? new Date().toISOString() : null }).eq('id', el.dataset.id); actions.attendees({ dataset: { id: el.dataset.e } }); },
  'modal-close': () => $('#modal').classList.remove('open'),
});

/* ---------- admin ---------- */
const AD = { tab: 'products', edit: null };
V.admin = {
  async load() { if (!isAdmin()) return null; const [p, o, s] = await Promise.all([sb.from('products').select('*, product_variants(*)').order('sort'), sb.from('orders').select('*, order_items(title,detail,qty)').order('created_at', { ascending: false }).limit(100), sb.from('settings').select('*')]); return { p: p.data || [], o: o.data || [], s: Object.fromEntries((s.data || []).map(x => [x.key, x.value])) }; },
  html(d) {
    if (!d) return `<div class="wrap">${pageHead('Admin', 'Restricted')}<div class="panel"><p class="muted">This area is for site admins. Make your account an admin in Supabase (see the README).</p></div></div>`;
    const e = AD.edit, tabs = [['products', 'Products'], ['orders', 'Orders'], ['settings', 'Delivery']];
    const body = AD.tab === 'products' ? (e ? prodForm(e) : `<div class="sechead" style="margin-bottom:16px"><span class="muted">${d.p.length} products</span><button class="btn sm" data-act="padmin" data-id="">New product</button></div><div class="tablewrap"><table><thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr></thead><tbody>${d.p.map(p => `<tr><td><b>${esc(p.name)}</b><br><span class="muted" style="font-size:12px">${esc(p.category)}</span></td><td class="tnum">${kes(p.price_kes)}</td><td class="tnum">${p.product_variants.reduce((a, v) => a + v.stock, 0)}</td><td><span class="pill ${p.active ? '' : 'warn'}">${p.active ? 'Live' : 'Hidden'}</span></td><td><button class="btn ghost sm" data-act="padmin" data-id="${p.id}">Edit</button></td></tr>`).join('')}</tbody></table></div>`)
      : AD.tab === 'orders' ? `<div class="tablewrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th></tr></thead><tbody>${d.o.map(o => `<tr><td class="tnum">${esc(o.reference)}<br><span class="muted" style="font-size:12px">${longDate(o.created_at)}</span></td><td>${esc(o.name)}<br><span class="muted" style="font-size:12px">${esc(o.email)} · ${esc(o.phone || '')}</span>${o.delivery_method === 'ship' ? `<br><span class="muted" style="font-size:12px">Ship: ${esc(o.delivery_town)}, ${esc(o.delivery_address)}</span>` : o.delivery_method === 'pickup' ? '<br><span class="muted" style="font-size:12px">Event pickup</span>' : ''}</td><td>${o.order_items.map(i => `${esc(i.title)} (${esc(i.detail || '')}) × ${i.qty}`).join('<br>')}</td><td class="tnum">${kes(o.total_kes)}</td><td><span class="pill ${o.status === 'paid' ? '' : o.status === 'refund_due' ? 'warn' : 'v'}">${esc(o.status.replace('_', ' '))}</span>${o.note ? `<br><span class="muted" style="font-size:11px">${esc(o.note)}</span>` : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No orders yet.</td></tr>'}</tbody></table></div>`
        : `<form id="setform" class="panel form" style="max-width:480px"><div class="field"><label for="s-fee">Delivery fee (KES)</label><input type="number" id="s-fee" min="0" value="${d.s.shipping_fee_kes}"></div><div class="field"><label for="s-free">Free delivery over (KES)</label><input type="number" id="s-free" min="0" value="${d.s.free_shipping_over_kes}"></div><button class="btn">Save</button></form>`;
    return `<div class="wrap">${pageHead('Admin', 'Shop &amp; orders')}<div class="tabs">${tabs.map(([k, t]) => `<button class="${AD.tab === k ? 'on' : ''}" data-act="adtab" data-t="${k}">${t}</button>`).join('')}</div>${body}<div style="height:70px"></div></div>`;
  }
};
const prodForm = p => `<form id="prodform" class="panel form"><div class="row2"><div class="field"><label for="pf-name">Name</label><input type="text" id="pf-name" value="${esc(p.name)}" required></div><div class="field"><label for="pf-cat">Category</label><input type="text" id="pf-cat" value="${esc(p.category)}" placeholder="Apparel, Bags, Prints"></div></div><div class="field"><label for="pf-desc">Description</label><textarea id="pf-desc">${esc(p.description)}</textarea></div>
<div class="row2"><div class="field"><label for="pf-price">Price (KES)</label><input type="number" id="pf-price" min="0" value="${p.price_kes}"></div><div class="field"><label for="pf-shape">Placeholder shape (when no photo)</label><select id="pf-shape">${Object.keys(SH).map(s => `<option ${p.shape === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div></div>
<div class="field"><label for="pf-img">Product photo</label><input type="file" id="pf-img" accept="image/*">${p.image_path ? `<img src="${esc(imgUrl(p.image_path))}" alt="" style="width:120px;margin-top:8px">` : ''}</div><label class="toggle"><input type="checkbox" id="pf-active" ${p.active ? 'checked' : ''}><i></i><span>Show in the shop</span></label>
<div class="field"><span class="lab">Variants and stock</span><div id="vars" class="form">${(p.product_variants || []).map((v, i) => varRow(v, i)).join('')}</div><div><button type="button" class="btn ghost sm" data-act="addvar">+ Add size / colour</button></div></div>
<p class="err" id="pferr" role="alert"></p><div style="display:flex;gap:12px"><button class="btn">Save product</button><button type="button" class="btn ghost" data-act="padmin-close">Cancel</button></div></form>`;
const varRow = (v, i) => `<div class="tierrow" data-v="${i}" data-vid="${v.id || ''}"><div class="field"><label>Size</label><input type="text" class="v-size" value="${esc(v.size)}" placeholder="M"></div><div class="field"><label>Colour</label><input type="text" class="v-color" value="${esc(v.color)}" placeholder="Black"></div><div class="field"><label>Stock</label><input type="number" class="v-stock" min="0" value="${v.stock}"></div><button type="button" class="mini" style="height:46px;width:40px" data-act="rmvar" aria-label="Remove">✕</button></div>`;
act({
  adtab: el => { AD.tab = el.dataset.t; AD.edit = null; repaint(); },
  padmin: el => { const id = el.dataset.id; AD.edit = id ? V.admin._d.p.find(p => p.id === id) : { name: '', category: '', description: '', price_kes: 0, shape: 'tee', active: true, product_variants: [{ size: 'One size', color: 'Black', stock: 0 }] }; repaint(); }, 'padmin-close': () => { AD.edit = null; repaint(); },
  addvar: () => $('#vars').insertAdjacentHTML('beforeend', varRow({ size: '', color: '', stock: 0 }, Date.now())), rmvar: el => el.closest('.tierrow').remove(),
});
document.addEventListener('submit', async e => {
  if (e.target.id === 'setform') { e.preventDefault(); const r = await Promise.all([sb.from('settings').update({ value: +$('#s-fee').value }).eq('key', 'shipping_fee_kes'), sb.from('settings').update({ value: +$('#s-free').value }).eq('key', 'free_shipping_over_kes')]); toast(r.some(x => x.error) ? 'Could not save' : 'Saved'); }
  if (e.target.id !== 'prodform') return; e.preventDefault();
  const p = AD.edit, err = $('#pferr'); err.textContent = '';
  try {
    const rows = $$('#vars .tierrow').map(r => ({ id: r.dataset.vid || null, size: $('.v-size', r).value.trim(), color: $('.v-color', r).value.trim(), stock: Math.max(0, Math.round(+$('.v-stock', r).value || 0)) }));
    if (!$('#pf-name').value.trim()) throw new Error('Enter a product name.'); if (!rows.length || rows.some(r => !r.size || !r.color)) throw new Error('Every variant needs a size and a colour.');
    if (new Set(rows.map(r => r.size + '|' + r.color)).size !== rows.length) throw new Error('Two variants have the same size and colour.');
    let image_path = p.image_path || null; const f = $('#pf-img').files[0]; if (f) image_path = await uploadImage(f, 'products');
    const row = { name: $('#pf-name').value.trim(), category: $('#pf-cat').value.trim() || 'General', description: $('#pf-desc').value.trim(), price_kes: Math.round(+$('#pf-price').value || 0), shape: $('#pf-shape').value, active: $('#pf-active').checked, image_path };
    let id = p.id; if (id) { const { error } = await sb.from('products').update(row).eq('id', id); if (error) throw error; } else { const { data, error } = await sb.from('products').insert(row).select('id').single(); if (error) throw error; id = data.id; }
    const keep = rows.map(r => r.id).filter(Boolean); for (const v of p.product_variants || []) if (v.id && !keep.includes(v.id)) await sb.from('product_variants').delete().eq('id', v.id);
    for (const r of rows) { const v = { size: r.size, color: r.color, stock: r.stock }; const q = r.id ? await sb.from('product_variants').update(v).eq('id', r.id) : await sb.from('product_variants').insert({ product_id: id, ...v }); if (q.error) throw q.error; }
    AD.edit = null; toast('Product saved'); render();
  } catch (x) { err.textContent = await errMsg(x); }
});

/* ---------- lightbox ---------- */
const LB = { list: [], i: 0, z: false };
function lbRender() {
  const p = LB.list[LB.i]; if (!p) return;
  $('#lb').innerHTML = `<div class="bar2"><span class="label">${LB.i + 1} / ${LB.list.length}</span><div style="display:flex;gap:8px"><button class="btn ghost sm" data-act="lbz">${LB.z ? 'Zoom out' : 'Zoom'}</button><button class="btn ghost sm" data-act="lbshare">Copy link</button><button class="iconbtn" data-act="lbclose" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div></div><div class="stage"><button class="nv prev" data-act="lbp" aria-label="Previous">‹</button><img src="${esc(imgUrl(p.path))}" alt="${esc(p.caption || '')}" class="${LB.z ? 'z' : ''}" data-act="lbz"><button class="nv next" data-act="lbn" aria-label="Next">›</button></div><div class="info"><div><b>${esc(p.caption || 'Untitled')}</b><br><span class="muted" style="font-size:13px">${esc(p.pillar || 'Unseen Kenya')}</span></div><button class="btn ${p.liked ? '' : 'ghost'} sm" data-act="like" data-id="${p.id}">${p.liked ? '♥ Liked' : '♡ Like'} · ${p.likes}</button></div>`;
}
const lbMove = d => { LB.i = (LB.i + d + LB.list.length) % LB.list.length; LB.z = false; lbRender(); };
act({
  lb: async el => { LB.list = $$('[data-act="lb"]').map(b => photoCache[b.dataset.id]).filter((p, i, a) => p && a.indexOf(p) === i); LB.i = Math.max(0, LB.list.findIndex(p => p.id === el.dataset.id)); LB.z = false;
    if (S.user && !photoCache._liked) { const { data } = await sb.from('photo_likes').select('photo_id').eq('user_id', S.user.id); photoCache._liked = new Set((data || []).map(x => x.photo_id)); } LB.list.forEach(p => p.liked = photoCache._liked?.has(p.id)); lbRender(); $('#lb').classList.add('open'); },
  lbclose: () => $('#lb').classList.remove('open'), lbp: () => lbMove(-1), lbn: () => lbMove(1), lbz: () => { LB.z = !LB.z; lbRender(); }, lbshare: () => copy(location.href),
  like: async el => { if (!requireAuth('Sign in to like photos.')) return; const p = photoCache[el.dataset.id]; photoCache._liked ||= new Set(); if (p.liked) { await sb.from('photo_likes').delete().match({ photo_id: p.id, user_id: S.user.id }); p.liked = false; p.likes = Math.max(0, p.likes - 1); photoCache._liked.delete(p.id); } else { const { error } = await sb.from('photo_likes').insert({ photo_id: p.id, user_id: S.user.id }); if (error) return toast(error.message); p.liked = true; p.likes++; photoCache._liked.add(p.id); } lbRender(); },
});
export const lbKeys = e => { if (!$('#lb').classList.contains('open')) return; if (e.key === 'ArrowLeft') lbMove(-1); if (e.key === 'ArrowRight') lbMove(1); };
export const lbSwipe = d => lbMove(d);

/* ---------- router hooks (set by main) ---------- */
let render = () => { }, repaint = () => { };
export const bind = (r, p) => { render = r; repaint = p; };
