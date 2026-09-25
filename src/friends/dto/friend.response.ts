export interface FriendResponse {
  userId: string;
  name: string;
  starred: boolean;
  /** 마지막으로 테이프를 주고받은 시각. 아직 없으면 null */
  lastAt: string | null;
}

export interface BlockedUserResponse {
  userId: string;
  name: string;
  blockedAt: string;
}

export interface ListResponse<T> {
  items: T[];
}
