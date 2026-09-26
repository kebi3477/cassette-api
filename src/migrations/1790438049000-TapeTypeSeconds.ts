import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 테이프 종류 코드를 녹음 한도(초)로 바꾼다: 1·3·5(1분·3분·5분) → 15·60·180(15초·1분·3분).
 * 자리를 그대로 옮긴다(1→15, 3→60, 5→180). 원장의 테이프 구매 문구도 새 이름으로 바꾼다
 * ("3분 테이프 구매" → "1분 테이프 구매", "5분 테이프 구매" → "3분 테이프 구매").
 */
export class TapeTypeSeconds1790438049000 implements MigrationInterface {
  name = 'TapeTypeSeconds1790438049000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "recordings" DROP CONSTRAINT "CHK_recordings_tape_type"`,
    );
    await queryRunner.query(
      `UPDATE "recordings" SET "tape_type" = CASE "tape_type" WHEN 1 THEN 15 WHEN 3 THEN 60 WHEN 5 THEN 180 END`,
    );
    await queryRunner.query(
      `ALTER TABLE "recordings" ADD CONSTRAINT "CHK_recordings_tape_type" CHECK ("tape_type" IN (15, 60, 180))`,
    );
    await queryRunner.query(
      `ALTER TABLE "tape_inventory" DROP CONSTRAINT "CHK_tape_inventory_type"`,
    );
    await queryRunner.query(
      `UPDATE "tape_inventory" SET "tape_type" = CASE "tape_type" WHEN 3 THEN 60 WHEN 5 THEN 180 END`,
    );
    await queryRunner.query(
      `ALTER TABLE "tape_inventory" ADD CONSTRAINT "CHK_tape_inventory_type" CHECK ("tape_type" IN (60, 180))`,
    );
    await queryRunner.query(
      `UPDATE "credit_ledger" SET "reason" = CASE
         WHEN "reason" LIKE '3분 테이프%' THEN '1분 테이프' || substr("reason", 7)
         WHEN "reason" LIKE '5분 테이프%' THEN '3분 테이프' || substr("reason", 7)
         ELSE "reason" END
       WHERE "kind" = 'tape_purchase'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "credit_ledger" SET "reason" = CASE
         WHEN "reason" LIKE '1분 테이프%' THEN '3분 테이프' || substr("reason", 7)
         WHEN "reason" LIKE '3분 테이프%' THEN '5분 테이프' || substr("reason", 7)
         ELSE "reason" END
       WHERE "kind" = 'tape_purchase'`,
    );
    await queryRunner.query(
      `ALTER TABLE "tape_inventory" DROP CONSTRAINT "CHK_tape_inventory_type"`,
    );
    await queryRunner.query(
      `UPDATE "tape_inventory" SET "tape_type" = CASE "tape_type" WHEN 60 THEN 3 WHEN 180 THEN 5 END`,
    );
    await queryRunner.query(
      `ALTER TABLE "tape_inventory" ADD CONSTRAINT "CHK_tape_inventory_type" CHECK ("tape_type" IN (3, 5))`,
    );
    await queryRunner.query(
      `ALTER TABLE "recordings" DROP CONSTRAINT "CHK_recordings_tape_type"`,
    );
    await queryRunner.query(
      `UPDATE "recordings" SET "tape_type" = CASE "tape_type" WHEN 15 THEN 1 WHEN 60 THEN 3 WHEN 180 THEN 5 END`,
    );
    await queryRunner.query(
      `ALTER TABLE "recordings" ADD CONSTRAINT "CHK_recordings_tape_type" CHECK ("tape_type" IN (1, 3, 5))`,
    );
  }
}
