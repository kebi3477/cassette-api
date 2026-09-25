import { MigrationInterface, QueryRunner } from 'typeorm';

export class Billing1790320326476 implements MigrationInterface {
  name = 'Billing1790320326476';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "billing_events" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "source" character varying(16) NOT NULL, "event_type" character varying(64) NOT NULL, "transaction_id" character varying(128), "payload" jsonb NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9a4a4a1b1f55bbc868f6a76a597" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "iap_purchases" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "store" character varying(16) NOT NULL, "transaction_id" character varying(128) NOT NULL, "product_id" character varying(64) NOT NULL, "user_id" uuid, "credits" integer NOT NULL, "purchase_token" text, "environment" character varying(16), "status" character varying(16) NOT NULL DEFAULT 'granted', "consumed_at" TIMESTAMP WITH TIME ZONE, "refunded_at" TIMESTAMP WITH TIME ZONE, "unrecovered_credits" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_iap_purchases_store_transaction" UNIQUE ("store", "transaction_id"), CONSTRAINT "PK_899c9c81af7f63306dea13aa1d6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_iap_purchases_user_id" ON "iap_purchases"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "device_tokens" ("token" character varying(512) NOT NULL, "user_id" uuid NOT NULL, "platform" character varying(16) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_977e24c520c49436d08e5eeea8a" PRIMARY KEY ("token"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_device_tokens_user_id" ON "device_tokens"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "ad_rewards" ("transaction_id" character varying(128) NOT NULL, "user_id" uuid NOT NULL, "reward_date" date NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_43dc37c97b2342bdc2aa8175ec1" PRIMARY KEY ("transaction_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ad_rewards_user_date" ON "ad_rewards"  ("user_id", "reward_date") `,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_identities" ADD "provider_refresh_token" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "iap_purchases" ADD CONSTRAINT "FK_424df4348b1261425046c0ba24c" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_tokens" ADD CONSTRAINT "FK_17e1f528b993c6d55def4cf5bea" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ad_rewards" ADD CONSTRAINT "FK_c7bec9ff30d16aa2c1aacf703c0" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ad_rewards" DROP CONSTRAINT "FK_c7bec9ff30d16aa2c1aacf703c0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_tokens" DROP CONSTRAINT "FK_17e1f528b993c6d55def4cf5bea"`,
    );
    await queryRunner.query(
      `ALTER TABLE "iap_purchases" DROP CONSTRAINT "FK_424df4348b1261425046c0ba24c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_identities" DROP COLUMN "provider_refresh_token"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_ad_rewards_user_date"`);
    await queryRunner.query(`DROP TABLE "ad_rewards"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_device_tokens_user_id"`);
    await queryRunner.query(`DROP TABLE "device_tokens"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_iap_purchases_user_id"`);
    await queryRunner.query(`DROP TABLE "iap_purchases"`);
    await queryRunner.query(`DROP TABLE "billing_events"`);
  }
}
