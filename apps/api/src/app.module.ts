import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'path';
import { AnalysisModule } from './analysis/analysis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Hỗ trợ cả `npm run dev` ở thư mục gốc lẫn `npm run dev` trong apps/api.
      envFilePath: [resolve(process.cwd(), 'apps/api/.env'), resolve(process.cwd(), '.env')],
    }),
    AnalysisModule,
  ],
})
export class AppModule {}
