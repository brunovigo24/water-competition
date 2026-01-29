# Water Cup 💧 (MVP)

MVP web (Next.js + Supabase) para competir “quem bebe mais água na semana” com **ranking em tempo real** via Supabase Realtime.

## Stack

- Next.js 14 (App Router) + TypeScript + React
- TailwindCSS
- Supabase: Auth (email OTP), Postgres, Realtime (`postgres_changes`)

## 1) Configurar Supabase

Crie um projeto no Supabase e rode o SQL:

- (Auth) Em **Authentication → Providers**, habilite **Email** (OTP / Magic Link)
- Abra o **SQL Editor** no Supabase
- Cole e execute o arquivo `supabase/schema.sql`

Isso cria:

- tabelas: `users`, `groups`, `group_members`, `water_logs`
- RLS/policies
- view: `weekly_leaderboard` (ranking apenas da **semana atual, segunda→domingo**)
- Realtime habilitado para `water_logs`

Se o Realtime não estiver emitindo eventos:

- Vá em **Database → Replication**
- Garanta que a tabela `water_logs` está habilitada no publication `supabase_realtime`

## 2) Variáveis de ambiente

Crie `.env.local` na raiz:

```bash
cp .env.example .env.local
```

Preencha:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

(Opcional, só para seed)

- `SUPABASE_SERVICE_ROLE_KEY`

## 3) Rodar local

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## 4) Como usar

Na home:

- escolha seu **nome**
- crie um grupo (ex: “Time Produto”) **ou** entre com **código** / busca por nome

Na tela do grupo:

- botão grande **“Bebi água 💧”**
- informe os **ml**
- ranking atualiza **em tempo real** para todos conectados

## 5) Seed (ambiente de teste)

O seed cria:

- 1 grupo (“Time Produto”)
- 3 usuários (via Admin API)
- alguns `water_logs` na semana atual

Requer `SUPABASE_SERVICE_ROLE_KEY` no `.env.local`.

```bash
npm run seed
```

O script vai imprimir os emails/senhas criados (apenas para teste).

## 6) Deploy na Vercel

1. Suba o repo (GitHub/GitLab)
2. Importe na Vercel
3. Configure as env vars no projeto da Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

## Notas de MVP

- Auth é **por e-mail + código (OTP)** (sem senha). O “nome” é salvo em `public.users`.
- Realtime: o app assina inserts em `public.water_logs` e, a cada evento, **refaz a query** do ranking (simples e confiável).

