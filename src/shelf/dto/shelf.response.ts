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
  /** 칸 이름 또는 "분류 안 함" */
  groupName: string;
}
