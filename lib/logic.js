// Lógica de negócio do Sistema de Frequência — Senac Três Corações
// Portado 1:1 das regras já validadas no protótipo (artefato), para não recomeçar do zero.

export const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const ymOf = (iso) => iso.slice(0, 7);
export const monthLabel = (ym) => { const [y, m] = ym.split("-"); return `${MESES[parseInt(m, 10) - 1]}/${y}`; };

export function turnoFromHora(hhmm) {
  if (!hhmm) return "Não definido";
  const h = parseInt(hhmm.split(":")[0], 10);
  if (h < 12) return "Manhã";
  if (h < 18) return "Tarde";
  return "Noite";
}
export function horasEntre(inicio, fim) {
  if (!inicio || !fim) return null;
  const [h1, m1] = inicio.split(":").map(Number);
  const [h2, m2] = fim.split(":").map(Number);
  const diff = (h2 * 60 + m2 - (h1 * 60 + m1)) / 60;
  return diff > 0 ? Math.round(diff) : null;
}
export function parseDataBR(s) {
  const m = String(s || "").match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}
export function parseHorarioStr(s) {
  const m = String(s || "").match(/(\d{1,2}):(\d{2}).*?(\d{1,2}):(\d{2})/);
  return m ? { inicio: `${m[1].padStart(2, "0")}:${m[2]}`, fim: `${m[3].padStart(2, "0")}:${m[4]}` } : null;
}
export function digitsOnly(s) { return String(s || "").replace(/\D/g, ""); }
export function telLink(tel) { const d = digitsOnly(tel); return d ? `tel:+55${d}` : null; }
export function waLink(tel, texto) { const d = digitsOnly(tel); if (!d) return null; const full = d.length <= 11 ? `55${d}` : d; return `https://wa.me/${full}?text=${encodeURIComponent(texto)}`; }
export function mailtoLink(email, assunto, corpo) { if (!email) return null; return `mailto:${email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`; }

export const SITUACOES_ALUNO = ["Ativo", "Evadiu", "Cancelou", "Desistiu", "Concluiu"];
export function isAlunoAtivo(aluno) { return !aluno.situacao || aluno.situacao === "Ativo"; }
export const STATUS_CONTATO = ["Aguardando retorno", "Retornou", "Sem resposta", "Não localizado", "Em acompanhamento", "Evadido"];
export const STATUS_CONTATO_COR = { "Aguardando retorno": "#F59E0B", "Retornou": "#10B981", "Sem resposta": "#9CA3AF", "Não localizado": "#EF4444", "Em acompanhamento": "#8B5CF6", "Evadido": "#6B7280" };
export const TIPOS_INTERVENCAO = ["Ligação", "WhatsApp", "E-mail", "Atendimento presencial", "Atendimento remoto", "Conversa com docente", "Conversa com coordenação", "Conversa com responsável", "Visita institucional", "Outro"];
export const TIER_COR = { verde: "#10B981", amarelo: "#F59E0B", roxo: "#8B5CF6", vermelho: "#EF4444", cinza: "#9CA3AF" };
export const RISCO_LABEL = { verde: "🟢 Baixo risco", amarelo: "🟡 Atenção", laranja: "🟠 Alto risco", vermelho: "🔴 Risco de evasão" };
export const RISCO_COR = { verde: "#10B981", amarelo: "#F59E0B", laranja: "#F97316", vermelho: "#EF4444" };

// contagem de um status ('F'|'A'|'J') no intervalo [desde, ate] para um aluno
// freqMap: objeto { "turmaId|data": { alunoId: { status, horarioAtraso } } } — já carregado do Firestore para a turma
export function contarStatus(turma, alunoId, freqMap, desde, ate, statusChar) {
  let n = 0;
  Object.keys(freqMap).forEach((chave) => {
    const [tId, data] = chave.split("|");
    if (tId !== turma.id) return;
    if (ate && data > ate) return;
    if (desde && data < desde) return;
    const reg = freqMap[chave][alunoId];
    if (reg && reg.status === statusChar) n++;
  });
  return n;
}

// % de frequência acumulada = (carga horária total − horas faltadas) ÷ carga horária total
// horas faltadas = faltas*horas/dia + atrasos*horas/dia*0.5
export function calcularFrequencia(turma, alunoId, freqMap, ate) {
  const limite = ate || todayISO();
  const faltas = contarStatus(turma, alunoId, freqMap, null, limite, "F");
  const atrasos = contarStatus(turma, alunoId, freqMap, null, limite, "A");
  const horasDia = turma.horariosPorDia || 1;
  const horasFaltadas = faltas * horasDia + atrasos * horasDia * 0.5;
  if (!turma.cargaHoraria) return { pct: null, faltas, atrasos, horasFaltadas };
  const pct = ((turma.cargaHoraria - horasFaltadas) / turma.cargaHoraria) * 100;
  return { pct: Math.max(0, Math.round(pct * 10) / 10), faltas, atrasos, horasFaltadas };
}

