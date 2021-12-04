import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { StationModule } from 'src/station/station.module';
import { StationService } from 'src/station/station.service';
import { EACs } from './dto/eacs.entity';
import { EACsController } from './eacs.controller';
import { AskRepository, EACsRepository } from './eacs.repository';
import { UserRepository } from 'src/auth/user.repository';
import { EACsService } from './eacs.service';
​
@Module({
  imports: [
    TypeOrmModule.forFeature([EACsRepository,AskRepository,UserRepository,]),
    AuthModule,
    StationModule
  ],
  controllers: [EACsController],
  providers: [EACsService]
})
export class EACsModule { }
