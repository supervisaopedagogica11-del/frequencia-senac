"use client";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Hand } from "lucide-react";
import { useData } from "./DataProvider";
import { fmtDataHora } from "@/lib/engine";
import { CATEGORIAS_EVASAO, CATEGORIA_LABEL, CATEGORIA_COR, mesclarPalavras, classificarEvasao } from "@/lib/evasao";

// texto da origem da classificação
export function OrigemChip({ cls }) {
  if (cls.origem === "manual") return <span className="chip-out" style={{ color: "#4F46E5", borderColor: "#4F46E5" }} title={`Definida por ${cls.manual?.por || "—"} em ${fmtDataHora(cls.manual?.em)}`}><Hand size={10} /> Manual</span>;
  return <span className="chip-out" style={{ color: "#6B7280", borderColor: "#9CA3AF" }}>Automática</span>;
}

// bloco reutilizado na ficha do aluno e na lista do dashboard
export function ClassificacaoEvasao({ turma, aluno, compacto }) {
  const { contatos, cfg, pode, acoes } = useData();
  const contato = contatos[`${turma.id}|${aluno.id}`] || null;
  const palavras = useMemo(() => mesclarPalavras(cfg.evasaoPalavras), [cfg.evasaoPalavras]);
  const cls = classificarEvasao({ aluno, contato, palavras });
  const ed = pode("contatos");
  const [txt, setTxt] = useState(contato?.motivoEvasao || "");
  useEffect(() => { setTxt(contato?.motivoEvasao || ""); }, [contato?.motivoEvasao]);
  const detalhe = cls.origem === "manual"
    ? `Classificação manual (automática seria: ${CATEGORIA_LABEL[cls.automatica]})`
    : cls.semTexto ? "Nenhum motivo registrado — classificado como Outros"
    : cls.candidatas.length ? `Encontrado em “${cls.fonte}”: ${cls.termos.join(", ")}`
    : "Nenhuma palavra-chave reconhecida nos registros — classificado como Outros";
  return (
    <div className="evasao-box" style={{ borderLeftColor: CATEGORIA_COR[cls.categoria] }}>
      {!compacto && (
        <label className="campo" style={{ marginBottom: 10 }}><span>Motivo da evasão (texto livre)</span>
          <textarea className="input" style={{ minHeight: 54 }} disabled={!ed} value={txt} placeholder="Ex.: conseguiu emprego no horário da aula" onChange={(e) => setTxt(e.target.value)} onBlur={() => acoes.salvarMotivoEvasao(turma, aluno, txt.trim())} />
        </label>
      )}
      <div className="row" style={{ gap: 8, alignItems: "center" }}>
        <span className="cat-dot" style={{ background: CATEGORIA_COR[cls.categoria] }} />
        <strong style={{ fontSize: 13 }}>{CATEGORIA_LABEL[cls.categoria]}</strong>
        <OrigemChip cls={cls} />
        {cls.revisar && <span className="chip" style={{ background: "#B45309" }} title={`Citou: ${cls.candidatas.map((c) => CATEGORIA_LABEL[c]).join(", ")}`}><AlertTriangle size={10} /> Revisar</span>}
        {ed && (
          <select className="select" style={{ padding: "3px 8px", fontSize: 12, minHeight: 28, marginLeft: "auto" }} value={cls.origem === "manual" ? cls.categoria : ""}
            onChange={(e) => acoes.classificarEvasaoManual(turma, aluno, e.target.value || null, CATEGORIA_LABEL[e.target.value])}>
            <option value="">Automática ({CATEGORIA_LABEL[cls.automatica]})</option>
            {CATEGORIAS_EVASAO.map((c) => <option key={c.id} value={c.id}>Manual: {c.label}</option>)}
          </select>
        )}
      </div>
      <div className="small soft" style={{ marginTop: 4 }}>{detalhe}{cls.revisar && cls.origem !== "manual" ? ` · também citou ${cls.candidatas.filter((c) => c !== cls.categoria).map((c) => CATEGORIA_LABEL[c]).join(", ")}` : ""}</div>
    </div>
  );
}

