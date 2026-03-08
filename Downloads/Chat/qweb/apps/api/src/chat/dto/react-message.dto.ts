import { IsString, MaxLength } from 'class-validator';

export class ReactMessageDto {
  @IsString()
  @MaxLength(16)
  emoji!: string;
}
