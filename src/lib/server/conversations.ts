import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import type { ChatMessage } from "@/lib/ai/types";

interface ConversationRow {
  id: string;
  title: string;
  model_id: string;
  provider_id: string;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: string;
}

function toMessage(row: MessageRow): ChatMessage {
  return { role: row.role as ChatMessage["role"], content: row.content };
}

export const listConversations = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<ConversationRow[]> => {
    const sql = await getSql();
    const rows = await sql<
      ConversationRow
    >`select id, title, model_id, provider_id, created_at, updated_at from conversations where user_id = ${context.userId} order by updated_at desc`;
    return rows.map((r) => ({ ...r, created_at: String(r.created_at), updated_at: String(r.updated_at) }));
  });

export const createConversation = createServerFn({ method: "POST" })
  .validator((input: { title: string; model_id: string; provider_id: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<ConversationRow> => {
    const sql = await getSql();
    const id = crypto.randomUUID();
    const rows = await sql<
      ConversationRow
    >`insert into conversations (id, user_id, title, model_id, provider_id) values (${id}, ${context.userId}, ${data.title}, ${data.model_id}, ${data.provider_id}) returning id, title, model_id, provider_id, created_at, updated_at`;
    const row = rows[0];
    return {
      id: row.id,
      title: row.title,
      model_id: row.model_id,
      provider_id: row.provider_id,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    };
  });

export const getMessages = createServerFn({ method: "GET" })
  .validator((conversationId: string) => conversationId)
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<ChatMessage[]> => {
    const sql = await getSql();
    const conv = await sql`select id from conversations where id = ${data} and user_id = ${context.userId}`;
    if (conv.length === 0) return [];
    const rows = await sql<
      MessageRow
    >`select id, conversation_id, role, content, created_at from messages where conversation_id = ${data} and user_id = ${context.userId} order by created_at`;
    return rows.map(toMessage);
  });

export const replaceMessages = createServerFn({ method: "POST" })
  .validator((input: { conversationId: string; messages: ChatMessage[] }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const conv = await sql`select id from conversations where id = ${data.conversationId} and user_id = ${context.userId}`;
    if (conv.length === 0) return;
    await sql`delete from messages where conversation_id = ${data.conversationId} and user_id = ${context.userId}`;
    for (const m of data.messages) {
      await sql`insert into messages (id, conversation_id, user_id, role, content) values (${crypto.randomUUID()}, ${data.conversationId}, ${context.userId}, ${m.role}, ${m.content})`;
    }
    await sql`update conversations set updated_at = now(), title = case when title = 'New conversation' and ${data.messages.length} > 1 then left(${data.messages[1]?.content ?? ""}, 60) else title end where id = ${data.conversationId} and user_id = ${context.userId}`;
  });

export const renameConversation = createServerFn({ method: "POST" })
  .validator((input: { id: string; title: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`update conversations set title = ${data.title}, updated_at = now() where id = ${data.id} and user_id = ${context.userId}`;
  });

export const deleteConversation = createServerFn({ method: "POST" })
  .validator((id: string) => id)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`delete from conversations where id = ${data} and user_id = ${context.userId}`;
  });