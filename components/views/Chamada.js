"use client";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CheckCircle2, Trash2, AlertTriangle, MailWarning, UserPlus } from "lucide-react";
import { useData } from "../DataProvider";
import { useUI } from "../Shell";
import { FaixaChip, Pct, Empty } from "../ui";
import { addDias, fmtData, fmtDataCurta, datasRegistradas, isFinalizada } from "@/lib/engine";

export default function Chamada({ turmaId, dataInicial }) {
  const { turmas, freq, linhas, cfg, hoje, pode, acoes } = useData();
  const ui = useUI();
  const turma = turmas.find((t) => t.id === turmaId);
  const [data, setData] = useState(dataInicial || hoje);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const chave = `${turmaId}|${data}`;
  const reg = freq[chave];
  const registrada = !!reg;
  const datas = useMemo(() => datasRegistradas(turmaId, freq).reverse(), [turmaId, freq]);
  const podeMarcar = pode("chamada");
  if (!turma) return null;
  const ls = linhas.filter((l) => l.turma.id === turmaId).sort((a, b) => a.aluno.nome.localeCompare(b.aluno.nome));
  const visiveis = ls.filter((l) => l.ativo || mostrarInativos);
  const contagem = { F: 0, A: 0, J: 0 };
  Object.values(reg || {}).forEach((r) => { if (contagem[r.status] !== undefined) contagem[r.status]++; });
  const ativosIds = ls.filter((l) => l.ativo).map((l) => l.aluno.id);
  const presentes = ativosIds.length - contagem.F - contagem.J;
  const diaSemana = new Date(data + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long" });
  const fora = (turma.periodoInicio && data < turma.periodoInicio) || (turma.periodoFim && data > (turma.periodoRealFim || turma.periodoFim));

  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="row">
            <button className="btn btn-ghost btn-icon" onClick={() => setData(addDias(data, -1))} aria-label="Dia anterior"><ChevronLeft size={16} /></button>
            <input type="date" className="input" value={data} max={hoje} onChange={(e) => e.target.value && setData(e.target.value)} />
            <button className="btn btn-ghost btn-icon" disabled={data >= hoje} onClick={() => setData(addDias(data, 1))} aria-label="Próximo dia"><ChevronRight size={16} /></button>
            {data !== hoje && <button className="btn btn-ghost btn-sm" onClick={() => setData(hoje)}>Hoje</button>}
            <span className="small soft" style={{ textTransform: "capitalize" }}>{diaSemana}</span>
          </div>
          <div className="row">
            {registrada
              ? <span className="chip" style={{ background: "var(--verde)" }}><CheckCircle2 size={11} /> Chamada registrada</span>
              : <span className="chip" style={{ background: "#9CA3AF" }}>Chamada não registrada</span>}
            {registrada && podeMarcar && <button className="btn btn-ghost btn-sm btn-icon" title="Excluir a chamada deste dia" onClick={() => acoes.excluirChamada(turma, data)}><Trash2 size={13} /></button>}
          </div>
        </div>
        {isFinalizada(turma) && <div className="aviso info" style={{ marginTop: 10 }}>Turma finalizada — a chamada fica disponível apenas para correções.</div>}
        {fora && <div className="aviso" style={{ marginTop: 10 }}><AlertTriangle size={14} /> Esta data está fora do período do curso ({fmtData(turma.periodoInicio)} a {fmtData(turma.periodoRealFim || turma.periodoFim)}).</div>}
        <div className="row" style={{ marginTop: 12, gap: 14 }}>
          <span className="small"><strong style={{ color: "var(--verde)" }}>{registrada ? presentes : "—"}</strong> presentes</span>
          <span className="small"><strong style={{ color: "var(--vermelho)" }}>{contagem.F}</strong> faltas</span>
          <span className="small"><strong style={{ color: "var(--amarelo)" }}>{contagem.A}</strong> atrasos</span>
          <span className="small"><strong style={{ color: "#5B7FBF" }}>{contagem.J}</strong> justificadas</span>
          {podeMarcar && !registrada && (
            <button className="btn btn-verde btn-sm" style={{ marginLeft: "auto" }} onClick={() => acoes.confirmarChamada(turma, data)}><CheckCircle2 size={13} /> Confirmar chamada (todos presentes)</button>
          )}
          {podeMarcar && registrada && (
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={() => acoes.confirmarChamada(turma, data)}><CheckCircle2 size={13} /> Salvar / confirmar</button>
          )}
        </div>
        <p className="small soft" style={{ margin: "10px 0 0" }}>P = presente · F = falta · A = atraso (desconta {cfg.pesoAtraso * 100}% das horas do dia) · J = falta justificada (não desconta). Cada marcação é salva na hora. Ao marcar qualquer aluno, a aula do dia passa a contar.</p>
      </div>

      {!ls.length ? (
        <Empty icone={<UserPlus size={22} />}>Nenhum aluno nesta turma. {pode("editar") && <button className="link-aluno" onClick={() => ui.abrirAluno(turma.id, null)}>Incluir aluno</button>}</Empty>
      ) : (
        <div className="tabela-wrap">
          <table className="tabela responsiva">
            <thead><tr><th>Aluno</th><th className="center">Marcação</th><th>Atraso</th><th className="num">Frequência</th><th className="center">Seguidas</th><th className="center">Pode faltar</th><th>Faixa</th></tr></thead>
            <tbody>
              {visiveis.map((l) => {
                const r = (reg || {})[l.aluno.id];
                const s = r?.status || (registrada ? "P" : null);
                return (
                  <tr key={l.key} style={{ opacity: l.ativo ? 1 : 0.55 }}>
                    <td className="principal">
                      <div>
                        <button className="link-aluno" onClick={() => ui.abrirFicha(turma.id, l.aluno.id)}>{l.aluno.nome}</button>
                        {!l.aluno.email && <MailWarning size={12} color="var(--amarelo)" style={{ marginLeft: 5, verticalAlign: "-1px" }} title="Sem e-mail cadastrado" />}
                        {!l.ativo && <span className="chip" style={{ background: "#9CA3AF", marginLeft: 6 }}>{l.status}</span>}
                      </div>
                    </td>
                    <td className="center" data-label="Marcação">
                      <div className="seg">
                        <button className={"P" + (s === "P" ? " on" : "")} disabled={!podeMarcar} title="Presente" onClick={() => (r ? acoes.marcar(turma, data, l.aluno, r.status) : !registrada && acoes.confirmarChamada(turma, data))}>P</button>
                        {["F", "A", "J"].map((x) => (
                          <button key={x} className={x + (r?.status === x ? " on" : "")} disabled={!podeMarcar} title={{ F: "Falta", A: "Atraso", J: "Falta justificada" }[x]} onClick={() => acoes.marcar(turma, data, l.aluno, x)}>{x}</button>
                        ))}
                      </div>
                    </td>
                    <td data-label="Atraso" className={r?.status === "A" ? "" : "so-desk"}>
                      {r?.status === "A" ? (
                        <select className="select" style={{ minHeight: 30, padding: "3px 6px", fontSize: 12 }} value={r.horarioAtraso || ""} disabled={!podeMarcar} onChange={(e) => acoes.setHorarioAtraso(turma, data, l.aluno, e.target.value)}>
                          <option value="">—</option>
                          {Array.from({ length: turma.horariosPorDia || 1 }, (_, i) => i + 1).map((h) => <option key={h} value={h}>{h}º horário</option>)}
                        </select>
                      ) : <span className="soft">—</span>}
                    </td>
                    <td className="num" data-label="Frequência"><Pct r={l.r} limite={cfg.limiteMinimo} /></td>
                    <td className="center mono so-desk" data-label="Seguidas" style={{ color: l.r.consecutivas >= cfg.consecutivasAlerta ? "var(--vermelho)" : undefined, fontWeight: 700 }}>{l.r.consecutivas}</td>
                    <td className="center mono so-desk" data-label="Pode faltar">{l.r.faltasPermitidasRestantes ?? "—"}</td>
                    <td data-label="Faixa" className="so-desk"><FaixaChip faixa={l.r.faixa} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="row" style={{ marginTop: 10, justifyContent: "space-between" }}>
        {ls.some((l) => !l.ativo) ? <label className="row small" style={{ cursor: "pointer" }}><input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} /> Mostrar evadidos/concluídos ({ls.filter((l) => !l.ativo).length})</label> : <span />}
        {pode("editar") && <button className="btn btn-ghost btn-sm" onClick={() => ui.abrirAluno(turma.id, null)}><UserPlus size={13} /> Incluir aluno</button>}
      </div>

      {datas.length > 0 && (
        <div className="secao" style={{ marginTop: 22 }}>
          <h4 style={{ marginBottom: 8 }}>Chamadas registradas ({datas.length} aulas · {datas.length * (turma.horariosPorDia || 1)}h de {turma.cargaHoraria || "?"}h)</h4>
          <div className="row" style={{ gap: 6 }}>
            {datas.slice(0, 60).map((d) => {
              const nF = Object.values(freq[`${turmaId}|${d}`] || {}).filter((x) => x.status === "F").length;
              return (
                <button key={d} className={"pill" + (d === data ? " on" : "")} onClick={() => setData(d)} title={`${fmtData(d)} — ${nF} falta(s)`}>
                  {fmtDataCurta(d)} {nF ? <span style={{ color: d === data ? "#fff" : "var(--vermelho)" }}>· {nF}F</span> : ""}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
