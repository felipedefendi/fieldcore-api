import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    // Sem segredo/expiracao padrao aqui de proposito -- access e refresh token
    // usam segredos e tempos de vida diferentes, passados explicitamente em
    // cada chamada de sign/verify no AuthService/JwtStrategy.
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
