/**
 * 개발 시드용 오디오: 사인파 톤을 WAV(16-bit PCM, 모노 16kHz)로 만든다.
 * 직접 생성한 소리라 라이선스 문제가 없다.
 */
export function makeToneWav(seconds: number, frequency: number): Buffer {
  const rate = 16_000;
  const samples = Math.round(seconds * rate);
  const data = Buffer.alloc(samples * 2);
  const fade = rate * 0.05;
  for (let i = 0; i < samples; i++) {
    const env = Math.min(1, i / fade, (samples - i) / fade);
    // 부드러운 톤 + 약한 트레몰로 (테이프처럼 들리게)
    const trem = 0.85 + 0.15 * Math.sin((2 * Math.PI * 4 * i) / rate);
    const v =
      Math.sin((2 * Math.PI * frequency * i) / rate) * 0.25 * env * trem;
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}
