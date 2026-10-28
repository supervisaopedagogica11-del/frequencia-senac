// Relatório de alunos com mais faltas num período — funções puras, mesmas regras do resto do sistema.
//
// Unidade: HORAS de falta (a mesma usada no cálculo dos 75%).
//  - aula dada = data com chamada registrada para a turma dentro do período;
//  - faltou o dia todo = todas as horas do dia; falta parcial = só os horários marcados;
//  - frequência no período = (horas de aula dadas − horas de falta) ÷ horas de aula dadas.
// Aulas previstas (que ainda não tiveram chamada) NÃO entram na conta.

import { dentroDeUC, datasRegistradas, horasDoRegistro, truncar1, todayISO, addDias, situacaoAluno } from "./engine.js";

export const PERIODO_PADRAO_DIAS = 15;
export const dataValida = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "") && !Number.isNaN(new Date(s + "T12:00:00").getTime()) && new Date(s + "T12:00:00").toISOString().slice(0, 10) === s;
// últimos 15 dias, contando hoje
export function periodoPadrao(hoje = todayISO(), dias = PERIODO_PADRAO_DIAS) {
  return { inicio: addDias(hoje, -(dias - 1)), fim: hoje };
}
export function quinzenaAnterior({ inicio, fim }) {
  const dias = Math.round((new Date(fim + "T12:00:00") - new Date(inicio + "T12:00:00")) / 86400000) + 1;
  return { inicio: addDias(inicio, -dias), fim: addDias(inicio, -1) };
}
export function quinzenaSeguinte({ inicio, fim }) {
  const dias = Math.round((new Date(fim + "T12:00:00") - new Date(inicio + "T12:00:00")) / 86400000) + 1;
  return { inicio: addDias(fim, 1), fim: addDias(fim, dias) };
}
export function validarPeriodo(inicio, fim) {
  if (!dataValida(inicio) || !dataValida(fim)) return "Informe uma data inicial e uma data final válidas.";
  if (inicio > fim) return "A data inicial não pode ser depois da data final.";
  return null;
}

// faltas de UM aluno dentro do período
export function resumoPeriodo(turma, alunoId, freq, inicio, fim) {
  const hd = Number(turma.horariosPorDia) || 1;
  const aluno = (turma.alunos || []).find((a) => a.id === alunoId);
  // aproveitamento de estudos: só contam as aulas dentro dos períodos das UCs do aluno
  const datas = datasRegistradas(turma.id, freq, fim).filter((d) => d >= inicio && dentroDeUC(aluno, d));
  let horasFalta = 0, diasFalta = 0, diasParcial = 0;
  for (const d of datas) {
    const r = (freq[`${turma.id}|${d}`] || {})[alunoId];
    const h = horasDoRegistro(r, hd);
    horasFalta += h;
    if (r?.status === "F") diasFalta++;
    else if (h > 0) diasParcial++;
  }
  const aulas = datas.length;
  const horasDadas = aulas * hd;
  return {
    aulas, horasDadas, horasFalta, diasFalta, diasParcial,
    pct: horasDadas > 0 ? truncar1(Math.max(0, ((horasDadas - horasFalta) / horasDadas) * 100)) : null,
  };
}

export const EXIBIR_OPCOES = [
  { id: "comfalta", label: "Só alunos com falta" },
  { id: "10", label: "10 com mais faltas" },
  { id: "20", label: "20 com mais faltas" },
  { id: "50", label: "50 com mais faltas" },
  { id: "todos", label: "Todos os alunos do filtro" },
];

// linhas = consolidar(...) ; filtros = { inicio, fim, turma, tipo, turno, situacao: "ativos"|"todas"|<situação>, exibir }
export function relatorioFaltas({ linhas, freq, filtros }) {
  const f = filtros || {};
  const erro = validarPeriodo(f.inicio, f.fim);
  if (erro) return { erro, itens: [], resumo: null };
  const itens = [];
  for (const l of linhas) {
    const t = l.turma;
    if (f.turma && t.id !== f.turma) continue;
    if (f.tipo && (t.tipo || "") !== f.tipo) continue;
    if (f.turno && t.turno !== f.turno) continue;
    const sit = situacaoAluno(l.aluno);
    if ((f.situacao || "ativos") === "ativos" ? sit !== "Ativo" : f.situacao !== "todas" && sit !== f.situacao) continue;
    const p = resumoPeriodo(t, l.aluno.id, freq, f.inicio, f.fim);
    if (!p.aulas) continue; // turma sem nenhuma chamada no período: nada a medir
    itens.push({ key: l.key, turma: t, aluno: l.aluno, p, situacao: sit, status: sit === "Ativo" ? l.st?.label || "" : sit, pctCurso: l.r?.pct ?? null });
  }
  itens.sort((a, b) => b.p.horasFalta - a.p.horasFalta || b.p.diasFalta - a.p.diasFalta || a.aluno.nome.localeCompare(b.aluno.nome));
  const exibir = f.exibir || "comfalta";
  let lista = itens;
  if (exibir === "comfalta") lista = itens.filter((x) => x.p.horasFalta > 0);
  else if (/^\d+$/.test(exibir)) lista = itens.filter((x) => x.p.horasFalta > 0).slice(0, Number(exibir));
  lista = lista.map((x, i) => ({ ...x, pos: i + 1 }));
  const horas = lista.reduce((s, x) => s + x.p.horasFalta, 0);
  const pcts = lista.map((x) => x.p.pct).filter((v) => v !== null);
  return {
    erro: null,
    itens: lista,
    resumo: {
      alunos: lista.length,
      avaliados: itens.length,
      comFalta: itens.filter((x) => x.p.horasFalta > 0).length,
      horasFalta: horas,
      turmas: new Set(lista.map((x) => x.turma.id)).size,
      mediaPct: pcts.length ? truncar1(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null,
    },
  };
}
