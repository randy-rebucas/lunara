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
