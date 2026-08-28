// Únic fitxer del projecte que importa `bcryptjs` (CLAUDE.md, docs/agents/AGENT_AUTH.md §2).

import bcrypt from 'bcryptjs';

// Cost factor fix i documentat aquí — no configurable per tenant (mínim exigit: 10).
const BCRYPT_COST_FACTOR = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST_FACTOR);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
