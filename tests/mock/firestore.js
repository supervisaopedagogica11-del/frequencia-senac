import { getStore, save, subscribe, uid } from "./store";
const clone = (x) => JSON.parse(JSON.stringify(x ?? null));
export const getFirestore = () => ({});
export const doc = (_db, col, id) => ({ type: "doc", col, id });
export const collection = (_db, col) => ({ type: "col", col, filtros: [], ordem: null, lim: null });
export const where = (campo, op, valor) => ({ w: [campo, op, valor] });
export const orderBy = (campo, dir) => ({ o: [campo, dir] });
export const limit = (n) => ({ l: n });
export const query = (c, ...mods) => { const q = { ...c, filtros: [...c.filtros] }; mods.forEach((m) => { if (m.w) q.filtros.push(m.w); if (m.o) q.ordem = m.o; if (m.l) q.lim = m.l; }); return q; };
const col = (n) => { const s = getStore(); s[n] = s[n] || {}; return s[n]; };
function snapDoc(ref) {
  const d = col(ref.col)[ref.id];
  return { id: ref.id, ref, exists: () => !!d, data: () => clone(d) };
}
function runQuery(q) {
  let docs = Object.entries(col(q.col)).map(([id, d]) => ({ id, d }));
  q.filtros.forEach(([c, op, v]) => { docs = docs.filter((x) => op === "==" ? x.d[c] === v : true); });
  if (q.ordem) { const [c, dir] = q.ordem; docs.sort((a, b) => String(a.d[c] ?? "").localeCompare(String(b.d[c] ?? "")) * (dir === "desc" ? -1 : 1)); }
  if (q.lim) docs = docs.slice(0, q.lim);
  const out = docs.map((x) => ({ id: x.id, ref: doc(null, q.col, x.id), data: () => clone(x.d), exists: () => true }));
  return { docs: out, empty: !out.length, size: out.length };
}
export async function getDoc(ref) { return snapDoc(ref); }
export async function getDocs(q) { return runQuery(q); }
const DEL = "__deleteField__";
export const deleteField = () => DEL;
function deepMerge(a, b) { const o = { ...(a || {}) }; for (const [k, v] of Object.entries(b)) { if (v && typeof v === "object" && !Array.isArray(v) && o[k] && typeof o[k] === "object" && !Array.isArray(o[k])) o[k] = deepMerge(o[k], v); else o[k] = v; } return o; }
function applyUpdate(obj, data) { const o = clone(obj); for (const [k, v] of Object.entries(data)) { const parts = k.split("."); let cur = o; for (let i = 0; i < parts.length - 1; i++) { cur[parts[i]] = cur[parts[i]] || {}; cur = cur[parts[i]]; } if (v === DEL) delete cur[parts.at(-1)]; else cur[parts.at(-1)] = clone(v); } return o; }
export async function setDoc(ref, data, opts) { const c = col(ref.col); c[ref.id] = opts?.merge ? deepMerge(c[ref.id], clone(data)) : clone(data); save(); }
export async function updateDoc(ref, data) { const c = col(ref.col); if (!c[ref.id]) throw new Error("not-found"); c[ref.id] = applyUpdate(c[ref.id], data); save(); }
export async function deleteDoc(ref) { delete col(ref.col)[ref.id]; save(); }
export async function addDoc(c, data) { const id = uid(); col(c.col)[id] = clone(data); save(); return { id }; }
export function onSnapshot(ref, cb, err) {
  const fire = () => { try { cb(ref.type === "doc" ? snapDoc(ref) : runQuery(ref)); } catch (e) { err?.(e); } };
  setTimeout(fire, 20);
  return subscribe(() => setTimeout(fire, 0));
}
export async function runTransaction(_db, fn) {
  const tx = { get: async (r) => snapDoc(r), set: (r, d) => { col(r.col)[r.id] = clone(d); }, update: (r, d) => { col(r.col)[r.id] = applyUpdate(col(r.col)[r.id], d); } };
  const r = await fn(tx); save(); return r;
}
export function writeBatch() {
  const ops = [];
  return { set: (r, d) => ops.push(() => { col(r.col)[r.id] = clone(d); }), delete: (r) => ops.push(() => { delete col(r.col)[r.id]; }), update: (r, d) => ops.push(() => { col(r.col)[r.id] = { ...col(r.col)[r.id], ...clone(d) }; }), commit: async () => { ops.forEach((f) => f()); save(); } };
}