// status: Risco de evasão (%<75) > Acompanhar (3+ justificadas no mês) > Monitorar (%<=85) > Regular
export function calcularStatus(turma, alunoId, freqMap, hoje) {
  const acumulado = calcularFrequencia(turma, alunoId, freqMap, hoje);
  const base = { pct: acumulado.pct, faltas: acumulado.faltas, atrasos: acumulado.atrasos };
  if (acumulado.pct !== null && acumulado.pct < 75) return { ...base, label: "Risco de evasão", tier: "vermelho" };
  const mesAtual = ymOf(hoje);
  const inicioMes = `${mesAtual}-01`;
  const justNoMes = contarStatus(turma, alunoId, freqMap, inicioMes, hoje, "J");
  if (justNoMes >= 3) return { ...base, label: "Acompanhar", tier: "roxo" };
  if (acumulado.pct !== null && acumulado.pct <= 85) return { ...base, label: "Monitorar", tier: "amarelo" };
  return { ...base, label: "Regular", tier: "verde" };
}

// dias consecutivos (mais recentes) com falta integral registrada
export function faltasConsecutivas(turma, alunoId, freqMap) {
  const datas = Object.keys(freqMap)
    .filter((k) => k.startsWith(turma.id + "|"))
    .map((k) => k.split("|")[1])
    .filter((d) => d <= todayISO())
    .sort();
  let streak = 0;
  for (let i = datas.length - 1; i >= 0; i--) {
    const reg = freqMap[`${turma.id}|${datas[i]}`][alunoId];
    if (reg && reg.status === "F") streak++;
    else break;
  }
  return streak;
}

// horas restantes que o aluno ainda pode faltar, faltas restantes, projeção mantendo o ritmo atual
export function calcularInteligencia(turma, alunoId, freqMap) {
  if (!turma.cargaHoraria) return null;
  const hoje = todayISO();
  const atual = calcularFrequencia(turma, alunoId, freqMap, hoje);
  const horasDia = turma.horariosPorDia || 1;
  const limiteHoras = turma.cargaHoraria * 0.25;
  const horasRestantesPermitidas = Math.max(0, limiteHoras - atual.horasFaltadas);
  const faltasInteirasRestantes = Math.floor(horasRestantesPermitidas / horasDia);
  const jaReprovado = atual.pct !== null && atual.pct < 75;

  const datasRegistradas = Object.keys(freqMap).filter((k) => k.startsWith(turma.id + "|")).map((k) => k.split("|")[1]).filter((d) => d <= hoje);
  let projecaoPct = atual.pct;
  if (datasRegistradas.length >= 3) {
    const horasDadas = datasRegistradas.length * horasDia;
    const taxaFalta = atual.horasFaltadas / horasDadas;
    const horasRestantesCurso = Math.max(0, turma.cargaHoraria - horasDadas);
    const horasFaltadasProjetadasExtra = taxaFalta * horasRestantesCurso;
    const horasFaltadasFinal = atual.horasFaltadas + horasFaltadasProjetadasExtra;
    projecaoPct = Math.max(0, Math.round(((turma.cargaHoraria - horasFaltadasFinal) / turma.cargaHoraria) * 1000) / 10);
  }
  return { pctAtual: atual.pct, horasRestantesPermitidas, faltasInteirasRestantes, jaReprovado, projecaoPct, recuperacaoPossivel: !jaReprovado };
}

// classificação de risco de evasão — combina múltiplos sinais, não é um modelo preditivo
export function classificarRisco(turma, alunoId, freqMap) {
  const status = calcularStatus(turma, alunoId, freqMap, todayISO());
  const consec = faltasConsecutivas(turma, alunoId, freqMap);
  const pct = status.pct;
  const motivos = [];
  let nivel = "verde";
  const escalar = (n) => { const ordem = { verde: 0, amarelo: 1, laranja: 2, vermelho: 3 }; if (ordem[n] > ordem[nivel]) nivel = n; };

  if (pct !== null && pct < 75) { escalar("vermelho"); motivos.push(`frequência em ${pct}% (abaixo do mínimo)`); }
  if (consec >= 5) { escalar("vermelho"); motivos.push(`${consec} faltas consecutivas`); }
  else if (consec >= 3) { escalar("laranja"); motivos.push(`${consec} faltas consecutivas`); }
  if (pct !== null && pct >= 75 && pct < 80) { escalar("laranja"); motivos.push(`frequência próxima do mínimo (${pct}%)`); }
  else if (pct !== null && pct >= 80 && pct < 85) { escalar("amarelo"); motivos.push(`frequência em atenção (${pct}%)`); }

  return { nivel, motivos, pct, consec };
}

