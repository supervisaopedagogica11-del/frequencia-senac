// Agenda do dia e lista de "Contato com alunos" — mesma lógica do protótipo, com melhorias:
//  - o aluno continua na lista até o acompanhamento ser finalizado (mesmo que volte a frequentar)
//  - "próximos do limite" usa as horas que o aluno ainda pode faltar (vale para qualquer carga horária)
import { isFinalizada, addDias, datasRegistradas, mergeConfig } from "./engine.js";

export function precisaContato(l, alertas, cfgIn) {
  const cfg = mergeConfig(cfgIn);
  if (!l.ativo || l.finalizada) return false;
  const c = l.contato;
  if (c && c.concluido) return false;
  if (l.r.consecutivas >= cfg.consecutivasAlerta) return true;
  if (c && (c.tentativas || []).length > 0) return true; // acompanhamento em andamento
  return Object.values(alertas || {}).some((a) => a.status === "aberto" && a.tipo === "consecutivas" && a.turmaId === l.turma.id && a.alunoId === l.aluno.id);
}

export function montarAgenda({ turmas, linhas, alertas, freq, cfg: cfgIn, hoje, turmaId }) {
  const cfg = mergeConfig(cfgIn);
  const ls = linhas.filter((l) => !turmaId || l.turma.id === turmaId);
  const semContato = [], aguardandoRetorno = [], retornaram = [], proximosLimite = [];
  const paraContato = ls.filter((l) => precisaContato(l, alertas, cfg));
  for (const l of paraContato) {
    const c = l.contato;
    if (!c || !(c.tentativas || []).length) semContato.push(l);
    else if (c.status === "Retornou") retornaram.push(l);
    else aguardandoRetorno.push(l);
  }
  // próximos do limite: ainda acima de 75%, mas podem faltar no máximo 2 dias de aula
  for (const l of ls) {
    if (!l.ativo || l.finalizada || l.r.pct === null || l.r.faixa === "abaixo") continue;
    if (l.r.horasRestantes <= 2 * (l.r.horasDia || 1)) proximosLimite.push(l);
  }
  proximosLimite.sort((a, b) => a.r.horasRestantes - b.r.horasRestantes);

  const turmasAlvo = turmas.filter((t) => (!turmaId || t.id === turmaId) && !isFinalizada(t));
  const turmasAcompanhar = [];
  for (const t of turmasAlvo) {
    const ativos = ls.filter((l) => l.turma.id === t.id && l.ativo);
    const risco = ativos.filter((l) => ["laranja", "vermelho"].includes(l.risco.nivel));
    const prop = ativos.length ? risco.length / ativos.length : 0;
    if (prop >= 0.2 && risco.length >= 2) turmasAcompanhar.push({ turma: t, n: risco.length, prop });
  }

  const pendenciasAdmin = [];
  for (const t of turmasAlvo) {
    if (!t.tipo) pendenciasAdmin.push({ turma: t, texto: `Turma "${t.curso}" (${t.codigo || "sem código"}) está sem o tipo (Técnico/FIC) definido.` });
    if (!t.cargaHoraria) pendenciasAdmin.push({ turma: t, texto: `Turma "${t.curso}" está sem carga horária — a frequência não pode ser calculada.` });
  }
  [...semContato, ...aguardandoRetorno].forEach((l) => {
    if (!l.aluno.telefone && !l.aluno.email) pendenciasAdmin.push({ turma: l.turma, linha: l, texto: `${l.aluno.nome} (${l.turma.curso}) precisa de contato, mas não tem telefone nem e-mail cadastrado.` });
  });

  const avisos = [];
  const dow = new Date(hoje + "T12:00:00").getDay();
  for (const t of turmasAlvo) {
    if (t.periodoFim && t.periodoFim < hoje) avisos.push({ turma: t, texto: `A turma "${t.curso}" (${t.codigo || "sem código"}) passou da data prevista de término (${t.periodoFim.split("-").reverse().join("/")}) e ainda não foi finalizada.` });
    // melhoria: lembrar chamada do dia (turma que teve aula neste dia da semana nas últimas 2 semanas)
    if (dow !== 0 && !freq[`${t.id}|${hoje}`] && !(t.periodoInicio && t.periodoInicio > hoje)) {
      const lim = addDias(hoje, -14);
      if (datasRegistradas(t.id, freq, hoje).some((d) => d >= lim && new Date(d + "T12:00:00").getDay() === dow)) avisos.push({ turma: t, chamada: true, texto: `A chamada de hoje da turma "${t.curso}" ainda não foi feita.` });
    }
  }

  const total = semContato.length + aguardandoRetorno.length + retornaram.length;
  return { semContato, aguardandoRetorno, retornaram, proximosLimite, turmasAcompanhar, pendenciasAdmin, avisos, paraContato, total };
}
