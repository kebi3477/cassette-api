import { ConfigService } from '@nestjs/config';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildTapeArgs,
  FfmpegService,
  TAPE_FILTER_COMPLEX,
} from './ffmpeg.service.js';

const hasFfmpeg =
  spawnSync('ffmpeg', ['-version']).status === 0 &&
  spawnSync('ffprobe', ['-version']).status === 0;

describe('FfmpegService', () => {
  it('필터 체인: 대역 제한, wow/flutter, 새추레이션, 히스', () => {
    // "옛날 통화" EQ: 505Hz 로우컷·3120Hz 하이컷(각 2차 필터 4개), 벨 3개
    expect(TAPE_FILTER_COMPLEX.match(/highpass=f=505:t=q:w=/g)).toHaveLength(4);
    expect(TAPE_FILTER_COMPLEX.match(/lowpass=f=3120:t=q:w=/g)).toHaveLength(4);
    for (const q of ['0.5098', '0.6013', '0.9', '2.5629']) {
      expect(TAPE_FILTER_COMPLEX).toContain(`highpass=f=505:t=q:w=${q}`);
      expect(TAPE_FILTER_COMPLEX).toContain(`lowpass=f=3120:t=q:w=${q}`);
    }
    expect(TAPE_FILTER_COMPLEX).toContain('equalizer=f=677:t=q:w=3.76:g=7.14');
    expect(TAPE_FILTER_COMPLEX).toContain(
      'equalizer=f=1170:t=q:w=3.76:g=-4.52',
    );
    expect(TAPE_FILTER_COMPLEX).toContain('equalizer=f=2110:t=q:w=2.82:g=6.19');
    expect(TAPE_FILTER_COMPLEX).not.toContain('lowpass=f=7000');
    expect(TAPE_FILTER_COMPLEX).toMatch(/vibrato=f=0\.7.*vibrato=f=7/);
    expect(TAPE_FILTER_COMPLEX).toContain('asoftclip=type=tanh');
    expect(TAPE_FILTER_COMPLEX).toContain('amix=inputs=2');
  });

  it('AAC 64kbps 모노 m4a로 쓴다', () => {
    const args = buildTapeArgs('/in', '/out.m4a');
    expect(args.slice(0, 5)).toEqual([
      '-hide_banner',
      '-nostdin',
      '-y',
      '-i',
      '/in',
    ]);
    expect(args).toContain(
      'anoisesrc=color=pink:amplitude=0.02:sample_rate=44100',
    );
    expect(args.join(' ')).toContain('-c:a aac -b:a 64k -ac 1');
    expect(args[args.length - 1]).toBe('/out.m4a');
  });

  it('없는 실행 파일이면 isAvailable()이 false', async () => {
    const service = new FfmpegService(
      new ConfigService({
        FFMPEG_PATH: '/nope/ffmpeg',
        FFPROBE_PATH: '/nope/ffprobe',
      }),
    );
    await expect(service.isAvailable()).resolves.toBe(false);
  });

  // 실제 ffmpeg가 있는 환경(운영 이미지, CI)에서만
  it.skipIf(!hasFfmpeg)(
    '실제 ffmpeg로 3초 사인파를 변환하고 길이를 잰다',
    async () => {
      const service = new FfmpegService(new ConfigService({}));
      const dir = await mkdtemp(join(tmpdir(), 'ffmpeg-test-'));
      try {
        const input = join(dir, 'in.m4a');
        const output = join(dir, 'out.m4a');
        spawnSync('ffmpeg', [
          '-y',
          '-f',
          'lavfi',
          '-i',
          'sine=frequency=440:duration=3',
          '-c:a',
          'aac',
          input,
        ]);
        await service.convertToTape(input, output);
        expect((await stat(output)).size).toBeGreaterThan(0);
        const ms = await service.probeDurationMs(output);
        expect(ms).toBeGreaterThan(2800);
        expect(ms).toBeLessThan(3500);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );
});
