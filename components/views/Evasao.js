"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Users, Percent, AlertTriangle, Hand, FileSpreadsheet, Info, RotateCcw } from "lucide-react";
import { useData } from "../DataProvider";
import { useUI } from "../Shell";
import { Empty, Kpi } from "../ui";
import { fmtData, todayISO, addDias, isFinalizada } from "@/lib/engine";
import { TURNOS, TIPOS_TURMA } from "@/lib/constants";
import { CATEGORIA_LABEL, montarDashboardEvasao, mesclarPalavras } from "@/lib/evasao";
import { ClassificacaoEvasao } from "../ClassificacaoEvasao";
import { exportarExcel, exportarCSV } from "@/lib/exportar";

const fmtP = (v) => (v === null || v === undefined ? "—" : `${String(v).replace(".", ",")}%`);
const PERIODOS = [
  ["tudo", "Todo o período"], ["mes", "Este mês"], ["3m", "Últimos 3 meses"], ["ano", "Este ano"], ["custom", "Escolher datas"],
];
function datasDoPeriodo(p, hoje, ini, fim) {
  if (p === "mes") return { inicio: hoje.slice(0, 8) + "01", fim: hoje };
  if (p === "3m") return { inicio: addDias(hoje, -89), fim: hoje };
  if (p === "ano") return { inicio: hoje.slice(0, 4) + "-01-01", fim: hoje };
  if (p === "custom") return { inicio: ini || "", fim: fim || "" };
  return { inicio: "", fim: "" };
}
const ler = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v && typeof v === "object" ? { ...d, ...v } : d; } catch { return d; } };
const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

function GraficoMotivos({ dados, sel, onSel }) {
  const max = Math.max(1, ...dados.categorias.map((c) => c.n));
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, margin: 0 }}>Distribuição dos evadidos por motivo</h3>
        <div className="legenda">{dados.categorias.map((c) => <span key={c.id}><i style={{ background: c.cor }} />{c.label}</span>)}</div>
      </div>
      <div className="barras" role="list">
        {dados.categorias.map((c) => (
          <button key={c.id} role="listitem" className={"barra-linha" + (sel === c.id ? " on" : "")} onClick={() => onSel(sel === c.id ? "" : c.id)}
            title={`${c.label}: ${c.n} aluno(s) · ${fmtP(c.pct)} dos evadidos — clique para ver os nomes`}>
            <span className="barra-rot">{c.label}</span>
            <span className="barra-trilho"><span className="barra" style={{ width: `${(c.n / max) * 100}%`, background: c.cor, minWidth: c.n ? 6 : 0 }} /></span>
            <span className="barra-val"><strong>{c.n}</strong> <span className="soft">· {fmtP(c.pct)}</span></span>
          </button>
        ))}
      </div>
      <div className="small soft" style={{ marginTop: 10 }}>Clique numa barra para ver os alunos da categoria. Percentuais sobre o total de {dados.total} evadido(s).</div>
    </div>
  );
}

