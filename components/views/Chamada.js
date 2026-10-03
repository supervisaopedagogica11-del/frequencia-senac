"use client";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CheckCircle2, Trash2, UserPlus, MailWarning } from "lucide-react";
import { useData } from "../DataProvider";
import { useUI } from "../Shell";
import { FaixaChip, FaltasBar, Empty } from "../ui";
import { addDias, fmtData, fmtDataCurta, datasRegistradas, isFinalizada } from "@/lib/engine";

export default function Chamada({ turmaId }) {
  const { turmas, freq, linhas, hoje, pode, acoes } = useData();
  const ui = useUI();
  const turma = turmas.find((t) => t.id === turmaId);
  const [data, setData] = useState(hoje);
  const [verInativos, setVerInativos] = useState(false);
  const datas = useMemo(() => datasRegistradas(turmaId, freq).reverse(), [turmaId, freq]);
  if (!turma) return null;
  const hd = Number(turma.horariosPorDia) || 1;
  const reg = freq[`${turmaId}|${data}`];
  const feita = !!reg;
  const podeMarcar = pode("chamada");
  const ls = linhas.filter((l) => l.turma.id === turmaId).sort((a, b) => a.aluno.nome.localeCompare(b.aluno.nome));
  const visiveis = ls.filter((l) => l.ativo || verInativos);
  const ativos = ls.filter((l) => l.ativo);
  let nF = 0, nH = 0;
  ativos.forEach((l) => { const r = reg?.[l.aluno.id]; if (r?.status === "F") nF++; else if (r) nH++; });
  const diaSemana = new Date(data + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long" });

  const horasDe = (r) => (!r ? [] : r.status === "F" ? Array.from({ length: hd }, (_, i) => i + 1) : r.status === "H" ? r.horas || [] : r.status === "A" ? [1] : []);
  const alternarHora = (l, h) => {
    const atual = horasDe(reg?.[l.aluno.id]);
    const novas = atual.includes(h) ? atual.filter((x) => x !== h) : [...atual, h];
    acoes.definirRegistro(turma, data, l.aluno, { status: "H", horas: novas });
  };

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-ghost btn-icon" onClick={() => setData(addDias(data, -1))} aria-label="Dia anterior"><ChevronLeft size={16} /></button>
            <input type="date" className="input" value={data} max={hoje} onChange={(e) => e.target.value && setData(e.target.value)} />
            <button className="btn btn-ghost btn-icon" disabled={data >= hoje} onClick={() => setData(addDias(data, 1))} aria-label="Próximo dia"><ChevronRight size={16} /></button>
            {data !== hoje && <button className="btn btn-ghost btn-sm" onClick={() => setData(hoje)}>Hoje</button>}
            <span className="small soft" style={{ textTransform: "capitalize" }}>{diaSemana}</span>
          </div>
          <div className="row" style={{ gap: 6 }}>
            {feita ? <span className="chip" style={{ background: "var(--verde)" }}><CheckCircle2 size={11} /> Chamada feita</span> : <span className="chip" style={{ background: "#9CA3AF" }}>Chamada não feita</span>}
            {feita && podeMarcar && <button className="btn btn-ghost btn-sm btn-icon" title="Apagar a chamada deste dia (aula não aconteceu)" onClick={() => acoes.excluirChamada(turma, data)}><Trash2 size={13} /></button>}
          </div>
        </div>
        <div className="row" style={{ marginTop: 10, justifyContent: "space-between" }}>
          <span className="small">
            {feita ? <><strong style={{ color: "var(--verde)" }}>{ativos.length - nF - nH}</strong> presentes · <strong style={{ color: "var(--vermelho)" }}>{nF}</strong> faltaram · <strong style={{ color: "var(--amarelo)" }}>{nH}</strong> com falta em alguns horários</> : <span className="soft">Marque só quem faltou. Os demais ficam como presentes.</span>}
          </span>
          {podeMarcar && !feita && <button className="btn btn-verde btn-sm" onClick={() => acoes.confirmarChamada(turma, data)}><CheckCircle2 size={13} /> Salvar chamada — todos presentes</button>}
        </div>
        {isFinalizada(turma) && <div className="aviso info" style={{ marginTop: 10 }}>Turma finalizada — use a chamada apenas para correções.</div>}
      </div>
      <p className="small soft" style={{ margin: "0 0 10px" }}>
        <strong>Faltou</strong> = falta o dia todo ({hd}h). Chegou atrasado ou saiu mais cedo? Clique nos <strong>horários</strong> em que o aluno não estava — cada horário = 1h de falta.
      </p>

      {!ls.length ? (
        <Empty icone={<UserPlus size={22} />}>Nenhum aluno nesta turma. {pode("editar") && <button className="link-aluno" onClick={() => ui.abrirAluno(turma.id, null)}>Incluir aluno</button>}</Empty>
      ) : (
        <div className="tabela-wrap">
          <table className="tabela responsiva chamada">
            <thead><tr><th>Aluno</th><th className="center">Presença</th><th className="center">Horários de falta</th><th>Faltas no curso</th><th>Situação</th></tr></thead>
            <tbody>
              {visiveis.map((l) => {
                const r = reg?.[l.aluno.id];
                const horas = horasDe(r);
                const presente = feita && !r;
                const faltou = r?.status === "F";
                return (
                  <tr key={l.key} style={{ opacity: l.ativo ? 1 : 0.5 }}>
                    <td className="principal">
                      <button className="link-aluno" onClick={() => ui.abrirFicha(turma.id, l.aluno.id)}>{l.aluno.nome}</button>
                      {!l.aluno.email && <MailWarning size={12} color="var(--amarelo)" style={{ marginLeft: 5, verticalAlign: "-1px" }} />}
                      {!l.ativo && <span className="chip" style={{ background: "#9CA3AF", marginLeft: 6 }}>{l.status}</span>}
                    </td>
                    <td className="center" data-label="Presença">
                      <div className="seg">
                        <button className={"pres" + (presente ? " on" : "")} disabled={!podeMarcar} onClick={() => acoes.definirRegistro(turma, data, l.aluno, null)}>Presente</button>
                        <button className={"falt" + (faltou ? " on" : "")} disabled={!podeMarcar} onClick={() => acoes.definirRegistro(turma, data, l.aluno, faltou ? null : { status: "F" })}>Faltou</button>
                      </div>
                    </td>
                    <td className="center" data-label="Horários">
                      <div className="horas">
                        {Array.from({ length: hd }, (_, i) => i + 1).map((h) => (
                          <button key={h} className={horas.includes(h) ? "on" : ""} disabled={!podeMarcar} title={`${h}º horário`} onClick={() => alternarHora(l, h)}>{h}º</button>
                        ))}
                      </div>
                    </td>
                    <td data-label="Faltas no curso"><FaltasBar r={l.r} /></td>
                    <td data-label="Situação"><FaixaChip faixa={l.r.faixa} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="row" style={{ marginTop: 10, justifyContent: "space-between" }}>
        {ls.some((l) => !l.ativo) ? <label className="row small" style={{ cursor: "pointer" }}><input type="checkbox" checked={verInativos} onChange={(e) => setVerInativos(e.target.checked)} /> Mostrar evadidos/concluídos</label> : <span />}
        {pode("editar") && <button className="btn btn-ghost btn-sm" onClick={() => ui.abrirAluno(turma.id, null)}><UserPlus size={13} /> Incluir aluno</button>}
      </div>

      {datas.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h4 style={{ marginBottom: 8 }}>Chamadas feitas · {datas.length} aulas ({datas.length * hd}h de {turma.cargaHoraria || "?"}h)</h4>
          <div className="row" style={{ gap: 5 }}>
            {datas.slice(0, 40).map((d) => <button key={d} className={"pill" + (d === data ? " on" : "")} onClick={() => setData(d)} title={fmtData(d)}>{fmtDataCurta(d)}</button>)}
          </div>
        </div>
      )}
    </>
  );
}
