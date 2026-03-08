import { IsArray, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export enum MessageKindDto {
  TEXT = 'TEXT',
  SYSTEM = 'SYSTEM',
  IMAGE = 'IMAGE',
  FILE = 'FILE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  VOICE = 'VOICE',
  STICKER = 'STICKER',
  GIF = 'GIF',
  EMOJI = 'EMOJI',
}

export class SendMessageDto {
  @IsOptional()
  @IsEnum(MessageKindDto)
  kind?: MessageKindDto;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  body?: string;

  @IsOptional()
  @IsString()
  clientMsgId?: string;

  @IsOptional()
  @IsUUID('4')
  replyToId?: string;

  @IsOptional()
  @IsUUID('4')
  forwardFromMessageId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  attachmentIds?: string[];
}
