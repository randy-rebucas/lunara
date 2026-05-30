import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UpdateCustomerDto } from './dto/customer.dto';
import { CustomersService } from './customers.service';

@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get('me')
  getMe(@Req() req: { user: { sub: string } }) {
    return this.customersService.getProfile(req.user.sub);
  }

  @Patch('me')
  updateMe(@Req() req: { user: { sub: string } }, @Body() dto: UpdateCustomerDto) {
    return this.customersService.updateProfile(req.user.sub, dto);
  }

  @Get('me/onboarding')
  getOnboarding(@Req() req: { user: { sub: string } }) {
    return this.customersService.getOnboardingStatus(req.user.sub);
  }
}
