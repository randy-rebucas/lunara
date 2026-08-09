import type { createApiClient } from '@lunara/hooks';

export const CHAT_AGENT_ID = 'emma';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

type ApiClient = ReturnType<typeof createApiClient>;

interface SendMessageResult {
  conversationId?: string;
  message: ChatMessage;
}

/** Sends a chat message — authenticated customers get a persisted, multi-turn conversation; guests get a single stateless turn. */
export async function sendChatMessage(
  api: ApiClient,
  isAuthenticated: boolean,
  message: string,
  conversationId?: string,
): Promise<SendMessageResult> {
  const path = isAuthenticated
    ? `/ai-agents/${CHAT_AGENT_ID}/messages`
    : `/ai-agents/guest/${CHAT_AGENT_ID}/messages`;
  const res = await api.post<SendMessageResult>(path, { message, conversationId });
  return res.data;
}

interface PromptLibraryGroup {
  category: string;
  prompts: string[];
}

/** Pulls a handful of varied starter prompts (one per category) from the prompt library. */
export async function fetchSuggestedPrompts(
  api: ApiClient,
  isAuthenticated: boolean,
): Promise<string[]> {
  const path = isAuthenticated
    ? `/ai-agents/${CHAT_AGENT_ID}/prompt-library`
    : `/ai-agents/guest/${CHAT_AGENT_ID}/prompt-library`;
  try {
    const res = await api.get<PromptLibraryGroup[]>(path);
    return res.data
      .map((group) => group.prompts[0])
      .filter((prompt): prompt is string => Boolean(prompt))
      .slice(0, 4);
  } catch {
    return [];
  }
}

export interface EscalateParams {
  message: string;
  transcript?: string;
  name?: string;
  email?: string;
}

/** "Talk to a human" hand-off — creates a support ticket for signed-in customers, or just emails support for guests. */
export async function escalateToHuman(
  api: ApiClient,
  isAuthenticated: boolean,
  params: EscalateParams,
): Promise<string> {
  const path = isAuthenticated ? '/ai-agents/escalate' : '/ai-agents/guest/escalate';
  const res = await api.post<unknown>(path, params);
  return res.message ?? "We've let our support team know.";
}
