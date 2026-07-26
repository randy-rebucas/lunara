import { AdminService } from '../../admin/admin.service';
import { ToolSpec } from './types';

export function buildAdminTools(admin: AdminService): ToolSpec[] {
  return [
    {
      name: 'get_ops_dashboard',
      description: 'Get the admin operations dashboard: today/month order volume, status breakdown, and key stats.',
      input_schema: { type: 'object', properties: {} },
      personas: ['olivia', 'aurora'],
      handler: async () => admin.getDashboard(),
    },
    {
      name: 'get_revenue',
      description: 'Get platform revenue summary.',
      input_schema: { type: 'object', properties: {} },
      personas: ['olivia', 'aurora'],
      handler: async () => admin.getRevenue(),
    },
    {
      name: 'get_reports',
      description: 'Get an analytics report over a trailing window of days.',
      input_schema: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'How many trailing days to report on (default 7).' },
        },
      },
      personas: ['olivia'],
      handler: async (input: { days?: number }) => admin.getReports(input?.days),
    },
    {
      name: 'get_quality_alerts',
      description:
        'Get current quality alerts: shops and riders with low average rating (below threshold, with enough reviews to be meaningful).',
      input_schema: { type: 'object', properties: {} },
      personas: ['olivia', 'mia', 'aurora'],
      handler: async () => admin.getQualityAlerts(),
    },
    {
      name: 'get_admin_orders',
      description: 'List orders platform-wide, optionally filtered by status.',
      input_schema: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Optional exact order status to filter by.' },
          limit: { type: 'number', description: 'Max number of orders to return (default 50).' },
        },
      },
      personas: ['olivia'],
      handler: async (input: { status?: string; limit?: number }) => admin.getOrders(input?.status, input?.limit),
    },
    {
      name: 'get_live_tracking',
      description: 'Get live rider tracking map data: active riders and their current orders/locations.',
      input_schema: { type: 'object', properties: {} },
      personas: ['olivia'],
      handler: async () => admin.getLiveTracking(),
    },
    {
      name: 'get_rider_roster',
      description: 'List all riders with verification/employment status (roster view).',
      input_schema: { type: 'object', properties: {} },
      personas: ['olivia'],
      handler: async () => admin.getRiders(),
    },
    {
      name: 'get_shops',
      description: 'List all partner shop accounts.',
      input_schema: { type: 'object', properties: {} },
      personas: ['mia'],
      handler: async () => admin.getShops(),
    },
    {
      name: 'get_shop_detail',
      description: 'Get full detail for one partner shop by id.',
      input_schema: {
        type: 'object',
        properties: {
          shopId: { type: 'string', description: 'The partner/shop id to look up.' },
        },
        required: ['shopId'],
      },
      personas: ['mia'],
      handler: async (input: { shopId: string }) => admin.getShopDetail(input.shopId),
    },
    {
      name: 'get_promotions',
      description: 'List all promotions/discount codes, including audience, dates, and usage limits.',
      input_schema: { type: 'object', properties: {} },
      personas: ['sophia'],
      handler: async () => admin.getPromotions(),
    },
    {
      name: 'get_active_deals',
      description: 'List currently active deals/promos visible to customers.',
      input_schema: { type: 'object', properties: {} },
      personas: ['sophia'],
      handler: async () => admin.getActiveDeals(),
    },
  ];
}
