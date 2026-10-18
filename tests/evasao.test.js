import test from "node:test";
import assert from "node:assert/strict";
import { classificarEvasao, classificarTexto, montarDashboardEvasao, normalizarTexto, mesclarPalavras } from "../lib/evasao.js";
import { relatorioFaltas, resumoPeriodo, periodoPadrao, validarPeriodo, quinzenaAnterior, quinzenaSeguinte } from "../lib/relatorioFaltas.js";
import { consolidar } from "../lib/engine.js";

const ev = (extra = {}) => ({ id: "a" + Math.random(), nome: "Aluno", situacao: "Evadiu", statusEm: "2026-09-10T10:00:00Z", ...extra });
const cls = (contato, aluno = ev()) => classificarEvasao({ aluno, contato });

// ---------- classificação ----------
test("1. 'trabalho' → Trabalho", () => assert.equal(cls({ motivoEvasao: "Saiu por causa do TRABALHO" }).categoria, "trabalho"));
test("2. 'problema de saúde' → Saúde (sem acento e maiúsculas também)", () => {
  assert.equal(cls({ justificativa: "Teve um problema de saúde" }).categoria, "saude");
  assert.equal(cls({ justificativa: "PROBLEMA DE SAUDE na familia" }).categoria, "saude");
});
test("3. 'mudou de cidade' → Mudança de cidade", () => assert.equal(cls({ observacoes: "A aluna mudou de cidade em agosto" }).categoria, "mudanca"));
test("4. 'motivos pessoais' → Motivos pessoais", () => assert.equal(cls({ motivoFalta: "Motivos pessoais" }).categoria, "pessoais"));
test("5. sem justificativa → Outros, sem inventar motivo", () => {
  const r = cls({});
  assert.equal(r.categoria, "outros");
  assert.equal(r.semTexto, true);
  assert.equal(cls(null).categoria, "outros");
  assert.equal(cls({ observacoes: "Não respondeu às ligações" }).categoria, "outros");
});
test("coincidências não classificam: 'trabalho de conclusão', 'serviço social', negação", () => {
  assert.equal(cls({ observacoes: "Não entregou o trabalho de conclusão" }).categoria, "outros");
  assert.equal(cls({ observacoes: "Encaminhado ao serviço social" }).categoria, "outros");
  assert.equal(cls({ motivoEvasao: "Não foi por motivo de saúde, mudou de cidade" }).categoria, "mudanca");
  assert.equal(cls({ observacoes: "trabalhoso" }).categoria, "outros"); // só palavra inteira
});
test("plural simples é reconhecido", () => assert.equal(cls({ observacoes: "conflito com os serviços" }).categoria, "trabalho"));
test("vários motivos: categoria única + marcação para revisar; 'saúde' dentro de 'problema de saúde' conta uma vez", () => {
  const r = cls({ motivoEvasao: "Arrumou emprego e teve problema de saúde" });
  assert.equal(r.categoria, "trabalho"); // empate 1x1 → prioridade da lista
  assert.deepEqual(r.candidatas, ["trabalho", "saude"]);
  assert.equal(r.revisar, true);
  const r2 = cls({ motivoEvasao: "problema de saúde, cirurgia e depois emprego" });
  assert.equal(r2.categoria, "saude"); // 2 termos de saúde x 1 de trabalho
});
test("o campo 'Motivo da evasão' tem prioridade sobre as observações", () => {
  assert.equal(cls({ motivoEvasao: "mudou de cidade", observacoes: "reclamou do trabalho" }).categoria, "mudanca");
  assert.equal(cls({ motivoEvasao: "sem informação", tentativas: [{ obs: "disse que está doente" }] }).categoria, "saude");
});
test("classificação manual prevalece até ser retirada; origem informada", () => {
  const c = { motivoEvasao: "emprego novo", evasaoManual: { categoria: "pessoais", por: "x" } };
  const r = cls(c);
  assert.equal(r.categoria, "pessoais");
  assert.equal(r.origem, "manual");
  assert.equal(r.automatica, "trabalho");
  const { evasaoManual, ...sem } = c;
  assert.equal(cls(sem).origem, "automatica");
});
test("8. editar a justificativa muda a classificação automática", () => {
  const c = { justificativa: "mudou de cidade" };
  assert.equal(cls(c).categoria, "mudanca");
  c.justificativa = "conseguiu emprego";
  assert.equal(cls(c).categoria, "trabalho");
});
test("classificar não altera os dados do aluno nem do contato", () => {
  const a = ev(); const c = { motivoEvasao: "trabalho", tentativas: [{ obs: "x" }] };
  const antes = JSON.stringify([a, c]);
  cls(c, a);
  assert.equal(JSON.stringify([a, c]), antes);
});
test("palavras-chave novas podem ser adicionadas pela configuração", () => {
  const p = mesclarPalavras({ trabalho: ["estágio"] });
  assert.equal(classificarTexto("começou um estagio", p).categoria, "trabalho");
  assert.ok(p.saude.includes("saúde")); // demais categorias mantêm o padrão
  assert.equal(normalizarTexto("Mudou-se p/ São Paulo!"), "mudou se p sao paulo");
});

