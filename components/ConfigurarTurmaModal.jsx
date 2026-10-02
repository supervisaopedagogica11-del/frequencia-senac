"use client";
import { useState } from "react";
import { X, ClipboardCheck, Trash2 } from "lucide-react";
import { salvarTurma, excluirTurmaDb } from "../lib/firestoreData";
import { todayISO } from "../lib/logic";

export default function ConfigurarTurmaModal({ turma, onClose, onSalvo, onExcluido }) {
  const [form, setForm] = useState({
    tipo: turma.tipo || "",
    horariosPorDia: turma.horariosPorDia || 4,
    cargaHoraria: turma.cargaHoraria || "",
    instrutor: turma.instrutor || "",
    periodoInicio: turma.periodoInicio || "",
    periodoFim: turma.periodoFim || "",
    periodoRealFim: turma.periodoRealFim || "",
  });
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  function update(campo, valor) { setForm({ ...form, [campo]: valor }); }

  async function salvar(patchExtra = {}) {
    setSalvando(true);
    setErro("");
    try {
      const atualizada = {
        ...turma,
        tipo: form.tipo || null,
        horariosPorDia: parseInt(form.horariosPorDia, 10) || 1,
        cargaHoraria: form.cargaHoraria ? parseInt(form.cargaHoraria, 10) : null,
        instrutor: form.instrutor,
        periodoInicio: form.periodoInicio || null,
        periodoFim: form.periodoFim || null,
        periodoRealFim: form.periodoRealFim || null,
        ...patchExtra,
      };
      await salvarTurma(atualizada);
      onSalvo(atualizada);
    } catch (err) {
      console.error(err);
      setErro("Não foi possível salvar as alterações. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  function marcarFinalizada() {
    const novaData = turma.periodoRealFim ? "" : todayISO();
    setForm({ ...form, periodoRealFim: novaData });
    salvar({ periodoRealFim: novaData || null });
  }

  async function excluir() {
    setSalvando(true);
    try {
      await excluirTurmaDb(turma.id);
      onExcluido(turma.id);
    } catch (err) {
      console.error(err);
      setErro("Não foi possível excluir a turma.");
      setSalvando(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: 18, margin: "0 0 4px" }}>{turma.curso}</h2>
            <p style={{ margin: 0, fontSize: 12, color: "#6B7686" }}>
              {turma.codigo || "sem código"} · {turma.turno} · {turma.horarioInicio || "—"}–{turma.horarioFim || "—"}
              {" "}<span className="chip" style={{ background: turma.periodoRealFim ? "#9CA3AF" : "#10B981" }}>{turma.periodoRealFim ? "Finalizada" : "Ativa"}</span>
            </p>
          </div>
          <button className="btn btn-ghost" onClick={onClose}><X size={14} /></button>
        </div>

        {erro && <div style={{ background: "#FDEBEB", border: "1px solid #F3B9B9", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, color: "#B42318", margin: "10px 0" }}>{erro}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
          <label style={{ fontSize: 12, color: "#6B7686" }}>Tipo da turma
            <select className="input" style={{ width: "100%", marginTop: 4 }} value={form.tipo} onChange={(e) => update("tipo", e.target.value)}>
              <option value="">Não definido</option>
              <option value="Tecnico">Técnico</option>
              <option value="FIC">FIC</option>
            </select>
          </label>
          <label style={{ fontSize: 12, color: "#6B7686" }}>Docente / Instrutor(a)
            <input className="input" style={{ width: "100%", marginTop: 4 }} value={form.instrutor} onChange={(e) => update("instrutor", e.target.value)} />
          </label>
          <label style={{ fontSize: 12, color: "#6B7686" }}>Carga horária diária (h/dia)
            <input className="input" type="number" min={1} max={12} style={{ width: "100%", marginTop: 4 }} value={form.horariosPorDia} onChange={(e) => update("horariosPorDia", e.target.value)} />
          </label>
          <label style={{ fontSize: 12, color: "#6B7686" }}>Carga horária total do curso (h)
            <input className="input" type="number" min={1} style={{ width: "100%", marginTop: 4 }} value={form.cargaHoraria} onChange={(e) => update("cargaHoraria", e.target.value)} />
          </label>
          <label style={{ fontSize: 12, color: "#6B7686" }}>Data de início do curso
            <input className="input" type="date" style={{ width: "100%", marginTop: 4 }} value={form.periodoInicio} onChange={(e) => update("periodoInicio", e.target.value)} />
          </label>
          <label style={{ fontSize: 12, color: "#6B7686" }}>Previsão de término
            <input className="input" type="date" style={{ width: "100%", marginTop: 4 }} value={form.periodoFim} onChange={(e) => update("periodoFim", e.target.value)} />
          </label>
          <label style={{ fontSize: 12, color: "#6B7686", gridColumn: "1 / -1" }}>Data real de encerramento da turma
            <input className="input" type="date" style={{ width: "100%", marginTop: 4 }} value={form.periodoRealFim} onChange={(e) => update("periodoRealFim", e.target.value)} />
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
          <button className="btn btn-primary" disabled={salvando} onClick={() => salvar()}>{salvando ? "Salvando..." : "Salvar alterações"}</button>
          <button className="btn btn-ghost" disabled={salvando} onClick={marcarFinalizada}>
            <ClipboardCheck size={14} />{turma.periodoRealFim ? "Reabrir turma" : "Marcar como finalizada hoje"}
          </button>
          <button className="btn btn-danger" style={{ marginLeft: "auto" }} onClick={() => setConfirmandoExclusao(true)}>
            <Trash2 size={14} /> Excluir turma
          </button>
        </div>

        {confirmandoExclusao && (
          <div style={{ marginTop: 16, background: "#FDEBEB", border: "1px solid #F3B9B9", borderRadius: 10, padding: 16 }}>
            <p style={{ fontSize: 13, margin: "0 0 12px", color: "#7A1F14" }}>
              Tem certeza? Isso apaga a turma, todos os alunos, a chamada e os contatos registrados dela. <strong>Não pode ser desfeito.</strong>
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setConfirmandoExclusao(false)}>Cancelar</button>
              <button className="btn" style={{ background: "#EF4444", color: "#fff" }} disabled={salvando} onClick={excluir}>Sim, excluir turma</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
