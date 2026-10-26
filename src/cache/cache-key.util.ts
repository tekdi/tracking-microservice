import { createHash } from 'crypto';

export function hashCacheParts(...parts: unknown[]): string {
  const normalized = JSON.stringify(parts);
  return createHash('sha1').update(normalized).digest('hex');
}
