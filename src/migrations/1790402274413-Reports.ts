import { MigrationInterface, QueryRunner } from 'typeorm';

export class Reports1790402274413 implements MigrationInterface {
  name = 'Reports1790402274413';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "reports" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "reporter_id" uuid, "target_type" character varying(8) NOT NULL, "target_id" uuid NOT NULL, "tape_sender_id" uuid, "reason" character varying(16) NOT NULL, "memo" character varying(300), "status" character varying(12) NOT NULL DEFAULT 'received', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d9013193989303580053c0b5ef6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reports_status_created" ON "reports"  ("status", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reports_reporter_target" ON "reports"  ("reporter_id", "target_type", "target_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reports_reporter_created" ON "reports"  ("reporter_id", "created_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "FK_9459b9bf907a3807ef7143d2ead" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT "FK_9459b9bf907a3807ef7143d2ead"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_reports_reporter_created"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_reports_reporter_target"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_reports_status_created"`);
    await queryRunner.query(`DROP TABLE "reports"`);
  }
}
