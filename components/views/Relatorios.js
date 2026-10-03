"use client";
import { useMemo, useState } from "react";
import { FileText, FileSpreadsheet, FileDown, User } from "lucide-react";
import { useData } from "../DataProvider";
import { useUI } from "../Shell";
import { Empty } from "../ui";
import { colunasFrequencia } from "./Frequencia";
import { resumoTurma, maiorSequencia, fmtData, fmtDataHora, isFinalizada, statusAluno } from "@/lib/engine";
import { FAIXA_LABEL, TURNOS, tipoLabel } from "@/lib/constants";
import { exportarPDF, exportarExcel, exportarCSV } from "@/lib/exportar";

const colAluno = [
  { titulo: "Aluno", valor: (l) => l.aluno.nome }, { titulo: "Turma", valor: (l) => l.turma.curso }, { titulo: "Código", valor: (l) => l.turma.codigo },
  { titulo: "Turno", valor: (l) => l.turma.turno },
];
const colPrev = [
  { titulo: "% Freq.", valor: (l) => l.r.pct }, { titulo: "Faltas", valor: (l) => l.r.faltas }, { titulo: "Seguidas", valor: (l) => l.r.consecutivas },
  { titulo: "Pode faltar", valor: (l) => l.r.faltasPermitidasRestantes }, { titulo: "Projeção %", valor: (l) => l.r.projecaoPct },
  { titulo: "Faixa", valor: (l) => FAIXA_LABEL[l.r.faixa] }, { titulo: "Situação", valor: (l) => l.status },
  { titulo: "Último contato", valor: (l) => fmtData(l.contato?.tentativas?.at(-1)?.data) },
];