function scanRowForField(cells, prefixes) {
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i].trim();
    for (const p of prefixes) {
      if (c.toLowerCase() === p.toLowerCase()) return (cells[i + 1] || "").trim();
      if (c.length > p.length && c.toLowerCase().startsWith(p.toLowerCase())) return c.slice(p.length).trim();
    }
  }
  return null;
}

// parser da "Listagem de Alunos para Livro" (Senac) e da aba BASE da planilha de acompanhamento
export function parsePlanilha(rows) {
  const blocks = [];
  let current = null, headerIdx = null, colIdx = {};

  rows.forEach((row, i) => {
    const cells = (row || []).map((c) => (c === null || c === undefined ? "" : String(c)));

    const cursoVal = scanRowForField(cells, ["Curso:"]);
    if (cursoVal) {
      current = { curso: cursoVal, turmaCodigo: "", turnoTexto: "", instrutor: "", periodoTexto: "", horarioTexto: "", cargaHorariaTexto: "", horasDiaTexto: "", alunos: [] };
      blocks.push(current);
      headerIdx = null; colIdx = {};
    }
    if (!current) return;

    const t1 = scanRowForField(cells, ["Turma:"]); if (t1) current.turmaCodigo = t1;
    const t2 = scanRowForField(cells, ["Turno:"]); if (t2) current.turnoTexto = t2;
    const t3 = scanRowForField(cells, ["Período:"]); if (t3) current.periodoTexto = t3;
    const t4 = scanRowForField(cells, ["Horário:"]); if (t4) current.horarioTexto = t4;
    const t5 = scanRowForField(cells, ["Docente:", "Instrutor(a):", "Instrutor:"]); if (t5) current.instrutor = t5;
    const t6 = scanRowForField(cells, ["Carga Horária (h):", "Carga Horária:"]); if (t6) current.cargaHorariaTexto = t6;
    const t7 = scanRowForField(cells, ["Horas/dia de aula:", "Horas/dia:", "Horas por dia:"]); if (t7) current.horasDiaTexto = t7;

    const nomeIdx = cells.findIndex((c) => ["nome completo do aluno", "nome do aluno", "nome"].includes(c.trim().toLowerCase()));
    if (nomeIdx !== -1) {
      colIdx = { nome: nomeIdx };
      cells.forEach((c, idx) => {
        const nh = c.trim().toLowerCase();
        if (["matrícula", "matricula"].includes(nh)) colIdx.matricula = idx;
        if (nh === "celular") colIdx.celular = idx;
        if (nh === "telefone") colIdx.telefone = idx;
        if (["e-mail", "email"].includes(nh)) colIdx.email = idx;
      });
      headerIdx = i;
      return;
    }

    if (headerIdx !== null && i > headerIdx && colIdx.nome !== undefined) {
      const nomeVal = (cells[colIdx.nome] || "").trim();
      if (!nomeVal) return;
      current.alunos.push({
        nome: nomeVal,
        matricula: colIdx.matricula !== undefined ? (cells[colIdx.matricula] || "").trim() : "",
        telefone: (colIdx.celular !== undefined && (cells[colIdx.celular] || "").trim()) || (colIdx.telefone !== undefined ? (cells[colIdx.telefone] || "").trim() : ""),
        email: colIdx.email !== undefined ? (cells[colIdx.email] || "").trim() : "",
        situacao: "Ativo",
      });
    }
  });

  return blocks.filter((b) => b.alunos.length > 0);
}

export function blockToTurma(block, novoId) {
  const h = parseHorarioStr(block.horarioTexto);
  const horarioInicio = h ? h.inicio : null;
  const horarioFim = h ? h.fim : null;
  const periodoParts = (block.periodoTexto || "").split(/à|a(?!\d)/i).map((s) => s.trim()).filter(Boolean);
  return {
    id: novoId,
    curso: block.curso || "Curso sem nome",
    tipo: null,
    codigo: (block.turmaCodigo || "").trim(),
    instrutor: block.instrutor || "",
    periodoInicio: periodoParts[0] ? parseDataBR(periodoParts[0]) : null,
    periodoFim: periodoParts[1] ? parseDataBR(periodoParts[1]) : (periodoParts[0] ? parseDataBR(periodoParts[0]) : null),
    periodoRealFim: null,
    horarioInicio, horarioFim,
    cargaHoraria: parseInt(block.cargaHorariaTexto, 10) || null,
    turno: block.turnoTexto || turnoFromHora(horarioInicio),
    horariosPorDia: parseInt(block.horasDiaTexto, 10) || horasEntre(horarioInicio, horarioFim) || 4,
    alunos: block.alunos.map((a) => ({ ...a, id: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2) })),
  };
}
