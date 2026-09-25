import { IsBoolean } from 'class-validator';

export class UpdateFriendDto {
  /** 즐겨찾기 */
  @IsBoolean()
  starred: boolean;
}
