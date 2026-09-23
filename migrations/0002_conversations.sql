-- GrokShell AI — app schema (per-user conversations, messages, settings).
--
-- user_id columns are TEXT (not UUID): the PGLite preview dev user id is the
-- string 'dev-user'; production uses Better Auth's text ids. Every server
-- function scopes reads/writes to context.userId from authMiddleware.

create table if not exists conversations (
  id            text primary key,
  user_id       text not null,
  title         text not null default 'New conversation',
  model_id      text not null,
  provider_id   text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists conversations_user_id_idx on conversations (user_id, updated_at desc);

create table if not exists messages (
  id              text primary key,
  conversation_id text not null references conversations (id) on delete cascade,
  user_id         text not null,
  role            text not null check (role in ('user', 'assistant', 'system')),
  content         text not null,
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_idx on messages (conversation_id, created_at);

create table if not exists user_settings (
  user_id     text primary key,
  provider_id text not null default 'ollama',
  model_id    text not null default 'llama3.2:3b',
  base_url    text,
  context_len integer not null default 8192,
  updated_at  timestamptz not null default now()
);