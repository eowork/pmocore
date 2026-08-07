import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ContractorAuthService } from './contractor-auth.service';
import { ContractorAuthController } from './contractor-auth.controller';
import { ContractorUser } from './entities/contractor-user.entity';
import { ContractorInviteToken } from './entities/contractor-invite-token.entity';
import { ProjectContractorAssignment } from './entities/project-contractor-assignment.entity';

@Module({
  imports: [
    MikroOrmModule.forFeature([ContractorUser, ContractorInviteToken, ProjectContractorAssignment]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cs: ConfigService) => ({
        secret: cs.get<string>('AUTH_JWT_SECRET'),
        signOptions: { expiresIn: cs.get<number>('AUTH_JWT_EXPIRES_IN', 604800) }, // 7d fallback
      }),
    }),
  ],
  providers: [ContractorAuthService],
  controllers: [ContractorAuthController],
  exports: [ContractorAuthService],
})
export class ContractorAuthModule {}
