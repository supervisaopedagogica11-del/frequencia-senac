// Classificação dos motivos de evasão — funções puras (sem Firebase), testáveis.
//
// Regras:
//  - só entram alunos com situação "Evadiu" (é o que o sistema chama de "Evadido");
//  - os textos já registrados são lidos SEM serem alterados; a classificação é calculada na hora,
//    então muda sozinha quando alguém edita uma justificativa ou observação;
//  - cada aluno fica em UMA categoria; se o texto citar mais de um motivo vale a categoria com mais
//    termos encontrados e, no empate, a ordem de prioridade abaixo — e o registro fica marcado "revisar";
//  - uma categoria escolhida manualmente vale mais que a automática até alguém retirá-la;
//  - sem texto ou sem palavra-chave reconhecida → "Outros" (nunca se inventa um motivo).

import { situacaoAluno } from "./engine.js";

// ordem = prioridade no empate
export const CATEGORIAS_EVASAO = [
  { id: "trabalho", label: "Trabalho" },
  { id: "saude", label: "Saúde" },
  { id: "mudanca", label: "Mudança de cidade" },
  { id: "pessoais", label: "Motivos pessoais" },
  { id: "outros", label: "Outros" },
];
export const CATEGORIA_LABEL = Object.fromEntries(CATEGORIAS_EVASAO.map((c) => [c.id, c.label]));
// cores categóricas em ordem fixa (paleta validada para daltonismo); "Outros" em cinza neutro
export const CATEGORIA_COR = { trabalho: "#2a78d6", saude: "#eb6834", mudanca: "#1baf7a", pessoais: "#eda100", outros: "#8A93A8" };

export const PALAVRAS_EVASAO_PADRAO = {
  trabalho: [
    "trabalho", "emprego", "serviço", "horário de trabalho", "oportunidade de emprego", "mudança de turno profissional",
    "trabalhando", "novo emprego", "conseguiu emprego", "arrumou emprego", "escala de trabalho", "horário do serviço",
  ],
  saude: [
    "saúde", "doença", "problema de saúde", "tratamento médico", "internação", "cirurgia",
    "doente", "internado", "internada", "hospital", "atestado médico", "licença médica", "gravidez", "gestação",
  ],
  mudanca: [
    "mudança de cidade", "mudou de cidade", "mudança de município", "mudou de endereço", "mudança de estado", "distância da escola",
    "outra cidade", "outro estado", "se mudou", "mudou-se", "mudança de endereço", "mora longe",
  ],
  pessoais: [
    "motivos pessoais", "problemas pessoais", "questões familiares", "dificuldades familiares", "responsabilidades familiares", "dificuldades pessoais",
    "motivo pessoal", "problema pessoal", "problemas familiares", "problema familiar", "motivo familiar", "questão familiar",
  ],
};
// expressões que contêm uma palavra-chave mas NÃO indicam o motivo (evita coincidências)
export const IGNORAR_EVASAO_PADRAO = [
  "trabalho de conclusão", "trabalho escolar", "trabalho em grupo", "trabalho da aula", "trabalho do curso", "trabalho final",
  "entrega do trabalho", "trabalho da disciplina", "serviço social", "área da saúde", "curso de saúde",
];

