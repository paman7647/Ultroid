import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export enum KeyAlgorithmDto {
  X25519 = 'X25519',
  RSA_OAEP_4096 = 'RSA_OAEP_4096',
  P256_ECDH = 'P256_ECDH',
  ED25519 = 'ED25519',
}

export class PublishKeyDto {
  @IsEnum(KeyAlgorithmDto)
  algorithm!: KeyAlgorithmDto;

  @IsString()
  @MaxLength(8192)
  publicKey!: string;

  @IsOptional()
  @IsUUID('4')
  deviceId?: string;

  @IsOptional()
  @IsBoolean()
  isIdentity?: boolean;

  @IsOptional()
  @IsBoolean()
  isOneTime?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  signature?: string;
}

export class PublishPreKeysDto {
  @IsEnum(KeyAlgorithmDto)
  algorithm!: KeyAlgorithmDto;

  keys!: Array<{
    publicKey: string;
    signature?: string;
  }>;

  @IsOptional()
  @IsUUID('4')
  deviceId?: string;
}

export class CreateSessionDto {
  @IsUUID('4')
  responderUserId!: string;

  @IsOptional()
  @IsUUID('4')
  initiatorDeviceId?: string;

  @IsOptional()
  @IsUUID('4')
  responderDeviceId?: string;

  @IsString()
  @MaxLength(65536)
  sessionData!: string;
}
