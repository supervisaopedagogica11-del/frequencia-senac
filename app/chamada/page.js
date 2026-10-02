"use client";
import { useEffect, useState, Fragment, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Users, Check, AlertTriangle } from "lucide-react";
import { listarTurmas, carregarFrequenciasDaTurma, salvarFrequenciaDia, salvarTurma } from "../../lib/firestoreData";
import { calcularStatus, isAlunoAtivo, TIER_COR, todayISO } from "../../lib/logic";
import FichaAlunoModal from "../../components/FichaAlunoModal";

function uid() { return (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2); }

function ChamadaConteudo() {
  const searchParams = useSearchParams();
  const turmaIdDaUrl = searchParams.get("turma");

  const [carregando, setCarregando] = useState(true);
  const [turmas, setTurmas] = useState([]);
  const [turmaId, setTurmaId] = useState("");
  const [data, setData] = useState(todayISO());
  const [freqMap, setFreqMap] = useState({});
  const [carregandoFreq, setCarregandoFreq] = useState(false);
  const [novoAberto, setNovoAberto] = useState(false);
  const [novo, setNovo] = useState({ nome: "", matricula: "", telefone: "", email: "" });
  const [erroSalvar, setErroSalvar] = useState("");
  const [fichaAberta, setFichaAberta] = useState(null);

  useEffect(() => {
    (async () => {
      const t = await listarTurmas();
      setTurmas(t);
      if (turmaIdDaUrl && t.some((x) => x.id === turmaIdDaUrl)) setTurmaId(turmaIdDaUrl);
      else if (t.length) setTurmaId(t[0].id);
      setCarregando(false);
    })();
  }, [turmaIdDaUrl]);

  useEffect(() => {
    if (!turmaId) return;
    setCarregandoFreq(true);
    carregarFrequenciasDaTurma(turmaId).then((m) => { setFreqMap(m); setCarregandoFreq(false); });
  }, [turmaId]);

  const turmaAtual = turmas.find((t) => t.id === turmaId) || null;
  const chave = turmaAtual ? `${turmaAtual.id}|${data}` : null;
  const registroDoDia = (chave && freqMap[chave]) || {};

  async function salvarRegistro(alunoId, novoRegistro) {
    const proximo = { ...registroDoDia };
    if (novoRegistro) proximo[alunoId] = novoRegistro;
    else delete proximo[alunoId];

    const freqMapAnterior = freqMap;
    setFreqMap({ ...freqMap, [chave]: proximo });
    setErroSalvar("");
    try {
      await salvarFrequenciaDia(turmaAtual.id, data, proximo);
    } catch (err) {
      console.error(err);
      setFreqMap(freqMapAnterior);
      setErroSalvar("Não foi possível salvar essa marcação no banco de dados. Verifique sua internet e tente de novo.");
    }
  }

  function marcar(alunoId, status) {
    const atual = registroDoDia[alunoId];
    if (atual && atual.status === status) salvarRegistro(alunoId, null);
    else salvarRegistro(alunoId, { status });
  }

  function alternarHorarioAtraso(alunoId, horario) {
    const atual = registroDoDia[alunoId];
    if (!atual || atual.status !== "A") return;
    const atuais = atual.horariosAtraso || [];
    const novos = atuais.includes(horario) ? atuais.filter((h) => h !== horario) : [...atuais, horario].sort((a, b) => a - b);
    const novoRegistro = { status: "A" };
    if (novos.length) novoRegistro.horariosAtraso = novos;
    salvarRegistro(alunoId, novoRegistro);
  }

  async function adicionarAluno() {
    if (!novo.nome.trim() || !turmaAtual) return;
    const novoAluno = { id: uid(), nome: novo.nome.trim(), matricula: novo.matricula.trim(), telefone: novo.telefone.trim(), email: novo.email.trim(), situacao: "Ativo" };
    const alunosAtualizados = [...(turmaAtual.alunos || []), novoAluno];
    try {
      await salvarTurma({ ...turmaAtual, alunos: alunosAtualizados });
      setTurmas(turmas.map((t) => (t.id === turmaAtual.id ? { ...t, alunos: alunosAtualizados } : t)));
      setNovo({ nome: "", matricula: "", telefone: "", email: "" });
      setNovoAberto(false);
    } catch (err) {
      console.error(err);
      setErroSalvar("Não foi possível salvar o novo aluno. Tente novamente.");
    }
  }

  if (carregando) return <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#6B7686" }}><Loader2 size={18} className="spin" /> Carregando...</div>;

  if (!turmas.length) {
    return (
      <div style={{ border: "1.5px dashed #E4E8EE", borderRadius: 12, padding: 36, textAlign: "center", color: "#6B7686" }}>
        <Users size={22} style={{ marginBottom: 8, opacity: 0.5 }} />
        <p>Nenhuma turma importada ainda. Vá em "Importar" para começar.</p>
      </div>
    );
  }

  if (!turmaAtual) {
    return (
      <div style={{ border: "1.5px dashed #E4E8EE", borderRadius: 12, padding: 36, textAlign: "center", color: "#6B7686" }}>
        <Users size={22} style={{ marginBottom: 8, opacity: 0.5 }} />
        <p>Selecione uma turma na barra lateral.</p>
      </div>
    );
  }

  const horarios = Array.from({ length: turmaAtual.horariosPorDia || 4 }, (_, i) => i + 1);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14, marginBottom: 18 }}>
        <div>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: 20, margin: "0 0 4px" }}>{turmaAtual.curso}</h2>
          <p style={{ color: "#6B7686", fontSize: 12.5, margin: 0 }}>{turmaAtual.codigo} · {turmaAtual.turno} · {turmaAtual.horariosPorDia}h/dia · Carga horária {turmaAtual.cargaHoraria ?? "—"}h</p>
        </div>
        <input className="input" type="date" value={data} max={todayISO()} onChange={(e) => setData(e.target.value)} />
      </div>

      {erroSalvar && (
        <div style={{ background: "#FDEBEB", border: "1px solid #F3B9B9", borderRadius: 10, padding: "10px 14px", fontSize: 12.5, color: "#B42318", marginBottom: 16 }}>
          <AlertTriangle size={13} style={{ marginRight: 6, verticalAlign: "-2px" }} />{erroSalvar}
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <button className="btn btn-ghost" onClick={() => setNovoAberto((v) => !v)}><Users size={14} /> Incluir aluno</button>
      </div>

      {novoAberto && (
        <div style={{ background: "#F5F7FB", border: "1px solid #E4E8EE", borderRadius: 10, padding: 14, marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input className="input" placeholder="Nome completo *" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
          <input className="input" placeholder="Matrícula" style={{ width: 120 }} value={novo.matricula} onChange={(e) => setNovo({ ...novo, matricula: e.target.value })} />
          <input className="input" placeholder="Telefone" style={{ width: 140 }} value={novo.telefone} onChange={(e) => setNovo({ ...novo, telefone: e.target.value })} />
          <input className="input" placeholder="E-mail" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} />
          <button className="btn btn-primary" onClick={adicionarAluno}><Check size={14} /> Adicionar</button>
        </div>
      )}

      <div style={{ fontSize: 12, color: "#6B7686", marginBottom: 10 }}>F = Falta · A = Atraso (escolha o(s) horário(s) depois de marcar) · J = Falta justificada · clique no nome para ver o acompanhamento do aluno</div>

      {carregandoFreq ? (
        <div style={{ color: "#6B7686", fontSize: 13 }}>Carregando frequência...</div>
      ) : (
        <table className="tbl">
          <thead><tr><th>Aluno</th><th style={{ textAlign: "center" }}>Marcação</th><th style={{ textAlign: "right" }}>Situação</th></tr></thead>
          <tbody>
            {(turmaAtual.alunos || []).filter(isAlunoAtivo).map((a) => {
              const reg = registroDoDia[a.id] || {};
              const status = calcularStatus(turmaAtual, a.id, freqMap, todayISO());
              return (
                <Fragment key={a.id}>
                  <tr>
                    <td><span style={{ cursor: "pointer", color: "#4F46E5", fontWeight: 600 }} onClick={() => setFichaAberta(a)}>{a.nome}</span></td>
                    <td style={{ textAlign: "center" }}>
                      <div style={{ display: "inline-flex", gap: 4 }}>
                        {["F", "A", "J"].map((s) => (
                          <button key={s} onClick={() => marcar(a.id, s)} style={{
                            width: 30, height: 28, borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                            border: "1.5px solid #E4E8EE",
                            background: reg.status === s ? (s === "F" ? "#EF4444" : s === "A" ? "#F59E0B" : "#5B7FBF") : "#fff",
                            color: reg.status === s ? "#fff" : "#6B7686",
                          }}>{s}</button>
                        ))}
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}><span className="chip" style={{ background: TIER_COR[status.tier] }}>{status.label}</span></td>
                  </tr>
                  {reg.status === "A" && (
                    <tr>
                      <td colSpan={3} style={{ background: "#FFFBEB", borderBottom: "1px solid #E4E8EE", padding: "8px 14px" }}>
                        <span style={{ fontSize: 11.5, color: "#92400E", marginRight: 10 }}>Em qual(is) horário(s) houve atraso?</span>
                        <span style={{ display: "inline-flex", gap: 6 }}>
                          {horarios.map((h) => {
                            const marcado = (reg.horariosAtraso || []).includes(h);
                            return (
                              <button key={h} onClick={() => alternarHorarioAtraso(a.id, h)} style={{
                                padding: "3px 10px", borderRadius: 20, fontSize: 11.5, cursor: "pointer",
                                border: "1.5px solid " + (marcado ? "#F59E0B" : "#E4E8EE"),
                                background: marcado ? "#F59E0B" : "#fff",
                                color: marcado ? "#fff" : "#6B7686", fontWeight: marcado ? 700 : 400,
                              }}>{h}º horário</button>
                            );
                          })}
                        </span>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}

      {fichaAberta && <FichaAlunoModal turma={turmaAtual} aluno={fichaAberta} freqMap={freqMap} onClose={() => setFichaAberta(null)} />}
    </div>
  );
}

export default function ChamadaPage() {
  return (
    <Suspense fallback={<div style={{ color: "#6B7686" }}>Carregando...</div>}>
      <ChamadaConteudo />
    </Suspense>
  );
}
