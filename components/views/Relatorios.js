"use client";
import { useMemo, useState } from "react";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { useData } from "../DataProvider";
import { Empty } from "../ui";
import { resumoTurma, maiorSequencia, fmtData, fmtDataHora, isFinalizada } from "@/lib/engine";
import { FAIXA_LABEL } from "@/lib/constants";
import { exportarPDF, exportarExcel, exportarCSV } from "@/lib/exportar";

export const colunasTurma = [
  { titulo: "Aluno", valor: (l) => l.aluno.nome },
  { titulo: "Frequência %", valor: (l) => (l.r.pct === null ? "" : String(l.r.pct).replace(".", ",")) },
  { titulo: "Horas de falta", valor: (l) => l.r.horasFalta },
  { titulo: "Limite (h)", valor: (l) => l.r.limiteHoras },
  { titulo: "Pode faltar ainda (h)", valor: (l) => l.r.horasRestantes },
  { titulo: "Dias de falta", valor: (l) => l.r.diasFalta },
  { titulo: "Faltas parciais", valor: (l) => l.r.diasParcial },
  { titulo: "Situação", valor: (l) => (l.r.faixa === "abaixo" ? "Abaixo de 75%" : FAIXA_LABEL[l.r.faixa]) },
  { titulo: "Acompanhamento", valor: (l) => l.status },
];
const comTurma = [{ titulo: "Turma", valor: (l) => l.turma.curso }, ...colunasTurma];

function definicoes({ linhas, turmas, contatos, emails, cfg, freq }, filtro) {
  const ls = linhas.filter((l) => (filtro.turma ? l.turma.id === filtro.turma : !l.finalizada));
  const ativos = ls.filter((l) => l.ativo);
  const turmasEsc = turmas.filter((t) => (filtro.turma ? t.id === filtro.turma : !isFinalizada(t)));
  const ord = (a, b) => a.turma.curso.localeCompare(b.turma.curso) || a.aluno.nome.localeCompare(b.aluno.nome);
  return [
    { id: "turma", titulo: "Frequência por turma", desc: "Todos os alunos com frequência e horas de falta.", linhas: () => ls.slice().sort(ord), colunas: comTurma },
    { id: "risco", titulo: "Alunos em risco ou abaixo de 75%", desc: "Quem precisa de intervenção.", linhas: () => ativos.filter((l) => ["risco", "abaixo"].includes(l.r.faixa)).sort((a, b) => b.prioridade - a.prioridade), colunas: comTurma },
    { id: "seguidas", titulo: `Alunos com ${cfg.consecutivasAlerta}+ faltas seguidas`, desc: "Sequência atual e maior sequência no curso.", linhas: () => ls.filter((l) => maiorSequencia(l.turma.id, l.aluno.id, freq) >= cfg.consecutivasAlerta).sort(ord), colunas: [{ titulo: "Turma", valor: (l) => l.turma.curso }, { titulo: "Aluno", valor: (l) => l.aluno.nome }, { titulo: "Faltas seguidas (agora)", valor: (l) => l.r.consecutivas }, { titulo: "Maior sequência", valor: (l) => maiorSequencia(l.turma.id, l.aluno.id, freq) }, { titulo: "Frequência %", valor: (l) => l.r.pct }, { titulo: "Acompanhamento", valor: (l) => l.status }] },
    { id: "permanencia", titulo: "Permanência e evasão por turma", desc: "Matriculados, evadidos e % de permanência.", linhas: () => turmasEsc.map((t) => ({ t, rs: resumoTurma(linhas.filter((l) => l.turma.id === t.id), cfg) })), colunas: [{ titulo: "Turma", valor: (x) => x.t.curso }, { titulo: "Código", valor: (x) => x.t.codigo }, { titulo: "Matriculados", valor: (x) => x.rs.total }, { titulo: "Ativos", valor: (x) => x.rs.ativos }, { titulo: "Evadidos", valor: (x) => x.rs.evadidos }, { titulo: "Permanência %", valor: (x) => x.rs.permanencia }, { titulo: "Frequência média %", valor: (x) => x.rs.media }, { titulo: "Em risco", valor: (x) => x.rs.risco }, { titulo: "Abaixo de 75%", valor: (x) => x.rs.abaixo }] },
    { id: "contatos", titulo: "Contatos realizados", desc: "Intervenções registradas pela Supervisão.", linhas: () => { const out = []; ls.forEach((l) => (contatos[l.key]?.tentativas || []).forEach((t) => out.push({ l, t }))); return out.sort((a, b) => (b.t.data || "").localeCompare(a.t.data || "")); }, colunas: [{ titulo: "Data", valor: (x) => fmtData(x.t.data) }, { titulo: "Aluno", valor: (x) => x.l.aluno.nome }, { titulo: "Turma", valor: (x) => x.l.turma.curso }, { titulo: "Forma", valor: (x) => x.t.forma || x.t.tipo }, { titulo: "Resultado", valor: (x) => x.t.resultado }, { titulo: "Observação", valor: (x) => [x.t.obs, x.t.justificativa, x.t.encaminhamento].filter(Boolean).join(" · ") }, { titulo: "Responsável", valor: (x) => x.t.responsavel }] },
    { id: "emails", titulo: "E-mails enviados", desc: "Disparos automáticos e manuais, com status.", linhas: () => emails.filter((e) => !filtro.turma || e.turmaId === filtro.turma), colunas: [{ titulo: "Data/hora", valor: (e) => fmtDataHora(e.enviadoEm) }, { titulo: "Aluno", valor: (e) => e.alunoNome }, { titulo: "E-mail", valor: (e) => e.para }, { titulo: "Motivo", valor: (e) => e.motivo }, { titulo: "Tipo", valor: (e) => (e.automatico ? "Automático" : "Manual") }, { titulo: "Status", valor: (e) => (e.status === "enviado" ? "Enviado" : `Erro: ${e.erro || ""}`) }, { titulo: "Responsável", valor: (e) => e.usuario }] },
  ];
}

