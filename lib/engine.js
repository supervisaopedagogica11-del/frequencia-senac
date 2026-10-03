// Motor de cálculo de frequência — funções puras (sem Firebase), testáveis.
//
// Modelo de dados de frequência (compatível com a versão anterior do site):
//   freq["<turmaId>|<AAAA-MM-DD>"] = { [alunoId]: { status: "F" | "A" | "J", horarioAtraso? } }
//   - uma data presente no mapa = aula registrada (chamada feita)
//   - aluno sem registro naquela data = presente
//
// % de frequência (igual à planilha usada pela escola):
//   (carga horária total − horas faltadas) ÷ carga horária total
//   horas faltadas = faltas × horas/dia + atrasos × horas/dia × pesoAtraso
//   faltas justificadas (J) não descontam horas.

import { CONFIG_PADRAO, STATUS_INATIVOS, FAIXA_ORDEM } from "./constants.js";

export const todayISO = () => {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
};
export const fmtPct = (v) => (v === null || v === undefined ? "—" : `${String(v).replace(".", ",")}%`);
export const ymOf = (iso) => (iso || "").slice(0, 7);
export const fmtData = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};
export const fmtDataCurta = (iso) => {
  if (!iso) return "—";
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}`;
};
export const fmtDataHora = (iso) => {
  if (!iso) return "—";
  const dt = new Date(iso);
  return dt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};
export const addDias = (iso, n) => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
export const diasEntre = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000);

export function mergeConfig(cfg) {
  const c = cfg || {};
  return {
    ...CONFIG_PADRAO,
    ...c,
    faixas: { ...CONFIG_PADRAO.faixas, ...(c.faixas || {}) },
    folga: { ...CONFIG_PADRAO.folga, ...(c.folga || {}) },
    automacoes: { ...CONFIG_PADRAO.automacoes, ...(c.automacoes || {}) },
    email: { ...CONFIG_PADRAO.email, ...(c.email || {}) },
  };
}

// ---------- turma / aluno ----------
export function isFinalizada(t) {
  if (!t) return false;
  if (typeof t.finalizada === "boolean") return t.finalizada;
  return !!t.periodoRealFim;
}
const LEGADO_SITUACAO = { Evadiu: "Evadido", Cancelou: "Evadido", Desistiu: "Evadido", Concluiu: "Concluído" };
export function statusAluno(a) {
  if (!a) return "Regular";
  if (a.statusAcomp) return a.statusAcomp;
  if (a.situacao && LEGADO_SITUACAO[a.situacao]) return LEGADO_SITUACAO[a.situacao];
  return "Regular";
}
export function isAlunoAtivo(a) {
  return !STATUS_INATIVOS.includes(statusAluno(a));
}

// ---------- registros ----------
export function datasRegistradas(turmaId, freq, ate) {
  const pref = turmaId + "|";
  const out = [];
  for (const k of Object.keys(freq || {})) {
    if (!k.startsWith(pref)) continue;
    const d = k.slice(pref.length);
    if (ate && d > ate) continue;
    out.push(d);
  }
  return out.sort();
}

function regDe(freq, turmaId, data, alunoId) {
  const r = freq[`${turmaId}|${data}`];
  return r ? r[alunoId] : undefined;
}

// sequência mais recente de faltas (F) consecutivas, considerando apenas aulas registradas
export function sequenciaFaltas(turmaId, alunoId, freq, ate) {
  const datas = datasRegistradas(turmaId, freq, ate);
  const seq = [];
  for (let i = datas.length - 1; i >= 0; i--) {
    const r = regDe(freq, turmaId, datas[i], alunoId);
    if (r && r.status === "F") seq.unshift(datas[i]);
    else break;
  }
  return seq; // datas em ordem crescente
}

// maior sequência de faltas da história (para relatórios)
export function maiorSequencia(turmaId, alunoId, freq, ate) {
  const datas = datasRegistradas(turmaId, freq, ate);
  let max = 0, cur = 0;
  for (const d of datas) {
    const r = regDe(freq, turmaId, d, alunoId);
    if (r && r.status === "F") { cur++; if (cur > max) max = cur; } else cur = 0;
  }
  return max;
}

// ---------- resumo completo do aluno ----------
export function resumoAluno(turma, alunoId, freq, cfgIn, ateIn) {
  const cfg = mergeConfig(cfgIn);
  const ate = ateIn || todayISO();
  const min = Number(cfg.limiteMinimo) || 75;
  const hd = Number(turma.horariosPorDia) || 1;
  const ch = Number(turma.cargaHoraria) || 0;
  const peso = Number(cfg.pesoAtraso ?? 0.5);

  const datas = datasRegistradas(turma.id, freq, ate);
  let faltas = 0, atrasos = 0, justificadas = 0;
  const historico = []; // [{data, status}]
  for (const d of datas) {
    const r = regDe(freq, turma.id, d, alunoId);
    const s = r ? r.status : "P";
    if (s === "F") faltas++;
    else if (s === "A") atrasos++;
    else if (s === "J") justificadas++;
    historico.push({ data: d, status: s });
  }
  const aulas = datas.length;
  const presencas = Math.max(0, aulas - faltas - justificadas);
  const horasDadas = aulas * hd;
  const horasFaltadas = faltas * hd + atrasos * hd * peso;

  const seq = sequenciaFaltas(turma.id, alunoId, freq, ate);
  const consecutivas = seq.length;
  const ultimas = historico.slice(-10);
  const faltasRecentes = ultimas.filter((h) => h.status === "F").length;
  const ultimaFalta = [...historico].reverse().find((h) => h.status === "F")?.data || null;

  const base = {
    faltas, atrasos, justificadas, presencas, aulas, horasDadas, horasFaltadas,
    consecutivas, datasConsecutivas: seq, faltasRecentes, aulasRecentes: ultimas.length, ultimaFalta, historico,
    pctAulasDadas: aulas ? Math.round(((horasDadas - horasFaltadas) / horasDadas) * 1000) / 10 : null,
  };

  if (!ch) {
    return {
      ...base, pct: null, faixa: "semdados", projecaoPct: null, horasRestantesCurso: null, aulasRestantes: null,
      horasPermitidasRestantes: null, faltasPermitidasRestantes: null, pctNecessarioRestante: null, faltasAteLimite: null,
      motivos: ["Carga horária da turma não informada"], acao: "Configure a carga horária da turma (engrenagem ⚙).",
    };
  }

  const pct = Math.max(0, Math.round(((ch - horasFaltadas) / ch) * 1000) / 10);
  const horasLimite = ch * (1 - min / 100); // horas que podem ser faltadas no curso inteiro
  const horasPermitidasRestantes = Math.max(0, horasLimite - horasFaltadas);
  const faltasPermitidasRestantes = Math.floor(horasPermitidasRestantes / hd + 1e-9);
  const horasRestantesCurso = Math.max(0, ch - horasDadas);
  const aulasRestantes = Math.ceil(horasRestantesCurso / hd);
  // presença mínima necessária nas aulas que faltam para terminar ≥ limite
  const pctNecessarioRestante = horasRestantesCurso > 0
    ? Math.max(0, Math.min(100, Math.round(((horasRestantesCurso - horasPermitidasRestantes) / horasRestantesCurso) * 1000) / 10))
    : null;

  // projeção: mantém o ritmo de faltas (usa o pior entre o ritmo geral e o das últimas 10 aulas)
  let projecaoPct = pct;
  let projecaoGeral = pct;
  if (aulas >= 3 && horasDadas > 0) {
    const taxaGeral = horasFaltadas / horasDadas;
    const hfRec = ultimas.reduce((s, h) => s + (h.status === "F" ? hd : h.status === "A" ? hd * peso : 0), 0);
    const taxaRec = ultimas.length ? hfRec / (ultimas.length * hd) : taxaGeral;
    const taxa = Math.max(taxaGeral, ultimas.length >= 5 ? taxaRec : 0);
    const proj = (t) => Math.max(0, Math.round(((ch - (horasFaltadas + t * horasRestantesCurso)) / ch) * 1000) / 10);
    projecaoPct = proj(taxa);
    projecaoGeral = proj(taxaGeral);
  }

  // faixa de acompanhamento
  const motivos = [];
  let faixa = "regular";
  const f = cfg.faixas, fg = cfg.folga;
  const nAlerta = Number(cfg.consecutivasAlerta) || 3;
  if (pct < min) {
    faixa = "abaixo";
    motivos.push(`Frequência de ${pct}% — abaixo do mínimo de ${min}%`);
  } else {
    if (pct < f.critico || faltasPermitidasRestantes <= fg.critico) {
      faixa = "critico";
      motivos.push(pct < f.critico ? `Frequência de ${pct}%, muito próxima de ${min}%` : `Só pode faltar mais ${faltasPermitidasRestantes} ${faltasPermitidasRestantes === 1 ? "dia" : "dias"}`);
    } else if (pct < f.risco || faltasPermitidasRestantes <= fg.risco || (projecaoPct < min && faltasPermitidasRestantes <= fg.risco * 3)) {
      faixa = "risco";
      if (pct < f.risco) motivos.push(`Frequência de ${pct}% se aproximando de ${min}%`);
      if (faltasPermitidasRestantes <= fg.risco) motivos.push(`Pode faltar apenas mais ${faltasPermitidasRestantes} ${faltasPermitidasRestantes === 1 ? "dia" : "dias"}`);
      if (projecaoPct < min && faltasPermitidasRestantes <= fg.risco * 3) motivos.push(`Mantendo o ritmo atual, termina o curso com ${projecaoPct}%`);
    } else if (pct < f.atencao || projecaoPct < min + 5 || consecutivas >= 2 || faltasRecentes >= 3) {
      faixa = "atencao";
      if (pct < f.atencao) motivos.push(`Frequência de ${pct}%`);
      if (projecaoPct < min + 5) motivos.push(`Mantendo o ritmo recente de faltas, a projeção é de ${projecaoPct}% ao final do curso`);
      if (consecutivas >= 2 && consecutivas < nAlerta) motivos.push(`${consecutivas} faltas seguidas`);
      if (faltasRecentes >= 3) motivos.push(`${faltasRecentes} faltas nas últimas ${ultimas.length} aulas`);
    }
  }
  if (consecutivas >= nAlerta) motivos.unshift(`${consecutivas} faltas consecutivas`);

  let acao = "Nenhuma ação necessária no momento.";
  if (faixa === "abaixo") acao = "Contato imediato: entender a situação e orientar sobre alternativas (rematrícula, reposição, nova turma).";
  else if (faixa === "critico") acao = "Contato imediato com o aluno — qualquer nova falta pode levá-lo abaixo do mínimo.";
  else if (faixa === "risco") acao = "Entrar em contato com o aluno para entender o motivo das faltas.";
  else if (consecutivas >= nAlerta) acao = "Entrar em contato — faltas consecutivas indicam possível risco de evasão.";
  else if (faixa === "atencao") acao = "Acompanhar de perto; considerar conversa preventiva.";

  return {
    ...base, pct, faixa, motivos, acao, projecaoPct, projecaoGeral, horasRestantesCurso, aulasRestantes,
    horasPermitidasRestantes, faltasPermitidasRestantes, pctNecessarioRestante, limite: min,
    faltasAteLimite: faltasPermitidasRestantes + 1,
  };
}

// prioridade para ordenar quem precisa de intervenção imediata (maior = mais urgente)
export function prioridade(r, cfgIn) {
  const cfg = mergeConfig(cfgIn);
  const nAlerta = Number(cfg.consecutivasAlerta) || 3;
  let p = { abaixo: 60, critico: 50, risco: 35, atencao: 15, regular: 0, semdados: 0 }[r.faixa] || 0;
  if (r.consecutivas >= nAlerta) p += 30 + r.consecutivas * 2;
  if (r.faltasPermitidasRestantes !== null && r.faltasPermitidasRestantes !== undefined) p += Math.max(0, 10 - r.faltasPermitidasRestantes);
  p += r.faltasRecentes || 0;
  return p;
}

export function piorFaixa(lista) {
  let pior = "regular";
  for (const f of lista) if ((FAIXA_ORDEM[f] ?? 9) < (FAIXA_ORDEM[pior] ?? 9)) pior = f;
  return pior;
}

// ---------- visão consolidada ----------
// gera uma linha por aluno (todas as turmas), com resumo e dados de acompanhamento
export function consolidar(turmas, freq, contatos, cfg, ate) {
  const linhas = [];
  for (const t of turmas) {
    for (const a of t.alunos || []) {
      const r = resumoAluno(t, a.id, freq, cfg, ate);
      const c = contatos[`${t.id}|${a.id}`] || null;
      linhas.push({
        key: `${t.id}|${a.id}`,
        turma: t,
        aluno: a,
        r,
        status: statusAluno(a),
        ativo: isAlunoAtivo(a),
        finalizada: isFinalizada(t),
        contato: c,
        prioridade: prioridade(r, cfg),
      });
    }
  }
  return linhas;
}

export function resumoTurma(turma, linhasTurma, cfgIn) {
  const cfg = mergeConfig(cfgIn);
  const nAlerta = Number(cfg.consecutivasAlerta) || 3;
  const ativos = linhasTurma.filter((l) => l.ativo);
  const pcts = ativos.map((l) => l.r.pct).filter((v) => v !== null && v !== undefined);
  const media = pcts.length ? Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10 : null;
  const cont = { regular: 0, atencao: 0, risco: 0, critico: 0, abaixo: 0, semdados: 0 };
  ativos.forEach((l) => cont[l.r.faixa]++);
  const evadidos = linhasTurma.filter((l) => l.status === "Evadido").length;
  const total = linhasTurma.length;
  return {
    total,
    ativos: ativos.length,
    media,
    cont,
    proximos: cont.atencao + cont.risco + cont.critico,
    consecutivas: ativos.filter((l) => l.r.consecutivas >= nAlerta).length,
    emAcompanhamento: linhasTurma.filter((l) => ["Em acompanhamento", "Contatado", "Aguardando retorno", "Necessita contato"].includes(l.status)).length,
    riscoEvasao: linhasTurma.filter((l) => l.status === "Risco de evasão").length,
    evadidos,
    concluidos: linhasTurma.filter((l) => l.status === "Concluído").length,
    permanencia: total ? Math.round(((total - evadidos) / total) * 1000) / 10 : null,
  };
}

// ---------- detecção de episódios (alertas automáticos) ----------
// Um episódio de faltas consecutivas é identificado pela data da 1ª falta da sequência.
// Enquanto a sequência continuar crescendo, é o mesmo episódio (não gera novo alerta/e-mail).
// Depois de uma presença, uma nova sequência gera um novo episódio.
export function episodioConsecutivas(turma, aluno, freq, cfgIn, ate) {
  const cfg = mergeConfig(cfgIn);
  const n = Number(cfg.consecutivasAlerta) || 3;
  const seq = sequenciaFaltas(turma.id, aluno.id, freq, ate);
  if (seq.length < n) return null;
  return {
    id: `${turma.id}_${aluno.id}_seq_${seq[0]}`,
    tipo: "consecutivas",
    turmaId: turma.id,
    alunoId: aluno.id,
    consecutivas: seq.length,
    datasFaltas: seq,
    inicio: seq[0],
  };
}

// alerta de aproximação do limite — um alerta por faixa atingida (risco, crítico, abaixo)
export function episodioLimite(turma, aluno, resumo) {
  if (!resumo || !["risco", "critico", "abaixo"].includes(resumo.faixa)) return null;
  return {
    id: `${turma.id}_${aluno.id}_limite_${resumo.faixa}`,
    tipo: "limite",
    turmaId: turma.id,
    alunoId: aluno.id,
    faixa: resumo.faixa,
    pct: resumo.pct,
  };
}

// ---------- template de e-mail ----------
export function renderTemplate(tpl, vars) {
  return String(tpl || "").replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m));
}
export function variaveisEmail({ turma, aluno, resumo, cfg, responsavel }) {
  const c = mergeConfig(cfg);
  const datas = (resumo?.datasConsecutivas || []).map(fmtDataCurta);
  return {
    aluno: aluno?.nome || "",
    primeiro_nome: (aluno?.nome || "").split(" ")[0],
    turma: turma?.codigo || turma?.curso || "",
    curso: turma?.curso || "",
    faltas_consecutivas: resumo?.consecutivas ?? "",
    total_faltas: resumo?.faltas ?? "",
    datas_faltas: datas.length > 1 ? datas.slice(0, -1).join(", ") + " e " + datas[datas.length - 1] : datas.join(""),
    frequencia: resumo?.pct !== null && resumo?.pct !== undefined ? `${String(resumo.pct).replace(".", ",")}%` : "—",
    instituicao: c.instituicao,
    responsavel: responsavel || c.email.responsavelContato,
    docente: turma?.instrutor || "",
  };
}

// ---------- utilidades de contato ----------
export const digitsOnly = (s) => String(s || "").replace(/\D/g, "");
export function telLink(tel) { const d = digitsOnly(tel); return d ? `tel:+55${d}` : null; }
export function waLink(tel, texto) {
  const d = digitsOnly(tel);
  if (!d) return null;
  const full = d.length <= 11 ? `55${d}` : d;
  return `https://wa.me/${full}?text=${encodeURIComponent(texto || "")}`;
}
export function mailtoLink(email, assunto, corpo) {
  if (!email) return null;
  return `mailto:${email}?subject=${encodeURIComponent(assunto || "")}&body=${encodeURIComponent(corpo || "")}`;
}
export const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || "").trim());

export function normalizar(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
