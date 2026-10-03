import test from "node:test";
import assert from "node:assert/strict";
import { resumoAluno, episodioConsecutivas, sequenciaFaltas, renderTemplate, variaveisEmail, isFinalizada, statusAluno } from "../lib/engine.js";

const turma = { id: "t1", curso: "Técnico em Administração", codigo: "ADM01", cargaHoraria: 160, horariosPorDia: 4, alunos: [{ id: "a1", nome: "João Silva" }] };
function freqCom(datas) {
  const f = {};
  for (const [d, s] of datas) f[`t1|${d}`] = s ? { a1: { status: s } } : {};
  return f;
}

test("percentual segue a fórmula da planilha", () => {
  const f = freqCom([["2026-09-01", "F"], ["2026-09-02", null], ["2026-09-03", "A"]]);
  const r = resumoAluno(turma, "a1", f, null, "2026-09-30");
  // horas faltadas = 4 + 2 = 6 → (160-6)/160 = 96.25 → 96.3
  assert.equal(r.pct, 96.3);
  assert.equal(r.faltas, 1);
  assert.equal(r.atrasos, 1);
  // limite 25% de 160 = 40h; restam 34h → 8 faltas inteiras
  assert.equal(r.faltasPermitidasRestantes, 8);
});

test("faltas consecutivas e episódio estável", () => {
  const f = freqCom([["2026-09-01", null], ["2026-09-02", "F"], ["2026-09-03", "F"], ["2026-09-04", "F"]]);
  const ep = episodioConsecutivas(turma, turma.alunos[0], f, null, "2026-09-30");
  assert.ok(ep);
  assert.equal(ep.consecutivas, 3);
  assert.equal(ep.id, "t1_a1_seq_2026-09-02");
  // quarta falta: mesmo episódio
  f["t1|2026-09-05"] = { a1: { status: "F" } };
  const ep2 = episodioConsecutivas(turma, turma.alunos[0], f, null, "2026-09-30");
  assert.equal(ep2.id, ep.id);
  assert.equal(ep2.consecutivas, 4);
  // presença quebra a sequência; nova sequência = novo episódio
  f["t1|2026-09-08"] = {};
  assert.equal(episodioConsecutivas(turma, turma.alunos[0], f, null, "2026-09-30"), null);
  f["t1|2026-09-09"] = { a1: { status: "F" } };
  f["t1|2026-09-10"] = { a1: { status: "F" } };
  f["t1|2026-09-11"] = { a1: { status: "F" } };
  assert.equal(episodioConsecutivas(turma, turma.alunos[0], f, null, "2026-09-30").id, "t1_a1_seq_2026-09-09");
});

test("faixas preventivas antes de chegar a 75%", () => {
  // 7 faltas de 4h = 28h → 82.5%; restam 12h = 3 faltas → risco (folga<=5)
  const datas = [];
  for (let i = 1; i <= 7; i++) datas.push([`2026-09-${String(i).padStart(2, "0")}`, "F"]);
  for (let i = 10; i <= 20; i++) datas.push([`2026-09-${i}`, null]);
  const r = resumoAluno(turma, "a1", freqCom(datas), null, "2026-09-30");
  assert.equal(r.pct, 82.5);
  assert.equal(r.faltasPermitidasRestantes, 3);
  assert.equal(r.faixa, "risco");
  // 9 faltas = 36h → 77.5%, folga 1 → crítico
  datas.push(["2026-09-21", "F"], ["2026-09-22", "F"]);
  const r2 = resumoAluno(turma, "a1", freqCom(datas), null, "2026-09-30");
  assert.equal(r2.faixa, "critico");
  // 11 faltas = 44h → 72.5% abaixo
  datas.push(["2026-09-23", "F"], ["2026-09-24", "F"]);
  assert.equal(resumoAluno(turma, "a1", freqCom(datas), null, "2026-09-30").faixa, "abaixo");
});

test("ritmo de faltas gera projeção de risco mesmo com % alto", () => {
  // turma longa: 400h, 4h/dia; 3 faltas em 6 aulas → % ainda 97%, mas ritmo de 50%
  const t = { ...turma, cargaHoraria: 400 };
  const datas = [["2026-09-01", "F"], ["2026-09-02", null], ["2026-09-03", "F"], ["2026-09-04", null], ["2026-09-05", "F"], ["2026-09-06", null]];
  const f = {}; for (const [d, s] of datas) f[`t1|${d}`] = s ? { a1: { status: s } } : {};
  const r = resumoAluno(t, "a1", f, null, "2026-09-30");
  assert.equal(r.pct, 97);
  assert.ok(r.projecaoPct < 75);
  // ainda tem muita folga (22 faltas) → atenção preventiva, não risco
  assert.equal(r.faixa, "atencao");
  // mesma situação com folga menor (curso de 200h → folga 9) → risco pela projeção
  const r2 = resumoAluno({ ...t, cargaHoraria: 200 }, "a1", f, null, "2026-09-30");
  assert.ok(r2.faltasPermitidasRestantes <= 15 && r2.projecaoPct < 75);
  assert.equal(r2.faixa, "risco");
});

test("template de e-mail com variáveis", () => {
  const f = freqCom([["2026-09-02", "F"], ["2026-09-03", "F"], ["2026-09-04", "F"]]);
  const r = resumoAluno(turma, "a1", f, null, "2026-09-30");
  const v = variaveisEmail({ turma, aluno: turma.alunos[0], resumo: r, cfg: null });
  const txt = renderTemplate("Olá {{aluno}}, {{faltas_consecutivas}} faltas ({{datas_faltas}}) em {{curso}}", v);
  assert.equal(txt, "Olá João Silva, 3 faltas (02/09, 03/09 e 04/09) em Técnico em Administração");
});

test("compatibilidade com dados antigos", () => {
  assert.equal(isFinalizada({ periodoRealFim: "2026-01-01" }), true);
  assert.equal(isFinalizada({ periodoRealFim: "2026-01-01", finalizada: false }), false);
  assert.equal(statusAluno({ situacao: "Evadiu" }), "Evadido");
  assert.equal(statusAluno({ situacao: "Ativo" }), "Regular");
});
