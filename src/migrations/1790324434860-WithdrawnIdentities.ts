import { MigrationInterface, QueryRunner } from 'typeorm';

export class WithdrawnIdentities1790324434860 implements MigrationInterface {
  name = 'WithdrawnIdentities1790324434860';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "withdrawn_identities" ("identity_hash" character varying(64) NOT NULL, "withdrawn_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_1ea099d009d684f9fe48984fe87" PRIMARY KEY ("identity_hash"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_withdrawn_identities_withdrawn_at" ON "withdrawn_identities"  ("withdrawn_at") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_withdrawn_identities_withdrawn_at"`,
    );
    await queryRunner.query(`DROP TABLE "withdrawn_identities"`);
  }
}
