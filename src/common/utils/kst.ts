/** 한국 시간(Asia/Seoul) 기준 날짜 'YYYY-MM-DD'. 광고 하루 3회 등 "하루"의 기준 */
export function kstDate(at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}
