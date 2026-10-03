// Camada de acesso ao Firestore. Mantém o mesmo formato de dados da versão anterior
// (coleções turmas, frequencias, contatos) e acrescenta as novas coleções.
import {
  doc, setDoc, updateDoc, deleteDoc, addDoc, collection, getDocs, query, where, runTransaction, writeBatch, getDoc, deleteField,
} from "firebase/firestore";
import { db } from "./firebase";

export const limpar = (o) => JSON.parse(JSON.stringify(o ?? null));
export const agoraISO = () => new Date().toISOString();
export const chaveContato = (turmaId, alunoId) => `${turmaId}_${alunoId}`;

// ---------- turmas ----------
export async function salvarTurma(t) { await setDoc(doc(db, "turmas", t.id), limpar(t)); }
export async function atualizarTurma(id, patch) { await updateDoc(doc(db, "turmas", id), limpar(patch)); }
// altera a lista de alunos lendo a versão mais recente do banco (evita sobrescrever edições simultâneas)
export async function alterarAlunos(turmaId, fn) {
  const ref = doc(db, "turmas", turmaId);
  return runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists()) throw new Error("Turma não encontrada");
    const alunos = fn([...(s.data().alunos || [])]);
    tx.update(ref, { alunos: limpar(alunos) });
    return alunos;
  });
}

async function apagarOnde(colecao, campo, valor) {
  const snap = await getDocs(query(collection(db, colecao), where(campo, "==", valor)));
  let batch = writeBatch(db), n = 0;
  for (const d of snap.docs) {
    batch.delete(d.ref);
    if (++n % 400 === 0) { await batch.commit(); batch = writeBatch(db); }
  }
  await batch.commit();
}
export async function excluirTurmaCompleta(turmaId) {
  await deleteDoc(doc(db, "turmas", turmaId));
  await apagarOnde("frequencias", "turmaId", turmaId);
  await apagarOnde("contatos", "turmaId", turmaId);
  await apagarOnde("alertas", "turmaId", turmaId);
}

// ---------- frequência ----------
export async function salvarDia(turmaId, data, registros, usuario) {
  await setDoc(doc(db, "frequencias", `${turmaId}_${data}`), limpar({
    turmaId, data, registros, atualizadoPor: usuario?.email || null, atualizadoEm: agoraISO(),
  }));
}
// grava/remove a marcação de UM aluno sem tocar nas demais (seguro para cliques rápidos e vários usuários)
export async function marcarRegistro(turmaId, data, alunoId, registro, usuario) {
  const ref = doc(db, "frequencias", `${turmaId}_${data}`);
  const meta = { turmaId, data, atualizadoPor: usuario?.email || null, atualizadoEm: agoraISO() };
  await setDoc(ref, meta, { merge: true }); // garante que o dia existe (= chamada feita)
  // substitui só o registro deste aluno, por inteiro
  await updateDoc(ref, { [`registros.${alunoId}`]: registro ? limpar(registro) : deleteField() });
}
export async function confirmarDia(turmaId, data, usuario) {
  await setDoc(doc(db, "frequencias", `${turmaId}_${data}`), { turmaId, data, atualizadoPor: usuario?.email || null, atualizadoEm: agoraISO() }, { merge: true });
}
export async function excluirDia(turmaId, data) {
  await deleteDoc(doc(db, "frequencias", `${turmaId}_${data}`));
}

// ---------- contatos / acompanhamento ----------
export async function salvarContato(turmaId, alunoId, dados) {
  await setDoc(doc(db, "contatos", chaveContato(turmaId, alunoId)), limpar({ ...dados, turmaId, alunoId, atualizadoEm: agoraISO() }));
}

// ---------- alertas (episódios) ----------
// cria o alerta somente se ainda não existir — garante que o mesmo episódio não gere dois disparos
export async function criarAlertaSeNovo(alerta) {
  const ref = doc(db, "alertas", alerta.id);
  return runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    if (s.exists()) return false;
    tx.set(ref, limpar(alerta));
    return true;
  });
}
export async function atualizarAlerta(id, patch) { await updateDoc(doc(db, "alertas", id), limpar(patch)); }

// ---------- e-mails / histórico ----------
export async function registrarEmail(log) { const r = await addDoc(collection(db, "emails"), limpar(log)); return r.id; }
export async function registrarHistorico(evento) {
  try { await addDoc(collection(db, "historico"), limpar({ em: agoraISO(), ...evento })); } catch (e) { console.warn("historico", e); }
}

// ---------- usuários ----------
export const idUsuario = (email) => String(email || "").trim().toLowerCase();
export async function lerUsuario(email) {
  const s = await getDoc(doc(db, "usuarios", idUsuario(email)));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}
export async function salvarUsuario(u) { await setDoc(doc(db, "usuarios", idUsuario(u.email)), limpar({ ...u, email: idUsuario(u.email) }), { merge: true }); }
export async function excluirUsuario(email) { await deleteDoc(doc(db, "usuarios", idUsuario(email))); }
export async function bootstrapAdmin(user) {
  // primeiro acesso ao sistema: se ainda não há nenhum usuário cadastrado, quem entra vira Administrador
  const boot = await getDoc(doc(db, "config", "bootstrap"));
  if (boot.exists()) return null;
  const u = { nome: user.displayName || user.email.split("@")[0], email: idUsuario(user.email), perfil: "Administrador", ativo: true, uid: user.uid, vinculadoEm: agoraISO(), criadoEm: agoraISO() };
  const b = writeBatch(db);
  b.set(doc(db, "usuarios", u.email), u);
  b.set(doc(db, "config", "bootstrap"), { em: agoraISO(), por: u.email });
  await b.commit();
  return { id: u.email, ...u };
}

// ---------- configurações ----------
export async function salvarConfig(cfg) { await setDoc(doc(db, "config", "geral"), limpar(cfg)); }
