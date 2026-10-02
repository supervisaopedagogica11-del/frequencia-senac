"use client";
import { useEffect, useState } from "react";
import { Users, Loader2 } from "lucide-react";
import { listarTurmas, carregarFrequenciasDaTurma } from "../../lib/firestoreData";
import { calcularStatus, isAlunoAtivo, TIER_COR, todayISO } from "../../lib/logic";

export default function PainelPage() {
  const [carregando, setCarregando] = useState(true);
  const [grupos, setGrupos] = useState([]); // [{ turma, itens: [{aluno, status}] }]
  const [contagem, setContagem] = useState({ verde: 0, amarelo: 0, roxo: 0, vermelho: 0 });
  const [total, setTotal] = useState(0);

  useEffect(() => {
    (async () => {
      const turmas = await listarTurmas();
      const hoje = todayISO();
      const cont = { verde: 0, amarelo: 0, roxo: 0, vermelho: 0 };
      let totalAtivos = 0;
      const gruposCalc = [];

      for (const turma of turmas) {
        const freqMap = await carregarFrequenciasDaTurma(turma.id);
        const ativos = (turma.alunos || []).filter(isAlunoAtivo);
        const itens = ativos.map((aluno) => ({ aluno, status: calcularStatus(turma, aluno.id, freqMap, hoje) }));
        itens.forEach((it) => { cont[it.status.tier]++; totalAtivos++; });
        const emAtencao = itens.filter((it) => it.status.tier !== "verde").sort((a, b) => (a.status.pct ?? 999) - (b.status.pct ?? 999));
        if (emAtencao.length) gruposCalc.push({ turma, itens: emAtencao });
      }

      setContagem(cont);
      setTotal(totalAtivos);
      setGrupos(gruposCalc);
      setCarregando(false);
    })();
  }, []);

  if (carregando) {
    return <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#6B7686" }}><Loader2 size={18} className="spin" /> Carregando...</div>;
  }

  return (
    <div>
      <h2 style={{ fontFamily: "Georgia, serif", fontSize: 20, margin: "0 0 4px" }}>Painel de frequência</h2>
      <p style={{ color: "#6B7686", fontSize: 12.5, margin: "0 0 20px" }}>Visão geral por status de risco de evasão</p>

      <div className="cards-grid">
        <div className="card" style={{ borderLeftColor: "#4F46E5" }}><div style={{ fontSize: 26, fontWeight: 700 }}>{total}</div><div style={{ fontSize: 11.5, color: "#6B7686" }}>Alunos ativos monitorados</div></div>
        <div className="card" style={{ borderLeftColor: "#10B981" }}><div style={{ fontSize: 26, fontWeight: 700, color: "#10B981" }}>{contagem.verde}</div><div style={{ fontSize: 11.5, color: "#6B7686" }}>✅ Regular</div></div>
        <div className="card" style={{ borderLeftColor: "#F59E0B" }}><div style={{ fontSize: 26, fontWeight: 700, color: "#F59E0B" }}>{contagem.amarelo}</div><div style={{ fontSize: 11.5, color: "#6B7686" }}>📋 Monitorar</div></div>
        <div className="card" style={{ borderLeftColor: "#8B5CF6" }}><div style={{ fontSize: 26, fontWeight: 700, color: "#8B5CF6" }}>{contagem.roxo}</div><div style={{ fontSize: 11.5, color: "#6B7686" }}>👁 Acompanhar</div></div>
        <div className="card" style={{ borderLeftColor: "#EF4444" }}><div style={{ fontSize: 26, fontWeight: 700, color: "#EF4444" }}>{contagem.vermelho}</div><div style={{ fontSize: 11.5, color: "#6B7686" }}>⚠ Risco de evasão</div></div>
      </div>

      {!grupos.length ? (
        <div style={{ border: "1.5px dashed #E4E8EE", borderRadius: 12, padding: 36, textAlign: "center", color: "#6B7686" }}>
          <Users size={22} style={{ marginBottom: 8, opacity: 0.5 }} />
          <p>{total === 0 ? "Importe a listagem de alunos para começar." : "Nenhum aluno fora do status Regular. 🎉"}</p>
        </div>
      ) : grupos.map((g) => (
        <div key={g.turma.id} style={{ marginBottom: 22 }}>
          <div style={{ marginBottom: 8 }}>
            <strong style={{ fontSize: 13.5 }}>{g.turma.curso}</strong>
            <span style={{ color: "#6B7686", fontSize: 12, marginLeft: 8 }}>{g.turma.codigo || "sem código"} · {g.turma.turno}</span>
          </div>
          <table className="tbl">
            <thead><tr><th>Aluno</th><th>Contato</th><th style={{ textAlign: "right" }}>Frequência</th><th>Situação</th></tr></thead>
            <tbody>
              {g.itens.map((it, i) => (
                <tr key={i}>
                  <td>{it.aluno.nome}</td>
                  <td style={{ color: "#6B7686", fontSize: 12 }}>{it.aluno.telefone || "—"}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: TIER_COR[it.status.tier] }}>{it.status.pct ?? "—"}%</td>
                  <td><span className="chip" style={{ background: TIER_COR[it.status.tier] }}>{it.status.label}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
