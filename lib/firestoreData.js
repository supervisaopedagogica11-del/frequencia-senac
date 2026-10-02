"use client";
import { db } from "./firebase";
import { collection, doc, getDocs, setDoc, deleteDoc, query, where } from "firebase/firestore";

export async function listarTurmas() {
  const snap = await getDocs(collection(db, "turmas"));
  return snap.docs.map((d) => d.data());
}

export async function salvarTurma(turma) {
  await setDoc(doc(db, "turmas", turma.id), turma);
}

export async function excluirTurmaDb(turmaId) {
  await deleteDoc(doc(db, "turmas", turmaId));
  const freqSnap = await getDocs(query(collection(db, "frequencias"), where("turmaId", "==", turmaId)));
  await Promise.all(freqSnap.docs.map((d) => deleteDoc(d.ref)));
  const contSnap = await getDocs(query(collection(db, "contatos"), where("turmaId", "==", turmaId)));
  await Promise.all(contSnap.docs.map((d) => deleteDoc(d.ref)));
}

// carrega todas as frequências de UMA turma e devolve no formato { "turmaId|data": { alunoId: {status, horarioAtraso} } }
// (o mesmo formato usado pelas funções de cálculo em lib/logic.js)
export async function carregarFrequenciasDaTurma(turmaId) {
  const snap = await getDocs(query(collection(db, "frequencias"), where("turmaId", "==", turmaId)));
  const freqMap = {};
  snap.docs.forEach((d) => {
    const dado = d.data();
    freqMap[`${dado.turmaId}|${dado.data}`] = dado.registros || {};
  });
  return freqMap;
}

export async function salvarFrequenciaDia(turmaId, data, registros) {
  const id = `${turmaId}_${data}`;
  await setDoc(doc(db, "frequencias", id), { turmaId, data, registros });
}

export async function carregarContatosDaTurma(turmaId) {
  const snap = await getDocs(query(collection(db, "contatos"), where("turmaId", "==", turmaId)));
  const map = {};
  snap.docs.forEach((d) => { const c = d.data(); map[`${c.turmaId}|${c.alunoId}`] = c; });
  return map;
}

export async function salvarContato(turmaId, alunoId, contato) {
  const id = `${turmaId}_${alunoId}`;
  await setDoc(doc(db, "contatos", id), { ...contato, turmaId, alunoId });
}
