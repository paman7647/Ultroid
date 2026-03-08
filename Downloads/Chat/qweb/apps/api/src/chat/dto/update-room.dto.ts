import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class UpdateRoomDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\/.+/)
  @MaxLength(2048)
  avatarUrl?: string;

  @IsOptional()
  @IsBoolean()
  announcementMode?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(300)
  slowModeSeconds?: number;
}
