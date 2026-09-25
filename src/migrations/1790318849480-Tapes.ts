import { MigrationInterface, QueryRunner } from 'typeorm';

export class Tapes1790318849480 implements MigrationInterface {
  name = 'Tapes1790318849480';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "recordings" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "owner_id" uuid, "tape_type" smallint NOT NULL, "duration_ms" integer NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'uploading', "content_type" character varying(64) NOT NULL, "raw_key" character varying(255) NOT NULL, "processed_key" character varying(255), "failure_reason" character varying(255), "purged_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_recordings_duration_positive" CHECK ("duration_ms" > 0), CONSTRAINT "CHK_recordings_tape_type" CHECK ("tape_type" IN (1, 3, 5)), CONSTRAINT "PK_8c3247d5ee4551d59bb2115a484" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_recordings_owner_id" ON "recordings"  ("owner_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "shelf_groups" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "name" character varying(12) NOT NULL, "position" character varying(64) COLLATE "C" NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_4048625e94e1211bae2803702fc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_shelf_groups_user_position" ON "shelf_groups"  ("user_id", "position") `,
    );
    await queryRunner.query(
      `CREATE TABLE "deliveries" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "recording_id" uuid NOT NULL, "sender_id" uuid, "sender_name" character varying(8) NOT NULL, "recipient_id" uuid, "link_name" character varying(8), "share_token" character varying(64), "share_expires_at" TIMESTAMP WITH TIME ZONE, "claimed_at" TIMESTAMP WITH TIME ZONE, "tag" character varying(16), "sent_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "opened_at" TIMESTAMP WITH TIME ZONE, "group_id" uuid, "position" character varying(64) COLLATE "C", "suppressed" boolean NOT NULL DEFAULT false, "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "REL_b0c2f1015e2d64ab01d9b2c8ad" UNIQUE ("recording_id"), CONSTRAINT "PK_a6ef225c5c5f0974e503bfb731f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_deliveries_share_token" ON "deliveries"  ("share_token") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_deliveries_sender_sent" ON "deliveries"  ("sender_id", "sent_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_deliveries_recipient_shelf" ON "deliveries"  ("recipient_id", "group_id", "position") `,
    );
    await queryRunner.query(
      `ALTER TABLE "recordings" ADD CONSTRAINT "FK_99f69754a6f792d5efe3ab0a1eb" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "shelf_groups" ADD CONSTRAINT "FK_5bb52157386be79e78d2f415dff" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD CONSTRAINT "FK_b0c2f1015e2d64ab01d9b2c8ad7" FOREIGN KEY ("recording_id") REFERENCES "recordings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD CONSTRAINT "FK_0d8f91dd31f069d047246b2b904" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD CONSTRAINT "FK_2499c339279740e77a256d15646" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD CONSTRAINT "FK_6f815018a5866f8c54b5966468f" FOREIGN KEY ("group_id") REFERENCES "shelf_groups"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP CONSTRAINT "FK_6f815018a5866f8c54b5966468f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP CONSTRAINT "FK_2499c339279740e77a256d15646"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP CONSTRAINT "FK_0d8f91dd31f069d047246b2b904"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP CONSTRAINT "FK_b0c2f1015e2d64ab01d9b2c8ad7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shelf_groups" DROP CONSTRAINT "FK_5bb52157386be79e78d2f415dff"`,
    );
    await queryRunner.query(
      `ALTER TABLE "recordings" DROP CONSTRAINT "FK_99f69754a6f792d5efe3ab0a1eb"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_deliveries_recipient_shelf"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_deliveries_sender_sent"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_deliveries_share_token"`);
    await queryRunner.query(`DROP TABLE "deliveries"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_shelf_groups_user_position"`,
    );
    await queryRunner.query(`DROP TABLE "shelf_groups"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_recordings_owner_id"`);
    await queryRunner.query(`DROP TABLE "recordings"`);
  }
}
