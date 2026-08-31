export function getAnthropicApiKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY?.trim() || undefined;
}

export function getAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-5';
}
