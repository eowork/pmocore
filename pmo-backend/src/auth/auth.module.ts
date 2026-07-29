import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { LdapStrategy } from './strategies/ldap.strategy';
import { JwtAuthGuard, RolesGuard } from './guards';
import { numberFromConfig } from '../common/config.util';
import { ActivityLogModule } from '../activity-logs/activity-log.module';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import {
  User,
  Role,
  UserRole,
  Permission,
  RolePermission,
  UserPermissionOverride,
  UserModuleAssignment,
  UserPillarAssignment,
  PasswordResetRequest,
} from '../database/entities';

@Module({
  imports: [
    MikroOrmModule.forFeature([
      User,
      Role,
      UserRole,
      Permission,
      RolePermission,
      UserPermissionOverride,
      UserModuleAssignment,
      UserPillarAssignment,
      PasswordResetRequest,
    ]),
    ActivityLogModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('AUTH_JWT_SECRET'),
        signOptions: {
          // T-JWT-EXPIRY: coerce to a real number. A raw string from .env (e.g. "28800") is read
          // by jsonwebtoken as milliseconds (~29s), not seconds — see common/config.util.ts.
          expiresIn: numberFromConfig(configService, 'AUTH_JWT_EXPIRES_IN', 28800), // 8h in seconds
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    // Phase HY: Only register LdapStrategy when LDAP_URL is configured
    // Prevents app crash when IT has not yet provisioned the LDAP server (Directive 229)
    ...(process.env.LDAP_URL ? [LdapStrategy] : []),
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [AuthService, JwtAuthGuard, RolesGuard, JwtModule],
})
export class AuthModule {}
