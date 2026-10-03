// Motor de cálculo de frequência — funções puras (sem Firebase), testáveis.
//
// REGRA (Senac): o aluno precisa de no mínimo 75% de frequência na carga horária TOTAL do curso.
// As faltas são contadas em HORAS:
//   - faltou o dia inteiro  → perde todas as horas do dia (ex.: 4h)
//   - chegou atrasado / saiu mais cedo → perde só os horários (horas) em que não esteve
//   frequência % = (carga horária total − horas de falta) ÷ carga horária total × 100
//   limite de faltas = 25% da carga horária total (ex.: 160h → 40h)
//
// Formato salvo no banco (compatível com a versão anterior):
//   freq["<turmaId>|<AAAA-MM-DD>"] = { [alunoId]: registro }
//   registro = { status: "F" }                 → faltou o dia todo
//            | { status: "H", horas: [1, 2] }  → faltou só o 1º e o 2º horário
//   aluno sem registro naquela data = presente. Uma data no mapa = chamada feita (aula dada).
//   (registros antigos: "A" = atraso valia meio dia; "J" = justificada não descontava)

import { CONFIG_PADRAO, STATUS_INATIVOS, FAIXA_ORDEM, FREQ_MINIMA } from "./constants.js";

export const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
export const ymOf = (iso) => (iso || "").slice(0, 7);
export const fmtData = (iso) => { if (!iso) return "—"; const [y, m, d] = iso.slice(0, 10).split("-"); return `${d}/${m}/${y}`; };
export const fmtDataCurta = (iso) => { if (!iso) return "—"; const [, m, d] = iso.slice(0, 10).split("-"); return `${d}/${m}`; };
export const fmtDataHora = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
export const addDias = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
export const diasEntre = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000);
// percentual com 1 casa, sempre arredondado PARA BAIXO (nunca mostra 75% para quem tem 74,97%)
export const truncar1 = (v) => Math.floor(v * 10 + 1e-9) / 10;
export const fmtPct = (v) => (v === null || v === undefined ? "—" : `${String(v).replace(".", ",")}%`);
export const fmtHoras = (h) => (h === null || h === undefined ? "—" : `${String(Math.round(h * 10) / 10).replace(".", ",")}h`);

