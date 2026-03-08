import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  MinLength,
  IsArray,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export class CreateBotDto {
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  username!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  botDescription?: string;

  @IsOptional()
  @IsUrl()
  botWebhookUrl?: string;

  @IsOptional()
  @IsBoolean()
  botPublic?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  botPermissions?: string[];
}

export class UpdateBotDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  botDescription?: string;

  @IsOptional()
  @IsUrl()
  botWebhookUrl?: string;

  @IsOptional()
  @IsBoolean()
  botPublic?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  botPermissions?: string[];
}

export class CreateBotTokenDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];
}

export class CreateBotCommandDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  usage?: string;

  @IsOptional()
  arguments?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

export class UpdateBotCommandDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  usage?: string;

  @IsOptional()
  arguments?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

export class BotSendMessageDto {
  @IsUUID('4')
  roomId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  text?: string;

  @IsOptional()
  @IsString()
  kind?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentIds?: string[];

  @IsOptional()
  @IsUUID('4')
  replyToId?: string;

  @IsOptional()
  embed?: Record<string, unknown>;
}

export class BotSendFileDto {
  @IsUUID('4')
  roomId!: string;

  @IsString()
  objectKey!: string;

  @IsOptional()
  @IsString()
  caption?: string;
}

export class CreateBotPluginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  commands?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

export enum BotCategoryDto {
  MODERATION = 'MODERATION',
  MUSIC = 'MUSIC',
  GAME = 'GAME',
  UTILITY = 'UTILITY',
  AI = 'AI',
  AUTOMATION = 'AUTOMATION',
  OTHER = 'OTHER',
}

export class SubmitMarketplaceDto {
  @IsEnum(BotCategoryDto)
  category!: BotCategoryDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  shortDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  longDescription?: string;

  @IsOptional()
  @IsUrl()
  websiteUrl?: string;

  @IsOptional()
  @IsUrl()
  sourceUrl?: string;
}

export class ReviewMarketplaceDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class BotInstallDto {
  @IsOptional()
  @IsUUID('4')
  roomId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}
