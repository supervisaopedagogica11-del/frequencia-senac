// Criação de login para a equipe pelo próprio administrador (sem sair da conta dele)
// e envio de link para a pessoa criar/redefinir a senha.
import { initializeApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from "firebase/auth";
import { auth, firebaseConfig } from "./firebase";

export const MSG_AUTH = {
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/wrong-password": "E-mail ou senha incorretos.",
  "auth/user-not-found": "Este e-mail ainda não tem senha criada.",
  "auth/email-already-in-use": "Este e-mail já tem senha criada.",
  "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
  "auth/invalid-email": "E-mail inválido.",
  "auth/missing-password": "Digite a senha.",
  "auth/too-many-requests": "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.",
  "auth/user-disabled": "Este login foi desativado no Firebase.",
  "auth/network-request-failed": "Sem conexão com a internet. Verifique a rede e tente de novo.",
  "auth/operation-not-allowed": "O login por e-mail e senha está desativado no Firebase (Authentication → Sign-in method → E-mail/senha).",
  "auth/admin-restricted-operation": "O Firebase está bloqueando a criação de novas contas. No Firebase: Authentication → Configurações → Ações do usuário → marque “Ativar criação (inscrição)”.",
};
export const msgAuth = (e) => MSG_AUTH[e?.code] || `${e?.message || "Erro desconhecido"}${e?.code ? ` (${e.code})` : ""}`;

function authSecundario() {
  const app = getApps().find((a) => a.name === "cadastro-equipe") || initializeApp(firebaseConfig, "cadastro-equipe");
  return getAuth(app);
}

// cria o login (e-mail + senha inicial) — retorna { ok, jaExistia, erro }
export async function criarLogin(email, senha) {
  const a2 = authSecundario();
  try {
    await createUserWithEmailAndPassword(a2, email.trim().toLowerCase(), senha);
    await signOut(a2);
    return { ok: true };
  } catch (e) {
    if (e?.code === "auth/email-already-in-use") return { ok: true, jaExistia: true };
    return { ok: false, erro: msgAuth(e) };
  }
}

export async function enviarLinkSenha(email) {
  try { await sendPasswordResetEmail(auth, email.trim().toLowerCase()); return { ok: true }; }
  catch (e) { return { ok: false, erro: msgAuth(e) }; }
}