function definicoes(ctx) {
  const { linhas, turmas, contatos, emails, alertas, historico, cfg, freq, filtro } = ctx;
  const doEscopo = (l) => (!filtro.turma || l.turma.id === filtro.turma) && (!filtro.turno || l.turma.turno === filtro.turno) && (filtro.finalizadas || !l.finalizada || filtro.turma);
  const ls = linhas.filter(doEscopo);
  const ativos = ls.filter((l) => l.ativo);
  const turmasEsc = turmas.filter((t) => (!filtro.turma || t.id === filtro.turma) && (!filtro.turno || t.turno === filtro.turno) && (filtro.finalizadas || !isFinalizada(t) || filtro.turma));
  const dentro = (d) => (!filtro.de || (d || "") >= filtro.de) && (!filtro.ate || (d || "").slice(0, 10) <= filtro.ate);
  return [
    { id: "turma", titulo: "Frequência por turma", desc: "Todos os alunos da turma com frequência, faltas e projeção.", linhas: () => ls.slice().sort((a, b) => a.turma.curso.localeCompare(b.turma.curso) || a.aluno.nome.localeCompare(b.aluno.nome)), colunas: colunasFrequencia },
    { id: "individual", titulo: "Relatório individual do aluno", desc: "Ficha completa com projeção e histórico (PDF). Escolha o aluno abaixo.", individual: true },
    { id: "proximos", titulo: `Alunos próximos de ${cfg.limiteMinimo}%`, desc: "Faixa Atenção — ainda seguros, mas se aproximando do limite.", linhas: () => ativos.filter((l) => l.r.faixa === "atencao").sort((a, b) => a.r.pct - b.r.pct), colunas: [...colAluno, ...colPrev] },
    { id: "risco", titulo: `Alunos em risco de ficar abaixo de ${cfg.limiteMinimo}%`, desc: "Faixas Risco e Crítico — poucas faltas os levam ao limite.", linhas: () => ativos.filter((l) => ["risco", "critico"].includes(l.r.faixa)).sort((a, b) => b.prioridade - a.prioridade), colunas: [...colAluno, ...colPrev, { titulo: "Motivos", valor: (l) => l.r.motivos.join("; ") }] },
    { id: "abaixo", titulo: `Alunos abaixo de ${cfg.limiteMinimo}%`, desc: "Já abaixo da frequência mínima.", linhas: () => ls.filter((l) => l.r.faixa === "abaixo").sort((a, b) => a.r.pct - b.r.pct), colunas: [...colAluno, ...colPrev] },
    { id: "consec", titulo: `Alunos com ${cfg.consecutivasAlerta}+ faltas consecutivas`, desc: "Sequência atual e maior sequência no curso.", linhas: () => ls.filter((l) => l.r.consecutivas >= cfg.consecutivasAlerta || maiorSequencia(l.turma.id, l.aluno.id, freq) >= cfg.consecutivasAlerta).sort((a, b) => b.r.consecutivas - a.r.consecutivas), colunas: [...colAluno, { titulo: "Seguidas (atual)", valor: (l) => l.r.consecutivas }, { titulo: "Maior sequência", valor: (l) => maiorSequencia(l.turma.id, l.aluno.id, freq) }, { titulo: "Datas (atual)", valor: (l) => l.r.datasConsecutivas.map(fmtData).join(", ") }, { titulo: "% Freq.", valor: (l) => l.r.pct }, { titulo: "Situação", valor: (l) => l.status }, { titulo: "E-mail", valor: (l) => l.aluno.email }] },
    { id: "evasao", titulo: "Relatório de evasão", desc: "Alunos evadidos, com último contato e justificativa.", linhas: () => ls.filter((l) => statusAluno(l.aluno) === "Evadido"), colunas: [...colAluno, { titulo: "% Freq. final", valor: (l) => l.r.pct }, { titulo: "Faltas", valor: (l) => l.r.faltas }, { titulo: "Marcado em", valor: (l) => fmtData(l.aluno.statusEm?.slice(0, 10)) }, { titulo: "Contatos feitos", valor: (l) => l.contato?.tentativas?.length || 0 }, { titulo: "Última justificativa", valor: (l) => [...(l.contato?.tentativas || [])].reverse().find((t) => t.justificativa)?.justificativa || "" }, { titulo: "Observações", valor: (l) => l.contato?.observacoes || "" }] },
    { id: "permanencia", titulo: "Relatório de permanência", desc: "Por turma: matriculados, ativos, evadidos, concluídos e % de permanência.", linhas: () => turmasEsc.map((t) => ({ t, rs: resumoTurma(t, linhas.filter((l) => l.turma.id === t.id), cfg) })), colunas: [{ titulo: "Turma", valor: (x) => x.t.curso }, { titulo: "Código", valor: (x) => x.t.codigo }, { titulo: "Turno", valor: (x) => x.t.turno }, { titulo: "Matriculados", valor: (x) => x.rs.total }, { titulo: "Ativos", valor: (x) => x.rs.ativos }, { titulo: "Em acompanhamento", valor: (x) => x.rs.emAcompanhamento }, { titulo: "Risco de evasão", valor: (x) => x.rs.riscoEvasao }, { titulo: "Evadidos", valor: (x) => x.rs.evadidos }, { titulo: "Concluídos", valor: (x) => x.rs.concluidos }, { titulo: "Permanência %", valor: (x) => x.rs.permanencia }] },
    { id: "contatos", titulo: "Contatos realizados", desc: "Todas as intervenções registradas pela Supervisão.", linhas: () => { const out = []; ls.forEach((l) => (contatos[l.key]?.tentativas || []).forEach((t) => { if (dentro(t.data)) out.push({ l, t }); })); return out.sort((a, b) => (b.t.data || "").localeCompare(a.t.data || "")); }, colunas: [{ titulo: "Data", valor: (x) => fmtData(x.t.data) }, { titulo: "Aluno", valor: (x) => x.l.aluno.nome }, { titulo: "Turma", valor: (x) => x.l.turma.curso }, { titulo: "Forma", valor: (x) => x.t.forma || x.t.tipo }, { titulo: "Motivo", valor: (x) => x.t.motivo }, { titulo: "Resultado", valor: (x) => x.t.resultado }, { titulo: "Retorno", valor: (x) => x.t.retorno }, { titulo: "Encaminhamento", valor: (x) => x.t.encaminhamento }, { titulo: "Próximo contato", valor: (x) => fmtData(x.t.proximaData) }, { titulo: "Responsável", valor: (x) => x.t.responsavel }], periodo: true },
    { id: "emails", titulo: "E-mails automáticos e manuais enviados", desc: "Histórico de disparos com status, motivo e responsável.", linhas: () => emails.filter((e) => (!filtro.turma || e.turmaId === filtro.turma) && dentro(e.enviadoEm)), colunas: [{ titulo: "Data/hora", valor: (e) => fmtDataHora(e.enviadoEm) }, { titulo: "Aluno", valor: (e) => e.alunoNome }, { titulo: "E-mail", valor: (e) => e.para }, { titulo: "Turma", valor: (e) => e.turmaNome }, { titulo: "Motivo", valor: (e) => e.motivo }, { titulo: "Tipo", valor: (e) => (e.automatico ? "Automático" : "Manual") }, { titulo: "Status", valor: (e) => (e.status === "enviado" ? "Enviado" : `Erro: ${e.erro || ""}`) }, { titulo: "Responsável", valor: (e) => e.usuario }, { titulo: "Modelo", valor: (e) => e.modelo }], periodo: true },
    { id: "alertas", titulo: "Alertas automáticos gerados", desc: "Episódios de faltas consecutivas e de aproximação do limite.", linhas: () => Object.values(alertas).filter((a) => (!filtro.turma || a.turmaId === filtro.turma) && dentro(a.criadoEm)).sort((a, b) => (b.criadoEm || "").localeCompare(a.criadoEm || "")), colunas: [{ titulo: "Gerado em", valor: (a) => fmtDataHora(a.criadoEm) }, { titulo: "Aluno", valor: (a) => a.alunoNome }, { titulo: "Turma", valor: (a) => a.turmaNome }, { titulo: "Alerta", valor: (a) => a.titulo }, { titulo: "E-mail", valor: (a) => ({ enviado: "Enviado", erro: "Erro", sem_email: "Sem e-mail", desativado: "Desativado", nao_aplicavel: "—", pendente: "Pendente" }[a.emailStatus] || "") }, { titulo: "Status", valor: (a) => (a.status === "aberto" ? "Aberto" : "Resolvido") }, { titulo: "Resolução", valor: (a) => a.resolucao || "" }, { titulo: "Resolvido por", valor: (a) => a.resolvidoPor || "" }], periodo: true },
    { id: "geral", titulo: "Relatório geral das turmas", desc: "Indicadores consolidados de cada turma.", linhas: () => turmasEsc.map((t) => ({ t, rs: resumoTurma(t, linhas.filter((l) => l.turma.id === t.id), cfg) })), colunas: [{ titulo: "Turma", valor: (x) => x.t.curso }, { titulo: "Código", valor: (x) => x.t.codigo }, { titulo: "Tipo", valor: (x) => tipoLabel(x.t.tipo) }, { titulo: "Turno", valor: (x) => x.t.turno }, { titulo: "Docente", valor: (x) => x.t.instrutor }, { titulo: "CH", valor: (x) => x.t.cargaHoraria }, { titulo: "Início", valor: (x) => fmtData(x.t.periodoInicio) }, { titulo: "Prev. término", valor: (x) => fmtData(x.t.periodoFim) }, { titulo: "Encerramento", valor: (x) => fmtData(x.t.periodoRealFim) }, { titulo: "Alunos", valor: (x) => x.rs.total }, { titulo: "Freq. média %", valor: (x) => x.rs.media }, { titulo: "Próx. 75%", valor: (x) => x.rs.proximos }, { titulo: "Abaixo 75%", valor: (x) => x.rs.cont.abaixo }, { titulo: "Faltas seguidas", valor: (x) => x.rs.consecutivas }, { titulo: "Evadidos", valor: (x) => x.rs.evadidos }, { titulo: "Permanência %", valor: (x) => x.rs.permanencia }] },
    { id: "historico", titulo: "Histórico e rastreabilidade", desc: "Registro de alterações: frequência, contatos, situações, turmas, e-mails.", linhas: () => historico.filter((h) => (!filtro.turma || h.turmaId === filtro.turma) && dentro(h.em)), colunas: [{ titulo: "Quando", valor: (h) => fmtDataHora(h.em) }, { titulo: "Tipo", valor: (h) => h.tipo }, { titulo: "Turma", valor: (h) => h.turmaNome || "" }, { titulo: "Aluno", valor: (h) => h.alunoNome || "" }, { titulo: "Descrição", valor: (h) => h.descricao }, { titulo: "Usuário", valor: (h) => h.usuario }], periodo: true },
  ];
}

