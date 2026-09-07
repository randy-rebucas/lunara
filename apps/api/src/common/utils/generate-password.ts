import { randomBytes } from 'crypto';

// Deliberately excludes 0/O, 1/I/l — visually ambiguous in an emailed/texted temp password.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

/** Generates a random, human-typable temporary password — for self-serve account creation
 * flows that email/SMS a password to a new user. */
export function generateTempPassword(length = 10): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}
