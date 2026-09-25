import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string;

  /** 이 칸 바로 앞 칸 id. null이면 맨 앞. 보내지 않으면 순서를 바꾸지 않는다 */
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUUID()
  afterId?: string | null;
}
