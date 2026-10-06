"use client";
import { useState } from "react";
import { UserPlus, Pencil, Trash2, Save, ShieldCheck, Link2, KeyRound, Mail } from "lucide-react";
import { criarLogin, enviarLinkSenha } from "@/lib/acessos";
import { useData } from "../DataProvider";
import { Modal, Empty, Switch } from "../ui";
import { PERFIS, PERFIL_DESCRICAO } from "@/lib/constants";
import { emailValido, fmtDataHora } from "@/lib/engine";

function FormUsuario({ inicial, onClose }) {
  const { acoes, usuarios, toast } = useData();
  const novo = !inicial;
  const [f, setF] = useState(inicial || { nome: "", email: "", perfil: "Supervisão", ativo: true, cargo: "" });
  const [senha, setSenha] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const email = f.email.trim().toLowerCase();
  const duplicado = novo && usuarios.some((u) => u.id === email);
  const ok = f.nome.trim() && emailValido(email) && !duplicado && (!novo || senha.length >= 6);
  async function salvar() {
    setSalvando(true); setErro(null);
    let extra = {};
    if (novo) {
      const r = await criarLogin(email, senha);
      if (!r.ok) { setErro(r.erro); setSalvando(false); return; }
      extra = { loginCriado: true, loginJaExistia: !!r.jaExistia };
      if (r.jaExistia) toast("Este e-mail já tinha login: a pessoa entra com a senha que já usava (ou em “Esqueci a senha”).");
    }
    await acoes.salvarUsuario({ ...f, ...extra, nome: f.nome.trim(), email }, novo);
    setSalvando(false);
    onClose();
  }
  return (
    <Modal onClose={onClose} titulo={novo ? "Cadastrar usuário" : "Editar usuário"} subtitulo={novo ? "O acesso já fica pronto: a pessoa entra com este e-mail e a senha inicial." : f.email}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={!ok || salvando} onClick={salvar}><Save size={14} /> {salvando ? "Salvando..." : "Salvar"}</button></>}>
      <div className="grid-form">
        <label className="campo"><span>Nome *</span><input className="input" value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: Supervisão 1 — Maria" /></label>
        <label className="campo"><span>Cargo / função</span><input className="input" value={f.cargo || ""} onChange={(e) => set("cargo", e.target.value)} placeholder="Ex.: Supervisora pedagógica" /></label>
        <label className="campo" style={{ gridColumn: "1 / -1" }}><span>E-mail *</span><input className="input" type="email" disabled={!novo} value={f.email} onChange={(e) => set("email", e.target.value)} />{duplicado && <small style={{ color: "var(--vermelho)" }}>Já existe um usuário com este e-mail.</small>}</label>
        {novo && <label className="campo" style={{ gridColumn: "1 / -1" }}><span>Senha inicial * (mínimo 6 caracteres)</span><input className="input" type="text" autoComplete="off" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Ex.: Senac2026" /><small>Passe esta senha para a pessoa. Depois ela pode trocar em “Esqueci a senha”, na tela de login.</small></label>}
        <label className="campo"><span>Perfil de acesso</span><select className="select" value={f.perfil} onChange={(e) => set("perfil", e.target.value)}>{PERFIS.map((p) => <option key={p}>{p}</option>)}</select><small>{PERFIL_DESCRICAO[f.perfil]}</small></label>
        <label className="campo"><span>Status</span><span className="row"><Switch checked={f.ativo !== false} onChange={(v) => set("ativo", v)} /> {f.ativo !== false ? "Ativo" : "Inativo (sem acesso)"}</span></label>
      </div>
      {erro && <div className="aviso erro" style={{ marginTop: 12 }}>Não foi possível criar o login: {erro}</div>}
    </Modal>
  );
}

function AcessoUsuario({ u, onClose }) {
  const { toast, acoes } = useData();
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  async function criar() {
    setOcupado(true); setMsg(null);
    const r = await criarLogin(u.email, senha);
    setOcupado(false);
    if (!r.ok) return setMsg({ tipo: "erro", texto: r.erro });
    if (r.jaExistia) return setMsg({ tipo: "info", texto: "Este e-mail já tem login. Se a pessoa não lembra a senha, use “Enviar link para trocar a senha” abaixo." });
    await acoes.salvarUsuario({ ...u, loginCriado: true }, false);
    setMsg({ tipo: "ok", texto: `Login criado. ${u.nome} já pode entrar com ${u.email} e a senha “${senha}”.` });
  }
  async function link() {
    setOcupado(true); setMsg(null);
    const r = await enviarLinkSenha(u.email);
    setOcupado(false);
    setMsg(r.ok ? { tipo: "ok", texto: `Link enviado para ${u.email}. Peça para olhar também a caixa de spam/lixo eletrônico.` } : { tipo: "erro", texto: r.erro });
    if (r.ok) toast("Link enviado.");
  }
  return (
    <Modal onClose={onClose} icone={<KeyRound size={16} />} titulo="Acesso ao sistema" subtitulo={`${u.nome} · ${u.email}`}>
      <h4 style={{ marginBottom: 6 }}>1. Criar o login com uma senha inicial</h4>
      <p className="small soft" style={{ marginTop: 0 }}>Use quando a pessoa ainda não consegue entrar. Você define a senha e repassa para ela.</p>
      <div className="row">
        <input className="input grow" type="text" autoComplete="off" placeholder="Senha inicial (mínimo 6 caracteres)" value={senha} onChange={(e) => setSenha(e.target.value)} />
        <button className="btn btn-primary" disabled={senha.length < 6 || ocupado} onClick={criar}><KeyRound size={14} /> Criar login</button>
      </div>
      <h4 style={{ margin: "18px 0 6px" }}>2. Ou enviar link para a pessoa trocar a senha</h4>
      <p className="small soft" style={{ marginTop: 0 }}>Use quando o login já existe e a pessoa esqueceu a senha.</p>
      <button className="btn btn-ghost" disabled={ocupado} onClick={link}><Mail size={14} /> Enviar link para trocar a senha</button>
      {msg && <div className={"aviso " + (msg.tipo === "erro" ? "erro" : msg.tipo === "ok" ? "ok" : "info")} style={{ marginTop: 14 }}>{msg.texto}</div>}
    </Modal>
  );
}

export default function Usuarios({ embutido }) {
  const { usuarios, usuario, pode, acoes } = useData();
  const [edit, setEdit] = useState(null);
  const [acesso, setAcesso] = useState(null);
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
                  <td data-label="Vínculo" className="small">{u.uid ? <span title={fmtDataHora(u.vinculadoEm)}><Link2 size={12} /> vinculado</span> : <span className="soft">{u.loginCriado ? "login criado · ainda não entrou" : "sem login — clique em Acesso"}</span>}</td>
                  <td className="num">{admin && <div className="row" style={{ gap: 4, justifyContent: "flex-end" }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setAcesso(u)}><KeyRound size={12} /> Acesso</button>
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
        <div><strong>Como a pessoa entra:</strong> com o e-mail cadastrado aqui e a senha inicial que você definiu. Se alguém não consegue entrar, clique em <strong>Acesso</strong> ao lado do nome para criar o login ou enviar um link de troca de senha.</div>
      </div>
      {acesso && <AcessoUsuario u={acesso} onClose={() => setAcesso(null)} />}
      {edit && <FormUsuario inicial={edit === "novo" ? null : edit} onClose={() => setEdit(null)} />}
    </>
  );
}
