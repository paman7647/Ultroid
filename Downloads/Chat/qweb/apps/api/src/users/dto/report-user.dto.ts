import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ReportUserDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string;
}
