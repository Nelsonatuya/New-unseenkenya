import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { esc, $, DP } from './core.js';

const GEO = (import.meta.env.VITE_GEOCODER_URL || 'https://nominatim.openstreetmap.org').replace(/\/$/, '');
const KENYA = [0.2, 37.9];
const pin = L.divIcon({ className: '', html: '<div class="uk-pin"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
const tiles = () => L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' });
export const mk = (el, c = KENYA, z = 6) => { const m = L.map(el, { scrollWheelZoom: false, zoomControl: true }).setView(c, z); tiles().addTo(m); return m; };
export const kmBetween = (a, b) => { const r = x => x * Math.PI / 180, dl = r(b[0] - a[0]), dn = r(b[1] - a[1]), h = Math.sin(dl / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dn / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };

const cache = new Map();
export async function searchPlaces(q) {
  q = q.trim(); if (q.length < 3) return [];
  if (cache.has(q)) return cache.get(q);
  const r = await fetch(`${GEO}/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=ke&q=${encodeURIComponent(q)}`, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('Place search is busy. Try again in a moment.');
  const out = (await r.json()).map(p => ({ name: p.name || p.display_name.split(',')[0], full: p.display_name, lat: +p.lat, lng: +p.lon, town: p.address?.city || p.address?.town || p.address?.village || p.address?.county || '' }));
  cache.set(q, out); return out;
}
export async function reverse(lat, lng) {
  try { const r = await fetch(`${GEO}/reverse?format=jsonv2&zoom=14&lat=${lat}&lon=${lng}`); const p = await r.json(); return { name: p.name || '', town: p.address?.city || p.address?.town || p.address?.village || p.address?.county || '', full: p.display_name || '' }; } catch { return null; }
}

/** Search box with a result list. onPick(place) fires when a result is chosen. */
export function placeSearch(root, onPick, placeholder = 'Search a place in Kenya') {
  root.innerHTML = `<div class="mapsearch"><input type="text" id="ps-${root.id}" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}" autocomplete="off"><div class="results" hidden></div></div>`;
  const inp = $('input', root), box = $('.results', root); let t, seq = 0;
  inp.addEventListener('input', () => {
    clearTimeout(t); const q = inp.value; if (q.trim().length < 3) { box.hidden = true; return; }
    t = setTimeout(async () => {
      const my = ++seq; box.hidden = false; box.innerHTML = '<button disabled>Searching…</button>';
      try { const r = await searchPlaces(q); if (my !== seq) return; box.innerHTML = r.length ? r.map((p, i) => `<button data-i="${i}">${esc(p.name)}<small>${esc(p.full)}</small></button>`).join('') : '<button disabled>No places found. Try a nearby town.</button>'; box._r = r; }
      catch (e) { box.innerHTML = `<button disabled>${esc(e.message)}</button>`; }
    }, 650);
  });
  box.addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (!b) return; const p = box._r[+b.dataset.i]; inp.value = p.name; box.hidden = true; onPick(p); });
  document.addEventListener('click', e => { if (!root.contains(e.target)) box.hidden = true; });
}

export function eventsMap(el, events, focus) {
  const m = mk(el), g = L.featureGroup();
  events.filter(e => e.lat != null).forEach(e => L.marker([e.lat, e.lng], { icon: pin }).bindPopup(`<b>${esc(e.title)}</b><br>${DP(e.starts_at).w} ${DP(e.starts_at).d} ${DP(e.starts_at).m} · ${esc(e.town)}<br><a href="#event-${e.id}">View event</a>`).addTo(g));
  g.addTo(m); if (focus) m.setView([focus.lat, focus.lng], 9); else if (g.getLayers().length) m.fitBounds(g.getBounds().pad(.3), { maxZoom: 10 });
  return m;
}
export function staticMap(el, lat, lng) { const m = mk(el, [lat, lng], 14); L.marker([lat, lng], { icon: pin }).addTo(m); return m; }
export function pickerMap(el, start, onMove) {
  const has = start.lat != null, m = mk(el, has ? [start.lat, start.lng] : KENYA, has ? 14 : 6);
  let mark = has ? L.marker([start.lat, start.lng], { icon: pin, draggable: true }).addTo(m) : null;
  const set = (lat, lng, fly) => { if (!mark) { mark = L.marker([lat, lng], { icon: pin, draggable: true }).addTo(m); mark.on('dragend', () => { const p = mark.getLatLng(); onMove(p.lat, p.lng, false); }); } else mark.setLatLng([lat, lng]); if (fly) m.setView([lat, lng], 15); onMove(lat, lng, fly); };
  if (mark) mark.on('dragend', () => { const p = mark.getLatLng(); onMove(p.lat, p.lng, false); });
  m.on('click', e => set(e.latlng.lat, e.latlng.lng, false));
  return { map: m, set };
}
