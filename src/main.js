import './styles.css';
import { sb, configured, S, $, $$, esc, act, actions, toast, go, loadUser, openAuth, drawer, saveCart, isAdmin, copy } from './lib/core.js';
import { V, bind, onChange, onSort, onCheckoutInput, onDelivery, onDraft, onTier, gcap, gev, addFiles, lbKeys, lbSwipe } from './views.js';

const NAV = [['Explore', 'home'], ['Events', 'events'], ['Gallery', 'gallery'], ['Shop', 'shop'], ['About', 'about'], ['Host an Event', 'create']];
const TAB = [['Home', 'home', '<path d="M4 11l8-7 8 7v9H4zM10 20v-6h4v6"/>'], ['Events', 'events', '<rect x="4" y="5" width="16" height="15"/><path d="M4 10h16M9 3v4M15 3v4"/>'], ['Gallery', 'gallery', '<rect x="3" y="4" width="18" height="16"/><circle cx="9" cy="10" r="2"/><path d="M3 18l6-5 4 3 3-2 5 4"/>'], ['Shop', 'shop', '<path d="M5 8h14l-1.2 11H6.2zM9 8V6a3 3 0 016 0v2"/>'], ['Host', 'create', '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>']];
const ALIAS = { edit: 'create', order: 'order' };
const GROUP = { event: 'events', product: 'shop', host: 'create', checkout: 'shop', order: 'shop', edit: 'create', account: 'home', admin: 'create' };
const route = () => { const h = location.hash.slice(1) || 'home', i = h.indexOf('-'); const name = i < 0 ? h : h.slice(0, i), id = i < 0 ? '' : h.slice(i + 1); return { name: ALIAS[name] && name === 'edit' ? 'create' : name, raw: name, id }; };

function chrome() {
  const { raw } = route(), grp = GROUP[raw] || raw;
  const nav = NAV.filter(([, h]) => h !== 'create' || isAdmin()), tabs = TAB.filter(([, h]) => h !== 'create' || isAdmin());
  $('#links').innerHTML = nav.map(([t, h]) => `<a href="#${h}" class="${grp === h ? 'on' : ''}">${t}</a>`).join('');
  $('#tabs').innerHTML = tabs.map(([t, h, p]) => `<button data-go="${h}" class="${grp === h ? 'on' : ''}"><svg viewBox="0 0 24 24">${p}</svg>${t}</button>`).join('');
  $('#tabs').style.gridTemplateColumns = `repeat(${tabs.length}, minmax(0, 1fr))`;
  $('#menulinks').innerHTML = nav.concat([[S.user ? 'Account' : 'Sign in', S.user ? 'account' : '__in'], ...(S.user ? [['Host dashboard', 'host']] : []), ...(isAdmin() ? [['Admin', 'admin']] : []), ['Cart', '__cart']]).map(([t, h]) => h === '__cart' ? `<a data-act="cart">${t}</a>` : h === '__in' ? `<a data-act="signin">${t}</a>` : `<a data-go="${h}">${t}</a>`).join('');
  const init = (S.profile?.full_name || S.user?.email || '?').trim()[0];
  $('#authslot').innerHTML = S.user ? `<div class="usermenu"><button class="avatar" data-act="usermenu" aria-label="Account menu" aria-haspopup="true">${esc(init)}</button><div class="dropdown" id="udrop"><a href="#account">My tickets</a><a href="#host">Host dashboard</a>${isAdmin() ? '<a href="#admin">Admin</a>' : ''}<button data-act="signout">Sign out</button></div></div>` : `<button class="btn sm" data-act="signin">Join / Sign in</button>`;
  saveCart();
}
act({ menu: () => $('#menu').classList.add('open'), 'menu-close': () => $('#menu').classList.remove('open'), usermenu: () => $('#udrop').classList.toggle('open') });

