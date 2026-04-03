// ABOUTME: Root application module that wires together all feature modules.
// Configures global ConfigModule and TypeORM database connection.

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@/auth/auth.module';
import { RegexFiltersModule } from '@/regex-filters/regex-filters.module';
import { TradeModule } from '@/trade/trade.module';
import { FilterPresetsModule } from '@/filter-presets/filter-presets.module';
import { PricesModule } from '@/prices/prices.module';
import { StrategiesModule } from '@/strategies/strategies.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        ...(config.get<string>('DATABASE_URL')
          ? {
              url: config.get<string>('DATABASE_URL'),
              ssl: { rejectUnauthorized: false },
            }
          : {
              host: config.get<string>('DB_HOST', 'localhost'),
              port: config.get<number>('DB_PORT', 5432),
              database: config.get<string>('DB_NAME', 'cadiro'),
              username: config.get<string>('DB_USER', 'postgres'),
              password: config.get<string>('DB_PASS', 'postgres'),
            }),
        autoLoadEntities: true,
        synchronize: config.get<string>('NODE_ENV') !== 'production',
        logging: config.get<string>('NODE_ENV') === 'development',
      }),
    }),
    AuthModule,
    RegexFiltersModule,
    TradeModule,
    FilterPresetsModule,
    PricesModule,
    StrategiesModule,
  ],
})
export class AppModule {}
