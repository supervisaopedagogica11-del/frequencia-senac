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
export function Pct({ r, limite = 75, mostrarBarra = true }) {
  if (!r || r.pct === null || r.pct === undefined) return <span className="soft">—</span>;
  const cor = FAIXA_COR[r.faixa];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
      {mostrarBarra && (
        <span className="meter" style={{ width: 70 }} title={`Limite mínimo: ${limite}%`}>
          <div style={{ width: `${Math.max(0, Math.min(100, r.pct))}%`, background: cor }} />
          <span className="marca" style={{ left: `${limite}%` }} />
        </span>
      )}
      <strong className="mono" style={{ color: cor }}>{String(r.pct).replace(".", ",")}%</strong>
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
export function DistribuicaoFaixas({ cont, total }) {
  const ordem = ["regular", "atencao", "risco", "critico", "abaixo"];
  const t = total || ordem.reduce((s, k) => s + (cont[k] || 0), 0);
  if (!t) return null;
  return (
    <div>
      <div className="barra" style={{ height: 12 }}>
        {ordem.map((k) => cont[k] ? <div key={k} title={`${FAIXA_LABEL[k]}: ${cont[k]}`} style={{ width: `${(cont[k] / t) * 100}%`, background: FAIXA_COR[k] }} /> : null)}
      </div>
      <div className="row" style={{ marginTop: 8, gap: 14 }}>
        {ordem.map((k) => (
          <span key={k} className="small" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: FAIXA_COR[k] }} />{FAIXA_LABEL[k]} <strong>{cont[k] || 0}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}
