import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { MembershipRole } from '@prisma/client';

export class UpdateMemberRoleDto {
  @IsOptional()
  @IsEnum(MembershipRole)
  role?: MembershipRole;

  @IsOptional()
  @IsBoolean()
  canPost?: boolean;
}
