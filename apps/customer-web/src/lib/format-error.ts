/** Matches raw driver/ORM/stack-trace leakage (ObjectIds, model names, file paths, "reference:"
 *  codes) that should never reach a user-facing message even if a backend guard is bypassed. */
const TECHNICAL_ERROR_PATTERN =
  /ObjectId|on model|\(reference:|Cast to |StackTrace|\.tsx?:\d|at\s+\w+\s+\(|ECONNREFUSED|ENOTFOUND/i;

/** Converts a caught error into copy safe to show a customer. Falls back to a generic message
 * for anything that looks technical, unexpectedly long, or isn't an Error at all — network
 * failures get their own message since "try again" alone isn't actionable for those. */
export function getFriendlyErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof TypeError && /fetch|network/i.test(err.message)) {
    return "Can't reach the server. Check your connection and try again.";
  }
  if (!(err instanceof Error) || !err.message) return fallback;

  const message = err.message.trim();
  if (!message || message.length > 160 || TECHNICAL_ERROR_PATTERN.test(message)) {
    return fallback;
  }
  return message;
}