// ---------- texto ----------
// minúsculas, sem acento, só letras/números separados por um espaço
export function normalizarTexto(s) {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// cada palavra do termo aceita plural simples (s/es) e o termo só casa com palavras inteiras
function regexDoTermo(termo) {
  const tokens = normalizarTexto(termo).split(" ").filter(Boolean);
  if (!tokens.length) return null;
  const corpo = tokens.map((t) => {
    const base = t.endsWith("s") && t.length > 3 ? t.slice(0, -1) : t;
    return `${escapar(base)}(?:s|es)?`;
  }).join(" ");
  return new RegExp(`(^| )${corpo}(?= |$)`, "g");
}
// "não foi por trabalho", "nem por saúde" etc. → o termo não conta
const NEGACOES = ["nao foi", "nao e", "nao era", "nao sera", "nao tem relacao", "nem"];
function negado(textoNorm, inicio) {
  const antes = textoNorm.slice(0, inicio).split(" ").filter(Boolean).slice(-5).join(" ");
  return NEGACOES.some((n) => (" " + antes + " ").includes(" " + n + " "));
}

export function mesclarPalavras(cfgPalavras) {
  const out = {};
  for (const c of CATEGORIAS_EVASAO) {
    if (c.id === "outros") continue;
    const lista = cfgPalavras && Array.isArray(cfgPalavras[c.id]) ? cfgPalavras[c.id] : PALAVRAS_EVASAO_PADRAO[c.id];
    out[c.id] = [...new Set(lista.map((x) => String(x || "").trim()).filter(Boolean))];
  }
  const ign = cfgPalavras && Array.isArray(cfgPalavras.ignorar) ? cfgPalavras.ignorar : IGNORAR_EVASAO_PADRAO;
  out.ignorar = [...new Set(ign.map((x) => String(x || "").trim()).filter(Boolean))];
  return out;
}

// encontra as categorias citadas num texto: { trabalho: ["emprego", ...], ... }
export function termosEncontrados(texto, palavrasIn) {
  const palavras = mesclarPalavras(palavrasIn);
  let t = " " + normalizarTexto(texto) + " ";
  for (const ig of palavras.ignorar) {
    const re = regexDoTermo(ig);
    if (re) t = t.replace(re, (m, p1) => p1 + " ".repeat(m.length - p1.length));
  }
  t = t.replace(/ +/g, " ");
  const achados = {};
  for (const c of CATEGORIAS_EVASAO) {
    if (c.id === "outros") continue;
    for (const termo of palavras[c.id]) {
      const re = regexDoTermo(termo);
      if (!re) continue;
      let m, valeu = false;
      while ((m = re.exec(t))) { if (!negado(t, m.index)) { valeu = true; break; } }
      if (valeu) (achados[c.id] = achados[c.id] || []).push(termo);
    }
  }
  // um termo contido em outro maior da mesma categoria conta uma vez só ("saúde" dentro de "problema de saúde")
  for (const k of Object.keys(achados)) {
    const ns = achados[k].map(normalizarTexto);
    achados[k] = achados[k].filter((x, i) => !ns.some((o, j) => j !== i && o.length > ns[i].length && (" " + o + " ").includes(" " + ns[i] + " ")));
  }
  return achados;
}

// decide a categoria de um conjunto de textos
export function classificarTexto(texto, palavras) {
  const achados = termosEncontrados(texto, palavras);
  const cats = CATEGORIAS_EVASAO.filter((c) => achados[c.id]?.length);
  if (!cats.length) return { categoria: "outros", candidatas: [], termos: [], revisar: false };
  const melhor = cats.reduce((a, b) => (achados[b.id].length > achados[a.id].length ? b : a));
  return {
    categoria: melhor.id,
    candidatas: cats.map((c) => c.id),
    termos: achados[melhor.id],
    achados,
    revisar: cats.length > 1,
  };
}

// textos de onde o motivo é lido, em ordem de confiança (o 1º nível que tiver palavra-chave decide)
export function fontesDeTexto(contato, aluno) {
  const c = contato || {};
  const tent = c.tentativas || [];
  return [
    { nivel: 1, nome: "Motivo da evasão", textos: [c.motivoEvasao] },
    { nivel: 2, nome: "Justificativa / motivo da ausência / observações", textos: [c.justificativa, c.motivoFalta, c.observacoes, aluno?.observacao] },
    { nivel: 3, nome: "Registros das tentativas de contato", textos: tent.flatMap((t) => [t.obs, t.resultado, t.retorno, t.justificativa]) },
  ].map((f) => ({ ...f, texto: f.textos.filter((x) => String(x || "").trim()).join(" \n ") }));
}

export const isEvadido = (aluno) => situacaoAluno(aluno) === "Evadiu";

// classificação final de UM aluno evadido
export function classificarEvasao({ aluno, contato, palavras }) {
  const fontes = fontesDeTexto(contato, aluno);
  const temTexto = fontes.some((f) => f.texto);
  let auto = { categoria: "outros", candidatas: [], termos: [], revisar: false, fonte: null, semTexto: !temTexto };
  for (const f of fontes) {
    if (!f.texto) continue;
    const r = classificarTexto(f.texto, palavras);
    if (r.candidatas.length) { auto = { ...r, fonte: f.nome, semTexto: false }; break; }
  }
  const manual = contato?.evasaoManual;
  if (manual && CATEGORIA_LABEL[manual.categoria]) {
    return { ...auto, automatica: auto.categoria, categoria: manual.categoria, origem: "manual", manual, revisar: false };
  }
  return { ...auto, automatica: auto.categoria, origem: "automatica" };
}

// ---------- data da evasão ----------
// usa a data em que a situação mudou para "Evadiu"; na falta dela, o registro do histórico
export function dataEvasao(aluno, turmaId, historico) {
  if (aluno?.situacao === "Evadiu" && aluno.statusEm) return String(aluno.statusEm).slice(0, 10);
  if (aluno?.statusAcomp === "Evadido" && aluno.statusEm) return String(aluno.statusEm).slice(0, 10);
  const h = (historico || []).find((x) => x.turmaId === turmaId && x.alunoId === aluno?.id && x.tipo === "status" && /Evadi(u|do)/.test(x.descricao || ""));
  return h?.em ? String(h.em).slice(0, 10) : null;
}
const dataValida = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "") && !Number.isNaN(new Date(s + "T12:00:00").getTime());

