import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateGroupDto {
  /** 1~12자. 비우면 "새 칸" */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string;
}
