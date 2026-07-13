import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { DecimalToNumberInterceptor } from './common/interceptors/decimal-to-number.interceptor';
import type { EnvConfig } from './config/env.validation';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService<EnvConfig, true>);

  app.enableCors({ origin: configService.get('CORS_ORIGIN', { infer: true }) });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new DecimalToNumberInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('FieldCore API')
    .setDescription(
      'Gestao de ordens de servico, manutencao e tecnicos em campo. ' +
        'Multi-tenant por empresa, RBAC por papel, JWT com access+refresh token.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  const port = configService.get('PORT', { infer: true });
  await app.listen(port);
}

bootstrap().catch((error: unknown) => {
  console.error('Falha ao iniciar a aplicacao:', error);
  process.exit(1);
});