// chave de pessoa: a mesma pessoa em duas turmas conta uma vez
export function chavePessoa(aluno, turmaId) {
  const m = String(aluno?.matricula || "").replace(/\s/g, "");
  if (m) return "m:" + m.toLowerCase();
  const n = normalizarTexto(aluno?.nome);
  return n ? "n:" + n : `t:${turmaId}|${aluno?.id}`;
}

// turma "em andamento" em algum momento do período
function turmaNoPeriodo(t, inicio, fim) {
  if (!inicio && !fim) return true;
  const ini = dataValida(t.periodoInicio) ? t.periodoInicio : null;
  const fimT = dataValida(t.periodoRealFim) ? t.periodoRealFim : dataValida(t.periodoFim) ? t.periodoFim : null;
  if (fim && ini && ini > fim) return false;
  if (inicio && fimT && fimT < inicio) return false;
  return true;
}

// ---------- dados do dashboard ----------
// linhas = consolidar(...) ; filtros = { inicio, fim, turma, tipo, turno, status: "todas"|"ativas"|"finalizadas" }
export function montarDashboardEvasao({ linhas, contatos, historico, palavras, filtros = {} }) {
  const f = filtros;
  const inicio = dataValida(f.inicio) ? f.inicio : null;
  const fim = dataValida(f.fim) ? f.fim : null;
  const comPeriodo = !!(inicio || fim);
  const doEscopo = linhas.filter((l) => {
    const t = l.turma;
    if (f.turma && t.id !== f.turma) return false;
    if (f.tipo && (t.tipo || "") !== f.tipo) return false;
    if (f.turno && t.turno !== f.turno) return false;
    if (f.status === "ativas" && l.finalizada) return false;
    if (f.status === "finalizadas" && !l.finalizada) return false;
    return turmaNoPeriodo(t, inicio, fim);
  });

  const matriculados = new Set(doEscopo.map((l) => chavePessoa(l.aluno, l.turma.id)));
  const porPessoa = new Map();
  let semData = 0;
  for (const l of doEscopo) {
    if (!isEvadido(l.aluno)) continue;
    const data = dataEvasao(l.aluno, l.turma.id, historico);
    if (comPeriodo) {
      if (!data) { semData++; continue; }
      if (inicio && data < inicio) continue;
      if (fim && data > fim) continue;
    }
    const contato = contatos[`${l.turma.id}|${l.aluno.id}`] || null;
    const cls = classificarEvasao({ aluno: l.aluno, contato, palavras });
    const k = chavePessoa(l.aluno, l.turma.id);
    const item = { key: l.key, pessoa: k, turma: l.turma, aluno: l.aluno, data, cls, contato, turmas: [l.turma] };
    const ant = porPessoa.get(k);
    if (!ant) porPessoa.set(k, item);
    else {
      // mesma pessoa evadida em mais de uma turma: vale o registro mais recente; guarda as turmas
      const maisRecente = (item.data || "") >= (ant.data || "") ? item : ant;
      porPessoa.set(k, { ...maisRecente, turmas: [...ant.turmas, l.turma] });
    }
  }
  const evadidos = [...porPessoa.values()].sort((a, b) => (b.data || "").localeCompare(a.data || "") || a.aluno.nome.localeCompare(b.aluno.nome));
  const total = evadidos.length;
  const categorias = CATEGORIAS_EVASAO.map((c) => {
    const alunos = evadidos.filter((e) => e.cls.categoria === c.id);
    return { ...c, cor: CATEGORIA_COR[c.id], n: alunos.length, pct: total ? Math.round((alunos.length / total) * 1000) / 10 : 0, alunos };
  });
  return {
    total,
    matriculados: matriculados.size,
    taxa: matriculados.size ? Math.round((total / matriculados.size) * 1000) / 10 : null,
    categorias,
    evadidos,
    revisar: evadidos.filter((e) => e.cls.revisar).length,
    manuais: evadidos.filter((e) => e.cls.origem === "manual").length,
    semData: comPeriodo ? semData : 0,
    comPeriodo,
  };
}
