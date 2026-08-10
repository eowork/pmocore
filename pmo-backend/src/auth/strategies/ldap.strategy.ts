import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import Strategy = require('passport-ldapauth');
import { AuthService } from '../auth.service';

@Injectable()
export class LdapStrategy extends PassportStrategy(Strategy, 'ldap') {
  private readonly logger = new Logger(LdapStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      server: {
        url: configService.get<string>('LDAP_URL', ''),
        bindDN: configService.get<string>('LDAP_BIND_DN', ''),
        bindCredentials: configService.get<string>('LDAP_BIND_PASSWORD', ''),
        searchBase: configService.get<string>('LDAP_SEARCH_BASE', ''),
        searchFilter: configService.get<string>(
          // T-LDAP-ROOT (RF-7): default to uid — the real CSU directory is OpenLDAP/POSIX.
          'LDAP_SEARCH_FILTER',
          '(uid={{username}})',
        ),
        tlsOptions: {
          rejectUnauthorized:
            configService.get<string>(
              'LDAP_TLS_REJECT_UNAUTHORIZED',
              'true',
            ) === 'true',
        },
      },
    });
  }

  async validate(ldapUser: any): Promise<any> {
    const email: string | undefined =
      ldapUser.mail || ldapUser.userPrincipalName;

    if (!email) {
      this.logger.warn('LDAP_LOGIN_FAILURE: reason=NO_EMAIL_ATTRIBUTE');
      throw new UnauthorizedException('No email attribute in LDAP profile');
    }

    // T-LDAP-JIT: resolve or auto-provision (flag-gated) via the shared helper so this
    // path behaves identically to the unified /api/auth/login path.
    const user = await this.authService.findOrCreateLdapUser({
      email,
      firstName: ldapUser.givenName,
      lastName: ldapUser.sn,
    });

    if (!user) {
      this.logger.warn(
        `LDAP_LOGIN_FAILURE: email=${email}, reason=NO_LOCAL_ACCOUNT`,
      );
      throw new UnauthorizedException(
        'No account found. Contact your administrator.',
      );
    }

    if (!user.isActive) {
      this.logger.warn(
        `LDAP_LOGIN_FAILURE: user_id=${user.id}, reason=ACCOUNT_INACTIVE`,
      );
      throw new UnauthorizedException(
        'Account is inactive. Contact your administrator.',
      );
    }

    this.logger.log(`LDAP_VALIDATE_SUCCESS: user_id=${user.id}`);
    return { id: user.id, email: user.email, is_active: user.isActive };
  }
}
