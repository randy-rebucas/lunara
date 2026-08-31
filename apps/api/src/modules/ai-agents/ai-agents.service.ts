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
  PERSONAS,
  PersonaAudience,
} from './personas';
import { AiConversation, AiConversationDocument } from './schemas/ai-conversation.schema';
import { AiMessage, AiMessageDocument } from './schemas/ai-message.schema';
import { AiGuestUsage, AiGuestUsageDocument } from './schemas/ai-guest-usage.schema';
import { SendMessageDto } from './dto/send-message.dto';
import { EscalateDto, GuestEscalateDto } from './dto/escalate.dto';
import { sanitizeMessage } from './sanitize-message';
import { AiToolRegistry } from './tools/registry';
import { EmailService } from '../../common/email/email.service';
import { SupportService } from '../support/support.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';

const HISTORY_WINDOW = 20;
const MAX_TOKENS = 1024;
const MAX_TOOL_ROUNDS = 4;
const NO_ANSWER_FALLBACK =
  "I wasn't able to finish that lookup — try rephrasing, or ask a simpler question.";

// Memoized by API key so the shared platform key still reuses one client, while each partner's
// own key (see Branch.portalSettings.aiApiKey) gets its own.
const anthropicClients = new Map<string, Anthropic>();

function getAnthropicClientFor(apiKey: string): Anthropic {
  let client = anthropicClients.get(apiKey);
  if (!client) {
    client = new Anthropic({ apiKey });
    anthropicClients.set(apiKey, client);
  }
  return client;
}

/** Turns an Anthropic SDK error (or anything else thrown from the chat loop) into a message
 * that's safe and useful to show a partner/customer — never the raw SDK/HTTP error text, which
 * can be a JSON blob or expose internal detail. */
function describeAiError(err: unknown): string {
  if (err instanceof Anthropic.APIError) {
    // A 400 whose body says the *model* wasn't found/supported is a server-side config problem
    // (e.g. a stale/misspelled ANTHROPIC_MODEL), not something rephrasing the message can fix —
    // surface that distinctly so it doesn't get mistaken for a bad user request.
    const errorType = (err.error as { error?: { type?: string; message?: string } } | undefined)?.error;
    if (err.status === 400 && (errorType?.type === 'not_found_error' || /\bmodel\b/i.test(errorType?.message ?? ''))) {
      return "The AI assistant is misconfigured (unknown model) — please let support know.";
    }
    switch (err.status) {
      case 401:
        return "That AI API key isn't valid — double-check it under Settings and save it again.";
      case 403:
        return "That AI API key doesn't have permission for this request — check its plan/permissions.";
      case 429:
        return "The AI assistant is getting a lot of requests right now — please wait a moment and try again.";
      case 400:
        return "That request couldn't be processed — try rephrasing your message.";
      case 500:
      case 502:
      case 503:
      case 529:
        return 'The AI service is temporarily unavailable — please try again in a moment.';
      default:
        return "The AI assistant couldn't complete that request — please try again.";
    }
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return "Couldn't reach the AI service — please check your connection and try again.";
  }
  return "The AI assistant couldn't complete that request — please try again.";
}

