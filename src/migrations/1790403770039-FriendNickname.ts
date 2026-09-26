import { MigrationInterface, QueryRunner } from 'typeorm';

export class FriendNickname1790403770039 implements MigrationInterface {
  name = 'FriendNickname1790403770039';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blocks" ADD "friend_nickname" character varying(10)`,
    );
    await queryRunner.query(
      `ALTER TABLE "friendships" ADD "nickname" character varying(10)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "friendships" DROP COLUMN "nickname"`);
    await queryRunner.query(
      `ALTER TABLE "blocks" DROP COLUMN "friend_nickname"`,
    );
  }
}
