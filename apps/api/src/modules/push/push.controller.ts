import { Body, Controller, Delete, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RegisterPushTokenDto, UnregisterPushTokenDto } from './dto/push-token.dto';
import { PushNotificationService } from './push-notification.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private readonly pushService: PushNotificationService) {}

  @Post('me/push-token')
  registerToken(@Req() req: { user: { sub: string } }, @Body() dto: RegisterPushTokenDto) {
    return this.pushService.registerToken(
      req.user.sub,
      dto.token,
      dto.platform,
      dto.deviceId,
    );
  }

  @Delete('me/push-token')
  unregisterToken(@Req() req: { user: { sub: string } }, @Body() dto: UnregisterPushTokenDto) {
    return this.pushService.unregisterToken(req.user.sub, dto.token);
  }
}
