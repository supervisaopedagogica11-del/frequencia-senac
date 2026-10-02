"use client";
import { X, User } from "lucide-react";
import { calcularStatus, calcularInteligencia, TIER_COR, todayISO } from "../lib/logic";

export default function FichaAlunoModal({ turma, aluno, freqMap, onClose }) {
  if (!aluno) return null;
  const status = calcularStatus(turma, aluno.id, freqMap, todayISO());
  const inteligencia = calcularInteligencia(turma, aluno.id, freqMap);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(17,17,32,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}
      onClick={onClose}
    >
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 480, maxHeight: "85vh", overflowY: "auto", padding: 24 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: 18, margin: "0 0 4px" }}>
              <User size={16} style={{ verticalAlign: "-2px", marginRight: 6 }} />{aluno.nome}
            </h2>
            <p style={{ margin: 0, fontSize: 12.5, color: "#6B7686" }}>{turma.curso} · {turma.codigo}</p>
          </div>
          <button className="btn btn-ghost" onClick={onClose}><X size={14} /></button>
        </div>

        <div style={{ fontSize: 13, lineHeight: 1.9, marginBottom: 18, background: "#F5F7FB", border: "1px solid #E4E8EE", borderRadius: 10, padding: "10px 14px" }}>
          <div><strong>Telefone:</strong> {aluno.telefone || "—"}</div>
          <div><strong>E-mail:</strong> {aluno.email || "—"}</div>
          <div><strong>Matrícula:</strong> {aluno.matricula || "—"}</div>
        </div>

        <div className="cards-grid" style={{ marginBottom: 0 }}>
          <div className="card" style={{ borderLeftColor: TIER_COR[status.tier] }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: TIER_COR[status.tier] }}>{status.pct ?? "—"}%</div>
            <div style={{ fontSize: 11.5, color: "#6B7686" }}>Frequência atual</div>
          </div>
          <div className="card"><div style={{ fontSize: 24, fontWeight: 700 }}>{status.faltas}</div><div style={{ fontSize: 11.5, color: "#6B7686" }}>Faltas</div></div>
          <div className="card"><div style={{ fontSize: 24, fontWeight: 700 }}>{status.atrasos}</div><div style={{ fontSize: 11.5, color: "#6B7686" }}>Atrasos</div></div>
          <div className="card" style={{ borderLeftColor: TIER_COR[status.tier] }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: TIER_COR[status.tier] }}>{status.label}</div>
            <div style={{ fontSize: 11.5, color: "#6B7686" }}>Situação</div>
          </div>
        </div>

        {inteligencia && (
          <div style={{ marginTop: 16, background: "#F5F7FF", border: "1px solid #E3DEFB", borderRadius: 10, padding: 14, fontSize: 12.5 }}>
            <strong style={{ fontSize: 12.5 }}>Cálculo inteligente</strong>
            {inteligencia.jaReprovado ? (
              <p style={{ margin: "8px 0 0" }}>Frequência já abaixo de 75% — pela fórmula acumulada, não há recuperação matemática possível neste ciclo.</p>
            ) : (
              <>
                <p style={{ margin: "8px 0 4px" }}>Ainda pode faltar até <strong>{Math.round(inteligencia.horasRestantesPermitidas * 10) / 10}h</strong> (~{inteligencia.faltasInteirasRestantes} dias) sem cair abaixo de 75%.</p>
                <p style={{ margin: 0 }}>Mantendo o ritmo atual, a frequência projetada ao final do curso é de <strong>{inteligencia.projecaoPct}%</strong>{inteligencia.projecaoPct < 75 ? " ⚠" : ""}.</p>
              </>
            )}
          </div>
        )}

        <p style={{ fontSize: 11.5, color: "#9CA3AF", marginTop: 16, lineHeight: 1.5 }}>
          Histórico de intervenções (ligação/e-mail/WhatsApp), Agenda do dia e Gestão de Permanência chegam na próxima etapa de implantação.
        </p>
      </div>
    </div>
  );
}
