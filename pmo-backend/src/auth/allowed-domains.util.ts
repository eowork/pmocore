/**
 * Single source of truth for parsing the institutional e-mail domain allowlist.
 *
 * OAUTH_ALLOWED_DOMAIN holds a comma-separated list (e.g. "carsu.edu.ph,csucc.edu.ph") so a
 * second campus domain can be onboarded without a code change. A single value is still valid
 * and behaves exactly as before, which keeps existing deployments working untouched.
 *
 * Shared by GoogleStrategy (the server-side gate) and GoogleAuthGuard (the consent-screen
 * hint), so the two can never disagree about what "allowed" means.
 */

/** Used when OAUTH_ALLOWED_DOMAIN is unset or parses to nothing. */
export const DEFAULT_ALLOWED_DOMAIN = 'carsu.edu.ph';

/**
 * Split a comma-separated domain list into normalised entries.
 *
 * Tolerates spaces around commas, mixed case, empty items and a stray leading "@" so a
 * mis-typed .env value degrades to something sane instead of silently allowing nothing.
 * Never returns an empty array — an empty allowlist would mean "reject everyone", which is
 * a far worse failure mode than falling back to the CSU domain.
 */
export function parseAllowedDomains(raw?: string | null): string[] {
  const parsed = (raw ?? '')
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter((d) => d.length > 0);
  return parsed.length > 0 ? parsed : [DEFAULT_ALLOWED_DOMAIN];
}

/**
 * True when the e-mail belongs to one of the allowed domains.
 *
 * Matches on "@" + domain rather than a bare suffix, so "user@evilcarsu.edu.ph" is rejected
 * for an allowlist of "carsu.edu.ph". Sub-domains are NOT matched: an address at
 * "mail.carsu.edu.ph" needs its own allowlist entry.
 */
export function isAllowedDomain(email: string, domains: string[]): boolean {
  const normalised = email.trim().toLowerCase();
  return domains.some((d) => normalised.endsWith(`@${d}`));
}

/**
 * The value for Google's `hd` authorisation parameter, or undefined to omit it.
 *
 * `hd` pre-filters the Google account chooser. It accepts exactly ONE domain, so with a
 * multi-domain allowlist the best available filter is "*", which limits the chooser to Google
 * Workspace accounts and hides consumer @gmail.com ones. Both CSU domains are Workspace
 * domains, so "*" still lets every legitimate user through.
 *
 * This is a USABILITY hint only. Google does not enforce it reliably and the parameter is
 * visible and editable in the browser's address bar, so the real check stays server-side in
 * GoogleStrategy.validate(). Never treat `hd` as a security control.
 */
export function hostedDomainParam(domains: string[]): string | undefined {
  if (domains.length === 0) return undefined;
  return domains.length === 1 ? domains[0] : '*';
}
