import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { AuthenticateOptionsGoogle } from 'passport-google-oauth20';
import {
  hostedDomainParam,
  parseAllowedDomains,
} from '../allowed-domains.util';

/**
 * Adds Google's `hd` (hosted domain) parameter to the consent-screen redirect.
 *
 * `hd` cannot be set in the strategy constructor: passport-google-oauth20 reads it from the
 * AUTHENTICATE options in Strategy.prototype.authorizationParams(), not from the strategy
 * options. In Nest the authenticate options come from getAuthenticateOptions(), which is why
 * this exists as a guard rather than another field in GoogleStrategy's super() call.
 *
 * Effect: the Google account chooser is pre-filtered, so a user with a personal @gmail.com
 * account signed in alongside their CSU one is not offered the wrong account and does not
 * discover the mistake only at /auth/restricted.
 *
 * NOT a security control. The parameter travels in the URL the browser is redirected to, so
 * the user can edit it. The authoritative domain check is in GoogleStrategy.validate().
 *
 * Only the initiate leg (/auth/google) builds an authorisation URL, so `hd` is inert on the
 * callback leg; the same guard is used on both purely so one strategy has one guard.
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(private readonly config: ConfigService) {
    super();
  }

  getAuthenticateOptions(): AuthenticateOptionsGoogle {
    const domains = parseAllowedDomains(
      this.config.get<string>('OAUTH_ALLOWED_DOMAIN'),
    );
    const hd = hostedDomainParam(domains);
    return hd ? { hd } : {};
  }
}
