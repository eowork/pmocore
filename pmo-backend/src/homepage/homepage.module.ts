import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { HomepageController } from './homepage.controller';
import { PublicHomepageController } from './public-homepage.controller';
import { HomepageService } from './homepage.service';
import { HomepageSetting, HomepageItem } from '../database/entities';

// T-HOME-CMS (THC-3/THC-4): CMS-backed public homepage content.
@Module({
  imports: [MikroOrmModule.forFeature([HomepageSetting, HomepageItem])],
  controllers: [HomepageController, PublicHomepageController],
  providers: [HomepageService],
})
export class HomepageModule {}
