"use client";
import { useEffect, useMemo, useState } from "react";
import { FileDown, FileSpreadsheet, ChevronLeft, ChevronRight, CalendarRange, History, Info } from "lucide-react";
import { useData } from "../DataProvider";
import { useUI } from "../Shell";
import { Empty } from "../ui";
import { fmtData, fmtDataHora, fmtHoras, fmtPct, todayISO, isFinalizada } from "@/lib/engine";
import { TURNOS, TIPOS_TURMA, SITUACOES_ALUNO, tipoLabel } from "@/lib/constants";
import { relatorioFaltas, periodoPadrao, quinzenaAnterior, quinzenaSeguinte, EXIBIR_OPCOES } from "@/lib/relatorioFaltas";
import { exportarPDF, exportarExcel, exportarCSV } from "@/lib/exportar";

export const TITULO_QUINZENAL = "Relatório Quinzenal de Frequência Escolar";
const CHAVE = "freq.quinzenal.filtros";
const FILTROS_PADRAO = { turma: "", tipo: "", turno: "", situacao: "ativos", exibir: "comfalta" };
const ler = () => { try { const v = JSON.parse(localStorage.getItem(CHAVE)); return v && typeof v === "object" ? { ...FILTROS_PADRAO, ...v } : FILTROS_PADRAO; } catch { return FILTROS_PADRAO; } };
const gravar = (v) => { try { localStorage.setItem(CHAVE, JSON.stringify(v)); } catch {} };

// colunas usadas IGUAIS na prévia, no PDF, no Excel e no CSV
const colunas = [
  { titulo: "Nº", valor: (x) => x.pos },
  { titulo: "Aluno", valor: (x) => x.aluno.nome },
  { titulo: "Matrícula", valor: (x) => x.aluno.matricula || "" },
  { titulo: "Turma / curso", valor: (x) => `${x.turma.curso}${x.turma.codigo ? ` (${x.turma.codigo})` : ""}` },
  { titulo: "Turno", valor: (x) => x.turma.turno || "" },
  { titulo: "Horas de falta", valor: (x) => fmtHoras(x.p.horasFalta) },
  { titulo: "Dias de falta inteira", valor: (x) => x.p.diasFalta },
  { titulo: "Dias com falta parcial", valor: (x) => x.p.diasParcial },
  { titulo: "Aulas no período", valor: (x) => `${x.p.aulas} (${x.p.horasDadas}h)` },
  { titulo: "Frequência no período", valor: (x) => fmtPct(x.p.pct) },
  { titulo: "Frequência no curso", valor: (x) => fmtPct(x.pctCurso) },
  { titulo: "Situação atual", valor: (x) => x.status },
];

function descreverFiltros(f, turmas) {
  const t = turmas.find((x) => x.id === f.turma);
  const sit = f.situacao === "ativos" ? "alunos ativos" : f.situacao === "todas" ? "todas as situações" : `situação ${f.situacao}`;
  return [
    t ? `Turma: ${t.curso}${t.codigo ? ` (${t.codigo})` : ""}` : "Todas as turmas",
    f.tipo ? `Tipo: ${tipoLabel(f.tipo)}` : null,
    f.turno ? `Turno: ${f.turno}` : null,
    sit,
    EXIBIR_OPCOES.find((o) => o.id === f.exibir)?.label,
  ].filter(Boolean).join(" · ");
}

