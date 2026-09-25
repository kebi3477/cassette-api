import { Init1790317777977 } from './1790317777977-Init.js';
import { Tapes1790318849480 } from './1790318849480-Tapes.js';
import { Billing1790320326476 } from './1790320326476-Billing.js';

/**
 * 적용할 마이그레이션 목록 (순서대로).
 * `npm run migration:generate -- src/migrations/<이름>`으로 만든 뒤 여기에 추가한다.
 */
export const migrations = [
  Init1790317777977,
  Tapes1790318849480,
  Billing1790320326476,
];
