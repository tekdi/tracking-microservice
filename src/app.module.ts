import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './common/database/database.module';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from "@nestjs/typeorm";
// import { AssessmentTracking } from "src/modules/tracking_assesment/entities/tracking-assessment-entity";
import { TrackingAssesmentModule } from "src/modules/tracking_assesment/tracking_assesment.module";

@Module({
  
  imports: [
    TrackingAssesmentModule,
    ConfigModule.forRoot({ isGlobal: true }),DatabaseModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
