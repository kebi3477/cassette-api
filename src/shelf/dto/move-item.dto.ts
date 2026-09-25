import { IsDefined, IsUUID, ValidateIf } from 'class-validator';

export class MoveItemDto {
  /** 옮길 칸. null이면 분류 안 함 */
  @IsDefined()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  groupId: string | null;

  /** 바로 앞 테이프 id. null이면 맨 앞 */
  @IsDefined()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  afterId: string | null;
}
