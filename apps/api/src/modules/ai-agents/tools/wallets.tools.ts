import { WalletsService } from '../../wallets/wallets.service';
import { ToolSpec } from './types';

export function buildWalletTools(wallets: WalletsService): ToolSpec[] {
  return [
    {
      name: 'get_my_wallet',
      description: "Get the caller's own wallet balance. Always scoped server-side to the authenticated user.",
      input_schema: { type: 'object', properties: {} },
      personas: ['emma'],
      handler: async (_input: unknown, ctx) => wallets.getWallet(ctx.userId),
    },
    {
      name: 'get_my_wallet_transactions',
      description: "Get the caller's own recent wallet transactions. Always scoped server-side to the authenticated user.",
      input_schema: { type: 'object', properties: {} },
      personas: ['emma'],
      handler: async (_input: unknown, ctx) => wallets.getTransactions(ctx.userId),
    },
    {
      name: 'get_wallet_balance',
      description: "Get any user's wallet balance, for finance review.",
      input_schema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'The user id whose wallet to look up.' },
        },
        required: ['userId'],
      },
      personas: ['benjamin'],
      handler: async (input: { userId: string }) => wallets.getWallet(input.userId),
    },
  ];
}
