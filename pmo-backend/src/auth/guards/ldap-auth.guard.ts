import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// T-LDAP-ROOT (RF-5): wraps the passport 'ldap' guard to log WHY authentication failed
// (a validate()-thrown error vs. an LDAP bind/search/credential failure) before returning the
// same 401 to the client. The HTTP contract is unchanged — only the server log gains the reason,
// turning a previously opaque 401 into something diagnosable.
@Injectable()
export class LdapAuthGuard extends AuthGuard('ldap') {
  private readonly logger = new Logger(LdapAuthGuard.name);

  handleRequest<TUser = any>(err: any, user: any, info: any): TUser {
    if (err) {
      // validate() threw (e.g. NO_LOCAL_ACCOUNT, ACCOUNT_INACTIVE) — LDAP itself succeeded.
      this.logger.warn(
        `LDAP_GUARD_FAILURE: reason=validate_error, message=${err?.message ?? err}`,
      );
      throw err;
    }
    if (!user) {
      // passport-ldapauth failed the bind/search/user-bind — LDAP-layer problem.
      this.logger.warn(
        `LDAP_GUARD_FAILURE: reason=ldap_auth_failed, info=${info?.message ?? String(info ?? 'none')}`,
      );
      throw new UnauthorizedException('Invalid LDAP credentials');
    }
    return user;
  }
}
