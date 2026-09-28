import { create } from "zustand";
import type { ChatMessage, ProviderId } from "@/lib/ai/types";
import { getProvider, loadSettings, saveSettings, type AiSettings } from "@/lib/ai";
import {
  createConversation,
  deleteConversation,
  getMessages,
  listConversations,
  renameConversation as renameConversationFn,
  replaceMessages,
} from "@/lib/server/conversations";

export interface ConversationSummary {
  id: string;
  title: string;
  model_id: string;
  provider_id: string;
  updated_at: string;
}

interface ChatStore {
  conversations: ConversationSummary[];
  activeId: string | null;
  messages: ChatMessage[];
  streaming: boolean;
  streamError: string | null;
  settings: AiSettings;
  ready: boolean;
  /** True while an ephemeral (incognito) session is active — never persisted. */
  ephemeral: boolean;

  refreshConversations: () => Promise<void>;
  openConversation: (id: string) => Promise<void>;
  newConversation: () => Promise<void>;
  /** New session that skips persistence entirely (incognito). */
  newEphemeralConversation: () => Promise<void>;
  /** Duplicate a conversation's messages into a brand-new session. */
  forkConversation: (id: string) => Promise<void>;
  send: (text: string) => Promise<void>;
  regenerate: () => Promise<void>;
  stop: () => void;
  removeConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  updateSettings: (partial: Partial<AiSettings>) => void;
}

let abortController: AbortController | null = null;

function abortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

