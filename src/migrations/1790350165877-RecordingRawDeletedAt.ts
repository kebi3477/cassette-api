import { MigrationInterface, QueryRunner } from 'typeorm';

export class RecordingRawDeletedAt1790350165877 implements MigrationInterface {
  name = 'RecordingRawDeletedAt1790350165877';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "recordings" ADD "raw_deleted_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "recordings" DROP COLUMN "raw_deleted_at"`,
    );
  }
}
