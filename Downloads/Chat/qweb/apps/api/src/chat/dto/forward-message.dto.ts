import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ForwardMessageDto {
  @IsUUID('4')
  targetRoomId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  bodyOverride?: string;
}
