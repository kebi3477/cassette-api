import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * 탈퇴한 소셜 계정(카카오·Apple). 재가입 제한(REJOIN_COOLDOWN_DAYS, 기본 30일)에만 쓰고,
 * 기간이 지나면 정리 작업이 지운다. 원문 식별자는 남기지 않고 HMAC-SHA256 해시만 둔다.
 */
@Entity('withdrawn_identities')
export class WithdrawnIdentity {
  /** HMAC-SHA256(IDENTITY_HASH_KEY, provider + "\n" + provider_sub), hex */
  @PrimaryColumn({ name: 'identity_hash', type: 'varchar', length: 64 })
  identityHash: string;

  @Index('IDX_withdrawn_identities_withdrawn_at')
  @Column({ name: 'withdrawn_at', type: 'timestamptz' })
  withdrawnAt: Date;
}