export function mergeConfig(cfg) {
  const c = cfg || {};
  return {
    ...CONFIG_PADRAO,
    ...c,
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
const LEGADO = { Evadiu: "Evadido", Cancelou: "Evadido", Desistiu: "Evadido", Concluiu: "Concluído", "Contatado": "Em acompanhamento", "Risco de evasão": "Em acompanhamento" };
export function statusAluno(a) {
  if (!a) return "Regular";
  const s = a.statusAcomp || (a.situacao && LEGADO[a.situacao]) || "Regular";
  return LEGADO[s] || s;
}
export const isAlunoAtivo = (a) => !STATUS_INATIVOS.includes(statusAluno(a));

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
const regDe = (freq, turmaId, data, alunoId) => (freq[`${turmaId}|${data}`] || {})[alunoId];

// horas de falta de UM registro
export function horasDoRegistro(r, horasDia) {
  if (!r) return 0;
  if (r.status === "F") return horasDia;
  if (r.status === "H") return Math.min(horasDia, (r.horas || []).length);
  if (r.status === "A") return horasDia * 0.5; // legado
  return 0; // "J" legado e qualquer outro
}

export function sequenciaFaltas(turmaId, alunoId, freq, ate) {
  const datas = datasRegistradas(turmaId, freq, ate);
  const seq = [];
  for (let i = datas.length - 1; i >= 0; i--) {
    const r = regDe(freq, turmaId, datas[i], alunoId);
    if (r && r.status === "F") seq.unshift(datas[i]);
    else break;
  }
  return seq;
}
export function maiorSequencia(turmaId, alunoId, freq, ate) {
  let max = 0, cur = 0;
  for (const d of datasRegistradas(turmaId, freq, ate)) {
    const r = regDe(freq, turmaId, d, alunoId);
    if (r && r.status === "F") { cur++; if (cur > max) max = cur; } else cur = 0;
  }
  return max;
}

// ---------- resumo completo do aluno ----------
export function resumoAluno(turma, alunoId, freq, cfgIn, ateIn) {
  const cfg = mergeConfig(cfgIn);
  const ate = ateIn || todayISO();
  const hd = Number(turma.horariosPorDia) || 1;
  const ch = Number(turma.cargaHoraria) || 0;
  const nAlerta = Number(cfg.consecutivasAlerta) || 3;

  const datas = datasRegistradas(turma.id, freq, ate);
  let horasFalta = 0, diasFalta = 0, diasParcial = 0;
  const historico = [];
  for (const d of datas) {
    const r = regDe(freq, turma.id, d, alunoId);
    const h = horasDoRegistro(r, hd);
    horasFalta += h;
    if (r?.status === "F") diasFalta++;
    else if (h > 0) diasParcial++;
    historico.push({ data: d, h, tipo: r?.status === "F" ? "F" : h > 0 ? "H" : "P" });
  }
  const aulas = datas.length;
  const horasDadas = aulas * hd;
  const seq = sequenciaFaltas(turma.id, alunoId, freq, ate);
  const consecutivas = seq.length;

  const base = { horasFalta, diasFalta, diasParcial, aulas, horasDadas, consecutivas, datasConsecutivas: seq, historico, horasDia: hd, cargaHoraria: ch };
  if (!ch) return { ...base, pct: null, faixa: "semdados", limiteHoras: null, horasRestantes: null, usoPct: null, projecaoPct: null, motivo: "Informe a carga horária da turma (engrenagem ⚙)." };

  const limiteHoras = ch * (1 - FREQ_MINIMA / 100);       // 25% da carga horária
  const pctExato = ((ch - horasFalta) / ch) * 100;
  const pct = Math.max(0, truncar1(pctExato));
  const abaixo = horasFalta > limiteHoras + 1e-9;
  const horasRestantes = Math.max(0, Math.floor(limiteHoras + 1e-9) - horasFalta); // faltas são em horas inteiras
  const usoPct = limiteHoras ? Math.round((horasFalta / limiteHoras) * 100) : 0;

  // projeção: mantendo o ritmo de faltas das últimas 10 aulas até o fim do curso
  let projecaoPct = null;
  if (aulas >= 5) {
    const ult = historico.slice(-10);
    const taxa = ult.reduce((s, x) => s + x.h, 0) / (ult.length * hd);
    const restantes = Math.max(0, ch - horasDadas);
    projecaoPct = Math.max(0, truncar1(((ch - (horasFalta + taxa * restantes)) / ch) * 100));
  }

  let faixa = "regular";
  let motivo = "";
  if (abaixo) { faixa = "abaixo"; motivo = `Ultrapassou o limite de ${fmtHoras(limiteHoras)} de falta`; }
  else if (usoPct >= cfg.usoAlerta) { faixa = "risco"; motivo = `Já usou ${usoPct}% das faltas permitidas — pode faltar só mais ${fmtHoras(horasRestantes)}`; }
  else if (projecaoPct !== null && projecaoPct < FREQ_MINIMA && usoPct >= 30) { faixa = "risco"; motivo = `No ritmo atual de faltas, terminaria o curso com ${fmtPct(projecaoPct)}`; }
  else if (consecutivas >= nAlerta) { faixa = "risco"; motivo = `${consecutivas} faltas seguidas`; }

  return { ...base, pct, pctExato, faixa, motivo, limiteHoras, horasRestantes, usoPct, projecaoPct };
}

// urgência (maior = mais urgente)
export function prioridade(r, cfgIn) {
  const cfg = mergeConfig(cfgIn);
  let p = { abaixo: 100, risco: 50, regular: 0, semdados: 0 }[r.faixa] || 0;
  if (r.consecutivas >= cfg.consecutivasAlerta) p += 40 + r.consecutivas;
  p += r.usoPct || 0;
  return p;
}
export function piorFaixa(lista) {
  let pior = "regular";
  for (const f of lista) if ((FAIXA_ORDEM[f] ?? 9) < (FAIXA_ORDEM[pior] ?? 9)) pior = f;
  return pior;
}

// ---------- visão consolidada ----------
export function consolidar(turmas, freq, contatos, cfg, ate) {
  const linhas = [];
  for (const t of turmas) for (const a of t.alunos || []) {
    const r = resumoAluno(t, a.id, freq, cfg, ate);
    linhas.push({
      key: `${t.id}|${a.id}`, turma: t, aluno: a, r,
      status: statusAluno(a), ativo: isAlunoAtivo(a), finalizada: isFinalizada(t),
      contato: contatos[`${t.id}|${a.id}`] || null, prioridade: prioridade(r, cfg),
    });
  }
  return linhas;
}

export function resumoTurma(linhasTurma, cfgIn) {
  const cfg = mergeConfig(cfgIn);
  const ativos = linhasTurma.filter((l) => l.ativo);
  const pcts = ativos.map((l) => l.r.pct).filter((v) => v !== null && v !== undefined);
  const evadidos = linhasTurma.filter((l) => l.status === "Evadido").length;
  const total = linhasTurma.length;
  return {
    total, ativos: ativos.length,
    media: pcts.length ? truncar1(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null,
    risco: ativos.filter((l) => l.r.faixa === "risco").length,
    abaixo: ativos.filter((l) => l.r.faixa === "abaixo").length,
    consecutivas: ativos.filter((l) => l.r.consecutivas >= cfg.consecutivasAlerta).length,
    evadidos,
    permanencia: total ? truncar1(((total - evadidos) / total) * 100) : null,
  };
}

// ---------- episódios (alertas automáticos sem duplicidade) ----------
// faltas seguidas: identificado pela data da 1ª falta da sequência (mesma sequência = mesmo episódio)
export function episodioConsecutivas(turma, aluno, freq, cfgIn, ate) {
  const cfg = mergeConfig(cfgIn);
  const seq = sequenciaFaltas(turma.id, aluno.id, freq, ate);
  if (seq.length < (Number(cfg.consecutivasAlerta) || 3)) return null;
  return { id: `${turma.id}_${aluno.id}_seq_${seq[0]}`, tipo: "consecutivas", turmaId: turma.id, alunoId: aluno.id, consecutivas: seq.length, datasFaltas: seq, inicio: seq[0] };
}
// risco / abaixo de 75%: um alerta por nível atingido
export function episodioLimite(turma, aluno, r) {
  if (!r || !["risco", "abaixo"].includes(r.faixa) || (r.faixa === "risco" && r.usoPct < 30)) return null;
  return { id: `${turma.id}_${aluno.id}_limite_${r.faixa}`, tipo: "limite", turmaId: turma.id, alunoId: aluno.id, faixa: r.faixa, pct: r.pct };
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
    datas_faltas: datas.length > 1 ? datas.slice(0, -1).join(", ") + " e " + datas[datas.length - 1] : datas.join(""),
    frequencia: fmtPct(resumo?.pct),
    horas_falta: fmtHoras(resumo?.horasFalta),
    instituicao: c.instituicao,
    responsavel: responsavel || c.email.responsavelContato,
    docente: turma?.instrutor || "",
  };
}

// ---------- utilidades ----------
export const digitsOnly = (s) => String(s || "").replace(/\D/g, "");
export const telLink = (tel) => { const d = digitsOnly(tel); return d ? `tel:+55${d}` : null; };
export function waLink(tel, texto) {
  const d = digitsOnly(tel);
  if (!d) return null;
  return `https://wa.me/${d.length <= 11 ? `55${d}` : d}?text=${encodeURIComponent(texto || "")}`;
}
export const mailtoLink = (email, assunto, corpo) => (email ? `mailto:${email}?subject=${encodeURIComponent(assunto || "")}&body=${encodeURIComponent(corpo || "")}` : null);
export const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || "").trim());
export const normalizar = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const textoWhats = (aluno, turma, cfg) =>
  `Olá, ${(aluno.nome || "").split(" ")[0]}! Aqui é da Supervisão Pedagógica do ${mergeConfig(cfg).instituicao}. Sentimos sua falta nas aulas de ${turma.curso} e queremos saber se está tudo bem. Podemos ajudar em algo?`;
