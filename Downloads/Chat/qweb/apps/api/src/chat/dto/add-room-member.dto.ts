import { IsUUID } from 'class-validator';

export class AddRoomMemberDto {
  @IsUUID('4')
  userId!: string;
}
