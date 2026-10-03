// Envio de e-mails do sistema (alertas automáticos e envios manuais).
// Provedores suportados (configure na Vercel → Settings → Environment Variables):
//   1) Microsoft 365 via Microsoft Graph (recomendado para contas Outlook institucionais):
//        MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, EMAIL_REMETENTE
//   2) SMTP (Outlook/Office 365, Gmail ou outro):
//        SMTP_USER, SMTP_PASS  [SMTP_HOST=smtp.office365.com] [SMTP_PORT=587] [EMAIL_REMETENTE]
import nodemailer from "nodemailer";
import { firebaseConfig } from "@/lib/firebase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function provedor() {
  const e = process.env;
  if (e.MS_TENANT_ID && e.MS_CLIENT_ID && e.MS_CLIENT_SECRET && e.EMAIL_REMETENTE) return "microsoft-graph";
  if (e.SMTP_USER && e.SMTP_PASS) return "smtp";
  return null;
}
const remetente = () => process.env.EMAIL_REMETENTE || process.env.SMTP_USER || "";

async function verificarUsuario(req) {
  const h = req.headers.get("authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return null;
  if (process.env.MOCK_FIREBASE === "1" && token === "mock-token") return "teste@local"; // apenas testes locais
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: token }),
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j.users?.[0]?.email || null;
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function textoParaHtml(texto, instituicao) {
  const paragrafos = String(texto || "").split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  return `<div style="font-family:Montserrat,Arial,sans-serif;font-size:14px;line-height:1.6;color:#1E2733;max-width:600px">
    <div style="border-top:4px solid #4F46E5;padding-top:18px">${paragrafos}</div>
    <p style="font-size:11px;color:#8A93A8;margin-top:24px">${esc(instituicao || "")} — mensagem enviada pela Supervisão Pedagógica.</p></div>`;
}

async function enviarGraph({ para, assunto, texto, html, nomeRemetente, replyTo }) {
  const e = process.env;
  const tk = await fetch(`https://login.microsoftonline.com/${e.MS_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: e.MS_CLIENT_ID, client_secret: e.MS_CLIENT_SECRET, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
  });
  const tj = await tk.json();
  if (!tk.ok) throw new Error("Falha ao autenticar no Microsoft 365: " + (tj.error_description || tj.error || tk.status));
  const msg = {
    message: {
      subject: assunto,
      body: { contentType: "HTML", content: html },
      toRecipients: [{ emailAddress: { address: para } }],
      ...(replyTo ? { replyTo: [{ emailAddress: { address: replyTo } }] } : {}),
    },
    saveToSentItems: true,
  };
  const r = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(e.EMAIL_REMETENTE)}/sendMail`, {
    method: "POST", headers: { Authorization: `Bearer ${tj.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify(msg),
  });
  if (!r.ok) {
    let det = ""; try { det = (await r.json()).error?.message || ""; } catch {}
    throw new Error(`Microsoft 365 recusou o envio (${r.status}) ${det}`);
  }
  return { id: r.headers.get("request-id") || null };
}

async function enviarSmtp({ para, assunto, texto, html, nomeRemetente, replyTo }) {
  const e = process.env;
  const port = Number(e.SMTP_PORT || 587);
  const t = nodemailer.createTransport({
    host: e.SMTP_HOST || "smtp.office365.com",
    port,
    secure: port === 465,
    auth: { user: e.SMTP_USER, pass: e.SMTP_PASS },
    tls: { ciphers: "TLSv1.2" },
  });
  const info = await t.sendMail({
    from: nomeRemetente ? `"${nomeRemetente.replace(/"/g, "")}" <${remetente()}>` : remetente(),
    to: para, subject: assunto, text: texto, html, ...(replyTo ? { replyTo } : {}),
  });
  return { id: info.messageId || null };
}

export async function GET() {
  return Response.json({ configurado: !!provedor(), provedor: provedor(), remetente: remetente() || null });
}

export async function POST(req) {
  const usuario = await verificarUsuario(req);
  if (!usuario) return Response.json({ ok: false, erro: "Sessão inválida. Entre novamente no sistema." }, { status: 401 });
  const p = provedor();
  if (!p) return Response.json({ ok: false, erro: "O envio de e-mail ainda não foi configurado na Vercel (variáveis MS_* ou SMTP_*)." }, { status: 503 });
  let body;
  try { body = await req.json(); } catch { return Response.json({ ok: false, erro: "Requisição inválida." }, { status: 400 }); }
  const { para, assunto, texto, nomeRemetente, replyTo, instituicao } = body || {};
  if (!para || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(para)) return Response.json({ ok: false, erro: "E-mail do destinatário inválido." }, { status: 400 });
  if (!assunto || !texto) return Response.json({ ok: false, erro: "Assunto e mensagem são obrigatórios." }, { status: 400 });
  const html = textoParaHtml(texto, instituicao);
  try {
    const r = p === "microsoft-graph"
      ? await enviarGraph({ para, assunto, texto, html, nomeRemetente, replyTo })
      : await enviarSmtp({ para, assunto, texto, html, nomeRemetente, replyTo });
    return Response.json({ ok: true, provedor: p, remetente: remetente(), id: r.id, enviadoPor: usuario });
  } catch (err) {
    return Response.json({ ok: false, erro: err.message || "Falha no envio." }, { status: 502 });
  }
}
