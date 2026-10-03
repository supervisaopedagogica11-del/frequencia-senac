"use client";
import { useMemo, useState } from "react";
import { Download, FileDown, Printer, Phone, Users } from "lucide-react";
import { useData } from "../DataProvider";
import { useUI } from "../Shell";
import { Kpi, Empty } from "../ui";
import { consolidar, resumoTurma, isFinalizada, ymOf, fmtPct, fmtHoras, horasDoRegistro, datasRegistradas } from "@/lib/engine";
import { TIER_COR, TIER_GRAD } from "@/lib/constants";
import { precisaContato } from "@/lib/pendencias";
import { exportarExcel, exportarPDF } from "@/lib/exportar";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
export const mesLabel = (ym) => { const [y, m] = ym.split("-"); return `${MESES[+m - 1]}/${y}`; };
const fimDoMes = (ym, hoje) => { const [y, m] = ym.split("-").map(Number); const f = new Date(y, m, 0).toISOString().slice(0, 10); return f < hoje ? f : hoje; };

// relatório mensal da turma (Excel), no formato da planilha da escola — faltas em horas
export function exportarExcelMensal(turma, ym, freq, linhas, hoje) {
  const ini = `${ym}-01`, fim = fimDoMes(ym, hoje);
  const datas = datasRegistradas(turma.id, freq, fim).filter((d) => d >= ini);
  const hd = Number(turma.horariosPorDia) || 1;
  const ls = linhas.filter((l) => l.turma.id === turma.id).sort((a, b) => a.aluno.nome.localeCompare(b.aluno.nome));
  exportarExcel({
    nome: `frequencia_${turma.codigo || turma.curso}_${ym}`, aba: ym,
    linhas: ls,
    colunas: [
      { titulo: "Turma", valor: () => turma.curso }, { titulo: "Mês de referência", valor: () => mesLabel(ym) }, { titulo: "Nome", valor: (l) => l.aluno.nome },
      { titulo: "Aulas registradas no mês", valor: () => datas.length },
      { titulo: "Dias de falta", valor: (l) => datas.filter((d) => freq[`${turma.id}|${d}`]?.[l.aluno.id]?.status === "F").length },
      { titulo: "Dias com falta parcial", valor: (l) => datas.filter((d) => { const r = freq[`${turma.id}|${d}`]?.[l.aluno.id]; return r && r.status !== "F" && horasDoRegistro(r, hd) > 0; }).length },
      { titulo: "Horas de falta no mês", valor: (l) => datas.reduce((s, d) => s + horasDoRegistro(freq[`${turma.id}|${d}`]?.[l.aluno.id], hd), 0) },
      { titulo: "Horas de falta acumuladas", valor: (l) => l.r.horasFalta },
      { titulo: "% Frequência acumulada", valor: (l) => l.r.pct }, { titulo: "Observações", valor: (l) => l.st.label },
    ],
  });
}
export function exportarPDFTurma(turma, linhas, cfg, final = false) {
  const ls = linhas.filter((l) => l.turma.id === turma.id && (final || l.ativo)).sort((a, b) => a.aluno.nome.localeCompare(b.aluno.nome));
  const cont = { verde: 0, amarelo: 0, roxo: 0, vermelho: 0 };
  ls.forEach((l) => { cont[l.st.tier]++; });
  exportarPDF({
    titulo: `${final ? "Relatório Final da Turma" : "Relatório de Frequência"} — ${turma.curso}`,
    subtitulo: `${turma.codigo || "sem código"} · ${turma.turno} · Docente: ${turma.instrutor || "—"} · Carga horária: ${turma.cargaHoraria ?? "—"}h · Início: ${turma.periodoInicio || "—"} · Término previsto: ${turma.periodoFim || "—"} · Término real: ${turma.periodoRealFim || "—"}`,
    resumo: final ? null : `Regular: ${cont.verde} · Monitorar: ${cont.amarelo} · Acompanhar: ${cont.roxo} · Risco de evasão: ${cont.vermelho}`,
    instituicao: cfg.instituicao, nome: `relatorio_${turma.codigo || turma.curso}${final ? "_final" : ""}`,
    linhas: ls,
    colunas: [
      { titulo: "Aluno", valor: (l) => l.aluno.nome }, { titulo: "Telefone", valor: (l) => l.aluno.telefone || "—" },
      { titulo: "Horas de falta", valor: (l) => fmtHoras(l.r.horasFalta) }, { titulo: "Faltas seguidas", valor: (l) => l.r.consecutivas },
      { titulo: "% Frequência", valor: (l) => fmtPct(l.r.pct) },
      { titulo: final ? "Situação final" : "Situação", valor: (l) => (final ? (l.r.faixa === "abaixo" ? "Reprovado por falta" : "Aprovado") : l.st.label) },
    ],
  });
}

