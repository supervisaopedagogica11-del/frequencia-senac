"use client";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ClipboardCheck, Eye, ArrowUpDown } from "lucide-react";
import { useData } from "../DataProvider";
import { useUI } from "../Shell";
import { FaixaChip, Pct, Empty } from "../ui";
import { useFiltros, aplicarFiltros, BarraFiltros } from "./Filtros";
import { STATUS_ALUNO, STATUS_ALUNO_COR } from "@/lib/constants";
import { statusAluno, fmtDataCurta, fmtData } from "@/lib/engine";

export default function Permanencia({ turmaId }) {
  const { linhas, turmas, alertas, cfg, pode, acoes, hoje } = useData();
  const ui = useUI();
  const sp = useSearchParams();
  const { f, set, limpar } = useFiltros({
    faixa: sp?.get("faixa") || "", status: sp?.get("status") || "", consec: sp?.get("consec") ? String(cfg.consecutivasAlerta) : "",
    turma: turmaId || sp?.get("turma") || "", situacaoTurma: turmaId ? "" : "ativas",
    evasao: sp?.get("status") === "Evadido" ? "" : "ativos",
  });
  const [ordem, setOrdem] = useState("prioridade");

  const base = turmaId ? linhas.filter((l) => l.turma.id === turmaId) : linhas;
  const contagem = useMemo(() => {
    const c = Object.fromEntries(STATUS_ALUNO.map((s) => [s, 0]));
    base.filter((l) => f.situacaoTurma !== "ativas" || !l.finalizada).forEach((l) => { c[statusAluno(l.aluno)]++; });
    return c;
  }, [base, f.situacaoTurma]);
  const lista = useMemo(() => {
    const r = aplicarFiltros(base, f, { alertas, cfg });
    const fn = {
      prioridade: (a, b) => b.prioridade - a.prioridade,
      pct: (a, b) => (a.r.pct ?? 999) - (b.r.pct ?? 999),
      nome: (a, b) => a.aluno.nome.localeCompare(b.aluno.nome),
      contato: (a, b) => (a.contato?.ultimoContato || "").localeCompare(b.contato?.ultimoContato || ""),
    }[ordem];
    return r.sort(fn);
  }, [base, f, alertas, cfg, ordem]);
  const pendAbertas = useMemo(() => new Set(Object.values(alertas).filter((a) => a.status === "aberto").map((a) => `${a.turmaId}|${a.alunoId}`)), [alertas]);

  return (
    <>
      {!turmaId && (
        <div className="page-header">
          <div><h2>Gestão de Permanência</h2><p>Situação de cada aluno, intervenções da Supervisão e acompanhamento da evasão</p></div>
        </div>
      )}
      <div className="pills" style={{ marginBottom: 12 }}>
        {STATUS_ALUNO.map((s) => (
          <button key={s} className={"pill" + (f.status === s ? " on" : "")} style={f.status === s ? { background: STATUS_ALUNO_COR[s], borderColor: STATUS_ALUNO_COR[s] } : {}}
            onClick={() => { set("status", f.status === s ? "" : s); }}>
            {s} <strong>{contagem[s]}</strong>
          </button>
        ))}
      </div>
      <BarraFiltros f={f} set={set} limpar={limpar} turmas={turmas} esconder={turmaId ? ["turma", "situacaoTurma", "turno", "tipo"] : []} total={base.length} filtrados={lista.length} />
      <div className="row" style={{ marginBottom: 10 }}>
        <span className="small soft"><ArrowUpDown size={12} /> Ordenar:</span>
        {[["prioridade", "Urgência"], ["pct", "Menor frequência"], ["contato", "Contato mais antigo"], ["nome", "Nome"]].map(([k, l]) => <button key={k} className={"pill" + (ordem === k ? " on" : "")} onClick={() => setOrdem(k)}>{l}</button>)}
      </div>
      {!lista.length ? <Empty>Nenhum aluno com esses filtros.</Empty> : (
        <div className="tabela-wrap">
          <table className="tabela responsiva">
            <thead><tr><th>Aluno</th><th className="num">Frequência</th><th className="center">Seguidas</th><th className="center">Pode faltar</th><th>Faixa</th><th>Situação</th><th>Último contato</th><th>Próxima ação</th><th></th></tr></thead>
            <tbody>
              {lista.slice(0, 400).map((l) => {
                const st = statusAluno(l.aluno);
                const c = l.contato;
                const ult = c?.tentativas?.at(-1);
                const atrasado = c?.proximaData && c.proximaData < hoje && !c.concluido;
                return (
                  <tr key={l.key}>
                    <td className="principal">
                      <div>
                        <button className="link-aluno" onClick={() => ui.abrirFicha(l.turma.id, l.aluno.id)}>{l.aluno.nome}</button>
                        {pendAbertas.has(l.key) && <span className="chip" style={{ background: "var(--vermelho)", marginLeft: 6 }}>pendência</span>}
                        {!turmaId && <div className="small soft">{l.turma.curso} · {l.turma.codigo || "—"} · {l.turma.turno}</div>}
                      </div>
                    </td>
                    <td className="num" data-label="Frequência"><Pct r={l.r} limite={cfg.limiteMinimo} /></td>
                    <td className="center mono" data-label="Seguidas" style={{ color: l.r.consecutivas >= cfg.consecutivasAlerta ? "var(--vermelho)" : undefined, fontWeight: 700 }}>{l.r.consecutivas}</td>
                    <td className="center mono" data-label="Pode faltar">{l.r.faltasPermitidasRestantes ?? "—"}</td>
                    <td data-label="Faixa"><FaixaChip faixa={l.r.faixa} /></td>
                    <td data-label="Situação">
                      <select className="select" style={{ minHeight: 30, padding: "4px 8px", fontSize: 12, color: STATUS_ALUNO_COR[st], fontWeight: 700, borderColor: STATUS_ALUNO_COR[st] }}
                        value={st} disabled={!pode("contatos")} onChange={(e) => acoes.mudarStatusAluno(l.turma, l.aluno, e.target.value)}>
                        {STATUS_ALUNO.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td data-label="Último contato" className="small">{ult ? <>{fmtDataCurta(ult.data)} · {ult.forma || ult.tipo}<div className="soft">{ult.resultado || ""}</div></> : <span className="soft">nenhum</span>}</td>
                    <td data-label="Próxima ação" className="small" style={{ color: atrasado ? "var(--vermelho)" : undefined }}>{c?.proximaData ? <>{fmtData(c.proximaData)}{atrasado ? " (atrasado)" : ""}<div className="soft">{c.proximaAcao}</div></> : <span className="soft">—</span>}</td>
                    <td className="num">
                      <div className="row" style={{ gap: 4, justifyContent: "flex-end", flexWrap: "nowrap" }}>
                        {pode("contatos") && <button className="btn btn-ghost btn-sm" onClick={() => ui.abrirContato(l.turma.id, l.aluno.id)}><ClipboardCheck size={12} /> Contato</button>}
                        <button className="btn btn-ghost btn-sm btn-icon" title="Ficha do aluno" onClick={() => ui.abrirFicha(l.turma.id, l.aluno.id)}><Eye size={13} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {lista.length > 400 && <div className="small soft" style={{ padding: 10 }}>Mostrando 400 de {lista.length}. Use os filtros para refinar.</div>}
        </div>
      )}
    </>
  );
}