// ---------- dashboard ----------
const T = (id, alunos, extra = {}) => ({ id, curso: "Curso " + id, codigo: id, turno: "Noite", tipo: "FIC", cargaHoraria: 160, horariosPorDia: 4, alunos, ...extra });
test("6/7. só evadidos entram; ninguém é contado duas vezes", () => {
  const turmas = [
    T("t1", [{ id: "1", nome: "Ana", matricula: "100", situacao: "Ativo" }, { id: "2", nome: "Bia", matricula: "200", situacao: "Evadiu", statusEm: "2026-09-05T00:00:00Z" }, { id: "3", nome: "Caio", situacao: "Evadiu", statusEm: "2026-09-20T00:00:00Z" }]),
    T("t2", [{ id: "9", nome: "Bia", matricula: "200", situacao: "Evadiu", statusEm: "2026-09-25T00:00:00Z" }]),
  ];
  const contatos = { "t1|1": { observacoes: "trabalho" }, "t1|2": { motivoEvasao: "emprego e cirurgia" }, "t2|9": { motivoEvasao: "mudou de cidade" } };
  const linhas = consolidar(turmas, {}, contatos, null, "2026-09-30");
  const d = montarDashboardEvasao({ linhas, contatos, historico: [] });
  assert.equal(d.total, 2); // Bia (2 turmas) conta uma vez + Caio; Ana (ativa) fora
  assert.equal(d.matriculados, 3); // Ana, Bia, Caio
  assert.equal(d.taxa, 66.7);
  const soma = d.categorias.reduce((s, c) => s + c.n, 0);
  assert.equal(soma, d.total);
  assert.equal(d.categorias.find((c) => c.id === "mudanca").n, 1); // registro mais recente da Bia (t2)
  assert.equal(d.categorias.find((c) => c.id === "outros").n, 1); // Caio sem texto
  assert.equal(d.categorias.find((c) => c.id === "trabalho").n, 0); // Ana é ativa
  // período: só setembro 1–10 → só a evasão... nenhuma (Bia mais recente é 25/09 na t2, mas na t1 é 05/09)
  const p = montarDashboardEvasao({ linhas, contatos, historico: [], filtros: { inicio: "2026-09-01", fim: "2026-09-10" } });
  assert.equal(p.total, 1);
  assert.equal(p.evadidos[0].turma.id, "t1");
  // filtro por turma
  assert.equal(montarDashboardEvasao({ linhas, contatos, historico: [], filtros: { turma: "t2" } }).total, 1);
});
test("evadido sem data é contado no período total e informado à parte quando há filtro de datas", () => {
  const turmas = [T("t1", [{ id: "1", nome: "Ana", situacao: "Evadiu" }])];
  const linhas = consolidar(turmas, {}, {}, null, "2026-09-30");
  assert.equal(montarDashboardEvasao({ linhas, contatos: {}, historico: [] }).total, 1);
  const p = montarDashboardEvasao({ linhas, contatos: {}, historico: [], filtros: { inicio: "2026-09-01", fim: "2026-09-30" } });
  assert.equal(p.total, 0);
  assert.equal(p.semData, 1);
  // data recuperada do histórico
  const h = [{ tipo: "status", turmaId: "t1", alunoId: "1", em: "2026-09-12T10:00:00Z", descricao: "Situação do aluno: Ativo → Evadiu" }];
  assert.equal(montarDashboardEvasao({ linhas, contatos: {}, historico: h, filtros: { inicio: "2026-09-01", fim: "2026-09-30" } }).total, 1);
});