export default function Relatorios() {
  const data = useData();
  const { turmas, cfg } = data;
  const [sel, setSel] = useState("turma");
  const [turma, setTurma] = useState("");
  const defs = useMemo(() => definicoes(data, { turma }), [data, turma]);
  const def = defs.find((d) => d.id === sel);
  const linhas = useMemo(() => def.linhas(), [def]);
  const t = turmas.find((x) => x.id === turma);
  const nome = `${def.titulo} ${t?.codigo || ""}`;
  return (
    <>
      <div className="page-header"><div><h2>Relatórios</h2><p>Escolha o relatório e baixe em PDF ou Excel</p></div></div>
      <div className="pills" style={{ marginBottom: 12 }}>
        {defs.map((d) => <button key={d.id} className={"pill" + (sel === d.id ? " on" : "")} onClick={() => setSel(d.id)}>{d.titulo}</button>)}
      </div>
      <div className="card" style={{ marginBottom: 12 }}>
        <p className="small soft" style={{ margin: "0 0 10px" }}>{def.desc} O relatório individual do aluno fica na ficha dele (botão PDF).</p>
        <div className="row">
          <select className="select" value={turma} onChange={(e) => setTurma(e.target.value)} style={{ maxWidth: 300 }}>
            <option value="">Todas as turmas ativas</option>
            {turmas.map((x) => <option key={x.id} value={x.id}>{x.curso}{isFinalizada(x) ? " (finalizada)" : ""}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" disabled={!linhas.length} onClick={() => exportarPDF({ titulo: def.titulo, subtitulo: t ? `${t.curso} (${t.codigo || "—"})` : "Todas as turmas ativas", colunas: def.colunas, linhas, nome, instituicao: cfg.instituicao })}><FileDown size={13} /> PDF</button>
          <button className="btn btn-ghost btn-sm" disabled={!linhas.length} onClick={() => exportarExcel({ colunas: def.colunas, linhas, nome, aba: def.titulo })}><FileSpreadsheet size={13} /> Excel</button>
          <button className="btn btn-ghost btn-sm" disabled={!linhas.length} onClick={() => exportarCSV({ colunas: def.colunas, linhas, nome })}>CSV</button>
          <span className="small soft">{linhas.length} registro(s)</span>
        </div>
      </div>
      {!linhas.length ? <Empty>Nenhum registro.</Empty> : (
        <div className="tabela-wrap" style={{ overflowX: "auto" }}>
          <table className="tabela">
            <thead><tr>{def.colunas.map((c) => <th key={c.titulo}>{c.titulo}</th>)}</tr></thead>
            <tbody>{linhas.slice(0, 100).map((l, i) => <tr key={i}>{def.colunas.map((c) => <td key={c.titulo} className="small">{String(c.valor(l) ?? "")}</td>)}</tr>)}</tbody>
          </table>
          {linhas.length > 100 && <div className="small soft" style={{ padding: 10 }}>Prévia das primeiras 100 linhas — o arquivo baixado tem todas as {linhas.length}.</div>}
        </div>
      )}
    </>
  );
}
