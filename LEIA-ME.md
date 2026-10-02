# Sistema de Frequência — Senac Três Corações

Este é o código completo do sistema, já pronto para virar um site de verdade,
com banco de dados no Firebase e login para a Supervisão Pedagógica.

Siga os passos NA ORDEM. Cada um leva poucos minutos.

---

## Parte 1 — Configurar o Firebase (banco de dados + login)

1. Acesse https://console.firebase.google.com e entre com sua conta Google (a mesma que você já usa).
2. Clique em **"Adicionar projeto"**, dê um nome (ex: `senac-frequencia`) e siga os passos padrão (pode desativar o Google Analytics, não é necessário).
3. Dentro do projeto, no menu lateral esquerdo, clique em **Compilação (Build) → Firestore Database**.
   - Clique em **"Criar banco de dados"**.
   - Escolha a localização **`southamerica-east1` (São Paulo)**, se disponível — deixa tudo mais rápido pra vocês.
   - Inicie em **modo de produção**.
4. Ainda no menu lateral, vá em **Compilação → Authentication**.
   - Clique em **"Vamos começar"**.
   - Na lista de provedores, ative **"E-mail/senha"**.
5. Ainda em Authentication, vá na aba **"Users"** e clique em **"Add user"** para criar o primeiro login da Supervisão Pedagógica (o e-mail e senha que você vai usar para entrar no sistema). Repita para cada pessoa da equipe que for usar.
6. Agora vá em **Configurações do projeto** (ícone de engrenagem, no topo do menu lateral) → aba **Geral** → role até **"Seus aplicativos"** → clique no ícone `</>` (Web) para registrar um app.
   - Dê um nome (ex: `senac-frequencia-web`) e clique em registrar.
   - Ele vai mostrar um bloco de código com `firebaseConfig = { apiKey: "...", ... }`. **Guarde essa tela aberta**, você vai precisar desses valores daqui a pouco.
7. Por fim, aplique as regras de segurança: vá em **Firestore Database → Regras**, apague o conteúdo e cole o conteúdo do arquivo `firestore.rules` que está junto com este projeto. Clique em **"Publicar"**.
   - Isso garante que só quem tem login (criado por você no passo 5) consegue ver ou alterar os dados dos alunos.

## Parte 2 — Colocar o código no GitHub (sem usar linha de comando)

O GitHub é só um lugar para guardar o código na internet, de onde a Vercel publica o site automaticamente.

1. Acesse https://github.com e crie uma conta gratuita (se ainda não tiver).
2. Clique no **"+"** no canto superior direito → **"New repository"**.
3. Dê um nome, por exemplo `senac-frequencia`. Deixe como **Private** (privado). Clique em **"Create repository"**.
4. Na página do repositório recém-criado, clique no link **"uploading an existing file"** (ou vá em **Add file → Upload files**).
5. Arraste TODOS os arquivos e pastas deste projeto para a área de upload (a pasta inteira que você recebeu de mim).
   - Importante: **não** envie o arquivo `.env.local` se você chegar a criá-lo — ele tem senhas. Envie o `.env.local.example` normalmente, sem problema.
6. Role para baixo e clique em **"Commit changes"**. Pronto, o código está no GitHub.

## Parte 3 — Publicar na Vercel

1. Acesse https://vercel.com e entre com sua conta.
2. Clique em **"Add New" → "Project"**.
3. Escolha **"Import Git Repository"** e selecione o repositório `senac-frequencia` que você acabou de criar (a Vercel vai pedir para conectar com o GitHub na primeira vez — autorize).
4. Antes de clicar em "Deploy", abra a seção **"Environment Variables"** e adicione uma por uma, usando os valores que você guardou no Passo 6 da Parte 1:

   | Nome (copie exatamente) | Valor |
   |---|---|
   | `NEXT_PUBLIC_FIREBASE_API_KEY` | o `apiKey` do Firebase |
   | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | o `authDomain` |
   | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | o `projectId` |
   | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | o `storageBucket` |
   | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | o `messagingSenderId` |
   | `NEXT_PUBLIC_FIREBASE_APP_ID` | o `appId` |

5. Clique em **"Deploy"**. Em 1-2 minutos a Vercel te dá um link (algo como `senac-frequencia.vercel.app`) — esse é o site de vocês, no ar.
6. Entre com o e-mail/senha que você criou no Passo 5 da Parte 1.

## Sempre que eu te der um código atualizado

Quando eu fizer melhorias, vou te passar os arquivos novos/alterados. Para atualizar o site:
1. No GitHub, abra o arquivo que mudou → ícone de lápis (editar) → cole o novo conteúdo → Commit.
   - Ou: **Add file → Upload files** de novo, para vários arquivos de uma vez (o GitHub substitui os que já existem).
2. A Vercel detecta a mudança sozinha e publica a nova versão automaticamente, em 1-2 minutos. Você não precisa fazer nada na Vercel.

---

## O que já funciona nesta primeira versão

- Login (Supervisão Pedagógica)
- Importar planilha (mesmo formato do Senac)
- Chamada (falta/atraso/justificada, incluir aluno manualmente)
- Painel (indicadores e alunos que precisam de atenção)

## O que ainda falta portar (próxima etapa)

Agenda do dia, Gestão de Permanência, Contato com Alunos (ligação/e-mail/WhatsApp),
Ficha do Aluno, exportação em Excel/PDF, busca global. Tudo isso já existe e funciona
no protótipo (artefato) — é "só" trazer para cá. Me avise quando quiser que eu continue.
