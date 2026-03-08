import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreateRoomInviteDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxUses?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60 * 24 * 30)
  expiresInMinutes?: number;
}
