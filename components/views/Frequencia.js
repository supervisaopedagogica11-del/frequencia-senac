"use client";
import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ClipboardList, CheckCircle2, Download, Sun, CloudSun, Moon } from "lucide-react";
import { useData } from "../DataProvider";
import { useUI } from "../Shell";
import { FaixaChip, Pct, Empty } from "../ui";
import { useFiltros, aplicarFiltros, BarraFiltros } from "./Filtros";
import { isFinalizada, fmtPct } from "@/lib/engine";
import { exportarExcel, exportarCSV } from "@/lib/exportar";
import { FAIXA_LABEL } from "@/lib/constants";

const ICON = { "Manhã": Sun, "Tarde": CloudSun, "Noite": Moon };

export function TabelaFrequencia({ lista, mostrarTurma = true }) {
  const { cfg } = useData();
  const ui = useUI();
  if (!lista.length) return <Empty>Nenhum aluno com esses filtros.</Empty>;
  return (
    <div className="tabela-wrap">
      <table className="tabela responsiva">
        <thead><tr>
          <th>Aluno</th><th className="num">Frequência atual</th><th className="center">Faltas</th><th className="center">Atrasos</th><th className="center">Seguidas</th>
          <th className="center">Aulas restantes</th><th className="center">Pode faltar</th><th className="num">Presença necessária</th><th className="num">Projeção</th><th>Faixa</th>
        </tr></thead>
        <tbody>
          {lista.slice(0, 500).map((l) => (
            <tr key={l.key} style={{ opacity: l.ativo ? 1 : 0.6 }}>
              <td className="principal"><div><button className="link-aluno" onClick={() => ui.abrirFicha(l.turma.id, l.aluno.id)}>{l.aluno.nome}</button>{mostrarTurma && <div className="small soft">{l.turma.curso} · {l.turma.codigo || "—"}</div>}</div></td>
              <td className="num" data-label="Frequência"><Pct r={l.r} limite={cfg.limiteMinimo} /></td>
              <td className="center mono" data-label="Faltas">{l.r.faltas}</td>
              <td className="center mono" data-label="Atrasos">{l.r.atrasos}</td>
              <td className="center mono" data-label="Seguidas" style={{ color: l.r.consecutivas >= cfg.consecutivasAlerta ? "var(--vermelho)" : undefined, fontWeight: 700 }}>{l.r.consecutivas}</td>
              <td className="center mono" data-label="Aulas restantes">{l.r.aulasRestantes ?? "—"}</td>
              <td className="center mono" data-label="Pode faltar" style={{ color: l.r.faltasPermitidasRestantes !== null && l.r.faltasPermitidasRestantes <= cfg.folga.critico ? "var(--vermelho)" : undefined, fontWeight: 700 }}>{l.r.faltasPermitidasRestantes ?? "—"}</td>
              <td className="num mono" data-label="Presença necessária">{l.r.pctNecessarioRestante !== null && l.r.faixa !== "abaixo" ? `${l.r.pctNecessarioRestante}%` : "—"}</td>
              <td className="num mono" data-label="Projeção" style={{ color: l.r.projecaoPct !== null && l.r.projecaoPct < cfg.limiteMinimo ? "var(--vermelho)" : undefined }}>{fmtPct(l.r.projecaoPct)}</td>
              <td data-label="Faixa"><FaixaChip faixa={l.r.faixa} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const colunasFrequencia = [
  { titulo: "Turma", valor: (l) => l.turma.curso }, { titulo: "Código", valor: (l) => l.turma.codigo }, { titulo: "Turno", valor: (l) => l.turma.turno },
  { titulo: "Aluno", valor: (l) => l.aluno.nome }, { titulo: "E-mail", valor: (l) => l.aluno.email },
  { titulo: "% Frequência", valor: (l) => l.r.pct }, { titulo: "Faltas", valor: (l) => l.r.faltas }, { titulo: "Atrasos", valor: (l) => l.r.atrasos },
  { titulo: "Justificadas", valor: (l) => l.r.justificadas }, { titulo: "Faltas seguidas", valor: (l) => l.r.consecutivas },
  { titulo: "Aulas dadas", valor: (l) => l.r.aulas }, { titulo: "Aulas restantes", valor: (l) => l.r.aulasRestantes },
  { titulo: "Pode faltar (dias)", valor: (l) => l.r.faltasPermitidasRestantes }, { titulo: "Presença necessária %", valor: (l) => l.r.pctNecessarioRestante },
  { titulo: "Projeção %", valor: (l) => l.r.projecaoPct }, { titulo: "Faixa", valor: (l) => FAIXA_LABEL[l.r.faixa] }, { titulo: "Situação", valor: (l) => l.status },
];

export default function Frequencia() {
  const { turmas, linhas, freq, alertas, cfg, hoje } = useData();
  const sp = useSearchParams();
  const { f, set, limpar } = useFiltros({ faixa: sp?.get("faixa") || "" });
  const lista = useMemo(() => aplicarFiltros(linhas, f, { alertas, cfg }).sort((a, b) => (a.r.pct ?? 999) - (b.r.pct ?? 999)), [linhas, f, alertas, cfg]);
  const ativas = turmas.filter((t) => !isFinalizada(t));

  return (
    <>
      <div className="page-header">
        <div><h2>Frequência/Chamadas</h2><p>Registre a chamada e acompanhe a projeção de frequência de cada aluno</p></div>
        <div className="row">
          <button className="btn btn-ghost" onClick={() => exportarCSV({ colunas: colunasFrequencia, linhas: lista, nome: `frequencia_${hoje}` })}><Download size={14} /> CSV</button>
          <button className="btn btn-primary" onClick={() => exportarExcel({ colunas: colunasFrequencia, linhas: lista, nome: `frequencia_${hoje}`, aba: "Frequência" })}><Download size={14} /> Excel</button>
        </div>
      </div>

      <div className="secao">
        <div className="secao-head"><h3><ClipboardList size={16} /> Chamada de hoje</h3></div>
        {!ativas.length ? <Empty>Nenhuma turma ativa.</Empty> : (
          <div className="grid3">
            {["Manhã", "Tarde", "Noite"].map((tn) => {
              const lst = ativas.filter((t) => t.turno === tn);
              const I = ICON[tn];
              return (
                <div key={tn} className="card">
                  <h4 style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><I size={14} /> {tn}</h4>
                  {!lst.length ? <div className="small soft">Nenhuma turma</div> : lst.map((t) => {
                    const feita = !!freq[`${t.id}|${hoje}`];
                    return (
                      <Link key={t.id} href={`/turmas/${t.id}?aba=chamada`} className="row small" style={{ padding: "7px 0", borderBottom: "1px solid var(--line)", textDecoration: "none", color: "inherit", flexWrap: "nowrap" }}>
                        {feita ? <CheckCircle2 size={14} color="var(--verde)" /> : <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid var(--cinza)", flexShrink: 0 }} />}
                        <span className="grow ellipsis">{t.curso} <span className="soft">({t.codigo || "—"})</span></span>
                        <span className={feita ? "soft" : ""} style={{ fontWeight: 700, color: feita ? undefined : "var(--primary)" }}>{feita ? "feita" : "fazer"}</span>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="secao">
        <div className="secao-head"><h3>Frequência e projeção por aluno</h3></div>
        <BarraFiltros f={f} set={set} limpar={limpar} turmas={turmas} total={linhas.length} filtrados={lista.length} />
        <TabelaFrequencia lista={lista} />
      </div>
    </>
  );
}
