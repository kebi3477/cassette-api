import { AuthIdentity } from '../auth/entities/auth-identity.entity.js';
import { RefreshToken } from '../auth/entities/refresh-token.entity.js';
import { IdempotencyKey } from '../common/entities/idempotency-key.entity.js';
import { Block } from '../friends/entities/block.entity.js';
import { Friendship } from '../friends/entities/friendship.entity.js';
import { TapeInventory } from '../users/entities/tape-inventory.entity.js';
import { User } from '../users/entities/user.entity.js';
import { CreditLedger } from '../wallet/entities/credit-ledger.entity.js';

/**
 * 모든 엔티티. 앱(TypeOrmModule)과 마이그레이션 CLI(data-source.ts)가 함께 쓴다.
 * 엔티티를 추가하면 여기에도 넣는다.
 */
export const entities = [
  User,
  TapeInventory,
  AuthIdentity,
  RefreshToken,
  Friendship,
  Block,
  CreditLedger,
  IdempotencyKey,
];
