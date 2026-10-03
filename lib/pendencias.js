// Monta a agenda/pendências da Supervisão a partir dos dados — sem repetições.
import { isFinalizada, mergeConfig, diasEntre, addDias, datasRegistradas, statusAluno } from "./engine.js";

export function montarAgenda({ turmas, linhas, alertas, contatos, freq, cfg: cfgIn, hoje, turmaId }) {
  const cfg = mergeConfig(cfgIn);
  const porKey = new Map(linhas.map((l) => [l.key, l]));
  const turmasAlvo = turmas.filter((t) => !turmaId || t.id === turmaId);
  const ativoKey = (k) => { const l = porKey.get(k); return l && l.ativo && !l.finalizada; };

  const abertos = Object.values(alertas).filter((a) => a.status === "aberto" && (!turmaId || a.turmaId === turmaId) && (!a.adiadoAte || a.adiadoAte <= hoje));
  const consecutivas = [];
  const limite = [];
  const vistos = new Set();
  abertos.filter((a) => a.tipo === "consecutivas").sort((a, b) => (b.consecutivas || 0) - (a.consecutivas || 0)).forEach((a) => {
    const k = `${a.turmaId}|${a.alunoId}`;
    if (!ativoKey(k) || vistos.has(k)) return;
    vistos.add(k);
    consecutivas.push({ alerta: a, linha: porKey.get(k) });
  });
  const ordemF = { abaixo: 0, critico: 1, risco: 2 };
  abertos.filter((a) => a.tipo === "limite").forEach((a) => {
    const k = `${a.turmaId}|${a.alunoId}`;
    if (!ativoKey(k) || vistos.has(k)) return;
    const l = porKey.get(k);
    // só mostra a faixa mais grave e apenas se o aluno ainda está nela (ou pior)
    if (!["risco", "critico", "abaixo"].includes(l.r.faixa)) return;
    const jaTem = limite.find((x) => x.linha.key === k);
    if (jaTem) { if (ordemF[a.faixa] < ordemF[jaTem.alerta.faixa]) jaTem.alerta = a; return; }
    limite.push({ alerta: a, linha: l });
  });
  limite.forEach((x) => vistos.add(x.linha.key));
  limite.sort((a, b) => b.linha.prioridade - a.linha.prioridade);

  // retornos agendados (próximo contato até hoje)
  const retornos = [];
  const semRetorno = [];
  for (const [k, c] of Object.entries(contatos)) {
    if (turmaId && !k.startsWith(turmaId + "|")) continue;
    if (!ativoKey(k) || c.concluido) continue;
    const l = porKey.get(k);
    if (c.proximaData && c.proximaData <= hoje) {
      retornos.push({ linha: l, contato: c, atraso: diasEntre(c.proximaData, hoje) });
      continue;
    }
    if (statusAluno(l.aluno) === "Aguardando retorno" && c.ultimoContato && diasEntre(c.ultimoContato, hoje) >= 3 && !vistos.has(k)) {
      semRetorno.push({ linha: l, contato: c, dias: diasEntre(c.ultimoContato, hoje) });
    }
  }
  retornos.sort((a, b) => b.atraso - a.atraso);

  // alunos marcados como "Necessita contato" sem alerta aberto (ex.: marcados manualmente)
  const necessitaContato = linhas.filter((l) => (!turmaId || l.turma.id === turmaId) && l.ativo && !l.finalizada && statusAluno(l.aluno) === "Necessita contato" && !vistos.has(l.key) && !retornos.find((r) => r.linha.key === l.key));

  // chamadas pendentes: turma ativa que costuma ter aula neste dia da semana e ainda não teve chamada hoje
  const chamadasPendentes = [];
  if (cfg.automacoes.alertaChamadaPendente) {
    const dow = new Date(hoje + "T12:00:00").getDay();
    for (const t of turmasAlvo) {
      if (isFinalizada(t) || dow === 0) continue;
      if (t.periodoInicio && t.periodoInicio > hoje) continue;
      if (t.periodoFim && t.periodoFim < hoje) continue;
      if (freq[`${t.id}|${hoje}`]) continue;
      const datas = datasRegistradas(t.id, freq, hoje);
      const limiteData = addDias(hoje, -14);
      const mesmoDia = datas.some((d) => d >= limiteData && new Date(d + "T12:00:00").getDay() === dow);
      if (mesmoDia) chamadasPendentes.push(t);
    }
  }

  // turmas com ocorrência coletiva
  const turmasOcorrencia = [];
  for (const t of turmasAlvo) {
    if (isFinalizada(t)) continue;
    const ls = linhas.filter((l) => l.turma.id === t.id && l.ativo);
    const risco = ls.filter((l) => ["risco", "critico", "abaixo"].includes(l.r.faixa) || l.r.consecutivas >= cfg.consecutivasAlerta);
    const prop = ls.length ? risco.length / ls.length : 0;
    if (risco.length >= 2 && prop >= 0.2) turmasOcorrencia.push({ turma: t, n: risco.length, prop });
  }

  // avisos administrativos
  const avisos = [];
  for (const t of turmasAlvo) {
    if (isFinalizada(t)) continue;
    if (t.periodoFim && t.periodoFim < hoje) avisos.push({ turma: t, texto: `"${t.curso}" (${t.codigo || "sem código"}) passou da previsão de término e ainda não foi finalizada.` });
    if (!t.cargaHoraria) avisos.push({ turma: t, texto: `"${t.curso}" está sem carga horária — os cálculos de frequência não funcionam sem ela.` });
    if (!t.tipo) avisos.push({ turma: t, texto: `"${t.curso}" está sem o tipo (Técnico/FIC) definido.` });
  }
  [...consecutivas, ...limite].forEach(({ linha }) => {
    if (!linha.aluno.email && !linha.aluno.telefone) avisos.push({ turma: linha.turma, linha, texto: `${linha.aluno.nome} precisa de contato, mas não tem telefone nem e-mail cadastrado.` });
    else if (!linha.aluno.email && cfg.automacoes.emailAutomatico) avisos.push({ turma: linha.turma, linha, texto: `${linha.aluno.nome} não tem e-mail cadastrado — o e-mail automático não pode ser enviado.` });
  });

  const total = consecutivas.length + limite.length + retornos.length + semRetorno.length + necessitaContato.length;
  return { consecutivas, limite, retornos, semRetorno, necessitaContato, chamadasPendentes, turmasOcorrencia, avisos, total };
}