export default function Relatorios({ turmaId }) {
  const data = useData();
  const ui = useUI();
  const { turmas, cfg } = data;
  const [sel, setSel] = useState("turma");
  const [filtro, setFiltro] = useState({ turma: turmaId || "", turno: "", de: "", ate: "", finalizadas: !!turmaId });
  const [alunoInd, setAlunoInd] = useState("");
  const defs = useMemo(() => definicoes({ ...data, filtro }), [data, filtro]);
  const def = defs.find((d) => d.id === sel);
  const linhas = useMemo(() => (def?.linhas ? def.linhas() : []), [def]);
  const turmaSel = turmas.find((t) => t.id === filtro.turma);
  const sub = [turmaSel ? `${turmaSel.curso} (${turmaSel.codigo || "—"})` : "Todas as turmas", filtro.turno, filtro.de && `desde ${fmtData(filtro.de)}`, filtro.ate && `até ${fmtData(filtro.ate)}`].filter(Boolean).join(" · ");
  const nome = `${def?.titulo || "relatorio"} ${turmaSel?.codigo || ""}`;
  const set = (k, v) => setFiltro((f) => ({ ...f, [k]: v }));

  return (
    <>
      {!turmaId && <div className="page-header"><div><h2>Relatórios</h2><p>Visualize e exporte em PDF, Excel ou CSV</p></div></div>}
      <div className="grid-rel">
        <div className="card" style={{ padding: 8 }}>
          {defs.map((d) => (
            <button key={d.id} onClick={() => setSel(d.id)} style={{ display: "block", width: "100%", textAlign: "left", border: "none", background: sel === d.id ? "var(--primary-soft)" : "transparent", borderRadius: 8, padding: "9px 10px", cursor: "pointer", color: sel === d.id ? "var(--primary)" : "var(--ink)", fontWeight: sel === d.id ? 700 : 500, fontSize: 13 }}>
              <FileText size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} />{d.titulo}
            </button>
          ))}
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="card" style={{ marginBottom: 12 }}>
            <h3 style={{ marginBottom: 4 }}>{def.titulo}</h3>
            <p className="small soft" style={{ margin: "0 0 12px" }}>{def.desc}</p>
            <div className="row">
              {!turmaId && <select className="select" value={filtro.turma} onChange={(e) => set("turma", e.target.value)} style={{ maxWidth: 280 }}><option value="">Todas as turmas</option>{turmas.map((t) => <option key={t.id} value={t.id}>{t.curso} ({t.codigo || "—"}){isFinalizada(t) ? " — finalizada" : ""}</option>)}</select>}
              {!turmaId && <select className="select" value={filtro.turno} onChange={(e) => set("turno", e.target.value)}><option value="">Todos os turnos</option>{TURNOS.map((t) => <option key={t}>{t}</option>)}</select>}
              {!turmaId && <label className="row small"><input type="checkbox" checked={filtro.finalizadas} onChange={(e) => set("finalizadas", e.target.checked)} /> incluir turmas finalizadas</label>}
              {def.periodo && <><label className="row small soft">de <input type="date" className="input" value={filtro.de} onChange={(e) => set("de", e.target.value)} /></label><label className="row small soft">até <input type="date" className="input" value={filtro.ate} onChange={(e) => set("ate", e.target.value)} /></label></>}
            </div>
            {!def.individual && (
              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn btn-primary btn-sm" disabled={!linhas.length} onClick={() => exportarPDF({ titulo: def.titulo, subtitulo: sub, colunas: def.colunas, linhas, nome, instituicao: cfg.instituicao })}><FileDown size={13} /> PDF</button>
                <button className="btn btn-ghost btn-sm" disabled={!linhas.length} onClick={() => exportarExcel({ colunas: def.colunas, linhas, nome, aba: def.titulo })}><FileSpreadsheet size={13} /> Excel</button>
                <button className="btn btn-ghost btn-sm" disabled={!linhas.length} onClick={() => exportarCSV({ colunas: def.colunas, linhas, nome })}>CSV</button>
                <span className="small soft">{linhas.length} registro(s)</span>
              </div>
            )}
          </div>
          {def.individual ? (
            <div className="card">
              <label className="campo"><span>Aluno</span>
                <select className="select" value={alunoInd} onChange={(e) => setAlunoInd(e.target.value)}>
                  <option value="">Selecione...</option>
                  {data.linhas.filter((l) => !filtro.turma || l.turma.id === filtro.turma).sort((a, b) => a.aluno.nome.localeCompare(b.aluno.nome)).map((l) => <option key={l.key} value={l.key}>{l.aluno.nome} — {l.turma.curso}</option>)}
                </select>
              </label>
              <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={!alunoInd} onClick={() => { const [t, a] = alunoInd.split("|"); ui.abrirFicha(t, a); }}><User size={14} /> Abrir ficha (com botão de PDF)</button>
            </div>
          ) : !linhas.length ? <Empty>Nenhum registro para este relatório com os filtros atuais.</Empty> : (
            <div className="tabela-wrap scroll-x" style={{ overflowX: "auto" }}>
              <table className="tabela">
                <thead><tr>{def.colunas.map((c) => <th key={c.titulo}>{c.titulo}</th>)}</tr></thead>
                <tbody>{linhas.slice(0, 200).map((l, i) => <tr key={i}>{def.colunas.map((c) => <td key={c.titulo} className="small">{String(c.valor(l) ?? "")}</td>)}</tr>)}</tbody>
              </table>
              {linhas.length > 200 && <div className="small soft" style={{ padding: 10 }}>Pré-visualização das primeiras 200 linhas — a exportação inclui todas as {linhas.length}.</div>}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
