import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Cho phép frontend chạy từ localhost hoặc địa chỉ LAN của máy phát triển.
  app.enableCors({ origin: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Bind IPv4 trên mọi network interface để frontend mở bằng địa chỉ LAN có thể gọi API.
  await app.listen(process.env.PORT || 3001, '0.0.0.0');
}
bootstrap();