export default function RelatorioQuinzenal() {
  const { linhas, freq, turmas, cfg, relatorios, acoes, hoje, toast } = useData();
  const ui = useUI();
  const [per, setPer] = useState(() => periodoPadrao(hoje || todayISO()));
  const [f, setF] = useState(FILTROS_PADRAO);
  const [hist, setHist] = useState(false);
  useEffect(() => { setF(ler()); }, []);
  const set = (k, v) => setF((x) => { const n = { ...x, [k]: v }; gravar(n); return n; });
  const filtros = { ...f, inicio: per.inicio, fim: per.fim };
  const rel = useMemo(() => relatorioFaltas({ linhas, freq, filtros }), [linhas, freq, f, per]); // eslint-disable-line
  const desc = descreverFiltros(f, turmas);
  const tiposExistentes = [...new Set(turmas.map((t) => t.tipo || ""))];
  const nome = `relatorio_quinzenal_${per.inicio}_a_${per.fim}`;
  const unidade = "Faltas contadas em horas-aula: faltou o dia = todas as horas do dia; atraso/saída antecipada = só os horários marcados. Só contam as aulas com chamada registrada no período (aulas previstas sem chamada não entram).";
  const resumoTxt = rel.resumo
    ? `Resumo do período: ${rel.resumo.alunos} aluno(s) listado(s) — de ${rel.resumo.avaliados} avaliado(s), ${rel.resumo.comFalta} com falta · ${fmtHoras(rel.resumo.horasFalta)} de falta somadas · ${rel.resumo.turmas} turma(s) · frequência média no período dos listados: ${fmtPct(rel.resumo.mediaPct)}.`
    : "";

  async function exportar(formato) {
    if (rel.erro) return;
    const args = { colunas, linhas: rel.itens, nome };
    if (formato === "pdf") {
      await exportarPDF({
        ...args, titulo: TITULO_QUINZENAL, orientacao: "landscape", instituicao: cfg.instituicao,
        subtitulo: `Período analisado: ${fmtData(per.inicio)} a ${fmtData(per.fim)} · ${desc}`,
        resumo: `${resumoTxt}\n${unidade}`,
      });
    } else if (formato === "xlsx") await exportarExcel({ ...args, aba: "Quinzenal" });
    else exportarCSV(args);
    await acoes.registrarRelatorio({ tipo: "quinzenal", titulo: TITULO_QUINZENAL, inicio: per.inicio, fim: per.fim, filtros: f, descricaoFiltros: desc, formato, alunos: rel.itens.length });
    toast("Relatório gerado e registrado no histórico.");
  }
  const meus = relatorios.filter((r) => r.tipo === "quinzenal");

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <label className="campo"><span>Data inicial</span><input type="date" className="input" value={per.inicio} onChange={(e) => setPer((p) => ({ ...p, inicio: e.target.value }))} /></label>
          <label className="campo"><span>Data final</span><input type="date" className="input" value={per.fim} onChange={(e) => setPer((p) => ({ ...p, fim: e.target.value }))} /></label>
          <div className="row" style={{ gap: 4 }}>
            <button className="btn btn-ghost btn-sm" title="Quinzena anterior" disabled={!!rel.erro} onClick={() => setPer(quinzenaAnterior(per))}><ChevronLeft size={13} /></button>
            <button className="btn btn-primary btn-sm" onClick={() => setPer(periodoPadrao(hoje || todayISO()))}><CalendarRange size={13} /> Últimos 15 dias</button>
            <button className="btn btn-ghost btn-sm" title="Quinzena seguinte" disabled={!!rel.erro} onClick={() => setPer(quinzenaSeguinte(per))}><ChevronRight size={13} /></button>
          </div>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <select className="select" value={f.turma} onChange={(e) => set("turma", e.target.value)} style={{ maxWidth: 260 }}>
            <option value="">Todas as turmas</option>
            {turmas.map((t) => <option key={t.id} value={t.id}>{t.curso} ({t.codigo || "—"}){isFinalizada(t) ? " · finalizada" : ""}</option>)}
          </select>
          <select className="select" value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>
            <option value="">Todos os tipos de curso</option>
            {TIPOS_TURMA.filter((x) => tiposExistentes.includes(x.value)).map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
          </select>
          <select className="select" value={f.turno} onChange={(e) => set("turno", e.target.value)}>
            <option value="">Todos os turnos</option>{TURNOS.map((x) => <option key={x}>{x}</option>)}
          </select>
          <select className="select" value={f.situacao} onChange={(e) => set("situacao", e.target.value)}>
            <option value="ativos">Alunos ativos</option><option value="todas">Todas as situações</option>
            {SITUACOES_ALUNO.filter((s) => s !== "Ativo").map((s) => <option key={s} value={s}>Só {s}</option>)}
          </select>
          <select className="select" value={f.exibir} onChange={(e) => set("exibir", e.target.value)}>
            {EXIBIR_OPCOES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
        <div className="row" style={{ marginTop: 12, justifyContent: "space-between" }}>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-primary btn-sm" disabled={!!rel.erro || !rel.itens.length} onClick={() => exportar("pdf")}><FileDown size={13} /> Gerar PDF</button>
            <button className="btn btn-ghost btn-sm" disabled={!!rel.erro || !rel.itens.length} onClick={() => exportar("xlsx")}><FileSpreadsheet size={13} /> Excel</button>
            <button className="btn btn-ghost btn-sm" disabled={!!rel.erro || !rel.itens.length} onClick={() => exportar("csv")}>CSV</button>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setHist(!hist)}><History size={13} /> {hist ? "Voltar à prévia" : `Relatórios gerados (${meus.length})`}</button>
        </div>
      </div>

      {hist ? (
        !meus.length ? <Empty>Nenhum relatório quinzenal gerado ainda.</Empty> : (
          <div className="tabela-wrap">
            <table className="tabela responsiva">
              <thead><tr><th>Gerado em</th><th>Período analisado</th><th>Filtros</th><th>Formato</th><th className="num">Alunos</th><th>Responsável</th><th></th></tr></thead>
              <tbody>
                {meus.map((r) => (
                  <tr key={r.id}>
                    <td className="principal small">{fmtDataHora(r.geradoEm)}</td>
                    <td data-label="Período" className="small">{fmtData(r.inicio)} a {fmtData(r.fim)}</td>
                    <td data-label="Filtros" className="small soft">{r.descricaoFiltros}</td>
                    <td data-label="Formato" className="small">{{ pdf: "PDF", xlsx: "Excel", csv: "CSV" }[r.formato] || r.formato}</td>
                    <td data-label="Alunos" className="num mono">{r.alunos}</td>
                    <td data-label="Responsável" className="small">{r.geradoPor}</td>
                    <td className="num"><button className="btn btn-ghost btn-sm" onClick={() => { setPer({ inicio: r.inicio, fim: r.fim }); const n = { ...FILTROS_PADRAO, ...(r.filtros || {}) }; setF(n); gravar(n); setHist(false); }}>Abrir de novo</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : rel.erro ? <div className="aviso erro">{rel.erro}</div> : (
        <div className="card">
          <div style={{ marginBottom: 12 }}>
            <div className="small soft" style={{ fontWeight: 700 }}>{cfg.instituicao}</div>
            <h3 style={{ margin: "2px 0 4px", fontSize: 16 }}>{TITULO_QUINZENAL}</h3>
            <div className="small">Período analisado: <strong>{fmtData(per.inicio)} a {fmtData(per.fim)}</strong> · Prévia de {fmtDataHora(new Date().toISOString())}</div>
            <div className="small soft">{desc}</div>
          </div>
          <div className="aviso info" style={{ marginBottom: 10 }}><Info size={14} /><span>{resumoTxt} <br />{unidade}</span></div>
          {!rel.itens.length ? <Empty>Nenhum aluno com falta neste período e filtros. {f.exibir !== "todos" && "Para ver todos os alunos, escolha “Todos os alunos do filtro”."}</Empty> : (
            <div className="tabela-wrap" style={{ overflowX: "auto" }}>
              <table className="tabela tabela-larga">
                <thead><tr>{colunas.map((c) => <th key={c.titulo}>{c.titulo}</th>)}</tr></thead>
                <tbody>
                  {rel.itens.slice(0, 500).map((x) => (
                    <tr key={x.key}>{colunas.map((c) => <td key={c.titulo} className="small">{c.titulo === "Aluno" ? <button className="link-aluno" onClick={() => ui.abrirFicha(x.turma.id, x.aluno.id)}>{x.aluno.nome}</button> : String(c.valor(x) ?? "")}</td>)}</tr>
                  ))}
                </tbody>
              </table>
              {rel.itens.length > 500 && <div className="small soft" style={{ padding: 10 }}>A prévia mostra os 500 primeiros — o arquivo gerado tem todos os {rel.itens.length}.</div>}
            </div>
          )}
        </div>
      )}
    </>
  );
}
