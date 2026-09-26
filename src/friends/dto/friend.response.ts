export interface FriendResponse {
  userId: string;
  /** 상대가 정한 이름 */
  name: string;
  /** 내가 붙인 별명 (없으면 null). 앱은 `nickname ?? name`으로 표시한다 */
  nickname: string | null;
  starred: boolean;
  /** 마지막으로 테이프를 주고받은 시각. 아직 없으면 null */
  lastAt: string | null;
}

export interface BlockedUserResponse {
  userId: string;
  name: string;
  /** 차단할 때 붙어 있던 별명 (해제하면 되돌아간다) */
  nickname: string | null;
  blockedAt: string;
}

export interface ListResponse<T> {
  items: T[];
}