let seq = 0, cur = null;
async function render(fresh = true) {
  const { name, id } = route(), v = V[name] || V.home, my = ++seq;
  if (!configured) { $('#app').innerHTML = `<div class="wrap" style="padding-block:90px;max-width:680px"><span class="label v">Setup needed</span><h1 style="font-size:56px;margin:12px 0 16px">Connect your database</h1><p class="muted">Copy <code>.env.example</code> to <code>.env</code> and add your Supabase URL and anon key, then restart. The README walks through each step.</p></div>`; return; }
  actions['close-all']?.(); $('#lb').classList.remove('open');
  if (fresh) {
    if (cur !== name + id) $('#app').innerHTML = '<div class="skeleton"><div class="spin"></div></div>';
    try { v._d = await v.load(id); } catch (e) { console.error(e); if (my === seq) $('#app').innerHTML = `<div class="wrap" style="padding-block:80px"><p class="banner">Something went wrong loading this page: ${esc(e.message || e)}</p><button class="btn" data-act="reload">Try again</button></div>`; return; }
    if (my !== seq) return;
  }
  cur = name + id; paint(v); chrome(); document.title = 'Unseen Kenya';
}
function paint(v) { v = v || V[route().name] || V.home; $('#app').innerHTML = v.html(v._d) + footer(); v.mount?.(v._d); wireDrop(); }
function repaint() { const y = scrollY, a = document.activeElement?.id; paint(); scrollTo(0, y); if (a) $('#' + a)?.focus?.(); }
bind(render, repaint);
act({ reload: () => render() });
const footer = () => `<footer><div class="wrap"><div class="fgrid"><div><img class="big" src="/img/logo.png" alt="Unseen Kenya"><p class="muted" style="max-width:28ch;font-family:var(--display);font-style:italic;font-size:20px">Beyond what meets the eye.</p></div><div><h4>Explore</h4><ul><li><a href="#events">Events</a></li><li><a href="#gallery">Gallery</a></li><li><a href="#shop">Shop</a></li><li><a href="#about">About</a></li></ul></div><div><h4>Hosts</h4><ul>${isAdmin() ? '<li><a href="#create">Create an event</a></li>' : ''}<li><a href="#host">Dashboard</a></li><li><a href="#gallery">Upload photos</a></li></ul></div><div><h4>Contact</h4><p class="muted" style="font-size:14px">Nairobi, Kenya</p></div></div><div class="fine"><span class="signoff">Discover. Connect. Belong.</span><span>© ${new Date().getFullYear()} Unseen Kenya</span></div></div></footer>`;
function wireDrop() { $$('.drop').forEach(d => { ['dragenter', 'dragover'].forEach(t => d.addEventListener(t, e => { e.preventDefault(); d.classList.add('over'); })); ['dragleave', 'drop'].forEach(t => d.addEventListener(t, e => { e.preventDefault(); d.classList.remove('over'); })); d.addEventListener('drop', e => addFiles(e.dataTransfer.files, d.dataset.ctx)); }); }

/* ---------- delegated events ---------- */
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]');
  if (a) { const f = actions[a.dataset.act]; if (f) { if (a.tagName === 'A' && !['upfor', 'close-all', 'newevent'].includes(a.dataset.act)) e.preventDefault(); return f(a, e); } }
  const g = e.target.closest('[data-go]'); if (g) { if (g.closest('.map,.mapbox') && !e.target.closest('.pin')) return; go(g.dataset.go); actions['close-all']?.(); return; }
  if (!e.target.closest('.usermenu')) $('#udrop')?.classList.remove('open');
});
document.addEventListener('input', e => { const t = e.target; if (t.dataset.d) onDraft(t); else if (t.dataset.tier !== undefined) onTier(t); else if (t.dataset.ucap) gcap(t); else if (t.dataset.c) onCheckoutInput(t); });
document.addEventListener('change', e => { const t = e.target; if (t.dataset.f) onChange.f(t); else if (t.dataset.uev) gev(t); else if (t.dataset.sort !== undefined) onSort(t); else if (t.matches('[data-dl]')) onDelivery(t); else if (t.matches('input[type=file][data-ctx]')) { addFiles(t.files, t.dataset.ctx); t.value = ''; } else if (t.dataset.act === 'dfree') actions.dfree(t); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { actions['close-all'](); $('#authmodal').classList.remove('open'); $('#modal').classList.remove('open'); $('#lb').classList.remove('open'); } lbKeys(e); if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=link][data-go]')) { e.preventDefault(); go(e.target.dataset.go); } });
let tx = 0; $('#lb').addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true }); $('#lb').addEventListener('touchend', e => { const dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 60) lbSwipe(dx < 0 ? 1 : -1); });
addEventListener('hashchange', () => { scrollTo(0, 0); render(); });
addEventListener('beforeunload', e => { /* nothing */ });

/* ---------- boot ---------- */
(async function boot() {
  // Paystack sends people back to the site root with ?reference=...
  const q = new URLSearchParams(location.search), ref = q.get('reference') || q.get('trxref');
  if (ref && /^UK-[A-Z0-9]{8}$/.test(ref)) { history.replaceState(null, '', location.pathname + '#order-' + ref); }
  else if (q.get('code')) { /* OAuth/email link: supabase-js exchanges it; clean the URL afterwards */ }
  if (configured) {
    await loadUser();
    const { data } = await sb.from('settings').select('*'); (data || []).forEach(s => S.settings[s.key] = s.value);
    sb.auth.onAuthStateChange(async (ev) => {
      if (ev === 'PASSWORD_RECOVERY') return openAuth('newpass', 'Choose a new password.');
      if (['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(ev)) { const before = S.user?.id; await loadUser(); if (before !== S.user?.id) { chrome(); render(); if (q.get('code')) history.replaceState(null, '', location.pathname + location.hash); } }
    });
  }
  chrome(); drawer(); render();
})();
