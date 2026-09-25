/** Google 서비스 계정 JSON (환경 변수에 원문 또는 base64로 넣는다) */
export interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

export function parseServiceAccount(
  raw: string | undefined,
): ServiceAccount | null {
  if (!raw) return null;
  const text = raw.trim().startsWith('{')
    ? raw
    : Buffer.from(raw, 'base64').toString('utf8');
  try {
    const json = JSON.parse(text) as Partial<ServiceAccount>;
    if (!json.client_email || !json.private_key || !json.project_id)
      return null;
    return json as ServiceAccount;
  } catch {
    return null;
  }
}
