import test from "node:test";
import assert from "node:assert/strict";
import { resumoAluno, episodioConsecutivas, renderTemplate, variaveisEmail, isFinalizada, statusAluno, horasDoRegistro } from "../lib/engine.js";

// curso de 160h, 4h por dia → limite de faltas = 40h (25%)
const turma = { id: "t1", curso: "Assistente Administrativo", codigo: "ASA01", cargaHoraria: 160, horariosPorDia: 4, alunos: [{ id: "a1", nome: "João Silva" }] };
const dia = (n) => `2026-09-${String(n).padStart(2, "0")}`;
function freqCom(lista) { const f = {}; for (const [d, r] of lista) f[`t1|${d}`] = r ? { a1: r } : {}; return f; }

test("falta do dia inteiro desconta todas as horas do dia", () => {
  const r = resumoAluno(turma, "a1", freqCom([[dia(1), { status: "F" }], [dia(2), null]]), null, "2026-09-30");
  assert.equal(r.horasFalta, 4);
  assert.equal(r.pct, 97.5); // (160-4)/160
  assert.equal(r.limiteHoras, 40);
  assert.equal(r.horasRestantes, 36);
});

test("atraso / saída antecipada desconta só os horários marcados", () => {
  const r = resumoAluno(turma, "a1", freqCom([[dia(1), { status: "H", horas: [1] }], [dia(2), { status: "H", horas: [3, 4] }]]), null, "2026-09-30");
  assert.equal(r.horasFalta, 3);
  assert.equal(r.pct, 98.1); // 157/160 = 98,125 → 98,1 (sempre para baixo)
  assert.equal(r.diasParcial, 2);
  assert.equal(r.diasFalta, 0);
});

test("limite exato de 75%: 40h = aprovado no limite, 41h = abaixo", () => {
  const lista = []; for (let i = 1; i <= 10; i++) lista.push([dia(i), { status: "F" }]);
  const r = resumoAluno(turma, "a1", freqCom(lista), null, "2026-09-30");
  assert.equal(r.horasFalta, 40);
  assert.equal(r.pct, 75);
  assert.notEqual(r.faixa, "abaixo");
  assert.equal(r.horasRestantes, 0);
  lista.push([dia(11), { status: "H", horas: [2] }]);
  const r2 = resumoAluno(turma, "a1", freqCom(lista), null, "2026-09-30");
  assert.equal(r2.horasFalta, 41);
  assert.equal(r2.pct, 74.3); // 119/160 = 74,375 → 74,3
  assert.equal(r2.faixa, "abaixo");
});

test("percentual nunca é arredondado para cima", () => {
  const t = { ...turma, cargaHoraria: 161 }; // limite 40,25h → no máximo 40h inteiras
  const lista = []; for (let i = 1; i <= 10; i++) lista.push([dia(i), { status: "F" }]);
  lista.push([dia(11), { status: "H", horas: [1] }]); // 41h > 40,25
  const r = resumoAluno(t, "a1", freqCom(lista), null, "2026-09-30");
  assert.equal(r.faixa, "abaixo");
  assert.ok(r.pct < 75); // 74,53 → 74,5
});

test("em risco quando já usou 60% das faltas permitidas", () => {
  const lista = []; for (let i = 1; i <= 6; i++) lista.push([dia(i), { status: "F" }]); // 24h de 40h = 60%
  const r = resumoAluno(turma, "a1", freqCom(lista), null, "2026-09-30");
  assert.equal(r.usoPct, 60);
  assert.equal(r.faixa, "risco");
  assert.equal(r.horasRestantes, 16);
});

test("vale para qualquer carga horária (curso técnico de 800h)", () => {
  const t = { ...turma, cargaHoraria: 800 }; // limite 200h
  const lista = []; for (let i = 1; i <= 20; i++) lista.push([dia(i), { status: "F" }]); // 80h
  const r = resumoAluno(t, "a1", freqCom(lista), null, "2026-09-30");
  assert.equal(r.limiteHoras, 200);
  assert.equal(r.pct, 90);
  assert.equal(r.horasRestantes, 120);
});

test("faltas seguidas: só dias inteiros contam e o episódio não se repete", () => {
  const f = freqCom([[dia(1), null], [dia(2), { status: "F" }], [dia(3), { status: "F" }], [dia(4), { status: "F" }]]);
  const ep = episodioConsecutivas(turma, turma.alunos[0], f, null, "2026-09-30");
  assert.equal(ep.id, "t1_a1_seq_2026-09-02");
  f[`t1|${dia(5)}`] = { a1: { status: "F" } };
  assert.equal(episodioConsecutivas(turma, turma.alunos[0], f, null, "2026-09-30").id, ep.id);
  f[`t1|${dia(8)}`] = { a1: { status: "H", horas: [1] } }; // veio, mesmo que atrasado → quebra a sequência
  assert.equal(episodioConsecutivas(turma, turma.alunos[0], f, null, "2026-09-30"), null);
});

test("registros antigos continuam sendo lidos", () => {
  assert.equal(horasDoRegistro({ status: "A" }, 4), 2);
  assert.equal(horasDoRegistro({ status: "J" }, 4), 0);
  assert.equal(isFinalizada({ periodoRealFim: "2026-01-01" }), true);
  assert.equal(statusAluno({ situacao: "Evadiu" }), "Evadido");
  assert.equal(statusAluno({ statusAcomp: "Contatado" }), "Em acompanhamento");
});

test("modelo de e-mail com variáveis", () => {
  const f = freqCom([[dia(2), { status: "F" }], [dia(3), { status: "F" }], [dia(4), { status: "F" }]]);
  const r = resumoAluno(turma, "a1", f, null, "2026-09-30");
  const txt = renderTemplate("Olá {{aluno}}, {{faltas_consecutivas}} faltas ({{datas_faltas}}), {{horas_falta}}, {{frequencia}}", variaveisEmail({ turma, aluno: turma.alunos[0], resumo: r }));
  assert.equal(txt, "Olá João Silva, 3 faltas (02/09, 03/09 e 04/09), 12h, 92,5%");
});
