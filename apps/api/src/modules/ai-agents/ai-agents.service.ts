import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import Anthropic from '@anthropic-ai/sdk';
import { Model, Types } from 'mongoose';
import { UserRole } from '@lunara/types';
import { getAnthropicApiKey, getAnthropicModel } from '../../common/config/ai-config';
import {
  getPersona,
  getPromptLibrary,
  getSystemPrompt,
  isAudienceAllowed,
  listPersonaSummaries,
  PersonaAudience,
} from './personas';
import { AiConversation, AiConversationDocument } from './schemas/ai-conversation.schema';
import { AiMessage, AiMessageDocument } from './schemas/ai-message.schema';
import { SendMessageDto } from './dto/send-message.dto';
import { sanitizeMessage } from './sanitize-message';
import { AiToolRegistry } from './tools/registry';

const HISTORY_WINDOW = 20;
const MAX_TOKENS = 1024;
const MAX_TOOL_ROUNDS = 4;
const NO_ANSWER_FALLBACK =
  "I wasn't able to finish that lookup — try rephrasing, or ask a simpler question.";

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    throw new BadRequestException('AI agents are not configured — ANTHROPIC_API_KEY is missing');
  }
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

@Injectable()
export class AiAgentsService {
  constructor(
    @InjectModel(AiConversation.name) private conversationModel: Model<AiConversationDocument>,
    @InjectModel(AiMessage.name) private messageModel: Model<AiMessageDocument>,
    private toolRegistry: AiToolRegistry,
  ) {}

  listAgents(audience: PersonaAudience) {
    return { success: true, data: listPersonaSummaries(audience) };
  }

  getPromptLibrary(agentId: string, audience: PersonaAudience) {
    const library = getPromptLibrary(agentId, audience);
    if (!library) throw new NotFoundException('Unknown agent');
    return { success: true, data: library };
  }

  async listConversations(userId: string, agentId: string, audience: PersonaAudience) {
    const persona = getPersona(agentId);
    if (!persona || !isAudienceAllowed(persona, audience)) throw new NotFoundException('Unknown agent');

    const conversations = await this.conversationModel
      .find({ userId: new Types.ObjectId(userId), agentId })
      .sort({ updatedAt: -1 })
      .limit(50);
    return {
      success: true,
      data: conversations.map((c) => this.serializeConversation(c)),
    };
  }

  async getMessages(userId: string, conversationId: string, audience: PersonaAudience) {
    const conversation = await this.findOwnedConversation(userId, conversationId);
    const persona = getPersona(conversation.agentId);
    if (!persona || !isAudienceAllowed(persona, audience)) throw new NotFoundException('Conversation not found');

    const messages = await this.messageModel
      .find({ conversationId: conversation._id })
      .sort({ createdAt: 1 })
      .limit(200);
    return { success: true, data: messages.map((m) => this.serializeMessage(m)) };
  }

  async sendMessage(
    userId: string,
    agentId: string,
    dto: SendMessageDto,
    audience: PersonaAudience,
    role: UserRole,
  ) {
    const persona = getPersona(agentId);
    if (!persona) throw new NotFoundException('Unknown agent');
    if (!isAudienceAllowed(persona, audience)) {
      throw new ForbiddenException('This agent is not available to your account');
    }

    const message = sanitizeMessage(dto.message);
    if (!message) throw new BadRequestException('Message cannot be empty');

    const conversation = dto.conversationId
      ? await this.findOwnedConversation(userId, dto.conversationId, agentId)
      : await this.conversationModel.create({
          agentId,
          userId: new Types.ObjectId(userId),
          title: message.slice(0, 60),
        });

    const priorMessages = await this.messageModel
      .find({ conversationId: conversation._id })
      .sort({ createdAt: 1 })
      .limit(HISTORY_WINDOW);

    const userMessage = await this.messageModel.create({
      conversationId: conversation._id,
      role: 'user',
      content: message,
    });

    const model = getAnthropicModel();
    let replyText: string;
    try {
      const client = getAnthropicClient();
      const tools = this.toolRegistry.getToolsForPersona(persona.id);
      const ctx = { userId, role, audience, personaId: persona.id };

      let turns: Anthropic.MessageParam[] = [
        ...priorMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: 'user' as const, content: message },
      ];

      replyText = '';
      for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        const response = await client.messages.create({
          model,
          max_tokens: MAX_TOKENS,
          system: getSystemPrompt(persona, audience),
          tools: tools.length ? tools : undefined,
          messages: turns,
        });

        if (response.stop_reason !== 'tool_use' || round === MAX_TOOL_ROUNDS) {
          const textBlock = response.content.find((b) => b.type === 'text');
          replyText = textBlock && textBlock.type === 'text' ? textBlock.text : '';
          break;
        }

        turns = [...turns, { role: 'assistant', content: response.content }];

        const toolUseBlocks = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
        );
        const toolResults = await Promise.all(
          toolUseBlocks.map(async (block) => {
            try {
              const result = await this.toolRegistry.execute(block.name, block.input, ctx);
              return {
                type: 'tool_result' as const,
                tool_use_id: block.id,
                content: JSON.stringify(result ?? null),
              };
            } catch (err) {
              return {
                type: 'tool_result' as const,
                tool_use_id: block.id,
                content: JSON.stringify({
                  error: err instanceof Error ? err.message : 'Tool execution failed',
                }),
                is_error: true,
              };
            }
          }),
        );
        turns = [...turns, { role: 'user', content: toolResults }];
      }

      if (!replyText) replyText = NO_ANSWER_FALLBACK;
    } catch (err) {
      await this.messageModel.deleteOne({ _id: userMessage._id });
      throw new BadRequestException(
        err instanceof Error ? `AI request failed: ${err.message}` : 'AI request failed',
      );
    }

    const assistantMessage = await this.messageModel.create({
      conversationId: conversation._id,
      role: 'assistant',
      content: replyText,
      model,
    });

    conversation.updatedAt = new Date();
    await conversation.save();

    return {
      success: true,
      data: {
        conversationId: conversation._id.toString(),
        message: this.serializeMessage(assistantMessage),
      },
    };
  }

  private async findOwnedConversation(userId: string, conversationId: string, agentId?: string) {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.userId.toString() !== userId) {
      throw new NotFoundException('Conversation not found');
    }
    if (agentId && conversation.agentId !== agentId) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }

  private serializeConversation(c: AiConversationDocument) {
    return {
      id: c._id.toString(),
      agentId: c.agentId,
      title: c.title,
      updatedAt: c.updatedAt.toISOString(),
    };
  }

  private serializeMessage(m: AiMessageDocument) {
    return {
      id: m._id.toString(),
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    };
  }
}