export default function Evasao() {
  const { linhas, contatos, historico, cfg, turmas, hoje } = useData();
  const ui = useUI();
  const PADRAO = { periodo: "tudo", ini: "", fim: "", turma: "", tipo: "", turno: "", status: "todas" };
  const [f, setF] = useState(PADRAO);
  const [sel, setSel] = useState("");
  const [soRevisar, setSoRevisar] = useState(false);
  useEffect(() => { setF(ler("freq.evasao.filtros", PADRAO)); }, []); // eslint-disable-line
  const set = (k, v) => setF((x) => { const n = { ...x, [k]: v }; gravar("freq.evasao.filtros", n); return n; });
  const per = datasDoPeriodo(f.periodo, hoje || todayISO(), f.ini, f.fim);
  const erroData = f.periodo === "custom" && per.inicio && per.fim && per.inicio > per.fim ? "A data inicial é depois da final." : null;
  const palavras = useMemo(() => mesclarPalavras(cfg.evasaoPalavras), [cfg.evasaoPalavras]);
  const dados = useMemo(() => montarDashboardEvasao({ linhas, contatos, historico, palavras, filtros: { ...f, inicio: erroData ? "" : per.inicio, fim: erroData ? "" : per.fim } }),
    [linhas, contatos, historico, palavras, f, per.inicio, per.fim, erroData]);
  const lista = dados.evadidos.filter((e) => (!sel || e.cls.categoria === sel) && (!soRevisar || e.cls.revisar));
  const colunas = [
    { titulo: "Aluno", valor: (e) => e.aluno.nome }, { titulo: "Matrícula", valor: (e) => e.aluno.matricula || "" },
    { titulo: "Turma", valor: (e) => e.turmas.map((t) => `${t.curso} (${t.codigo || "—"})`).join(" / ") },
    { titulo: "Data da evasão", valor: (e) => (e.data ? fmtData(e.data) : "sem data") },
    { titulo: "Categoria", valor: (e) => CATEGORIA_LABEL[e.cls.categoria] }, { titulo: "Origem", valor: (e) => (e.cls.origem === "manual" ? "Manual" : "Automática") },
    { titulo: "Termos encontrados", valor: (e) => (e.cls.origem === "manual" ? "" : e.cls.termos.join(", ")) },
    { titulo: "Motivo registrado", valor: (e) => e.contato?.motivoEvasao || "" },
  ];
  const tiposExistentes = [...new Set(turmas.map((t) => t.tipo || ""))];
  const sufixo = [f.periodo !== "tudo" && per.inicio ? `${per.inicio}_a_${per.fim}` : "", sel].filter(Boolean).join("_");

  return (
    <>
      <div className="page-header"><div><h2>Evasão escolar</h2><p>Quantos alunos evadiram e por quê — calculado com os registros reais, atualizado na hora</p></div></div>

      <div className="card filtros-evasao" style={{ marginBottom: 14 }}>
        <div className="pills">{PERIODOS.map(([k, l]) => <button key={k} className={"pill" + (f.periodo === k ? " on" : "")} onClick={() => set("periodo", k)}>{l}</button>)}</div>
        <div className="row" style={{ marginTop: 10 }}>
          {f.periodo === "custom" && <>
            <label className="small row" style={{ gap: 4 }}>De <input type="date" className="input" value={f.ini} onChange={(e) => set("ini", e.target.value)} /></label>
            <label className="small row" style={{ gap: 4 }}>até <input type="date" className="input" value={f.fim} onChange={(e) => set("fim", e.target.value)} /></label>
          </>}
          <select className="select" value={f.turma} onChange={(e) => set("turma", e.target.value)} style={{ maxWidth: 260 }}>
            <option value="">Todas as turmas</option>
            {turmas.map((t) => <option key={t.id} value={t.id}>{t.curso} ({t.codigo || "—"}){isFinalizada(t) ? " · finalizada" : ""}</option>)}
          </select>
          <select className="select" value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>
            <option value="">Todos os tipos</option>
            {TIPOS_TURMA.filter((x) => tiposExistentes.includes(x.value)).map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
          </select>
          <select className="select" value={f.turno} onChange={(e) => set("turno", e.target.value)}>
            <option value="">Todos os turnos</option>{TURNOS.map((x) => <option key={x}>{x}</option>)}
          </select>
          <select className="select" value={f.status} onChange={(e) => set("status", e.target.value)}>
            <option value="todas">Turmas ativas e finalizadas</option><option value="ativas">Só turmas ativas</option><option value="finalizadas">Só turmas finalizadas</option>
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => { setF(PADRAO); gravar("freq.evasao.filtros", PADRAO); setSel(""); }}><RotateCcw size={12} /> Limpar</button>
        </div>
        {erroData && <div className="aviso erro" style={{ marginTop: 10 }}>{erroData} O período foi ignorado até a correção.</div>}
        {f.periodo !== "tudo" && per.inicio && !erroData && <div className="small soft" style={{ marginTop: 8 }}>Período: {fmtData(per.inicio)} a {fmtData(per.fim)} — conta quem evadiu nessas datas, entre os alunos das turmas em andamento no período.</div>}
      </div>

      <div className="cards">
        <Kpi n={dados.total} l="Alunos evadidos" cor="#6B7280" icone={<Users size={12} />} d={f.periodo === "tudo" ? "situação “Evadiu” no sistema" : "evadiram no período"} />
        <Kpi n={fmtP(dados.taxa)} l="Taxa de evasão" cor="#DC2626" icone={<Percent size={12} />} d={`${dados.total} de ${dados.matriculados} alunos matriculados`} />
        <Kpi n={dados.revisar} l="Citam mais de um motivo" cor="#B45309" icone={<AlertTriangle size={12} />} d="vale revisar a categoria" onClick={dados.revisar ? () => { setSoRevisar(true); setSel(""); } : undefined} />
        <Kpi n={dados.manuais} l="Classificados à mão" cor="#4F46E5" icone={<Hand size={12} />} d="prevalecem sobre o automático" />
      </div>
      {dados.semData > 0 && <div className="aviso info" style={{ marginBottom: 14 }}><Info size={14} /> {dados.semData} aluno(s) evadido(s) não têm a data da evasão registrada e por isso não entram quando há filtro de período (aparecem em “Todo o período”).</div>}

      {!dados.total ? <Empty>Nenhum aluno com situação “Evadiu” {f.periodo === "tudo" ? "nos filtros escolhidos" : "neste período"}.</Empty> : (
        <>
          <div className="grid2" style={{ marginBottom: 16, alignItems: "start" }}>
            <GraficoMotivos dados={dados} sel={sel} onSel={(v) => { setSel(v); setSoRevisar(false); }} />
            <div className="card">
              <h3 style={{ fontSize: 14, margin: "0 0 10px" }}>Detalhamento por categoria</h3>
              <table className="tabela">
                <thead><tr><th>Categoria</th><th className="num">Alunos</th><th className="num">%</th><th></th></tr></thead>
                <tbody>
                  {dados.categorias.map((c) => (
                    <tr key={c.id}>
                      <td><span className="cat-dot" style={{ background: c.cor }} /> {c.label}</td>
                      <td className="num mono">{c.n}</td>
                      <td className="num mono">{fmtP(c.pct)}</td>
                      <td className="num">{c.n > 0 && <button className="link-aluno small" onClick={() => { setSel(c.id); setSoRevisar(false); }}>Ver alunos</button>}</td>
                    </tr>
                  ))}
                  <tr><td><strong>Total</strong></td><td className="num mono"><strong>{dados.total}</strong></td><td className="num mono">100%</td><td /></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
              <h3 style={{ fontSize: 14, margin: 0 }}>
                {soRevisar ? "Alunos que citam mais de um motivo" : sel ? `Alunos — ${CATEGORIA_LABEL[sel]}` : "Todos os alunos evadidos"} <span className="soft small">({lista.length})</span>
              </h3>
              <div className="row" style={{ gap: 6 }}>
                {(sel || soRevisar) && <button className="btn btn-ghost btn-sm" onClick={() => { setSel(""); setSoRevisar(false); }}>Ver todos</button>}
                <button className="btn btn-ghost btn-sm" disabled={!lista.length} onClick={() => exportarExcel({ colunas, linhas: lista, nome: `evasao_${sufixo || "geral"}`, aba: "Evasão" })}><FileSpreadsheet size={12} /> Excel</button>
                <button className="btn btn-ghost btn-sm" disabled={!lista.length} onClick={() => exportarCSV({ colunas, linhas: lista, nome: `evasao_${sufixo || "geral"}` })}>CSV</button>
              </div>
            </div>
            {!lista.length ? <Empty>Nenhum aluno nesta categoria.</Empty> : (
              <div className="lista" style={{ gap: 10 }}>
                {lista.map((e) => (
                  <div key={e.key} className="evasao-item">
                    <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                      <div>
                        <button className="link-aluno" onClick={() => ui.abrirFicha(e.turma.id, e.aluno.id)}>{e.aluno.nome}</button>
                        <span className="small soft"> · {e.turmas.map((t) => t.curso).join(" / ")} · evadiu em {e.data ? fmtData(e.data) : "data não registrada"}</span>
                      </div>
                    </div>
                    <ClassificacaoEvasao turma={e.turma} aluno={e.aluno} compacto />
                    {e.contato?.motivoEvasao && <div className="small" style={{ marginTop: 6 }}><strong>Motivo registrado:</strong> {e.contato.motivoEvasao}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className="aviso info" style={{ marginTop: 16 }}>
        <Info size={14} />
        <span>A categoria é lida, nesta ordem, do <strong>Motivo da evasão</strong> (ficha do aluno), da justificativa / motivo da ausência / observações e dos registros de contato. Sem palavra-chave = <strong>Outros</strong>. Nada é alterado nos registros. As palavras-chave ficam em <Link href="/configuracoes?aba=evasao">Configurações → Motivos de evasão</Link>.</span>
      </div>
    </>
  );
}
