"use client";
import { X } from "lucide-react";
import { FAIXA_COR, FAIXA_LABEL, STATUS_ALUNO_COR } from "@/lib/constants";

export function FaixaChip({ faixa, small }) {
  return <span className="chip" style={{ background: FAIXA_COR[faixa] || "#9CA3AF", fontSize: small ? 10 : undefined }}>{FAIXA_LABEL[faixa] || faixa}</span>;
}
export function StatusChip({ status }) {
  const c = STATUS_ALUNO_COR[status] || "#6B7280";
  return <span className="chip-out" style={{ color: c, borderColor: c }}>{status}</span>;
}
// frequência atual em destaque (cor = situação)
export function Pct({ r }) {
  if (!r || r.pct === null || r.pct === undefined) return <span className="soft">—</span>;
  return <strong className="mono" style={{ color: FAIXA_COR[r.faixa] }}>{String(r.pct).replace(".", ",")}%</strong>;
}
// horas de falta usadas x permitidas (barra enche até o limite de 25% da carga horária)
export function FaltasBar({ r, largura = 110 }) {
  if (!r || r.limiteHoras === null || r.limiteHoras === undefined) return <span className="soft">—</span>;
  const uso = Math.min(100, (r.horasFalta / (r.limiteHoras || 1)) * 100);
  const n = (v) => String(Math.round(v * 10) / 10).replace(".", ",");
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 3, minWidth: largura }} title={`${n(r.horasFalta)}h de falta · limite ${n(r.limiteHoras)}h (25% de ${r.cargaHoraria}h)`}>
      <span className="small"><strong>{n(r.horasFalta)}h</strong> <span className="soft">de {n(r.limiteHoras)}h</span></span>
      <span className="meter" style={{ width: largura }}><div style={{ width: `${uso}%`, background: FAIXA_COR[r.faixa] }} /></span>
    </span>
  );
}
export function Modal({ titulo, subtitulo, onClose, children, footer, grande, icone }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={"modal" + (grande ? " lg" : "")} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-header">
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 18, display: "flex", alignItems: "center", gap: 8 }}>{icone}{titulo}</h2>
            {subtitulo && <p>{subtitulo}</p>}
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Fechar"><X size={16} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
export function Kpi({ n, l, d, cor, onClick, destaque, icone }) {
  return (
    <div className={"card kpi" + (onClick ? " click" : "") + (destaque ? " kpi-destaque" : "")} style={{ borderLeftColor: cor }} onClick={onClick}>
      <div className="n" style={{ color: cor }}>{n}</div>
      <div className="l" style={{ display: "flex", alignItems: "center", gap: 5 }}>{icone}{l}</div>
      {d && <div className="d">{d}</div>}
    </div>
  );
}
export function Empty({ children, icone }) {
  return <div className="empty">{icone && <div style={{ marginBottom: 8, opacity: .55 }}>{icone}</div>}{children}</div>;
}
export function Switch({ checked, onChange, disabled }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  );
}
