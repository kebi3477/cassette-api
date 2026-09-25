import type { MeResponse } from '../../users/dto/me.response.js';

export interface TokenPair {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export interface AuthResponse extends TokenPair {
  /** 이번 로그인으로 가입했으면 true (가입 선물 지급됨) */
  isNewUser: boolean;
  /** 이름 정하기 화면에 미리 채울 이름 (카카오 닉네임 등). 없으면 null */
  suggestedName: string | null;
  user: MeResponse;
}
