import Anthropic from '@anthropic-ai/sdk';
import { UserRole } from '@lunara/types';
import { PersonaAudience } from '../personas';

export interface ToolCtx {
  userId: string;
  /** Absent for the 'guest' audience — no authenticated user. */
  role?: UserRole;
  audience: PersonaAudience;
  personaId: string;
}

export interface ToolSpec<TInput = any> {
  name: string;
  description: string;
  input_schema: Anthropic.Tool.InputSchema;
  personas: string[];
  /** Set on tools backed by no-auth/public data only — the sole tools exposed to the 'guest' audience. */
  guestSafe?: boolean;
  handler: (input: TInput, ctx: ToolCtx) => Promise<unknown>;
}
