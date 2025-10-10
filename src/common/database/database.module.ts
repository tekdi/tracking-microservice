import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

const telemetryDBModule = (configService: ConfigService) =>
  configService.get('DISABLE_TELEMETRY') === 'true'
    ? []
    : [
        TypeOrmModule.forRootAsync({
          name: 'telemetryDB',
          useFactory: (configService: ConfigService) => ({
            type: 'postgres',
            host: configService.get('TELEMETRY_POSTGRES_HOST'),
            port: configService.get<number>('TELEMETRY_POSTGRES_PORT'),
            database: configService.get('TELEMETRY_POSTGRES_DATABASE'),
            username: configService.get('TELEMETRY_POSTGRES_USERNAME'),
            password: configService.get('TELEMETRY_POSTGRES_PASSWORD'),
            autoLoadEntities: true,
          }),
          inject: [ConfigService],
        }),
      ];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('POSTGRES_HOST'),
        port: configService.get('POSTGRES_PORT'),
        database: configService.get('POSTGRES_DATABASE'),
        username: configService.get('POSTGRES_USERNAME'),
        password: configService.get('POSTGRES_PASSWORD'),
        // entities: [
        //   User
        // ],
        autoLoadEntities: true,
      }),
      inject: [ConfigService],
    }),
    ...telemetryDBModule(new ConfigService()),
  ],
})
export class DatabaseModule {}
