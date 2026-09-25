import type { ShelfItem } from '../../deliveries/delivery.mapper.js';

export interface GroupResponse {
  id: string;
  name: string;
  items: ShelfItem[];
}

export interface ShelfResponse {
  stored: number;
  cap: number;
  full: boolean;
  /** 분류 안 함에 있는 안 뜯은 소포 수 (탭바 레드 점) */
  unopenedCount: number;
  unsorted: ShelfItem[];
  groups: GroupResponse[];
}

export interface FriendTapeItem extends ShelfItem {
  /** 칸 이름. "분류 안 함"에 있으면 null (앱이 "분류 안 함"으로 표시) */
  groupName: string | null;
}
