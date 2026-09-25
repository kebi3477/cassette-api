import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'node:child_process';
import { copyFile } from 'node:fs/promises';

const CONVERT_TIMEOUT_MS = 120_000;

/**
 * "테이프 소리" 필터 체인.
 * - 대역 제한: highpass 100Hz + lowpass 7kHz (카세트의 좁은 대역)
 * - 약한 wow(0.7Hz)와 flutter(7Hz): vibrato 두 번
 * - 새추레이션: 게인을 올려 tanh 소프트 클립 후 다시 내림
 * - 히스 노이즈: 핑크 노이즈를 고역만 남겨 작게 섞음
 */
export const TAPE_FILTER_COMPLEX = [
  '[0:a]aformat=sample_rates=44100:channel_layouts=mono,' +
    'highpass=f=100,lowpass=f=7000,' +
    'vibrato=f=0.7:d=0.03,vibrato=f=7:d=0.008,' +
    'volume=1.8,asoftclip=type=tanh,volume=0.6[voice]',
  '[1:a]highpass=f=2500,lowpass=f=9000,volume=0.25[hiss]',
  '[voice][hiss]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[out]',
].join(';');

/** ffmpeg 인자. 결과는 AAC(m4a) 64kbps 모노 */
export function buildTapeArgs(input: string, output: string): string[] {
  return [
    '-hide_banner',
    '-nostdin',
    '-y',
    '-i',
    input,
    '-f',
    'lavfi',
    '-i',
    'anoisesrc=color=pink:amplitude=0.02:sample_rate=44100',
    '-filter_complex',
    TAPE_FILTER_COMPLEX,
    '-map',
    '[out]',
    '-c:a',
    'aac',
    '-b:a',
    '64k',
    '-ac',
    '1',
    '-ar',
    '44100',
    '-movflags',
    '+faststart',
    output,
  ];
}

/**
 * ffmpeg·ffprobe 실행을 감싼다. 테스트에서는 목으로 바꾼다.
 * FFMPEG_MODE=passthrough(개발 전용)면 원본을 그대로 복사하고 길이는 재지 않는다.
 */
@Injectable()
export class FfmpegService {
  constructor(private readonly config: ConfigService) {}

  get passthrough(): boolean {
    return this.config.get<string>('FFMPEG_MODE') === 'passthrough';
  }

  private get ffmpeg(): string {
    return this.config.get<string>('FFMPEG_PATH') ?? 'ffmpeg';
  }

  private get ffprobe(): string {
    return this.config.get<string>('FFPROBE_PATH') ?? 'ffprobe';
  }

  /** ffmpeg와 ffprobe를 실행할 수 있는지 */
  async isAvailable(): Promise<boolean> {
    try {
      await run(this.ffmpeg, ['-version'], 5000);
      await run(this.ffprobe, ['-version'], 5000);
      return true;
    } catch {
      return false;
    }
  }

  /** 원본을 테이프 소리로 바꿔 output(m4a)에 쓴다 */
  async convertToTape(input: string, output: string): Promise<void> {
    if (this.passthrough) {
      await copyFile(input, output);
      return;
    }
    await run(this.ffmpeg, buildTapeArgs(input, output), CONVERT_TIMEOUT_MS);
  }

  /** 파일 길이(ms). passthrough면 null (앱이 알린 길이를 쓴다) */
  async probeDurationMs(file: string): Promise<number | null> {
    if (this.passthrough) return null;
    const out = await run(
      this.ffprobe,
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=nw=1:nk=1',
        file,
      ],
      10_000,
    );
    const seconds = Number.parseFloat(out.trim());
    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw new Error(`길이를 알 수 없는 파일: ${out.trim()}`);
    }
    return Math.round(seconds * 1000);
  }
}

function run(cmd: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
    child.stderr.on('data', (d: Buffer) => {
      stderr = (stderr + d.toString()).slice(-4000);
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else
        reject(
          new Error(`${cmd} 실패 (code=${code}, signal=${signal}): ${stderr}`),
        );
    });
  });
}
