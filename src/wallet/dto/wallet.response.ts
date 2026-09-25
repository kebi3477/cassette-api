import type { LedgerKind } from '../entities/credit-ledger.entity.js';

export interface LedgerEntryResponse {
  id: string;
  delta: number;
  reason: string;
  kind: LedgerKind;
  createdAt: string;
}

export interface WalletResponse {
  credits: number;
  ads: { rewardPerView: number; dailyLimit: number; remainingToday: number };
}
