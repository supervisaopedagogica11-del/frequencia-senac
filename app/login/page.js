"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { msgAuth } from "@/lib/acessos";
import { useData } from "@/components/DataProvider";
import { Loader2 } from "lucide-react";


export default function Login() {
  const { user, usuario, autorizado } = useData();
  const router = useRouter();
  const [modo, setModo] = useState("entrar"); // entrar | primeiro | esqueci
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [msg, setMsg] = useState(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => { if (user && autorizado) router.replace("/painel"); }, [user, autorizado, router]);

  async function enviar(e) {
    e.preventDefault();
    setMsg(null); setCarregando(true);
    try {
      if (modo === "entrar") {
        await signInWithEmailAndPassword(auth, email.trim(), senha);
      } else if (modo === "primeiro") {
        if (senha !== senha2) throw { code: "x", message: "As senhas não conferem." };
        await createUserWithEmailAndPassword(auth, email.trim(), senha);
        setMsg({ tipo: "ok", texto: "Senha criada! Entrando..." });
      } else {
        await sendPasswordResetEmail(auth, email.trim());
        setMsg({ tipo: "ok", texto: "Se este e-mail tiver login, enviamos um link para criar uma nova senha. Confira a caixa de entrada e o spam/lixo eletrônico." });
      }
    } catch (err) {
      let texto = err.code ? msgAuth(err) : err.message || "Não foi possível concluir.";
      if (modo === "entrar" && ["auth/invalid-credential", "auth/user-not-found", "auth/wrong-password"].includes(err.code)) texto += " Se ainda não criou sua senha, use “Primeiro acesso”. Se esqueceu, use “Esqueci a senha” ou peça ao administrador.";
      if (modo === "primeiro" && err.code === "auth/email-already-in-use") texto += " Use “Entrar” com a senha que você já tem, ou “Esqueci a senha”.";
      setMsg({ tipo: "erro", texto });
    } finally { setCarregando(false); }
  }

  const bloqueado = user && usuario && !autorizado;

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={enviar}>
        <h1>Senac Três Corações</h1>
        <p className="soft" style={{ fontSize: 13, margin: "0 0 22px" }}>Frequência e Permanência · Supervisão Pedagógica</p>

        {bloqueado ? (
          <>
            <div className="aviso erro" style={{ marginBottom: 16 }}>
              {usuario?.erro ? `Erro ao verificar acesso: ${usuario.erro}` : usuario?.ativo === false
                ? "Seu usuário está inativo. Fale com o administrador do sistema."
                : `O e-mail ${user.email} ainda não foi liberado. Peça ao administrador para cadastrá-lo em Usuários/Equipe.`}
            </div>
            <button type="button" className="btn btn-ghost" style={{ width: "100%" }} onClick={() => signOut(auth)}>Sair e usar outro e-mail</button>
          </>
        ) : (
          <>
            <div className="pills" style={{ marginBottom: 18 }}>
              {[["entrar", "Entrar"], ["primeiro", "Primeiro acesso"], ["esqueci", "Esqueci a senha"]].map(([k, l]) => (
                <button type="button" key={k} className={"pill" + (modo === k ? " on" : "")} onClick={() => { setModo(k); setMsg(null); }}>{l}</button>
              ))}
            </div>
            {modo === "primeiro" && <p className="small soft" style={{ marginTop: 0 }}>Use o e-mail cadastrado pelo administrador e crie sua senha. É assim que você vincula seu e-mail ao sistema.</p>}
            <label className="campo" style={{ marginBottom: 12 }}><span>E-mail</span>
              <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {modo !== "esqueci" && (
              <label className="campo" style={{ marginBottom: 12 }}><span>{modo === "primeiro" ? "Crie uma senha (mín. 6 caracteres)" : "Senha"}</span>
                <input className="input" type="password" autoComplete={modo === "primeiro" ? "new-password" : "current-password"} required value={senha} onChange={(e) => setSenha(e.target.value)} />
              </label>
            )}
            {modo === "primeiro" && (
              <label className="campo" style={{ marginBottom: 12 }}><span>Repita a senha</span>
                <input className="input" type="password" autoComplete="new-password" required value={senha2} onChange={(e) => setSenha2(e.target.value)} />
              </label>
            )}
            {msg && <div className={"aviso " + (msg.tipo === "erro" ? "erro" : "ok")} style={{ marginBottom: 12 }}>{msg.texto}</div>}
            <button className="btn btn-primary" style={{ width: "100%", marginTop: 6 }} disabled={carregando}>
              {carregando && <Loader2 size={15} className="spin" />}
              {modo === "entrar" ? "Entrar" : modo === "primeiro" ? "Criar senha e entrar" : "Enviar link de redefinição"}
            </button>
            {user && !usuario && <p className="small soft" style={{ textAlign: "center" }}><Loader2 size={12} className="spin" /> Verificando acesso...</p>}
          </>
        )}
      </form>
    </div>
  );
}
