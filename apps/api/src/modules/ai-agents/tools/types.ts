import Anthropic from '@anthropic-ai/sdk';
import { UserRole } from '@lunara/types';
import { PersonaAudience } from '../personas';

export interface ToolCtx {
  userId: string;
  role: UserRole;
  audience: PersonaAudience;
  personaId: string;
}

export interface ToolSpec<TInput = any> {
  name: string;
  description: string;
  input_schema: Anthropic.Tool.InputSchema;
  personas: string[];
  handler: (input: TInput, ctx: ToolCtx) => Promise<unknown>;
}
