// Lista única de pendências da Supervisão — sem repetir o mesmo aluno.
import { isFinalizada, statusAluno, diasEntre, addDias, datasRegistradas, fmtDataCurta } from "./engine.js";

export function montarAgenda({ turmas, linhas, alertas, contatos, freq, hoje, turmaId }) {
  const porKey = new Map(linhas.map((l) => [l.key, l]));
  const ok = (k) => { const l = porKey.get(k); return l && l.ativo && !l.finalizada && (!turmaId || l.turma.id === turmaId); };
  const contatar = new Map();
  const add = (l, item) => {
    const atual = contatar.get(l.key);
    if (!atual || item.peso > atual.peso) contatar.set(l.key, { linha: l, ...item, alertas: [...(atual?.alertas || []), ...(item.alerta ? [item.alerta] : [])] });
    else if (item.alerta) atual.alertas.push(item.alerta);
  };

  for (const a of Object.values(alertas)) {
    if (a.status !== "aberto" || (a.adiadoAte && a.adiadoAte > hoje)) continue;
    const k = `${a.turmaId}|${a.alunoId}`;
    if (!ok(k)) continue;
    const l = porKey.get(k);
    if (a.tipo === "consecutivas") {
      add(l, { alerta: a, peso: 3, cor: "#DC2626", motivo: `${l.r.consecutivas || a.consecutivas} faltas seguidas (${(l.r.datasConsecutivas.length ? l.r.datasConsecutivas : a.datasFaltas || []).map(fmtDataCurta).join(", ")})` });
    } else if (a.tipo === "limite" && ["risco", "abaixo"].includes(l.r.faixa)) {
      add(l, { alerta: a, peso: l.r.faixa === "abaixo" ? 4 : 2, cor: l.r.faixa === "abaixo" ? "#DC2626" : "#F59E0B", motivo: l.r.motivo });
    }
  }
  for (const l of linhas) {
    if (!ok(l.key)) continue;
    if (statusAluno(l.aluno) === "Necessita contato" && !contatar.has(l.key)) add(l, { peso: 1, cor: "#EF4444", motivo: l.r.motivo || "Marcado como “Necessita contato”" });
  }

  const retornos = [];
  for (const [k, c] of Object.entries(contatos)) {
    if (!ok(k) || c.concluido || contatar.has(k)) continue;
    if (c.proximaData && c.proximaData <= hoje) retornos.push({ linha: porKey.get(k), contato: c, atraso: diasEntre(c.proximaData, hoje) });
  }
  retornos.sort((a, b) => b.atraso - a.atraso);

  // chamada do dia ainda não feita (turma que teve aula neste mesmo dia da semana nas últimas 2 semanas)
  const chamadas = [];
  const dow = new Date(hoje + "T12:00:00").getDay();
  for (const t of turmas) {
    if ((turmaId && t.id !== turmaId) || isFinalizada(t) || dow === 0 || freq[`${t.id}|${hoje}`]) continue;
    if ((t.periodoInicio && t.periodoInicio > hoje) || (t.periodoFim && t.periodoFim < hoje)) continue;
    const lim = addDias(hoje, -14);
    if (datasRegistradas(t.id, freq, hoje).some((d) => d >= lim && new Date(d + "T12:00:00").getDay() === dow)) chamadas.push(t);
  }

  // ajustes de cadastro que impedem o sistema de funcionar direito
  const avisos = [];
  for (const t of turmas) {
    if ((turmaId && t.id !== turmaId) || isFinalizada(t)) continue;
    if (!t.cargaHoraria) avisos.push({ turma: t, texto: `"${t.curso}" está sem carga horária — sem ela não dá para calcular a frequência.` });
    else if (t.periodoFim && t.periodoFim < hoje) avisos.push({ turma: t, texto: `"${t.curso}" passou da data de término e ainda não foi finalizada.` });
  }

  const lista = [...contatar.values()].sort((a, b) => b.peso - a.peso || b.linha.prioridade - a.linha.prioridade);
  return { contatar: lista, retornos, chamadas, avisos, total: lista.length + retornos.length };
}
