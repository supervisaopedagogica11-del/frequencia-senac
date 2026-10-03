// Leitura das planilhas do sistema acadêmico do Senac ("Listagem de Alunos para Livro" e aba BASE)
// — mesma lógica do protótipo, com o campo de e-mail sempre preservado.

function turnoFromHora(hhmm) {
  if (!hhmm) return "Não definido";
  const h = parseInt(hhmm.split(":")[0], 10);
  if (h < 12) return "Manhã";
  if (h < 18) return "Tarde";
  return "Noite";
}
function horasEntre(inicio, fim) {
  if (!inicio || !fim) return null;
  const [h1, m1] = inicio.split(":").map(Number);
  const [h2, m2] = fim.split(":").map(Number);
  const diff = (h2 * 60 + m2 - (h1 * 60 + m1)) / 60;
  return diff > 0 ? Math.round(diff) : null;
}
function parseDataBR(s) {
  const m = String(s || "").match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}
function parseHorarioStr(s) {
  const m = String(s || "").match(/(\d{1,2}):(\d{2}).*?(\d{1,2}):(\d{2})/);
  return m ? { inicio: `${m[1].padStart(2, "0")}:${m[2]}`, fim: `${m[3].padStart(2, "0")}:${m[4]}` } : null;
}
export function normalizarTurno(txt, horaInicio) {
  const t = String(txt || "").toLowerCase();
  if (t.includes("manh")) return "Manhã";
  if (t.includes("tard")) return "Tarde";
  if (t.includes("noit")) return "Noite";
  return turnoFromHora(horaInicio);
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
export const novoId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

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
        id: novoId(),
        nome: nomeVal,
        matricula: colIdx.matricula !== undefined ? (cells[colIdx.matricula] || "").trim() : "",
        telefone: (colIdx.celular !== undefined && (cells[colIdx.celular] || "").trim()) || (colIdx.telefone !== undefined ? (cells[colIdx.telefone] || "").trim() : ""),
        email: colIdx.email !== undefined ? (cells[colIdx.email] || "").trim().toLowerCase() : "",
        statusAcomp: "Regular",
      });
    }
  });
  return blocks.filter((b) => b.alunos.length > 0);
}

export function blockToTurma(block) {
  const h = parseHorarioStr(block.horarioTexto);
  const horarioInicio = h ? h.inicio : null;
  const horarioFim = h ? h.fim : null;
  const periodoParts = (block.periodoTexto || "").split(/à|a(?!\d)/i).map((s) => s.trim()).filter(Boolean);
  return {
    id: novoId(),
    curso: block.curso || "Curso sem nome",
    tipo: null,
    codigo: (block.turmaCodigo || "").trim(),
    instrutor: block.instrutor || "",
    periodoInicio: periodoParts[0] ? parseDataBR(periodoParts[0]) : null,
    periodoFim: periodoParts[1] ? parseDataBR(periodoParts[1]) : (periodoParts[0] ? parseDataBR(periodoParts[0]) : null),
    periodoRealFim: null,
    finalizada: false,
    horarioInicio, horarioFim,
    cargaHoraria: parseInt(block.cargaHorariaTexto, 10) || null,
    turno: normalizarTurno(block.turnoTexto, horarioInicio),
    horariosPorDia: parseInt(block.horasDiaTexto, 10) || horasEntre(horarioInicio, horarioFim) || 4,
    alunos: block.alunos,
  };
}

// mescla turmas importadas com as existentes (só mescla por código; sem código, por curso+turno+início)
export function mesclarImportacao(turmasAtuais, blocks) {
  const alteradas = [];
  const novas = [];
  let novosAlunos = 0, emailsAtualizados = 0;
  const copia = turmasAtuais.map((t) => ({ ...t, alunos: [...(t.alunos || [])] }));
  blocks.forEach((b) => {
    const nova = blockToTurma(b);
    const existente = copia.find((t) => {
      if (nova.codigo && t.codigo) return t.codigo === nova.codigo;
      if (!nova.codigo && !t.codigo) return t.curso === nova.curso && t.turno === nova.turno && t.periodoInicio === nova.periodoInicio;
      return false;
    });
    if (existente) {
      let mudou = false;
      nova.alunos.forEach((a) => {
        const dup = existente.alunos.find((x) => (a.matricula && x.matricula === a.matricula) || x.nome.toLowerCase() === a.nome.toLowerCase());
        if (!dup) { existente.alunos.push(a); novosAlunos++; mudou = true; }
        else {
          const idx = existente.alunos.indexOf(dup);
          const patch = {};
          if (!dup.email && a.email) { patch.email = a.email; emailsAtualizados++; }
          if (!dup.telefone && a.telefone) patch.telefone = a.telefone;
          if (Object.keys(patch).length) { existente.alunos[idx] = { ...dup, ...patch }; mudou = true; }
        }
      });
      if (!existente.cargaHoraria && nova.cargaHoraria) { existente.cargaHoraria = nova.cargaHoraria; mudou = true; }
      if (mudou) alteradas.push(existente);
    } else {
      novas.push(nova);
      novosAlunos += nova.alunos.length;
    }
  });
  return { alteradas, novas, novosAlunos, emailsAtualizados };
}
