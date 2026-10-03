"use client";
import { useMemo, useState } from "react";
import { resumoAluno, datasRegistradas, fmtData, fmtDataCurta } from "@/lib/engine";

// Evolução da frequência média da turma ao longo das aulas registradas (série única + linha de referência do mínimo)
export default function EvolucaoChart({ turma, freq, cfg, alunosIds }) {
  const [hover, setHover] = useState(null);
  const pontos = useMemo(() => {
    const datas = datasRegistradas(turma.id, freq);
    if (datas.length < 2 || !turma.cargaHoraria) return [];
    const passo = Math.max(1, Math.ceil(datas.length / 60));
    const sel = datas.filter((_, i) => i % passo === 0 || i === datas.length - 1);
    return sel.map((d) => {
      const pcts = alunosIds.map((id) => resumoAluno(turma, id, freq, cfg, d).pct).filter((v) => v !== null);
      return { d, v: pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null };
    }).filter((p) => p.v !== null);
  }, [turma, freq, cfg, alunosIds]);
  if (pontos.length < 2) return <p className="small soft">A evolução aparece após duas ou mais chamadas registradas.</p>;
  const W = 640, H = 200, pl = 36, pr = 12, pt = 12, pb = 26;
  const minY = Math.min(cfg.limiteMinimo - 5, Math.floor(Math.min(...pontos.map((p) => p.v)) - 2));
  const x = (i) => pl + (i / (pontos.length - 1)) * (W - pl - pr);
  const y = (v) => pt + (1 - (v - minY) / (100 - minY)) * (H - pt - pb);
  const path = pontos.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const ticks = [minY, cfg.limiteMinimo, 100].filter((v, i, a) => a.indexOf(v) === i);
  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Evolução da frequência média da turma"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          const i = Math.round(((px - pl) / (W - pl - pr)) * (pontos.length - 1));
          setHover(Math.max(0, Math.min(pontos.length - 1, i)));
        }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} stroke={t === cfg.limiteMinimo ? "#991B1B" : "#E4E8EE"} strokeWidth={t === cfg.limiteMinimo ? 1.5 : 1} strokeDasharray={t === cfg.limiteMinimo ? "5 4" : ""} />
            <text x={pl - 6} y={y(t) + 3.5} fontSize="10" textAnchor="end" fill="#6B7686">{t}%</text>
          </g>
        ))}
        <text x={W - pr} y={y(cfg.limiteMinimo) - 5} fontSize="10" textAnchor="end" fill="#991B1B">mínimo {cfg.limiteMinimo}%</text>
        <path d={path} fill="none" stroke="#4F46E5" strokeWidth="2" strokeLinejoin="round" />
        <text x={pl} y={H - 6} fontSize="10" fill="#6B7686">{fmtDataCurta(pontos[0].d)}</text>
        <text x={W - pr} y={H - 6} fontSize="10" textAnchor="end" fill="#6B7686">{fmtDataCurta(pontos[pontos.length - 1].d)}</text>
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pt} y2={H - pb} stroke="#9CA3AF" strokeWidth="1" />
            <circle cx={x(hover)} cy={y(pontos[hover].v)} r="5" fill="#4F46E5" stroke="#fff" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div style={{ position: "absolute", top: 0, left: `${(x(hover) / W) * 100}%`, transform: "translateX(-50%)", background: "#1E2733", color: "#fff", fontSize: 11.5, padding: "4px 8px", borderRadius: 6, pointerEvents: "none", whiteSpace: "nowrap" }}>
          {fmtData(pontos[hover].d)} · média {pontos[hover].v.toFixed(1).replace(".", ",")}%
        </div>
      )}
    </div>
  );
}
