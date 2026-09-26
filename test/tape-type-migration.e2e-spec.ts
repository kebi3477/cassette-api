import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../src/config/typeorm.config.js';
import { TapeTypeSeconds1790438049000 } from '../src/migrations/1790438049000-TapeTypeSeconds.js';

/**
 * 테이프 종류 코드 마이그레이션(1·3·5 → 15·60·180)의 down/up.
 * 이미 적용된 DB에서 트랜잭션 안에 데이터를 넣고 down → up을 돌린 뒤 되돌린다(다른 테스트에 흔적을 남기지 않는다).
 */
describe('마이그레이션: 테이프 종류 코드를 초로', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = new DataSource(
      buildDataSourceOptions(
        process.env.TEST_DATABASE_URL ??
          'postgres://localhost:5432/cassette_test',
      ),
    );
    await ds.initialize();
  });

  afterAll(async () => {
    await ds.destroy();
  });

  it('down은 15·60·180 → 1·3·5, up은 다시 15·60·180 (재고·원장 문구·CHECK 포함)', async () => {
    const qr = ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const [{ id: userId }] = (await qr.query(
        `INSERT INTO users (name) VALUES ('마이그') RETURNING id`,
      )) as { id: string }[];
      for (const t of [15, 60, 180]) {
        await qr.query(
          `INSERT INTO recordings (owner_id, tape_type, duration_ms, content_type, raw_key)
           VALUES ($1, $2, 1000, 'audio/mp4', 'k')`,
          [userId, t],
        );
      }
      await qr.query(
        `INSERT INTO tape_inventory (user_id, tape_type, qty) VALUES ($1, 60, 2), ($1, 180, 3)`,
        [userId],
      );
      await qr.query(
        `INSERT INTO credit_ledger (user_id, delta, balance_after, kind, reason) VALUES
           ($1, -30, 0, 'tape_purchase', '1분 테이프 구매'),
           ($1, -200, 0, 'tape_purchase', '3분 테이프 5개 구매'),
           ($1, 10, 0, 'ad_reward', '광고 보상')`,
        [userId],
      );
      const snapshot = async () => ({
        rec: (
          (await qr.query(
            `SELECT tape_type FROM recordings WHERE owner_id = $1 ORDER BY tape_type`,
            [userId],
          )) as { tape_type: number }[]
        ).map((r) => r.tape_type),
        inv: (
          (await qr.query(
            `SELECT tape_type, qty FROM tape_inventory WHERE user_id = $1 ORDER BY tape_type`,
            [userId],
          )) as { tape_type: number; qty: number }[]
        ).map((r) => [r.tape_type, r.qty]),
        led: (
          (await qr.query(
            `SELECT reason FROM credit_ledger WHERE user_id = $1 ORDER BY delta`,
            [userId],
          )) as { reason: string }[]
        ).map((r) => r.reason),
      });

      const migration = new TapeTypeSeconds1790438049000();
      await migration.down(qr);
      expect(await snapshot()).toEqual({
        rec: [1, 3, 5],
        inv: [
          [3, 2],
          [5, 3],
        ],
        led: ['5분 테이프 5개 구매', '3분 테이프 구매', '광고 보상'],
      });

      await migration.up(qr);
      expect(await snapshot()).toEqual({
        rec: [15, 60, 180],
        inv: [
          [60, 2],
          [180, 3],
        ],
        led: ['3분 테이프 5개 구매', '1분 테이프 구매', '광고 보상'],
      });

      // 새 CHECK: 옛 코드는 들어가지 않는다
      await qr.query('SAVEPOINT bad');
      await expect(
        qr.query(
          `INSERT INTO recordings (owner_id, tape_type, duration_ms, content_type, raw_key)
           VALUES ($1, 3, 1000, 'audio/mp4', 'k')`,
          [userId],
        ),
      ).rejects.toThrow(/CHK_recordings_tape_type/);
      await qr.query('ROLLBACK TO SAVEPOINT bad');
      await expect(
        qr.query(
          `INSERT INTO tape_inventory (user_id, tape_type, qty) VALUES ($1, 15, 1)`,
          [userId],
        ),
      ).rejects.toThrow(/CHK_tape_inventory_type/);
    } finally {
      await qr.rollbackTransaction();
      await qr.release();
    }
  });
});
