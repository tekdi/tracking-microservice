import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.setGlobalPrefix('trackingservice/api/v1');
  const options = new DocumentBuilder()
    .setTitle('Tracking Service API Collection')
    .setDescription('APIs required for frontend apps.')
    .setVersion('1.0')
    .addServer('http://localhost:3000/', 'Local environment')
    .build();

  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(3000);
}
bootstrap();
