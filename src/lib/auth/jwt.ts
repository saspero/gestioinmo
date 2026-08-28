// Únic fitxer del projecte que importa `jose` (CLAUDE.md, docs/agents/AGENT_AUTH.md §1).

import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import type { RolUsuari } from './rbac';

export interface JwtPayload {
  sub: string;
  tenant_id: string;
  rol: RolUsuari;
  jti: string;
  iat: number;
  exp: number;
}

const jwtPayloadSchema = z.object({
  sub: z.string().uuid(),
  tenant_id: z.string().uuid(),
  rol: z.enum(['admin', 'gestor', 'comptable']),
  jti: z.string().uuid(),
  iat: z.number(),
  exp: z.number(),
});

let cachedSecret: Uint8Array | undefined;

function getJwtSecret(): Uint8Array {
  if (!cachedSecret) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET no configurat.');
    }
    cachedSecret = new TextEncoder().encode(secret);
  }
  return cachedSecret;
}

/**
 * L'expiració es calcula a partir de `tenants.jwt_expiracio_minuts` del tenant
 * corresponent (docs/db-schema.md §3.1), mai d'un valor fix global.
 */
export async function signToken(
  payload: Pick<JwtPayload, 'sub' | 'tenant_id' | 'rol' | 'jti'>,
  expiracioMinuts: number
): Promise<string> {
  return new SignJWT({
    tenant_id: payload.tenant_id,
    rol: payload.rol,
    jti: payload.jti,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${expiracioMinuts}m`)
    .sign(getJwtSecret());
}

/**
 * Retorna `null` per a qualsevol token absent/invàlid/expirat/mal format — mai llança —
 * perquè el middleware i la resta del codi el puguin tractar com "no autenticat" sense
 * `try/catch` escampat (docs/agents/AGENT_AUTH.md §1).
 */
export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), { algorithms: ['HS256'] });
    const parsed = jwtPayloadSchema.safeParse(payload);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
