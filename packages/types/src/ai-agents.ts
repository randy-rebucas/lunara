export interface AiAgentPersona {
  id: string;
  name: string;
  role: string;
  tagline: string;
  suggestedPrompts: string[];
}

export interface AiPromptLibraryGroup {
  category: string;
  prompts: string[];
}

export interface AiConversationSummary {
  id: string;
  agentId: string;
  title?: string;
  updatedAt: string;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface AiPersonaStats {
  agentId: string;
  name: string;
  conversations: number;
  messages: number;
  guestMessages: number;
}

export interface AiGuestUsageDay {
  date: string;
  agentId: string;
  count: number;
}

export interface AiAgentsStats {
  totalConversations: number;
  totalMessages: number;
  totalGuestMessages: number;
  perPersona: AiPersonaStats[];
  guestUsageByDay: AiGuestUsageDay[];
}
