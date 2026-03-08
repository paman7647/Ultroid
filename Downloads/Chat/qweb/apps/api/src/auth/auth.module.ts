import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './google-auth.service';
import { AccessTokenGuard } from '@/common/guards/access-token.guard';
import { WsJwtGuard } from '@/common/guards/ws-jwt.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, GoogleAuthService, AccessTokenGuard, WsJwtGuard],
  exports: [AuthService, GoogleAuthService, AccessTokenGuard, WsJwtGuard, JwtModule],
})
export class AuthModule {}
