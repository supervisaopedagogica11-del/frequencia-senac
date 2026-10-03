"use client";
import { useState } from "react";
import { UserPlus, Pencil, Trash2, Save, ShieldCheck, Link2 } from "lucide-react";
import { useData } from "../DataProvider";
import { Modal, Empty, Switch } from "../ui";
import { PERFIS, PERFIL_DESCRICAO } from "@/lib/constants";
import { emailValido, fmtDataHora } from "@/lib/engine";

function FormUsuario({ inicial, onClose }) {
  const { acoes, usuarios } = useData();
  const novo = !inicial;
  const [f, setF] = useState(inicial || { nome: "", email: "", perfil: "Supervisão", ativo: true, cargo: "" });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const duplicado = novo && usuarios.some((u) => u.id === f.email.trim().toLowerCase());
  const ok = f.nome.trim() && emailValido(f.email) && !duplicado;
  return (
    <Modal onClose={onClose} titulo={novo ? "Cadastrar usuário" : "Editar usuário"} subtitulo={novo ? "Depois de cadastrado, a pessoa entra em “Primeiro acesso” com este e-mail e cria a própria senha." : f.email}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={!ok} onClick={async () => { await acoes.salvarUsuario({ ...f, nome: f.nome.trim(), email: f.email.trim().toLowerCase() }, novo); onClose(); }}><Save size={14} /> Salvar</button></>}>
      <div className="grid-form">
        <label className="campo"><span>Nome *</span><input className="input" value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: Supervisão 1 — Maria" /></label>
        <label className="campo"><span>Cargo / função</span><input className="input" value={f.cargo || ""} onChange={(e) => set("cargo", e.target.value)} placeholder="Ex.: Supervisora pedagógica" /></label>
        <label className="campo" style={{ gridColumn: "1 / -1" }}><span>E-mail *</span><input className="input" type="email" disabled={!novo} value={f.email} onChange={(e) => set("email", e.target.value)} />{duplicado && <small style={{ color: "var(--vermelho)" }}>Já existe um usuário com este e-mail.</small>}</label>
        <label className="campo"><span>Perfil de acesso</span><select className="select" value={f.perfil} onChange={(e) => set("perfil", e.target.value)}>{PERFIS.map((p) => <option key={p}>{p}</option>)}</select><small>{PERFIL_DESCRICAO[f.perfil]}</small></label>
        <label className="campo"><span>Status</span><span className="row"><Switch checked={f.ativo !== false} onChange={(v) => set("ativo", v)} /> {f.ativo !== false ? "Ativo" : "Inativo (sem acesso)"}</span></label>
      </div>
    </Modal>
  );
}

export default function Usuarios({ embutido }) {
  const { usuarios, usuario, pode, acoes } = useData();
  const [edit, setEdit] = useState(null);
  const admin = pode("usuarios");
  return (
    <>
      <div className={embutido ? "row" : "page-header"} style={embutido ? { justifyContent: "space-between", marginBottom: 12 } : undefined}>
        {embutido ? <span className="small soft">Quem pode acessar o sistema e com qual perfil.</span> : <div><h2>Usuários/Equipe</h2><p>Quem pode acessar o sistema e com qual perfil</p></div>}
        {admin && <button className="btn btn-primary" onClick={() => setEdit("novo")}><UserPlus size={14} /> Cadastrar usuário</button>}
      </div>
      {!admin && <div className="aviso info" style={{ marginBottom: 14 }}><ShieldCheck size={14} /> Apenas administradores podem cadastrar ou alterar usuários.</div>}
      {!usuarios.length ? <Empty>Nenhum usuário.</Empty> : (
        <div className="tabela-wrap">
          <table className="tabela responsiva">
            <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th>Vínculo</th><th></th></tr></thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td className="principal"><div><strong>{u.nome}</strong>{u.id === usuario?.email?.toLowerCase() && <span className="chip" style={{ background: "var(--primary)", marginLeft: 6 }}>você</span>}{u.cargo && <div className="small soft">{u.cargo}</div>}</div></td>
                  <td data-label="E-mail" className="small">{u.email}</td>
                  <td data-label="Perfil" title={PERFIL_DESCRICAO[u.perfil]}>{u.perfil}</td>
                  <td data-label="Status">{u.ativo !== false ? <span className="chip" style={{ background: "var(--verde)" }}>Ativo</span> : <span className="chip" style={{ background: "#9CA3AF" }}>Inativo</span>}</td>
                  <td data-label="Vínculo" className="small">{u.uid ? <span title={fmtDataHora(u.vinculadoEm)}><Link2 size={12} /> vinculado</span> : <span className="soft">aguardando primeiro acesso</span>}</td>
                  <td className="num">{admin && <div className="row" style={{ gap: 4, justifyContent: "flex-end" }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEdit(u)}><Pencil size={12} /> Editar</button>
                    <button className="btn btn-perigo-ghost btn-sm btn-icon" title="Remover" onClick={() => acoes.excluirUsuario(u)}><Trash2 size={12} /></button>
                  </div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="aviso info" style={{ marginTop: 16 }}>
        <div><strong>Como a pessoa vincula o e-mail:</strong> após o cadastro aqui, ela abre o sistema, escolhe <em>Primeiro acesso</em>, informa o mesmo e-mail e cria a senha. Esqueceu a senha? Use <em>Esqueci a senha</em> na tela de login.</div>
      </div>
      {edit && <FormUsuario inicial={edit === "novo" ? null : edit} onClose={() => setEdit(null)} />}
    </>
  );
}
