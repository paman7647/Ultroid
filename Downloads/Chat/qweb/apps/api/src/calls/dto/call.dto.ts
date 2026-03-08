import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export enum CallTypeDto {
  VOICE = 'VOICE',
  VIDEO = 'VIDEO',
  SCREEN_SHARE = 'SCREEN_SHARE',
}

export class InitiateCallDto {
  @IsUUID('4')
  roomId!: string;

  @IsEnum(CallTypeDto)
  type!: CallTypeDto;

  @IsOptional()
  @IsBoolean()
  isGroup?: boolean;
}

export class AnswerCallDto {
  @IsUUID('4')
  callId!: string;

  @IsString()
  sdp!: string;
}

export class IceCandidateDto {
  @IsUUID('4')
  callId!: string;

  @IsString()
  candidate!: string;

  @IsOptional()
  @IsString()
  sdpMid?: string;

  @IsOptional()
  sdpMLineIndex?: number;
}