@Injectable()
export class AiAgentsService {
  constructor(
    @InjectModel(AiConversation.name) private conversationModel: Model<AiConversationDocument>,
    @InjectModel(AiMessage.name) private messageModel: Model<AiMessageDocument>,
    @InjectModel(AiGuestUsage.name) private guestUsageModel: Model<AiGuestUsageDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Branch.name) private branchModel: Model<BranchDocument>,
    private toolRegistry: AiToolRegistry,
    private emailService: EmailService,
    private supportService: SupportService,
  ) {}

  /** Partners can configure their own Anthropic API key under Settings — use it if set, falling
   * back to the shared platform key. Only real UserRole.PARTNER accounts get this (not staff
   * logged into a partner's portal), matching who can actually see/edit that setting. */
  private async resolveApiKey(userId: string, role: UserRole): Promise<string | undefined> {
    if (role === UserRole.PARTNER) {
      const branch = await this.branchModel
        .findOne({ partnerUserId: new Types.ObjectId(userId) })
        .select('portalSettings.aiApiKey')
        .lean();
      const ownKey = branch?.portalSettings?.aiApiKey?.trim();
      if (ownKey) return ownKey;
    }
    return getAnthropicApiKey();
  }

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
      const apiKey = await this.resolveApiKey(userId, role);
      if (!apiKey) {
        throw new BadRequestException('AI agents are not configured — ANTHROPIC_API_KEY is missing');
      }
      const client = getAnthropicClientFor(apiKey);
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
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(describeAiError(err));
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

  /**
   * Logged-out chat: no persistence, no tools (nothing to scope them to), single Claude turn.
   * Only reachable for personas with 'guest' in their audience — enforced by isAudienceAllowed.
   */
  async sendGuestMessage(agentId: string, dto: SendMessageDto) {
    const persona = getPersona(agentId);
    if (!persona || !isAudienceAllowed(persona, 'guest')) {
      throw new NotFoundException('Unknown agent');
    }

    const message = sanitizeMessage(dto.message);
    if (!message) throw new BadRequestException('Message cannot be empty');

    const model = getAnthropicModel();
    let replyText: string;
    try {
      const apiKey = getAnthropicApiKey();
      if (!apiKey) {
        throw new BadRequestException('AI agents are not configured — ANTHROPIC_API_KEY is missing');
      }
      const client = getAnthropicClientFor(apiKey);
      const tools = this.toolRegistry.getGuestToolsForPersona(persona.id);
      const ctx = { userId: '', audience: 'guest' as const, personaId: persona.id };

      let turns: Anthropic.MessageParam[] = [{ role: 'user', content: message }];
      replyText = '';
      for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        const response = await client.messages.create({
          model,
          max_tokens: MAX_TOKENS,
          system: getSystemPrompt(persona, 'guest'),
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
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(describeAiError(err));
    }

    const today = new Date().toISOString().slice(0, 10);
    await this.guestUsageModel
      .updateOne({ agentId, date: today }, { $inc: { count: 1 } }, { upsert: true })
      .catch(() => undefined);

    return {
      success: true,
      data: {
        message: {
          id: new Types.ObjectId().toString(),
          role: 'assistant',
          content: replyText,
          createdAt: new Date().toISOString(),
        },
      },
    };
  }

  /**
   * "Talk to a human" hand-off for a signed-in customer — opens a real support ticket (so it's
   * tracked in /support and the admin queue) and always emails the fixed chat-escalation inbox,
   * regardless of the configurable admin-notification-email setting.
   */
  async escalateToHuman(userId: string, dto: EscalateDto) {
    const message = sanitizeMessage(dto.message);
    if (!message) throw new BadRequestException('Message cannot be empty');

    const user = await this.userModel.findById(userId).select('email');
    const ticketResult = await this.supportService.createGeneralTicket(userId, {
      subject: `Chat hand-off: ${message}`.slice(0, 100),
      description: `Escalated from the AI chat widget.\n\n${message}`,
    });

    await this.emailService.sendChatEscalation({
      fromEmail: user?.email ?? ticketResult.data.customerEmail ?? 'unknown@lunara.app',
      message,
      transcript: dto.transcript,
      ticketId: ticketResult.data._id,
    });

    return {
      success: true,
      data: { ticket: ticketResult.data },
      message: "We've let our support team know — they'll follow up by email.",
    };
  }

  /** "Talk to a human" hand-off for a logged-out visitor — no account to attach a ticket to, so
   * this just emails the fixed chat-escalation inbox with their contact details. */
  async escalateGuestToHuman(dto: GuestEscalateDto) {
    const message = sanitizeMessage(dto.message);
    if (!message) throw new BadRequestException('Message cannot be empty');

    await this.emailService.sendChatEscalation({
      fromName: dto.name,
      fromEmail: dto.email,
      message,
      transcript: dto.transcript,
    });

    return {
      success: true,
      data: null,
      message: "Thanks — we've emailed our support team and they'll get back to you.",
    };
  }

  /** Staff-facing usage stats: conversations/messages per persona, plus guest chat volume. */
  async getStats() {
    const [conversationCounts, messageCounts, guestUsage, totalConversations, totalMessages] =
      await Promise.all([
        this.conversationModel.aggregate([{ $group: { _id: '$agentId', count: { $sum: 1 } } }]),
        this.messageModel.aggregate([
          { $match: { role: 'user' } },
          {
            $lookup: {
              from: 'ai_conversations',
              localField: 'conversationId',
              foreignField: '_id',
              as: 'conversation',
            },
          },
          { $unwind: '$conversation' },
          { $group: { _id: '$conversation.agentId', count: { $sum: 1 } } },
        ]),
        this.guestUsageModel
          .find()
          .sort({ date: -1 })
          .limit(56) // ~4 weeks × up to 2 guest-enabled agents
          .lean(),
        this.conversationModel.countDocuments(),
        this.messageModel.countDocuments({ role: 'user' }),
      ]);

    const guestTotalByAgent = new Map<string, number>();
    for (const row of guestUsage) {
      guestTotalByAgent.set(row.agentId, (guestTotalByAgent.get(row.agentId) ?? 0) + row.count);
    }

    return {
      success: true,
      data: {
        totalConversations,
        totalMessages,
        totalGuestMessages: guestUsage.reduce((sum, r) => sum + r.count, 0),
        perPersona: PERSONAS.map((p) => ({
          agentId: p.id,
          name: p.name,
          conversations: conversationCounts.find((c) => c._id === p.id)?.count ?? 0,
          messages: messageCounts.find((c) => c._id === p.id)?.count ?? 0,
          guestMessages: guestTotalByAgent.get(p.id) ?? 0,
        })),
        guestUsageByDay: guestUsage
          .map((r) => ({ date: r.date, agentId: r.agentId, count: r.count }))
          .sort((a, b) => a.date.localeCompare(b.date)),
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
