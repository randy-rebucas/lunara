import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PaymentMethod } from '@lunara/types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PaymentWebhookGuard } from '../../common/guards/payment-webhook.guard';
import {
  ConfirmPaymentDto,
  CreatePaymentIntentDto,
  CreateWalletTopupIntentDto,
} from './dto/payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('intent')
  @UseGuards(JwtAuthGuard)
  createIntent(@Req() req: { user: { sub: string } }, @Body() dto: CreatePaymentIntentDto) {
    return this.paymentsService.createIntent(
      req.user.sub,
      dto.orderId,
      dto.method,
      dto.cashTiming,
      dto.clientOrigin,
    );
  }

  @Post('wallet-topup/intent')
  @UseGuards(JwtAuthGuard)
  createWalletTopupIntent(
    @Req() req: { user: { sub: string } },
    @Body() dto: CreateWalletTopupIntentDto,
  ) {
    return this.paymentsService.createWalletTopupIntent(
      req.user.sub,
      dto.amount,
      dto.method,
      dto.clientOrigin,
    );
  }

  @Get('orders/:orderId')
  @UseGuards(JwtAuthGuard)
  getForOrder(@Req() req: { user: { sub: string } }, @Param('orderId') orderId: string) {
    return this.paymentsService.getForOrder(req.user.sub, orderId);
  }

  @Post('webhooks/paymongo')
  paymongoWebhook(@Req() req: RawBodyRequest<Request>, @Res() res: Response) {
    const rawBody = req.rawBody;
    if (!rawBody) {
      return res.status(400).json({ success: false, message: 'Missing raw body' });
    }

    const signature = req.headers['paymongo-signature'] as string | undefined;

    return this.paymentsService
      .handlePaymongoWebhook(rawBody, signature)
      .then((result) => res.status(200).json(result))
      .catch((err) =>
        res.status(err.status ?? 400).json({
          success: false,
          message: err.message ?? 'Webhook handling failed',
        }),
      );
  }

  @Get('mock/paymongo/checkout')
  paymongoCheckout(
    @Query('paymentId') paymentId: string,
    @Query('method') method: string,
    @Query('amount') amount: string,
    @Query('purpose') purpose: string,
    @Res() res: Response,
  ) {
    const label =
      method === PaymentMethod.GCASH
        ? 'GCash'
        : method === PaymentMethod.MAYA
          ? 'Maya'
          : 'Card';
    const completeUrl = `${process.env.API_URL ?? 'http://localhost:3001'}/api/v1/payments/mock/paymongo/complete?paymentId=${paymentId}&method=${method}&purpose=${purpose ?? 'order'}`;
    res.type('html').send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>PayMongo (dev)</title>
<style>body{font-family:system-ui;max-width:420px;margin:48px auto;padding:24px}
.btn{display:block;background:#4F46E5;color:#fff;text-align:center;padding:14px;border-radius:8px;text-decoration:none;margin-top:24px}
.muted{color:#64748b;font-size:14px}</style></head>
<body>
<h1>PayMongo</h1>
<p class="muted">Development checkout — no real charge</p>
<p><strong>${label}</strong> · ₱${Number(amount || 0).toFixed(2)}</p>
<a class="btn" href="${completeUrl}">Pay now</a>
</body></html>`);
  }

  @Get('mock/paymongo/complete')
  async paymongoComplete(
    @Query('paymentId') paymentId: string,
    @Query('method') method: string,
    @Res() res: Response,
  ) {
    const result = await this.paymentsService.confirmPayment(
      paymentId,
      `mock-paymongo-${method}-${Date.now()}`,
    );
    const payment = result.data as {
      orderId?: string;
      _id: string;
      purpose?: string;
      returnOrigin?: string;
    };

    res.redirect(this.paymentsService.getRedirectUrlAfterPayment(payment));
  }

  @Get('mock/gcash')
  async mockGcash(@Query('paymentId') paymentId: string, @Res() res: Response) {
    await this.redirectAfterConfirm(paymentId, `gcash-${Date.now()}`, res);
  }

  @Get('mock/maya')
  async mockMaya(@Query('paymentId') paymentId: string, @Res() res: Response) {
    await this.redirectAfterConfirm(paymentId, `maya-${Date.now()}`, res);
  }

  @Get('mock/stripe')
  async mockStripe(@Query('paymentId') paymentId: string, @Res() res: Response) {
    await this.redirectAfterConfirm(paymentId, `stripe-${Date.now()}`, res);
  }

  @Post(':id/sync')
  @UseGuards(JwtAuthGuard)
  syncPayment(@Req() req: { user: { sub: string } }, @Param('id') id: string) {
    return this.paymentsService.syncPayment(req.user.sub, id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  getById(@Req() req: { user: { sub: string } }, @Param('id') id: string) {
    return this.paymentsService.getById(req.user.sub, id);
  }

  @Post(':id/confirm')
  @UseGuards(PaymentWebhookGuard)
  confirm(@Param('id') id: string, @Body() dto: ConfirmPaymentDto) {
    return this.paymentsService.confirmPayment(id, dto.externalId);
  }

  private async redirectAfterConfirm(paymentId: string, externalId: string, res: Response) {
    const result = await this.paymentsService.confirmPayment(paymentId, externalId);
    const payment = result.data as {
      orderId?: string;
      _id: string;
      purpose?: string;
      returnOrigin?: string;
    };

    res.redirect(this.paymentsService.getRedirectUrlAfterPayment(payment));
  }
}
