import { z } from 'zod';

export const qrPanelPropsSchema = z.object({
  mode: z.enum(['display', 'scan']),
  instructions: z.string().optional(),
  code: z.string().optional(),
});

export type QrPanelProps = z.infer<typeof qrPanelPropsSchema>;

export const qrPanelDefaultProps: QrPanelProps = {
  mode: 'display',
  instructions: 'Show this code to your rider at handoff',
  code: 'LN-10245-HANDOFF',
};
