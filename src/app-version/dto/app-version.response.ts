export interface AppVersionResponse {
  platform: 'ios' | 'android';
  minVersion: string;
  latestVersion: string;
  storeUrl: string;
  /** version을 줬을 때만. minVersion보다 낮으면 true (강제 업데이트 화면) */
  updateRequired: boolean | null;
  /** version을 줬을 때만. latestVersion보다 낮으면 true */
  updateAvailable: boolean | null;
}
