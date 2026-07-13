import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { addDuration, parseDurationToMs } from '../../common/utils/duration';
import type { EnvConfig } from '../../config/env.validation';
import type { LoginDto } from './dto/login.dto';
import type { AuthTokensDto } from './dto/auth-tokens.dto';

const REFRESH_TOKEN_SALT_ROUNDS = 10;

type RefreshTokenPayload = { sub: string; jti: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<EnvConfig, true>,
  ) {}

  async login(dto: LoginDto): Promise<AuthTokensDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    return this.issueTokens(
      user.id,
      user.name,
      user.email,
      user.role,
      user.companyId,
    );
  }

  async refresh(refreshToken: string): Promise<AuthTokensDto> {
    const refreshSecret = this.configService.get('JWT_REFRESH_SECRET', {
      infer: true,
    });

    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret: refreshSecret,
        },
      );
    } catch {
      throw new UnauthorizedException('Refresh token invalido ou expirado.');
    }

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
    });

    if (
      !storedToken ||
      storedToken.revokedAt ||
      storedToken.expiresAt < new Date()
    ) {
      throw new UnauthorizedException('Refresh token invalido ou expirado.');
    }

    const tokenMatches = await bcrypt.compare(
      refreshToken,
      storedToken.tokenHash,
    );
    if (!tokenMatches) {
      throw new UnauthorizedException('Refresh token invalido ou expirado.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: storedToken.userId },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario invalido ou inativo.');
    }

    // Rotaciona: revoga o token usado e emite um par novo, evitando reuso.
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(
      user.id,
      user.name,
      user.email,
      user.role,
      user.companyId,
    );
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(
    userId: string,
    name: string,
    email: string,
    role: string,
    companyId: string | null,
  ): Promise<AuthTokensDto> {
    const accessSecret = this.configService.get('JWT_ACCESS_SECRET', {
      infer: true,
    });
    const accessExpiresIn = this.configService.get('JWT_ACCESS_EXPIRES_IN', {
      infer: true,
    });
    const refreshSecret = this.configService.get('JWT_REFRESH_SECRET', {
      infer: true,
    });
    const refreshExpiresIn = this.configService.get('JWT_REFRESH_EXPIRES_IN', {
      infer: true,
    });

    const accessToken = await this.jwtService.signAsync(
      { sub: userId },
      { secret: accessSecret, expiresIn: toSeconds(accessExpiresIn) },
    );

    // Cria a linha do refresh token antes de assinar o JWT, pra ter um id (jti)
    // que o token referencia -- permite localizar/revogar sem varrer tudo.
    const expiresAt = addDuration(new Date(), refreshExpiresIn);
    const placeholder = await this.prisma.refreshToken.create({
      data: { userId, tokenHash: '', expiresAt },
    });

    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, jti: placeholder.id },
      { secret: refreshSecret, expiresIn: toSeconds(refreshExpiresIn) },
    );

    const tokenHash = await bcrypt.hash(
      refreshToken,
      REFRESH_TOKEN_SALT_ROUNDS,
    );
    await this.prisma.refreshToken.update({
      where: { id: placeholder.id },
      data: { tokenHash },
    });

    return {
      accessToken,
      refreshToken,
      user: { id: userId, name, email, role, companyId },
    };
  }
}

/** jsonwebtoken exige `expiresIn` em segundos (number) ou uma string bem tipada; */
/** convertemos a duracao configurada (ex.: "15m") usando o mesmo parser testado. */
function toSeconds(duration: string): number {
  return Math.floor(parseDurationToMs(duration) / 1000);
}
