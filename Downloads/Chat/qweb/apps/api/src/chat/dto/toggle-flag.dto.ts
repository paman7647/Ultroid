import { IsBoolean } from 'class-validator';

export class ToggleFlagDto {
  @IsBoolean()
  value!: boolean;
}
