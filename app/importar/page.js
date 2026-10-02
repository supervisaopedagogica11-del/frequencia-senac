"use client";
import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Upload, Check, AlertTriangle } from "lucide-react";
import { parsePlanilha, blockToTurma } from "../../lib/logic";
import { listarTurmas, salvarTurma } from "../../lib/firestoreData";

function uid() { return (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2); }

export default function ImportarPage() {
  const fileRef = useRef(null);
  const [msg, setMsg] = useState(null);
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(false);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro(null); setMsg(null); setCarregando(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "array" });
        const nomesAba = wb.SheetNames.filter((n) => !/^(dashboard|acomp|instruç|instru)/i.test(n));
        const sheet = wb.Sheets[nomesAba.find((n) => /base/i.test(n)) || nomesAba[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        const blocks = parsePlanilha(rows);
        if (!blocks.length) throw new Error('Não reconheci o formato desta planilha (esperava um cabeçalho com "Curso:" e uma lista de alunos com Nome/Celular/E-mail).');

        const turmasExistentes = await listarTurmas();
        let novasTurmas = 0, novosAlunos = 0;

        for (const b of blocks) {
          const nova = blockToTurma(b, uid());
          const existente = turmasExistentes.find((t) => (nova.codigo && t.codigo === nova.codigo) || (!nova.codigo && !t.codigo && t.curso === nova.curso && t.turno === nova.turno && t.periodoInicio === nova.periodoInicio));
          if (existente) {
            const alunosFinal = [...existente.alunos];
            nova.alunos.forEach((a) => {
              const dup = alunosFinal.find((x) => (a.matricula && x.matricula === a.matricula) || x.nome.toLowerCase() === a.nome.toLowerCase());
              if (!dup) { alunosFinal.push(a); novosAlunos++; }
            });
            await salvarTurma({ ...existente, alunos: alunosFinal, cargaHoraria: existente.cargaHoraria || nova.cargaHoraria });
          } else {
            await salvarTurma(nova);
            novasTurmas++;
            novosAlunos += nova.alunos.length;
          }
        }

        setMsg(`${novosAlunos} aluno(s) em ${novasTurmas} turma(s) nova(s) importada(s).`);
      } catch (err) {
        setErro(err.message || "Não foi possível ler o arquivo.");
      } finally {
        setCarregando(false);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  }

  return (
    <div>
      <h2 style={{ fontFamily: "Georgia, serif", fontSize: 20, margin: "0 0 4px" }}>Importar planilha</h2>
      <p style={{ color: "#6B7686", fontSize: 12.5, margin: "0 0 20px" }}>Aceita a "Listagem de Alunos para Livro" e a planilha de acompanhamento (aba BASE)</p>

      <div
        onClick={() => fileRef.current?.click()}
        style={{ border: "2px dashed #C7BFF5", borderRadius: 12, padding: 40, textAlign: "center", cursor: "pointer", background: "linear-gradient(160deg,#F8F7FF,#fff)" }}
      >
        <Upload size={22} style={{ marginBottom: 10, opacity: 0.6 }} />
        <p style={{ margin: 0, fontWeight: 600 }}>{carregando ? "Importando..." : "Clique para escolher o arquivo .xlsx"}</p>
        <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#6B7686" }}>Curso, turma, turno, horário, carga horária e alunos são lidos automaticamente.</p>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={handleFile} />
      </div>

      {erro && <div style={{ marginTop: 16, color: "#EF4444", fontSize: 13.5 }}><AlertTriangle size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />{erro}</div>}
      {msg && <div style={{ marginTop: 16, color: "#10B981", fontSize: 13.5 }}><Check size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />{msg}</div>}
    </div>
  );
}
