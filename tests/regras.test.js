import test from "node:test";
import assert from "node:assert/strict";
import { resumoAluno, episodioConsecutivas, limiteSeguidas, isAprendizagemComercial, riscoDoResumo, consolidar, dentroDeUC, ucDoMomento } from "../lib/engine.js";
import { precisaContato } from "../lib/pendencias.js";
import { resumoPeriodo } from "../lib/relatorioFaltas.js";

const F = { status: "F" };
const freqDe = (tid, lista) => Object.fromEntries(lista.map(([d, regs]) => [`${tid}|${d}`, regs]));

// ---------- Aprendizagem Comercial: 2 faltas seguidas ----------
const ac = { id: "ac", curso: "Aprendizagem Comercial em Serviços Administrativos", codigo: "APR-01", cargaHoraria: 400, horariosPorDia: 4, alunos: [{ id: "x", nome: "Ana" }] };
const tec = { ...ac, id: "tc", curso: "Técnico em Administração" };
// segunda e terça
const fAC = freqDe("ac", [["2026-10-19", {}], ["2026-10-20", {}], ["2026-10-26", { x: F }], ["2026-10-27", { x: F }]]);
test("Aprendizagem Comercial é reconhecida pelo nome (com ou sem acento/maiúsculas)", () => {
  assert.equal(isAprendizagemComercial(ac), true);
  assert.equal(isAprendizagemComercial({ curso: "APRENDIZAGEM COMERCIAL - Varejo" }), true);
  assert.equal(isAprendizagemComercial(tec), false);
  assert.equal(limiteSeguidas(ac, null), 2);
  assert.equal(limiteSeguidas(tec, null), 3);
  assert.equal(limiteSeguidas(tec, { consecutivasAlerta: 4 }), 4);
});
test("2 faltas seguidas geram alerta e contato só na Aprendizagem Comercial", () => {
  const ep = episodioConsecutivas(ac, ac.alunos[0], fAC, null, "2026-10-27");
  assert.ok(ep);
  assert.equal(ep.consecutivas, 2);
  const fTec = freqDe("tc", [["2026-10-26", { x: F }], ["2026-10-27", { x: F }]]);
  assert.equal(episodioConsecutivas(tec, tec.alunos[0], fTec, null, "2026-10-27"), null);
  const [l] = consolidar([ac], fAC, {}, null, "2026-10-27");
  assert.equal(precisaContato(l, {}, null), true);
  assert.equal(riscoDoResumo(l.r).nivel, "laranja");
  const [lt] = consolidar([tec], fTec, {}, null, "2026-10-27");
  assert.equal(precisaContato(lt, {}, null), false);
});

// ---------- Aproveitamento de estudos ----------
const alunoAE = { id: "y", nome: "Bruno", aproveitamento: { ativo: true, cargaHoraria: 40, periodos: [{ uc: "UC5", inicio: "2026-10-20", fim: "2026-10-31" }] } };
const tAE = { id: "t", curso: "Técnico em Administração", cargaHoraria: 800, horariosPorDia: 4, alunos: [alunoAE] };
const fAE = freqDe("t", [["2026-10-05", { y: F }], ["2026-10-06", { y: F }], ["2026-10-07", { y: F }], ["2026-10-21", { y: F }], ["2026-10-22", {}]]);
test("aproveitamento: faltas fora do período da UC não contam; 75% sobre a CH das UCs", () => {
  const r = resumoAluno(tAE, "y", fAE, null, "2026-10-22");
  assert.equal(r.aulas, 2);       // só 21 e 22/10
  assert.equal(r.horasFalta, 4);  // só 21/10
  assert.equal(r.cargaHoraria, 40);
  assert.equal(r.limiteHoras, 10);
  assert.equal(r.pct, 90);        // (40-4)/40
  assert.equal(r.consecutivas, 0);
  assert.equal(r.uc.cursando, true);
});
test("aproveitamento: aguardando a UC não gera alerta nem contato", () => {
  const r = resumoAluno(tAE, "y", fAE, null, "2026-10-08");
  assert.equal(r.aulas, 0);
  assert.equal(r.horasFalta, 0);
  assert.equal(r.uc.cursando, false);
  assert.equal(r.uc.proxima.uc, "UC5");
  assert.equal(episodioConsecutivas(tAE, alunoAE, fAE, null, "2026-10-08"), null);
  const [l] = consolidar([tAE], fAE, {}, null, "2026-10-08");
  assert.equal(precisaContato(l, { a: { status: "aberto", tipo: "consecutivas", turmaId: "t", alunoId: "y" } }, null), false);
});
test("aproveitamento: dentro da UC as faltas seguidas geram alerta normalmente", () => {
  const f = freqDe("t", [["2026-10-20", { y: F }], ["2026-10-21", { y: F }], ["2026-10-22", { y: F }]]);
  assert.ok(episodioConsecutivas(tAE, alunoAE, f, null, "2026-10-22"));
});
test("aproveitamento: sem UC cadastrada nenhuma aula conta; desmarcado volta ao normal", () => {
  const a = { id: "z", aproveitamento: { ativo: true, cargaHoraria: 40, periodos: [] } };
  assert.equal(dentroDeUC(a, "2026-10-21"), false);
  assert.equal(ucDoMomento(a, "2026-10-21").semPeriodos, true);
  const a2 = { id: "z", aproveitamento: { ativo: false, periodos: [] } };
  assert.equal(dentroDeUC(a2, "2026-10-21"), true);
  const t2 = { ...tAE, alunos: [{ ...alunoAE, aproveitamento: { ...alunoAE.aproveitamento, ativo: false } }] };
  assert.equal(resumoAluno(t2, "y", fAE, null, "2026-10-22").horasFalta, 16);
});
test("relatório quinzenal respeita o período das UCs", () => {
  const p = resumoPeriodo(tAE, "y", fAE, "2026-10-01", "2026-10-31");
  assert.equal(p.aulas, 2);
  assert.equal(p.horasFalta, 4);
});
