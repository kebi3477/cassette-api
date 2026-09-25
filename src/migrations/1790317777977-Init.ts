import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1790317777977 implements MigrationInterface {
  name = 'Init1790317777977';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(8), "credits" integer NOT NULL DEFAULT '0', "drawer_cap" integer NOT NULL DEFAULT '12', "notifications_enabled" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_users_drawer_cap_positive" CHECK ("drawer_cap" > 0), CONSTRAINT "CHK_users_credits_non_negative" CHECK ("credits" >= 0), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "auth_identities" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "provider" character varying(16) NOT NULL, "provider_sub" character varying(255) NOT NULL, "email" character varying(320), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_auth_identities_provider_sub" UNIQUE ("provider", "provider_sub"), CONSTRAINT "PK_63a29aebcddd09448dbeee4666b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_auth_identities_user_id" ON "auth_identities"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "token_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_refresh_tokens_user_id" ON "refresh_tokens"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_refresh_tokens_token_hash" ON "refresh_tokens"  ("token_hash") `,
    );
    await queryRunner.query(
      `CREATE TABLE "idempotency_keys" ("user_id" uuid NOT NULL, "key" character varying(255) NOT NULL, "method" character varying(8) NOT NULL, "path" character varying(255) NOT NULL, "request_hash" character varying(64) NOT NULL, "response_status" smallint, "response_body" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_392b1af86f210d98d3f0c764728" PRIMARY KEY ("user_id", "key"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "blocks" ("user_id" uuid NOT NULL, "blocked_id" uuid NOT NULL, "was_friend" boolean NOT NULL DEFAULT false, "friend_starred" boolean NOT NULL DEFAULT false, "friend_last_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_blocks_not_self" CHECK ("user_id" <> "blocked_id"), CONSTRAINT "PK_b3f3f738d6cb55a8c7fe10b3b0e" PRIMARY KEY ("user_id", "blocked_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_blocks_blocked_id" ON "blocks"  ("blocked_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "friendships" ("user_id" uuid NOT NULL, "friend_id" uuid NOT NULL, "starred" boolean NOT NULL DEFAULT false, "last_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_friendships_not_self" CHECK ("user_id" <> "friend_id"), CONSTRAINT "PK_a8e4ede8e2df44f3f21f557d379" PRIMARY KEY ("user_id", "friend_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_friendships_friend_id" ON "friendships"  ("friend_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_friendships_user_order" ON "friendships"  ("user_id", "starred", "last_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "tape_inventory" ("user_id" uuid NOT NULL, "tape_type" smallint NOT NULL, "qty" integer NOT NULL DEFAULT '0', CONSTRAINT "CHK_tape_inventory_qty_non_negative" CHECK ("qty" >= 0), CONSTRAINT "CHK_tape_inventory_type" CHECK ("tape_type" IN (3, 5)), CONSTRAINT "PK_0187e84ca9e60e5f13867b61ff5" PRIMARY KEY ("user_id", "tape_type"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "credit_ledger" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "delta" integer NOT NULL, "balance_after" integer NOT NULL, "kind" character varying(32) NOT NULL, "reason" character varying(64) NOT NULL, "ref_id" uuid, "idempotency_key" character varying(255), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_credit_ledger_user_idempotency" UNIQUE ("user_id", "idempotency_key"), CONSTRAINT "PK_7ff08f655cf2f4d118c116571db" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_credit_ledger_user_created" ON "credit_ledger"  ("user_id", "created_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_identities" ADD CONSTRAINT "FK_c06a980d83c42611d27a294e55c" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "idempotency_keys" ADD CONSTRAINT "FK_4d2181624ba2d61e76a07175198" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "blocks" ADD CONSTRAINT "FK_91d7d715d368c9d4ff34cc7160e" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "blocks" ADD CONSTRAINT "FK_8aa6c887bed61ad10829450f2f0" FOREIGN KEY ("blocked_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "friendships" ADD CONSTRAINT "FK_c73eec6c7e7d5d1f2b3ce8b9002" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "friendships" ADD CONSTRAINT "FK_972c6bdd4bc18dda48b8aa4714c" FOREIGN KEY ("friend_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tape_inventory" ADD CONSTRAINT "FK_a2e13662a136602ea5569cd66b8" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "credit_ledger" ADD CONSTRAINT "FK_b3c288c46f5de08a59632916e8c" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "credit_ledger" DROP CONSTRAINT "FK_b3c288c46f5de08a59632916e8c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tape_inventory" DROP CONSTRAINT "FK_a2e13662a136602ea5569cd66b8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "friendships" DROP CONSTRAINT "FK_972c6bdd4bc18dda48b8aa4714c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "friendships" DROP CONSTRAINT "FK_c73eec6c7e7d5d1f2b3ce8b9002"`,
    );
    await queryRunner.query(
      `ALTER TABLE "blocks" DROP CONSTRAINT "FK_8aa6c887bed61ad10829450f2f0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "blocks" DROP CONSTRAINT "FK_91d7d715d368c9d4ff34cc7160e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "idempotency_keys" DROP CONSTRAINT "FK_4d2181624ba2d61e76a07175198"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_identities" DROP CONSTRAINT "FK_c06a980d83c42611d27a294e55c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_credit_ledger_user_created"`,
    );
    await queryRunner.query(`DROP TABLE "credit_ledger"`);
    await queryRunner.query(`DROP TABLE "tape_inventory"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_friendships_user_order"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_friendships_friend_id"`);
    await queryRunner.query(`DROP TABLE "friendships"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_blocks_blocked_id"`);
    await queryRunner.query(`DROP TABLE "blocks"`);
    await queryRunner.query(`DROP TABLE "idempotency_keys"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_refresh_tokens_token_hash"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_refresh_tokens_user_id"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_auth_identities_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "auth_identities"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
