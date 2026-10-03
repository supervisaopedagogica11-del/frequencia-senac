"use client";
import { useRef, useState } from "react";
import { Upload, Check, AlertTriangle, Loader2 } from "lucide-react";
import { useData } from "../DataProvider";
import { parsePlanilha } from "@/lib/importar";

export default function Importar() {
  const { acoes, pode } = useData();
  const ref = useRef(null);
  const [msg, setMsg] = useState(null);
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(false);

  async function arquivo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro(null); setMsg(null); setCarregando(true);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const nomes = wb.SheetNames.filter((n) => !/^(dashboard|acomp|instruç|instru)/i.test(n));
      const sheet = wb.Sheets[nomes.find((n) => /base/i.test(n)) || nomes[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      const blocks = parsePlanilha(rows);
      if (!blocks.length) throw new Error('Não reconheci o formato desta planilha (esperava um cabeçalho com "Curso:" e uma lista de alunos com Nome/Celular/E-mail).');
      const r = await acoes.importar(blocks);
      if (r) setMsg(`${r.novas.length} turma(s) nova(s), ${r.alteradas.length} turma(s) atualizada(s), ${r.novosAlunos} aluno(s) novo(s)${r.emailsAtualizados ? `, ${r.emailsAtualizados} e-mail(s) preenchido(s)` : ""}.`);
    } catch (err) { setErro(err.message || "Não foi possível ler o arquivo."); }
    setCarregando(false);
    e.target.value = "";
  }

  return (
    <>
      <div className="page-header"><div><h2>Importar planilha</h2><p>Aceita a “Listagem de Alunos para Livro” e a planilha de acompanhamento (aba BASE)</p></div></div>
      {!pode("importar") ? <div className="aviso info">Seu perfil não permite importar.</div> : (
        <div className="dropzone" onClick={() => ref.current?.click()}>
          {carregando ? <Loader2 size={24} className="spin" /> : <Upload size={24} style={{ opacity: .6 }} />}
          <p style={{ margin: "10px 0 0", fontWeight: 700 }}>Clique para escolher o arquivo .xlsx</p>
          <p className="small soft" style={{ margin: "6px 0 0" }}>Curso, turma, turno, horário, docente, carga horária e alunos (nome, matrícula, celular, e-mail) são lidos automaticamente.</p>
          <input ref={ref} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={arquivo} />
        </div>
      )}
      {erro && <div className="aviso erro" style={{ marginTop: 16 }}><AlertTriangle size={14} /> {erro}</div>}
      {msg && <div className="aviso ok" style={{ marginTop: 16 }}><Check size={14} /> {msg}</div>}
      <div className="card" style={{ marginTop: 20 }}>
        <h4 style={{ marginBottom: 8 }}>Como funciona</h4>
        <ul className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
          <li>Turmas são reconhecidas pelo <strong>código</strong>. Se a turma já existe, só os alunos novos são adicionados — ninguém é duplicado.</li>
          <li>E-mails e telefones que estavam vazios no cadastro são preenchidos com os da planilha.</li>
          <li>Depois de importar, clique na <strong>engrenagem ⚙</strong> da turma para conferir tipo (Técnico/FIC), carga horária diária e total, docente e datas.</li>
        </ul>
      </div>
    </>
  );
}
