"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, TrendingDown, Users, ShieldAlert, Phone, Flag, ClipboardCheck, Download, Activity, UserX, CalendarClock } from "lucide-react";
import { useData } from "../DataProvider";
import { useUI } from "../Shell";
import { Kpi, FaixaChip, StatusChip, Pct, Empty, DistribuicaoFaixas } from "../ui";
import EvolucaoChart from "./EvolucaoChart";
import { consolidar, resumoTurma, isFinalizada, fmtData, ymOf, fmtPct } from "@/lib/engine";
import { FAIXA_COR, tipoLabel } from "@/lib/constants";
import { exportarExcel } from "@/lib/exportar";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const mesLabel = (ym) => { const [y, m] = ym.split("-"); return `${MESES[+m - 1]}/${y}`; };

export function ListaIntervencao({ itens, limite = 10, vazio }) {
  const ui = useUI();
  const { cfg, pode } = useData();
  if (!itens.length) return <Empty>{vazio || "Nenhum aluno precisando de intervenção agora. 🎉"}</Empty>;
  return (
    <div className="tabela-wrap">
      <table className="tabela responsiva">
        <thead><tr><th>Aluno</th><th className="num">Frequência</th><th className="center">Faltas</th><th className="center">Seguidas</th><th className="center">Pode faltar</th><th className="num">Projeção</th><th>Situação</th><th></th></tr></thead>
        <tbody>
          {itens.slice(0, limite).map((l) => (
            <tr key={l.key}>
              <td className="principal">
                <div><button className="link-aluno" onClick={() => ui.abrirFicha(l.turma.id, l.aluno.id)}>{l.aluno.nome}</button>
                  <div className="small soft">{l.turma.curso} · {l.turma.codigo || "—"}</div></div>
              </td>
              <td className="num" data-label="Frequência"><Pct r={l.r} limite={cfg.limiteMinimo} /></td>
              <td className="center mono" data-label="Faltas">{l.r.faltas}</td>
              <td className="center mono" data-label="Seguidas" style={{ color: l.r.consecutivas >= cfg.consecutivasAlerta ? "var(--vermelho)" : undefined, fontWeight: l.r.consecutivas >= cfg.consecutivasAlerta ? 800 : 400 }}>{l.r.consecutivas}</td>
              <td className="center mono" data-label="Pode faltar">{l.r.faltasPermitidasRestantes ?? "—"}</td>
              <td className="num mono" data-label="Projeção" style={{ color: l.r.projecaoPct !== null && l.r.projecaoPct < cfg.limiteMinimo ? "var(--vermelho)" : undefined }}>{fmtPct(l.r.projecaoPct)}</td>
              <td data-label="Situação"><div className="row" style={{ gap: 4 }}><FaixaChip faixa={l.r.faixa} /><StatusChip status={l.status} /></div></td>
              <td className="num">{pode("contatos") && <button className="btn btn-ghost btn-sm" onClick={() => ui.abrirContato(l.turma.id, l.aluno.id)}><ClipboardCheck size={12} /> Contato</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {itens.length > limite && <div className="small soft" style={{ padding: "8px 12px" }}>+ {itens.length - limite} aluno(s) — veja todos em <Link href="/permanencia">Gestão de Permanência</Link>.</div>}
    </div>
  );
}

export default function Painel({ turmaId }) {
  const { turmas, freq, contatos, linhas: linhasHoje, cfg, hoje } = useData();
  const ui = useUI();
  const router = useRouter();
  const [mes, setMes] = useState("geral");
  const turma = turmaId ? turmas.find((t) => t.id === turmaId) : null;

  const meses = useMemo(() => {
    const s = new Set();
    Object.keys(freq).forEach((k) => { if (!turmaId || k.startsWith(turmaId + "|")) s.add(ymOf(k.split("|")[1])); });
    return [...s].sort().reverse();
  }, [freq, turmaId]);

  const linhasTodas = useMemo(() => {
    if (mes === "geral") return linhasHoje;
    const [y, m] = mes.split("-").map(Number);
    const fim = new Date(y, m, 0).toISOString().slice(0, 10);
    return consolidar(turmas, freq, contatos, cfg, fim < hoje ? fim : hoje);
  }, [mes, linhasHoje, turmas, freq, contatos, cfg, hoje]);

  const escopo = linhasTodas.filter((l) => (turmaId ? l.turma.id === turmaId : !l.finalizada));
  const ativos = escopo.filter((l) => l.ativo);
  const rt = resumoTurma(turma || {}, escopo, cfg);
  const prioridade = ativos.filter((l) => ["risco", "critico", "abaixo"].includes(l.r.faixa) || l.r.consecutivas >= cfg.consecutivasAlerta).sort((a, b) => b.prioridade - a.prioridade);
  const atencao = ativos.filter((l) => l.r.faixa === "atencao" && l.r.consecutivas < cfg.consecutivasAlerta).sort((a, b) => b.prioridade - a.prioridade);
  const pendencias = ui.agenda;

  const ranking = useMemo(() => {
    if (turmaId) return [];
    return turmas.filter((t) => !isFinalizada(t)).map((t) => ({ t, rs: resumoTurma(t, linhasTodas.filter((l) => l.turma.id === t.id), cfg) })).filter((x) => x.rs.media !== null).sort((a, b) => a.rs.media - b.rs.media);
  }, [turmas, linhasTodas, cfg, turmaId]);

  const irPermanencia = (q) => router.push(`/permanencia${q ? "?" + q : ""}${turmaId ? `${q ? "&" : "?"}turma=${turmaId}` : ""}`);

  function exportar() {
    exportarExcel({
      nome: `painel_${turma ? turma.codigo || turma.curso : "geral"}_${mes}`, aba: "Frequência",
      linhas: escopo,
      colunas: [
        { titulo: "Turma", valor: (l) => l.turma.curso }, { titulo: "Código", valor: (l) => l.turma.codigo }, { titulo: "Turno", valor: (l) => l.turma.turno },
        { titulo: "Aluno", valor: (l) => l.aluno.nome }, { titulo: "E-mail", valor: (l) => l.aluno.email }, { titulo: "Telefone", valor: (l) => l.aluno.telefone },
        { titulo: "% Frequência", valor: (l) => l.r.pct }, { titulo: "Faixa", valor: (l) => l.r.faixa }, { titulo: "Faltas", valor: (l) => l.r.faltas },
        { titulo: "Faltas consecutivas", valor: (l) => l.r.consecutivas }, { titulo: "Pode faltar (dias)", valor: (l) => l.r.faltasPermitidasRestantes },
        { titulo: "Projeção %", valor: (l) => l.r.projecaoPct }, { titulo: "Situação", valor: (l) => l.status },
      ],
    });
  }

  return (
    <>
      {!turmaId && (
        <div className="page-header">
          <div><h2>Painel Geral</h2><p>Prevenção: quem precisa de intervenção antes de chegar a {cfg.limiteMinimo}% de frequência</p></div>
          <div className="row">
            <select className="select" value={mes} onChange={(e) => setMes(e.target.value)}>
              <option value="geral">Até hoje</option>
              {meses.map((ym) => <option key={ym} value={ym}>Até o fim de {mesLabel(ym)}</option>)}
            </select>
            <button className="btn btn-primary" onClick={exportar} disabled={!escopo.length}><Download size={14} /> Exportar</button>
          </div>
        </div>
      )}

      {turma && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="grid3" style={{ gap: 10, fontSize: 12.5 }}>
            <div><span className="soft">Código:</span> <strong>{turma.codigo || "—"}</strong></div>
            <div><span className="soft">Tipo:</span> <strong>{tipoLabel(turma.tipo)}</strong></div>
            <div><span className="soft">Turno:</span> <strong>{turma.turno}</strong> {turma.horarioInicio ? `(${turma.horarioInicio}–${turma.horarioFim || "?"})` : ""}</div>
            <div><span className="soft">Docente:</span> <strong>{turma.instrutor || "—"}</strong></div>
            <div><span className="soft">Carga horária:</span> <strong>{turma.cargaHoraria ?? "—"}h</strong> · {turma.horariosPorDia}h/dia</div>
            <div><span className="soft">Alunos:</span> <strong>{rt.total}</strong> ({rt.ativos} ativos)</div>
            <div><span className="soft">Início:</span> <strong>{fmtData(turma.periodoInicio)}</strong></div>
            <div><span className="soft">Previsão de término:</span> <strong>{fmtData(turma.periodoFim)}</strong></div>
            <div><span className="soft">Encerramento real:</span> <strong>{fmtData(turma.periodoRealFim)}</strong></div>
          </div>
          {turmaId && (
            <div className="row" style={{ marginTop: 12 }}>
              <select className="select" value={mes} onChange={(e) => setMes(e.target.value)}>
                <option value="geral">Situação até hoje</option>
                {meses.map((ym) => <option key={ym} value={ym}>Até o fim de {mesLabel(ym)}</option>)}
              </select>
              <button className="btn btn-ghost btn-sm" onClick={exportar}><Download size={13} /> Excel</button>
            </div>
          )}
        </div>
      )}

      <div className="cards">
        <Kpi destaque n={rt.proximos} l={`Em risco de chegar a ${cfg.limiteMinimo}%`} d="atenção + risco + crítico" cor="var(--laranja)" icone={<TrendingDown size={12} />} onClick={() => irPermanencia("faixa=prevencao")} />
        <Kpi n={rt.cont.critico} l="Críticos" d={`podem faltar ≤ ${cfg.folga.critico} dias`} cor="var(--vermelho)" onClick={() => irPermanencia("faixa=critico")} />
        <Kpi n={rt.cont.abaixo} l={`Abaixo de ${cfg.limiteMinimo}%`} cor="var(--vinho)" onClick={() => irPermanencia("faixa=abaixo")} />
        <Kpi n={rt.consecutivas} l={`${cfg.consecutivasAlerta}+ faltas seguidas`} cor="#DC2626" icone={<AlertTriangle size={12} />} onClick={() => irPermanencia("consec=1")} />
        <Kpi n={rt.media !== null ? `${String(rt.media).replace(".", ",")}%` : "—"} l="Frequência média" cor="var(--primary)" icone={<Activity size={12} />} />
        <Kpi n={turmaId ? montarPend(pendencias, turmaId) : pendencias.total} l="Pendências na agenda" cor="var(--roxo)" icone={<CalendarClock size={12} />} onClick={() => router.push(turmaId ? `/turmas/${turmaId}?aba=agenda` : "/agenda")} />
      </div>
      <div className="cards">
        <Kpi n={rt.ativos} l="Alunos ativos" cor="#4F46E5" icone={<Users size={12} />} />
        <Kpi n={rt.emAcompanhamento} l="Em acompanhamento" cor="var(--roxo)" />
        <Kpi n={rt.riscoEvasao} l="Risco de evasão" cor="#DC2626" icone={<ShieldAlert size={12} />} onClick={() => irPermanencia("status=Risco de evasão")} />
        <Kpi n={rt.evadidos} l="Evadidos" cor="#6B7280" icone={<UserX size={12} />} onClick={() => irPermanencia("status=Evadido")} />
        <Kpi n={rt.permanencia !== null ? `${String(rt.permanencia).replace(".", ",")}%` : "—"} l="Permanência" d="alunos que não evadiram" cor="var(--verde)" />
        {!turmaId && <Kpi n={turmas.filter((t) => !isFinalizada(t)).length} l="Turmas ativas" d={`${turmas.filter(isFinalizada).length} finalizadas`} cor="#0EA5E9" icone={<Flag size={12} />} />}
      </div>

      {ativos.length > 0 && (
        <div className="card secao">
          <h4 style={{ marginBottom: 10 }}>Distribuição dos alunos ativos por faixa de acompanhamento</h4>
          <DistribuicaoFaixas cont={rt.cont} />
        </div>
      )}

      {turma && (
        <div className="card secao">
          <h4 style={{ marginBottom: 10 }}>Evolução da frequência média da turma</h4>
          <EvolucaoChart turma={turma} freq={freq} cfg={cfg} alunosIds={ativos.map((l) => l.aluno.id)} />
        </div>
      )}

      {!escopo.length ? (
        <Empty icone={<Users size={24} />}>
          {turmaId ? "Esta turma ainda não tem alunos. Inclua pela aba Alunos." : <>Nenhuma turma ativa ainda. <Link href="/importar">Importe a planilha</Link> do sistema acadêmico ou crie uma turma pelo “+” no menu.</>}
        </Empty>
      ) : (
        <>
          <div className="secao">
            <div className="secao-head"><h3><AlertTriangle size={16} color="var(--vermelho)" /> Intervenção imediata ({prioridade.length})</h3><span className="small soft">ordenado pela urgência</span></div>
            <ListaIntervencao itens={prioridade} limite={turmaId ? 50 : 12} vazio="Nenhum aluno em risco, crítico ou com faltas seguidas. 🎉" />
          </div>
          <div className="secao">
            <div className="secao-head"><h3><TrendingDown size={16} color="var(--amarelo)" /> Em atenção — acompanhar de perto ({atencao.length})</h3></div>
            <ListaIntervencao itens={atencao} limite={turmaId ? 50 : 8} vazio="Nenhum aluno na faixa de atenção." />
          </div>
        </>
      )}

      {ranking.length > 0 && (
        <div className="grid2 secao">
          <div className="card" style={{ borderLeft: "4px solid var(--vermelho)" }}>
            <h4 style={{ marginBottom: 8 }}>📉 Turmas com menor frequência média</h4>
            {ranking.slice(0, 5).map(({ t, rs }) => (
              <Link key={t.id} href={`/turmas/${t.id}`} className="row small" style={{ justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--line)", textDecoration: "none", color: "inherit" }}>
                <span className="grow ellipsis">{t.curso} <span className="soft">({t.codigo})</span></span>
                <span className="soft">{rs.proximos} em risco</span>
                <strong className="mono" style={{ color: rs.media < cfg.limiteMinimo ? "var(--vinho)" : rs.media < cfg.faixas.atencao ? "var(--laranja)" : "var(--verde)" }}>{rs.media}%</strong>
              </Link>
            ))}
          </div>
          <div className="card" style={{ borderLeft: "4px solid var(--verde)" }}>
            <h4 style={{ marginBottom: 8 }}>📈 Turmas com melhor frequência média</h4>
            {ranking.slice(-5).reverse().map(({ t, rs }) => (
              <Link key={t.id} href={`/turmas/${t.id}`} className="row small" style={{ justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--line)", textDecoration: "none", color: "inherit" }}>
                <span className="grow ellipsis">{t.curso} <span className="soft">({t.codigo})</span></span>
                <strong className="mono" style={{ color: "var(--verde)" }}>{rs.media}%</strong>
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function montarPend(agenda, turmaId) {
  const f = (arr) => arr.filter((x) => (x.linha || x).turma?.id === turmaId).length;
  return f(agenda.consecutivas) + f(agenda.limite) + f(agenda.retornos) + f(agenda.semRetorno) + agenda.necessitaContato.filter((l) => l.turma.id === turmaId).length;
}
