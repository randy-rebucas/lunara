import type {
  AiAgentPersona,
  AiChatMessage,
  AiConversationSummary,
  AiPromptLibraryGroup,
} from '@lunara/types';
import { partnerFetch } from './partner-api';

export function listAgents(): Promise<AiAgentPersona[]> {
  return partnerFetch<AiAgentPersona[]>('/ai-agents');
}

export function getPromptLibrary(agentId: string): Promise<AiPromptLibraryGroup[]> {
  return partnerFetch<AiPromptLibraryGroup[]>(`/ai-agents/${agentId}/prompt-library`);
}

export function listConversations(agentId: string): Promise<AiConversationSummary[]> {
  return partnerFetch<AiConversationSummary[]>(`/ai-agents/${agentId}/conversations`);
}

export function getMessages(conversationId: string): Promise<AiChatMessage[]> {
  return partnerFetch<AiChatMessage[]>(`/ai-agents/conversations/${conversationId}/messages`);
}

export function sendMessage(
  agentId: string,
  message: string,
  conversationId?: string,
): Promise<{ conversationId: string; message: AiChatMessage }> {
  return partnerFetch(`/ai-agents/${agentId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message, conversationId }),
  });
}
