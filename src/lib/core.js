import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';

export const URL_ = import.meta.env.VITE_SUPABASE_URL, KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured = !!(URL_ && KEY);
export const sb = configured ? createClient(URL_, KEY, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } }) : null;

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const kes = n => n === 0 ? 'Free' : 'KES ' + Number(n).toLocaleString('en-US');
const TZ = 'Africa/Nairobi';
export const DP = iso => { const d = new Date(iso), f = o => d.toLocaleString('en-US', { timeZone: TZ, ...o }); return { d: f({ day: 'numeric' }), m: f({ month: 'short' }), w: f({ weekday: 'short' }), t: f({ hour: 'numeric', minute: '2-digit' }), y: f({ year: 'numeric' }) }; };
export const longDate = iso => { const p = DP(iso); return `${p.w} ${p.d} ${p.m} ${p.y}`; };
export const toStarts = (date, time) => `${date}T${time || '18:00'}:00+03:00`;
export const PILLARS = [['People', 'forest', 'The faces behind the places'], ['Culture', 'tower', 'Rituals, craft and memory'], ['Food', 'deer', 'Tables worth travelling for'], ['Music', 'sun', 'Sound from every county'], ['Fashion', 'canopy', 'Cloth, cut and character'], ['Art', 'dusk', 'Studios, walls and walks'], ['Talent', 'lake', 'Stages for the unheard'], ['Communities', 'lodge', 'Gatherings that hold people'], ['Hidden Gems', 'tower', 'Places off the usual map'], ['Natural World', 'bird', 'Forest, wing and horizon']];
export const PNAMES = PILLARS.map(p => p[0]);
const ICON = { People: '<circle cx="12" cy="9" r="3"/><circle cx="5.5" cy="10.5" r="2"/><circle cx="18.5" cy="10.5" r="2"/><path d="M6.5 19c0-3.3 2.5-5 5.5-5s5.5 1.7 5.5 5"/>', Culture: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/><path d="M12 3v18M3 12h18"/>', Food: '<path d="M3.5 12h17a8.5 8.5 0 01-17 0zM8 12c0-3 2-4 4-4s4 1 4 4M9 20h6"/>', Music: '<path d="M6 8h12l-1.5 11a2 2 0 01-2 1.5h-5a2 2 0 01-2-1.5zM6 8c0-1.5 2.7-2.5 6-2.5s6 1 6 2.5"/>', Fashion: '<path d="M8 4l4 2.5L16 4l5 4-2.5 3.5L17 10.5V20H7v-9.5l-1.5 1L3 8z"/>', Art: '<path d="M18.5 3.5l2 2-11 11-3.5 1 1-3.5zM6 18l-2.5 2.5"/>', Talent: '<path d="M12 3.5l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.8l6-.8z"/>', Communities: '<circle cx="12" cy="6" r="2"/><circle cx="6" cy="10" r="2"/><circle cx="18" cy="10" r="2"/><circle cx="8.5" cy="16.5" r="2"/><circle cx="15.5" cy="16.5" r="2"/>', 'Hidden Gems': '<path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0113 0c0 5.2-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.5"/>', 'Natural World': '<path d="M5 19C5 10 10 5 20 4c0 9-4 15-13 15zM5 19l9-9"/>' };
export const ico = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[n] || ''}</svg>`;

export function imgUrl(p) {
  if (!p) return '/img/dusk.jpg';
  if (p.startsWith('site:')) return `/img/${p.slice(5)}.jpg`;
  if (p.startsWith('blob:') || p.startsWith('http') || p.startsWith('/')) return p;
  return sb.storage.from('media').getPublicUrl(p).data.publicUrl;
}

/* ---------- ui helpers ---------- */
export const S = { user: null, profile: null, cart: [], settings: { shipping_fee_kes: 350, free_shipping_over_kes: 5000 } };
export const actions = {};
export const act = o => Object.assign(actions, o);
export function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3200); }
export const go = h => { location.hash = h; };
const store = { get(k, d) { try { const v = localStorage.getItem('uk_' + k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem('uk_' + k, JSON.stringify(v)); } catch { } } };
export { store };
export const wait = ms => new Promise(r => setTimeout(r, ms));
export async function errMsg(e) { try { if (e?.context?.json) { const j = await e.context.json(); if (j?.error) return j.error; } } catch { } return e?.message || 'Something went wrong. Please try again.'; }

/* ---------- auth ---------- */
export const isAdmin = () => S.profile?.role === 'admin';
export async function loadUser() {
  if (!sb) return;
  const { data } = await sb.auth.getSession();
  S.user = data.session?.user ?? null;
  S.profile = null;
  if (S.user) { const { data: p } = await sb.from('profiles').select('*').eq('id', S.user.id).maybeSingle(); S.profile = p; }
}
export function requireAuth(msg) { if (S.user) return true; openAuth('signin', msg || 'Sign in to continue.'); return false; }
export function openAuth(mode = 'signin', note = '') {
  const m = $('#authmodal'); const su = mode === 'signup', rs = mode === 'reset', up = mode === 'newpass';
  m.innerHTML = `<div class="box"><button class="iconbtn x" data-act="auth-close" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
  <span class="label v">Unseen Kenya</span><h2>${up ? 'New password' : rs ? 'Reset password' : su ? 'Create account' : 'Welcome back'}</h2>
  ${note ? `<p class="muted" style="margin-bottom:14px">${esc(note)}</p>` : ''}
  <form id="authform" class="form" style="margin-top:16px" novalidate>
  ${up || rs ? '' : `<button type="button" class="gbtn" data-act="google"><svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 010-9.4l-7.9-6.1a24 24 0 000 21.6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>Continue with Google</button><div class="or">or</div>`}
  ${su ? `<div class="field"><label for="a-name">Full name</label><input type="text" id="a-name" autocomplete="name"></div>` : ''}
  ${up ? '' : `<div class="field"><label for="a-email">Email</label><input type="email" id="a-email" autocomplete="email"></div>`}
  ${rs ? '' : `<div class="field"><label for="a-pass">${up ? 'New password' : 'Password'}</label><input type="password" id="a-pass" autocomplete="${su || up ? 'new-password' : 'current-password'}" minlength="8" style="width:100%;background:var(--coal);border:1px solid var(--line);color:var(--bone);padding:12px 14px;min-height:46px;font:inherit"></div>`}
  <p class="err" id="autherr" role="alert"></p>
  <button class="btn block" id="authgo">${up ? 'Save password' : rs ? 'Send reset link' : su ? 'Create account' : 'Sign in'}</button></form>
  <p class="muted" style="font-size:13px;margin-top:16px;text-align:center">${up ? '' : rs ? `<a class="link" data-act="auth-mode" data-m="signin">Back to sign in</a>` : su ? `Have an account? <a class="link" data-act="auth-mode" data-m="signin">Sign in</a>` : `New here? <a class="link" data-act="auth-mode" data-m="signup">Create account</a> · <a class="link" data-act="auth-mode" data-m="reset">Forgot password?</a>`}</p></div>`;
  m.dataset.mode = mode; m.classList.add('open'); setTimeout(() => $('#a-email,#a-pass')?.focus(), 50);
}
async function submitAuth(e) {
  e.preventDefault();
  const m = $('#authmodal').dataset.mode, em = $('#a-email')?.value.trim(), pw = $('#a-pass')?.value, err = $('#autherr'), btn = $('#authgo');
  err.textContent = '';
  if (m !== 'newpass' && !/^\S+@\S+\.\S+$/.test(em || '')) return err.textContent = 'Enter a valid email address.';
  if (m !== 'reset' && (pw || '').length < 8) return err.textContent = 'Password must be at least 8 characters.';
  btn.disabled = true;
  let r;
  if (m === 'signin') r = await sb.auth.signInWithPassword({ email: em, password: pw });
  else if (m === 'signup') { const nm = $('#a-name').value.trim(); if (nm.length < 2) { btn.disabled = false; return err.textContent = 'Enter your full name.'; } r = await sb.auth.signUp({ email: em, password: pw, options: { data: { full_name: nm }, emailRedirectTo: location.origin } }); }
  else if (m === 'reset') r = await sb.auth.resetPasswordForEmail(em, { redirectTo: location.origin });
  else r = await sb.auth.updateUser({ password: pw });
  btn.disabled = false;
  if (r.error) return err.textContent = r.error.message;
  if (m === 'reset') { $('#authmodal').classList.remove('open'); return toast('Check your email for the reset link.'); }
  if (m === 'signup' && !r.data.session) { $('#authmodal').classList.remove('open'); return toast('Check your email to confirm your account, then sign in.'); }
  $('#authmodal').classList.remove('open'); toast(m === 'newpass' ? 'Password updated' : 'Signed in');
}
document.addEventListener('submit', e => { if (e.target.id === 'authform') submitAuth(e); });
act({
  'auth-close': () => $('#authmodal').classList.remove('open'), 'auth-mode': (el) => openAuth(el.dataset.m),
  google: async () => { const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin } }); if (error) $('#autherr').textContent = error.message; },
  signout: async () => { await sb.auth.signOut(); go('home'); toast('Signed out'); }, signin: () => openAuth('signin'),
});

/* ---------- cart ---------- */
S.cart = store.get('cart', []);
export const cartTotal = () => S.cart.reduce((a, i) => a + i.price * i.qty, 0);
export function addCart(it) { const f = S.cart.find(c => c.key === it.key); if (f) f.qty = Math.min(10, f.qty + it.qty); else S.cart.push(it); saveCart(); }
export function saveCart() { store.set('cart', S.cart); const n = S.cart.reduce((a, i) => a + i.qty, 0), c = $('#cartcount'); c.hidden = !n; c.textContent = n; drawer(); }
export function drawer() {
  const hasT = S.cart.some(i => i.kind === 'ticket'), hasP = S.cart.some(i => i.kind === 'product');
  $('#drawer').innerHTML = `<header><h3>Your cart</h3><button class="iconbtn" data-act="close-all" aria-label="Close cart"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header>
  <div class="dlist">${S.cart.length ? S.cart.map((i, x) => `<div class="ditem"><div class="th"><img src="${esc(i.img)}" alt=""></div><div><h4>${esc(i.title)}</h4><small>${esc(i.detail)}</small><div class="qty"><button data-act="cq" data-x="${x}" data-d="-1" aria-label="Fewer">−</button><span class="tnum">${i.qty}</span><button data-act="cq" data-x="${x}" data-d="1" aria-label="More">+</button></div></div><div style="text-align:right"><div class="price tnum">${kes(i.price * i.qty)}</div><button class="muted" style="font-size:12px;margin-top:8px;text-decoration:underline" data-act="crm" data-x="${x}">Remove</button></div></div>`).join('') : `<div class="empty"><img class="eye" src="/img/mono.png" alt=""><p>Nothing here yet.</p><div style="display:flex;gap:10px"><a class="btn sm" href="#events" data-act="close-all">Browse events</a><a class="btn ghost sm" href="#shop" data-act="close-all">Shop</a></div></div>`}
  ${hasT && !hasP ? `<div class="nudge"><span>Going to the event? Add merch and collect it at the door.</span><a class="link" href="#shop" data-act="close-all">Shop merch</a></div>` : ''}${hasP && !hasT ? `<div class="nudge"><span>Pair your order with a ticket to an upcoming event.</span><a class="link" href="#events" data-act="close-all">Browse events</a></div>` : ''}</div>
  ${S.cart.length ? `<div class="dfoot"><div class="tot"><span>Subtotal</span><b class="tnum">${kes(cartTotal())}</b></div><button class="btn block" data-act="tocheckout">Checkout</button></div>` : ''}`;
}
act({
  cart: () => { drawer(); $('#menu').classList.remove('open'); $('#drawer').classList.add('open'); $('#scrim').classList.add('open'); },
  'close-all': () => { ['#drawer', '#menu'].forEach(s => $(s).classList.remove('open')); $('#scrim').classList.remove('open'); },
  cq: el => { const i = S.cart[+el.dataset.x]; i.qty = Math.min(10, i.qty + +el.dataset.d); if (i.qty < 1) S.cart.splice(+el.dataset.x, 1); saveCart(); document.dispatchEvent(new Event('cartchange')); },
  crm: el => { S.cart.splice(+el.dataset.x, 1); saveCart(); document.dispatchEvent(new Event('cartchange')); },
  tocheckout: () => { actions['close-all'](); go('checkout'); },
});

/* ---------- images ---------- */
export function resizeImage(file, max = 1800) {
  return new Promise((res, rej) => {
    const img = new Image(), u = URL.createObjectURL(file);
    img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u); c.toBlob(b => b ? res(b) : rej(new Error('Could not process image')), 'image/jpeg', .85); };
    img.onerror = () => { URL.revokeObjectURL(u); rej(new Error('That file is not a readable image.')); };
    img.src = u;
  });
}
export async function uploadImage(file, folder) {
  const blob = await resizeImage(file);
  const path = `${folder}/${crypto.randomUUID()}.jpg`;
  const { error } = await sb.storage.from('media').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
  if (error) throw error; return path;
}
export const qr = text => QRCode.toDataURL(text, { margin: 1, width: 240, color: { dark: '#0A0A0B', light: '#FFFFFF' } });
export const copy = t => { try { navigator.clipboard.writeText(t).then(() => toast('Link copied'), () => toast('Copy the link from the address bar')); } catch { toast('Copy the link from the address bar'); } };