export const useChatStore = create<ChatStore>((set, get) => ({
  conversations: [],
  activeId: null,
  messages: [],
  streaming: false,
  streamError: null,
  settings: loadSettings(),
  ready: false,
  ephemeral: false,

  refreshConversations: async () => {
    try {
      const list = await listConversations();
      set({ conversations: list, ready: true });
    } catch {
      set({ ready: true });
    }
  },

  openConversation: async (id) => {
    if (get().streaming) get().stop();
    try {
      const msgs = await getMessages({ data: id });
      set({ activeId: id, messages: msgs, streamError: null, ephemeral: false });
    } catch {
      set({ activeId: id, messages: [], streamError: null, ephemeral: false });
    }
  },

  newConversation: async () => {
    if (get().streaming) get().stop();
    set({ activeId: null, messages: [], streamError: null, ephemeral: false });
  },

  newEphemeralConversation: async () => {
    if (get().streaming) get().stop();
    set({ activeId: null, messages: [], streamError: null, ephemeral: true });
  },

  forkConversation: async (id) => {
    if (get().streaming) get().stop();
    let source = get().messages;
    if (get().activeId !== id) {
      try {
        source = await getMessages({ data: id });
      } catch {
        return;
      }
    }
    const original = get().conversations.find((c) => c.id === id);
    try {
      const conv = await createConversation({
        data: {
          title: `Fork of ${original?.title ?? "session"}`,
          model_id: get().settings.modelId,
          provider_id: get().settings.providerId,
        },
      });
      await replaceMessages({ data: { conversationId: conv.id, messages: source } });
      set((s) => ({
        activeId: conv.id,
        messages: source,
        ephemeral: false,
        streamError: null,
        conversations: [conv, ...s.conversations.filter((c) => c.id !== conv.id)],
      }));
      await get().refreshConversations();
    } catch {
      set({ streamError: "Could not fork session — please sign in." });
    }
  },

  send: async (text) => {
    const trimmed = text.trim();
    if (!trimmed || get().streaming) return;
    const { settings, messages, activeId, ephemeral } = get();

    let convId = activeId;
    if (!convId && !ephemeral) {
      try {
        const conv = await createConversation({
          data: {
            title: "New conversation",
            model_id: settings.modelId,
            provider_id: settings.providerId,
          },
        });
        convId = conv.id;
        set((s) => ({
          activeId: conv.id,
          conversations: [conv, ...s.conversations.filter((c) => c.id !== conv.id)],
        }));
      } catch {
        set({ streamError: "Could not create conversation — please sign in." });
        return;
      }
    }

    const userMsg: ChatMessage = { role: "user", content: trimmed };
    const history = [...messages.filter((m) => m.role !== "system"), userMsg];
    const assistantPlaceholder: ChatMessage = { role: "assistant", content: "" };
    set({
      messages: [...history, assistantPlaceholder],
      streaming: true,
      streamError: null,
    });

    abortController = new AbortController();
    const provider = getProvider(settings.providerId);
    try {
      const result = await provider.chat(
        settings.modelId,
        history,
        (delta) => {
          set((s) => {
            const msgs = [...s.messages];
            const last = msgs[msgs.length - 1];
            if (last?.role === "assistant") msgs[msgs.length - 1] = { ...last, content: last.content + delta };
            return { messages: msgs };
          });
        },
        {
          signal: abortController.signal,
          maxTokens: 1024,
          contextLength: settings.contextLength,
          thinking: settings.thinking,
          onReasoning: (delta) => {
            set((s) => {
              const msgs = [...s.messages];
              const last = msgs[msgs.length - 1];
              if (last?.role === "assistant") {
                msgs[msgs.length - 1] = {
                  ...last,
                  reasoning: (last.reasoning ?? "") + delta,
                };
              }
              return { messages: msgs };
            });
          },
        },
      );

      set((s) => {
        const msgs = [...s.messages];
        const last = msgs[msgs.length - 1];
        const finalText = result.text || "(empty response)";
        if (last?.role === "assistant") {
          msgs[msgs.length - 1] = { ...last, content: finalText };
        } else {
          msgs.push({ role: "assistant", content: finalText });
        }
        return { messages: msgs, streaming: false };
      });
      // The provider may have recovered from a missing/misconfigured model —
      // keep the composer's model button honest about what actually answered.
      if (result.model && result.model !== settings.modelId) {
        get().updateSettings({ modelId: result.model });
      }
    } catch (err) {
      if (abortError(err)) {
        set({ streaming: false });
      } else {
        const message = err instanceof Error ? err.message : "Generation failed";
        set((s) => ({
          streaming: false,
          streamError: message,
          messages: [
            ...s.messages.slice(0, -1),
            { role: "assistant", content: `⚠️ ${message}` },
          ],
        }));
      }
    } finally {
      abortController = null;
      // Persist whatever we have, keyed to the real conversation —
      // ephemeral (incognito) sessions are never written to the server.
      const persistId = get().activeId ?? convId;
      if (!get().ephemeral && persistId) {
        void replaceMessages({
          data: {
            conversationId: persistId,
            messages: get().messages.filter((m) => m.content),
          },
        })
          .then(() => get().refreshConversations())
          .catch(() => undefined);
      }
    }
  },

  regenerate: async () => {
    const { messages, streaming } = get();
    if (streaming) return;
    const trimmed = [...messages];
    while (trimmed.length && trimmed[trimmed.length - 1].role !== "user") trimmed.pop();
    const lastUser = trimmed[trimmed.length - 1];
    if (!lastUser) return;
    set({ messages: trimmed });
    await get().send(lastUser.content);
  },

  stop: () => {
    abortController?.abort();
    set({ streaming: false });
  },

  removeConversation: async (id) => {
    try {
      await deleteConversation({ data: id });
    } catch {
      /* ignore */
    }
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== id),
      activeId: s.activeId === id ? null : s.activeId,
      messages: s.activeId === id ? [] : s.messages,
    }));
  },

  renameConversation: async (id, title) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, title: trimmed, updated_at: new Date().toISOString() } : c,
      ),
    }));
    try {
      await renameConversationFn({ data: { id, title: trimmed } });
    } catch {
      /* keep the optimistic title */
    }
  },

  updateSettings: (partial) => {
    const next = { ...get().settings, ...partial };
    saveSettings(next);
    set({ settings: next });
  },
}));

/** Convenience used by the model picker — set both at once. */
export function useSetActiveModel() {
  return (modelId: string, providerId: ProviderId) =>
    useChatStore.getState().updateSettings({ modelId, providerId });
}