// ---------- relatório de faltas no período ----------
const tf = T("t1", [{ id: "a", nome: "Ana", situacao: "Ativo" }, { id: "b", nome: "Bruno", situacao: "Ativo" }, { id: "c", nome: "Carla", situacao: "Evadiu" }]);
const tg = T("t2", [{ id: "d", nome: "Davi", situacao: "Ativo" }], { turno: "Manhã" });
const freq = {
  "t1|2026-09-01": { a: { status: "F" }, b: { status: "H", horas: [1] } }, // fora do período
  "t1|2026-09-20": { a: { status: "H", horas: [1, 2] }, c: { status: "F" } },
  "t1|2026-09-21": { b: { status: "F" }, c: { status: "F" } },
  "t1|2026-09-22": {},
  "t2|2026-09-21": { d: { status: "F" } },
};
const linhasF = consolidar([tf, tg], freq, {}, null, "2026-09-30");
test("faltas contadas em horas só dentro do período; aulas sem chamada não contam", () => {
  const p = resumoPeriodo(tf, "a", freq, "2026-09-16", "2026-09-30");
  assert.deepEqual([p.aulas, p.horasDadas, p.horasFalta, p.diasParcial, p.diasFalta], [3, 12, 2, 1, 0]);
  assert.equal(p.pct, 83.3); // 10/12 = 83,33 → 83,3
});
test("9. ordem decrescente de faltas; evadidos fora por padrão; filtros de turma/turno", () => {
  const r = relatorioFaltas({ linhas: linhasF, freq, filtros: { inicio: "2026-09-16", fim: "2026-09-30" } });
  assert.deepEqual(r.itens.map((x) => [x.aluno.nome, x.p.horasFalta]), [["Bruno", 4], ["Davi", 4], ["Ana", 2]]);
  assert.equal(r.itens[0].pos, 1);
  assert.equal(r.resumo.alunos, 3);
  assert.equal(r.resumo.horasFalta, 10);
  const t = relatorioFaltas({ linhas: linhasF, freq, filtros: { inicio: "2026-09-16", fim: "2026-09-30", turno: "Manhã" } });
  assert.deepEqual(t.itens.map((x) => x.aluno.nome), ["Davi"]);
  const todas = relatorioFaltas({ linhas: linhasF, freq, filtros: { inicio: "2026-09-16", fim: "2026-09-30", situacao: "todas", turma: "t1" } });
  assert.equal(todas.itens[0].aluno.nome, "Carla"); // 8h
  const top1 = relatorioFaltas({ linhas: linhasF, freq, filtros: { inicio: "2026-09-16", fim: "2026-09-30", exibir: "10", turma: "t1" } });
  assert.equal(top1.itens.length, 2);
  const tudo = relatorioFaltas({ linhas: linhasF, freq, filtros: { inicio: "2026-09-21", fim: "2026-09-22", exibir: "todos", turma: "t1" } });
  assert.deepEqual(tudo.itens.map((x) => x.aluno.nome), ["Bruno", "Ana"]); // Ana com 0h aparece só em "todos"
});
test("11. datas inválidas são recusadas; período padrão = 15 dias", () => {
  assert.ok(validarPeriodo("2026-09-30", "2026-09-01"));
  assert.ok(validarPeriodo("2026-02-30", "2026-03-01"));
  assert.ok(relatorioFaltas({ linhas: linhasF, freq, filtros: { inicio: "", fim: "2026-09-30" } }).erro);
  assert.deepEqual(periodoPadrao("2026-10-17"), { inicio: "2026-10-03", fim: "2026-10-17" });
  assert.deepEqual(quinzenaAnterior({ inicio: "2026-10-03", fim: "2026-10-17" }), { inicio: "2026-09-18", fim: "2026-10-02" });
  assert.deepEqual(quinzenaSeguinte({ inicio: "2026-09-18", fim: "2026-10-02" }), { inicio: "2026-10-03", fim: "2026-10-17" });
});
