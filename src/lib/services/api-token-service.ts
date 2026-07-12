import { randomBytes, createHash } from 'crypto';
import { prisma } from '@/lib/prisma';

const TOKEN_PREFIX = 'ftmcp_';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function looksLikeApiToken(token: string): boolean {
  return token.startsWith(TOKEN_PREFIX);
}

/**
 * Creates a new personal access token for MCP / external LLM clients.
 * Returns the plaintext token once — only its hash is persisted.
 */
export async function createApiToken(userId: string, name: string): Promise<{ id: string; token: string }> {
  const token = `${TOKEN_PREFIX}${randomBytes(24).toString('hex')}`;
  const record = await prisma.apiToken.create({
    data: { userId, name, tokenHash: hashToken(token) },
  });
  return { id: record.id, token };
}

/**
 * Resolves a bearer token to a userId if it matches a live ApiToken, and
 * bumps lastUsedAt. Returns null if the token doesn't match any record.
 */
export async function resolveApiToken(token: string): Promise<string | null> {
  if (!looksLikeApiToken(token)) return null;

  const record = await prisma.apiToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record) return null;

  await prisma.apiToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
  return record.userId;
}
