import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum VoiceRoomTypeDto {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  GROUP_CHANNEL = 'GROUP_CHANNEL',
}

export class CreateVoiceRoomDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @IsEnum(VoiceRoomTypeDto)
  type!: VoiceRoomTypeDto;

  @IsOptional()
  @IsUUID('4')
  roomId?: string; // link to chat room

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(100)
  maxParticipants?: number;
}

export class UpdateVoiceRoomDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(100)
  maxParticipants?: number;
}
