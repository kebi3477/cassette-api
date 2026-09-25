import { AppException } from '../errors/app.exception.js';

/** 최신순 목록의 커서: (시각, id) */
export interface TimeCursor {
  at: string;
  id: string;
}

export function encodeCursor(c: TimeCursor): string {
  return Buffer.from(`${c.at}|${c.id}`).toString('base64url');
}

export function decodeCursor(raw: string): TimeCursor {
  const [at, id] = Buffer.from(raw, 'base64url').toString().split('|');
  if (
    !at ||
    !id ||
    Number.isNaN(Date.parse(at)) ||
    !/^[0-9a-f-]{36}$/.test(id)
  ) {
    throw new AppException('VALIDATION_FAILED', { fields: ['cursor'] });
  }
  return { at, id };
}
