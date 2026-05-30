import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';
import { AddressesService } from './addresses.service';

@Controller('addresses')
@UseGuards(JwtAuthGuard)
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  findAll(@Req() req: { user: { sub: string } }) {
    return this.addressesService.findAll(req.user.sub);
  }

  @Post()
  create(@Req() req: { user: { sub: string } }, @Body() dto: CreateAddressDto) {
    return this.addressesService.create(req.user.sub, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
    @Body() dto: UpdateAddressDto,
  ) {
    return this.addressesService.update(id, req.user.sub, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: { user: { sub: string } }) {
    return this.addressesService.remove(id, req.user.sub);
  }
}
