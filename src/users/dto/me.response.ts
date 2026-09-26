import type { AuthProvider } from '../../auth/entities/auth-identity.entity.js';
import type { TapeType } from '../../recordings/entities/recording.entity.js';

export interface TapeStock {
  /** 15 | 60 | 180 (녹음 한도, 초) */
  tapeType: TapeType;
  /** 보유 개수. 15초는 무제한이라 null */
  qty: number | null;
}

export interface MeResponse {
  id: string;
  /** 가입 직후에는 null → 이름 정하기 화면 */
  name: string | null;
  credits: number;
  drawer: {
    /** 보관 중인 테이프 수 (분류 안 함 + 모든 칸) */
    stored: number;
    cap: number;
    /** stored >= cap. 꽉 참 배너 */
    full: boolean;
    /** 분류 안 함에 있는 안 뜯은 소포 수 (탭바 서랍 레드 점) */
    unopenedCount: number;
  };
  tapes: TapeStock[];
  stats: {
    receivedCount: number;
    sentCount: number;
    friendCount: number;
  };
  /** 연결된 계정 */
  providers: AuthProvider[];
  notificationsEnabled: boolean;
  createdAt: string;
}
