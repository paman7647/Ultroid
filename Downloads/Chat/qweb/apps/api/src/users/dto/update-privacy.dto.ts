import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePrivacyDto {
  @IsOptional()
  @IsBoolean()
  hideLastSeen?: boolean;

  @IsOptional()
  @IsBoolean()
  hideProfilePhoto?: boolean;
}
