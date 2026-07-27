import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@lunara/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AiAgentsService } from './ai-agents.service';
import { PersonaAudience } from './personas';
import { SendMessageDto } from './dto/send-message.dto';

// Each message is a billed Claude call — throttle tighter than the global 120/min default so a
// runaway client (or a user probing the chat with a script) can't rack up API spend.
const SEND_MESSAGE_THROTTLE = { default: { limit: 20, ttl: 60_000 } };

// Guests are unauthenticated (identified only by IP via the global throttler), so keep this
// noticeably tighter than the logged-in throttle to limit anonymous Claude spend/abuse.
const GUEST_MESSAGE_THROTTLE = { default: { limit: 8, ttl: 60_000 } };

function audienceFor(role: UserRole): PersonaAudience {
  return role === UserRole.CUSTOMER ? 'customer' : 'staff';
}

@Controller('ai-agents')
export class AiAgentsController {
  constructor(private readonly aiAgentsService: AiAgentsService) {}

  // Logged-out access — no guard. Deliberately narrow: only personas with 'guest' in their
  // audience (currently just Emma) respond here, and only with the general/basic prompt set —
  // enforced in personas.ts + AiAgentsService, not here.
  @Get('guest/:agentId/prompt-library')
  getGuestPromptLibrary(@Param('agentId') agentId: string) {
    return this.aiAgentsService.getPromptLibrary(agentId, 'guest');
  }

  @Post('guest/:agentId/messages')
  @Throttle(GUEST_MESSAGE_THROTTLE)
  sendGuestMessage(@Param('agentId') agentId: string, @Body() dto: SendMessageDto) {
    return this.aiAgentsService.sendGuestMessage(agentId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STAFF, UserRole.ADMIN, UserRole.CUSTOMER)
  listAgents(@Req() req: { user: { role: UserRole } }) {
    return this.aiAgentsService.listAgents(audienceFor(req.user.role));
  }

  @Get(':agentId/prompt-library')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STAFF, UserRole.ADMIN, UserRole.CUSTOMER)
  getPromptLibrary(@Req() req: { user: { role: UserRole } }, @Param('agentId') agentId: string) {
    return this.aiAgentsService.getPromptLibrary(agentId, audienceFor(req.user.role));
  }

  @Get(':agentId/conversations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STAFF, UserRole.ADMIN, UserRole.CUSTOMER)
  listConversations(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Param('agentId') agentId: string,
  ) {
    return this.aiAgentsService.listConversations(req.user.sub, agentId, audienceFor(req.user.role));
  }

  @Get('conversations/:conversationId/messages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STAFF, UserRole.ADMIN, UserRole.CUSTOMER)
  getMessages(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Param('conversationId') conversationId: string,
  ) {
    return this.aiAgentsService.getMessages(req.user.sub, conversationId, audienceFor(req.user.role));
  }

  @Post(':agentId/messages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STAFF, UserRole.ADMIN, UserRole.CUSTOMER)
  @Throttle(SEND_MESSAGE_THROTTLE)
  sendMessage(
    @Req() req: { user: { sub: string; role: UserRole } },
    @Param('agentId') agentId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.aiAgentsService.sendMessage(
      req.user.sub,
      agentId,
      dto,
      audienceFor(req.user.role),
      req.user.role,
    );
  }
}
