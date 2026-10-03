# Frequência e Permanência — Senac Três Corações (versão 2.0)

Sistema da Supervisão Pedagógica para **prevenir a reprovação por faltas**, acompanhar a frequência
antes que ela chegue a 75%, controlar a evasão, registrar intervenções e automatizar comunicações.

Tecnologias: Next.js 14 · Firebase (Authentication + Firestore) · Vercel.
Os dados da versão anterior (turmas, frequências e contatos) continuam valendo — o formato foi mantido.

---

## Como o sistema funciona

**Regra de aprovação:** no mínimo **75% de frequência** na carga horária total do curso (vale para qualquer carga horária).
As faltas são contadas **em horas**:
- **Faltou** o dia → perde todas as horas do dia (ex.: 4h).
- Chegou atrasado ou saiu mais cedo → na chamada, clique nos **horários** em que o aluno não estava (cada horário = 1h).
- Frequência = (carga horária − horas de falta) ÷ carga horária. Limite de faltas = 25% da carga horária (ex.: 160h → 40h).
- O percentual é sempre arredondado **para baixo** (74,97% aparece como 74,9%, nunca como 75%).

**Menu:** Início · Pendências · Alunos · Relatórios · Turmas (Manhã / Tarde / Noite / Finalizadas) · Configurações.
**Dentro da turma:** Chamada · Alunos · Pendências · Resumo · ⚙️ Configurar (dados da turma, finalizar, excluir).

**Situação de frequência (3 cores):** OK · **Em risco** (já usou 60% das faltas permitidas, faltas seguidas ou ritmo de faltas alto) · **Abaixo de 75%**.

**Automático:** faltas seguidas (3 dias) ou entrada em risco → aluno vai para **Pendências** com “Necessita contato”;
e-mail automático opcional (uma vez por sequência de faltas).

## Passo a passo para publicar esta versão

### 1. Enviar o código (GitHub Desktop)
1. Abra o **GitHub Desktop** — ele vai mostrar a lista de arquivos alterados.
2. Embaixo, à esquerda, escreva um resumo (ex.: `Versão 2.0 – sistema completo`) e clique em **Commit to main**.
3. Clique em **Push origin** (no topo). A Vercel publica sozinha em 1–3 minutos.

Arquivos da versão 1 que **não são mais usados** e podem ser apagados da pasta (opcional — não atrapalham):
`lib/firestoreData.js`, `lib/logic.js`, `lib/useAuth.js`, `components/ConfigurarTurmaModal.jsx`, `components/FichaAlunoModal.jsx`.

### 2. Primeiro acesso e cadastro da equipe
1. Abra o site e entre com o seu login de sempre. **A primeira pessoa que entrar nesta versão vira Administradora** — faça isso você mesma.
2. Vá em **Usuários/Equipe → Cadastrar usuário** e cadastre cada pessoa (nome, e-mail, perfil).
   - Quem **já tinha login** (criado no Firebase) entra normalmente com a mesma senha depois de cadastrado aqui.
   - Quem **não tinha login** entra em **“Primeiro acesso”** com o e-mail cadastrado e cria a própria senha (isso vincula o e-mail ao sistema).
   - Esqueceu a senha? **“Esqueci a senha”** na tela de login.
3. Abra cada turma pela **engrenagem ⚙️** e confira tipo, carga horária diária e total, docente e datas.
4. Em **Alunos**, confira os e-mails dos alunos (o sistema avisa quem está sem e-mail).

### 3. Regras de segurança do banco (recomendado, depois do passo 2)
Firebase Console → **Firestore Database → Regras** → apague tudo, cole o conteúdo do arquivo `firestore.rules` → **Publicar**.
A partir daí, só quem está cadastrado e ativo em Usuários/Equipe acessa os dados, e cada perfil só faz o que pode.

### 4. E-mail automático (Outlook / Microsoft 365)
O envio é feito pelo servidor da Vercel. Escolha **uma** das opções e cadastre as variáveis em
**Vercel → projeto → Settings → Environment Variables** (marque Production, Preview e Development). Depois, em
**Deployments**, clique nos três pontinhos do último deploy → **Redeploy**.

**Opção A — Microsoft Graph (recomendada; pode precisar do TI do Senac)**
1. Acesse https://entra.microsoft.com → **Aplicativos → Registros de aplicativo → Novo registro** (nome: `Frequencia Senac`).
2. **Permissões de API → Adicionar → Microsoft Graph → Permissões de aplicativo → `Mail.Send`** → **Conceder consentimento do administrador**.
3. **Certificados e segredos → Novo segredo do cliente** → copie o **Valor**.
4. Cadastre na Vercel:

| Variável | Valor |
|---|---|
| `MS_TENANT_ID` | “ID do diretório (locatário)” |
| `MS_CLIENT_ID` | “ID do aplicativo (cliente)” |
| `MS_CLIENT_SECRET` | o valor do segredo |
| `EMAIL_REMETENTE` | a caixa que vai enviar, ex.: `supervisao@...` |

**Opção B — SMTP (mais simples, mas temporária)**
A Microsoft vai desligar por padrão o envio por SMTP com senha nas contas Microsoft 365 a partir do fim de dezembro de 2026.
Use apenas se a opção A não for possível agora.

| Variável | Valor |
|---|---|
| `SMTP_HOST` | `smtp.office365.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | o e-mail que envia |
| `SMTP_PASS` | a senha (ou senha de app) |
| `EMAIL_REMETENTE` | o mesmo e-mail |

5. No sistema: **Configurações → E-mail automático** → confira remetente, assunto e modelo → **Enviar teste** →
   ligue **“E-mail automático ao aluno”** → **Salvar configurações**.

---

## Para desenvolvedores
- `npm install` · `npm run dev` · `npm test` (testes do motor de cálculo em `tests/engine.test.js`)
- `MOCK_FIREBASE=1 npm run dev` roda a interface com um banco de testes em memória (pasta `tests/mock`), sem tocar no Firebase real.
- Coleções do Firestore: `turmas`, `frequencias`, `contatos` (formato da v1) + `alertas`, `emails`, `historico`, `usuarios`, `config`.
- Regras de cálculo: `lib/engine.js` · automações: `lib/automacao.js` · agenda: `lib/pendencias.js` · envio: `app/api/email/route.js`.
