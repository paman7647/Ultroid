import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

export enum RoomTypeDto {
  DM = 'DM',
  GROUP = 'GROUP',
}

export class CreateRoomDto {
  @IsEnum(RoomTypeDto)
  type!: RoomTypeDto;

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

  @IsArray()
  @IsUUID('4', { each: true })
  memberIds!: string[];
}
