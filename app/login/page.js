"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useAuth } from "../../lib/useAuth";

export default function LoginPage() {
  const user = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  useEffect(() => { if (user) router.replace("/painel"); }, [user, router]);

  async function entrar(e) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), senha);
      router.replace("/painel");
    } catch (err) {
      setErro("E-mail ou senha incorretos, ou este usuário ainda não foi criado no Firebase.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={entrar}>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: 20, margin: "0 0 4px", color: "#3730A3" }}>Senac Três Corações</h1>
        <p style={{ fontSize: 12.5, color: "#6B7686", margin: "0 0 22px" }}>Acesso da Supervisão Pedagógica</p>
        <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>E-mail</label>
        <input className="input" style={{ width: "100%", marginBottom: 14 }} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Senha</label>
        <input className="input" style={{ width: "100%", marginBottom: 18 }} type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
        {erro && <div style={{ color: "#EF4444", fontSize: 12.5, marginBottom: 14 }}>{erro}</div>}
        <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={carregando}>{carregando ? "Entrando..." : "Entrar"}</button>
        <p style={{ fontSize: 11.5, color: "#9CA3AF", marginTop: 16, lineHeight: 1.5 }}>
          Não tem uma conta ainda? Peça ao administrador para criar seu acesso no painel do Firebase (Authentication → Add user).
        </p>
      </form>
    </div>
  );
}