export default function Painel() {
  const { turmas, linhas: linhasHoje, freq, contatos, alertas, cfg, hoje } = useData();
  const ui = useUI();
  const [mes, setMes] = useState("geral");
  const meses = useMemo(() => [...new Set(Object.keys(freq).map((k) => ymOf(k.split("|")[1])))].sort(), [freq]);
  const ate = mes === "geral" ? hoje : fimDoMes(mes, hoje);
  const linhas = useMemo(() => (mes === "geral" ? linhasHoje : consolidar(turmas, freq, contatos, cfg, ate)), [mes, linhasHoje, turmas, freq, contatos, cfg, ate]);
  const todos = linhas.filter((l) => l.ativo);
  const comPct = todos.filter((l) => l.r.pct !== null);
  const faixas = {
    abaixo: comPct.filter((l) => l.r.pct < 75).length,
    f7580: comPct.filter((l) => l.r.pct >= 75 && l.r.pct < 80).length,
    f8090: comPct.filter((l) => l.r.pct >= 80 && l.r.pct < 90).length,
    f90: comPct.filter((l) => l.r.pct >= 90).length,
  };
  const tiers = { verde: 0, amarelo: 0, roxo: 0, vermelho: 0 };
  todos.forEach((l) => { tiers[l.st.tier]++; });
  const evadidos = linhas.filter((l) => l.situacao === "Evadiu").length;

  const ranking = useMemo(() => turmas.map((t) => ({ t, rs: resumoTurma(linhas.filter((l) => l.turma.id === t.id), cfg) })).filter((x) => x.rs.media !== null).sort((a, b) => a.rs.media - b.rs.media), [turmas, linhas, cfg]);
  const grupos = useMemo(() => {
    const m = new Map();
    todos.filter((l) => l.st.tier !== "verde").sort((a, b) => (a.r.pct ?? 999) - (b.r.pct ?? 999)).forEach((l) => {
      if (!m.has(l.turma.id)) m.set(l.turma.id, { turma: l.turma, itens: [] });
      m.get(l.turma.id).itens.push(l);
    });
    return [...m.values()].sort((a, b) => a.turma.curso.localeCompare(b.turma.curso));
  }, [todos]);

  function exportarGeral() {
    exportarExcel({
      nome: `frequencia_senac_${mes}`, aba: "Frequencia", linhas: todos,
      colunas: [
        { titulo: "Turma", valor: (l) => l.turma.curso }, { titulo: "Código", valor: (l) => l.turma.codigo }, { titulo: "Turno", valor: (l) => l.turma.turno }, { titulo: "Tipo", valor: (l) => l.turma.tipo || "—" },
        { titulo: "Nome", valor: (l) => l.aluno.nome }, { titulo: "Telefone", valor: (l) => l.aluno.telefone }, { titulo: "Email", valor: (l) => l.aluno.email },
        { titulo: "Horas de falta", valor: (l) => l.r.horasFalta }, { titulo: "% Frequência", valor: (l) => l.r.pct ?? "" }, { titulo: "Situação", valor: (l) => l.st.label }, { titulo: "Faltas consecutivas", valor: (l) => l.r.consecutivas },
      ],
    });
  }

  return (
    <>
      <div className="page-header">
        <div><h2>Painel de frequência</h2><p>Visão geral por status de risco de evasão · mínimo de 75% de frequência para aprovação</p></div>
        <div className="row">
          <select className="select" value={mes} onChange={(e) => setMes(e.target.value)}>
            <option value="geral">Até hoje</option>
            {meses.map((ym) => <option key={ym} value={ym}>{mesLabel(ym)}</option>)}
          </select>
          <button className="btn btn-primary" onClick={exportarGeral} disabled={!todos.length}><Download size={14} /> Exportar</button>
        </div>
      </div>

      <div className="cards">
        <Kpi n={todos.length} l="Alunos ativos monitorados" cor="#4F46E5" />
        <Kpi n={faixas.abaixo} l="Abaixo de 75%" cor="var(--vermelho)" />
        <Kpi n={faixas.f7580} l="Entre 75% e 80% (atenção)" cor="var(--roxo)" />
        <Kpi n={faixas.f8090} l="Entre 80% e 90%" cor="#B45309" />
        <Kpi n={faixas.f90} l="Acima de 90%" cor="var(--verde)" />
        <Kpi n={evadidos} l="🚪 Evadidos" cor="#6B7280" />
      </div>
      <div className="cards" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        <div className="card kpi cc-verde"><div className="n" style={{ color: "var(--verde)" }}>{tiers.verde}</div><div className="l">✅ Regular</div></div>
        <div className="card kpi cc-amarelo"><div className="n" style={{ color: "var(--amarelo)" }}>{tiers.amarelo}</div><div className="l">📋 Monitorar</div></div>
        <div className="card kpi cc-roxo"><div className="n" style={{ color: "var(--roxo)" }}>{tiers.roxo}</div><div className="l">👁 Acompanhar</div></div>
        <div className="card kpi cc-vermelho"><div className="n" style={{ color: "var(--vermelho)" }}>{tiers.vermelho}</div><div className="l">⚠ Risco de evasão</div></div>
      </div>

      {ranking.length > 0 && (
        <div className="grid2 secao">
          <div className="card" style={{ borderLeft: "4px solid var(--vermelho)" }}>
            <div className="small soft" style={{ fontWeight: 700, marginBottom: 8 }}>📉 Turmas com maior índice de faltas</div>
            {ranking.slice(0, 3).map(({ t, rs }) => (
              <div key={t.id} className="row small" style={{ justifyContent: "space-between", padding: "4px 0", flexWrap: "nowrap" }}>
                <span className="grow ellipsis">{t.curso} <span className="soft">({t.codigo})</span></span>
                <strong style={{ color: rs.media < 75 ? TIER_COR.vermelho : rs.media < 85 ? TIER_COR.amarelo : TIER_COR.verde }}>{fmtPct(rs.media)}</strong>
              </div>
            ))}
          </div>
          <div className="card" style={{ borderLeft: "4px solid var(--verde)" }}>
            <div className="small soft" style={{ fontWeight: 700, marginBottom: 8 }}>📈 Turmas com melhor frequência</div>
            {ranking.slice(-3).reverse().map(({ t, rs }) => (
              <div key={t.id} className="row small" style={{ justifyContent: "space-between", padding: "4px 0", flexWrap: "nowrap" }}>
                <span className="grow ellipsis">{t.curso} <span className="soft">({t.codigo})</span></span>
                <strong style={{ color: "var(--verde)" }}>{fmtPct(rs.media)}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {!turmas.length ? (
        <Empty icone={<Users size={22} />}>Importe a listagem de alunos do sistema acadêmico para começar.</Empty>
      ) : (
        <>
          <h3 style={{ margin: "0 0 10px" }}>Alunos que precisam de atenção</h3>
          {!grupos.length ? <Empty>Nenhum aluno fora do status Regular no período selecionado. 🎉</Empty> : grupos.map((g) => (
            <div key={g.turma.id} style={{ marginBottom: 22 }}>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                <div><strong style={{ fontSize: 13.5 }}>{g.turma.curso}</strong> <span className="small soft" style={{ marginLeft: 6 }}>{g.turma.codigo || "sem código"} · {g.turma.turno} · {isFinalizada(g.turma) ? "Finalizada" : "Ativa"}</span></div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => exportarExcelMensal(g.turma, mes === "geral" ? ymOf(hoje) : mes, freq, linhas, hoje)}><FileDown size={12} /> Excel do mês</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => exportarPDFTurma(g.turma, linhas, cfg)}><Printer size={12} /> Exportar PDF</button>
                </div>
              </div>
              <div className="tabela-wrap">
                <table className="tabela responsiva">
                  <thead><tr><th>Aluno</th><th>Contato</th><th className="center">Horas de falta</th><th className="center">Seguidas</th><th className="num">Frequência</th><th>Situação</th></tr></thead>
                  <tbody>
                    {g.itens.map((l) => (
                      <tr key={l.key}>
                        <td className="principal">
                          <button className="link-aluno" onClick={() => ui.abrirFicha(l.turma.id, l.aluno.id)}>{l.aluno.nome}</button>
                          {precisaContato(l, alertas, cfg) && <Phone size={12} color="var(--vermelho)" style={{ marginLeft: 4, verticalAlign: "-1px" }} />}
                        </td>
                        <td className="small soft" data-label="Contato">{l.aluno.telefone || "—"}</td>
                        <td className="center mono" data-label="Horas de falta">{fmtHoras(l.r.horasFalta)} <span className="soft small">/ {fmtHoras(l.r.limiteHoras)}</span></td>
                        <td className="center mono" data-label="Seguidas">{l.r.consecutivas}</td>
                        <td className="num mono" data-label="Frequência" style={{ fontWeight: 800, color: TIER_COR[l.st.tier] }}>{fmtPct(l.r.pct)}</td>
                        <td data-label="Situação"><span className="chip" style={{ background: TIER_GRAD[l.st.tier] }}>{l.st.label}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}
