import { getStore, save } from "./store";
const cbs = new Set();
const authObj = { currentUser: null };
function setUser(u) { authObj.currentUser = u; try { localStorage.setItem("mockuser", JSON.stringify(u ? { email: u.email, uid: u.uid } : null)); } catch {} cbs.forEach((f) => f(u)); }
function mkUser(email, uid) { return { email, uid, displayName: null, getIdToken: async () => "mock-token", delete: async () => {} }; }
const secObj = { currentUser: null, __sec: true };
export const getAuth = (app) => (app && app.__sec ? secObj : authObj);
export function onAuthStateChanged(_a, cb) {
  cbs.add(cb);
  setTimeout(() => { let u = null; try { u = JSON.parse(localStorage.getItem("mockuser")); } catch {} authObj.currentUser = u ? mkUser(u.email, u.uid) : null; cb(authObj.currentUser); }, 30);
  return () => cbs.delete(cb);
}
export async function signInWithEmailAndPassword(_a, email, senha) {
  const s = getStore(); s._auth = s._auth || {};
  const u = s._auth[email.toLowerCase()];
  if (!u || u.senha !== senha) { const e = new Error("x"); e.code = "auth/invalid-credential"; throw e; }
  setUser(mkUser(email.toLowerCase(), u.uid));
}
export async function createUserWithEmailAndPassword(_a, email, senha) {
  const s = getStore(); s._auth = s._auth || {};
  if (s._auth[email.toLowerCase()]) { const e = new Error("x"); e.code = "auth/email-already-in-use"; throw e; }
  if (senha.length < 6) { const e = new Error("x"); e.code = "auth/weak-password"; throw e; }
  const uid = Math.random().toString(36).slice(2);
  s._auth[email.toLowerCase()] = { senha, uid }; save();
  if (_a && _a.__sec) { _a.currentUser = mkUser(email.toLowerCase(), uid); return; }
  setUser(mkUser(email.toLowerCase(), uid));
}
export async function sendPasswordResetEmail() {}
export async function signOut(a) { if (a && a.__sec) { a.currentUser = null; return; } setUser(null); }
