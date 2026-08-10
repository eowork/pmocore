import { JwtService } from '@nestjs/jwt';
import { numberFromConfig } from './config.util';

// Minimal ConfigService stub: get(key) returns the stored raw value (string, as env vars are).
function csWith(value: unknown) {
  return { get: (_key: string) => value } as any;
}

describe('numberFromConfig', () => {
  it('coerces a numeric string (the .env case) to a real number', () => {
    expect(numberFromConfig(csWith('28800'), 'AUTH_JWT_EXPIRES_IN', 111)).toBe(28800);
    expect(typeof numberFromConfig(csWith('28800'), 'K', 1)).toBe('number');
  });

  it('passes through a real number', () => {
    expect(numberFromConfig(csWith(5432), 'DATABASE_PORT', 1)).toBe(5432);
  });

  it('falls back on undefined / empty / non-numeric / non-positive input', () => {
    expect(numberFromConfig(csWith(undefined), 'K', 28800)).toBe(28800);
    expect(numberFromConfig(csWith(''), 'K', 28800)).toBe(28800);
    expect(numberFromConfig(csWith('abc'), 'K', 28800)).toBe(28800);
    expect(numberFromConfig(csWith('0'), 'K', 28800)).toBe(28800);
    expect(numberFromConfig(csWith('-5'), 'K', 28800)).toBe(28800);
  });
});

// T-JWT-EXPIRY regression: proves the bug (string "28800" -> ~29s token) is fixed and that a
// token signed via the coerced value lasts the intended 8 hours.
describe('JWT expiry regression (exp - iat)', () => {
  const SECRET = 'test-secret';

  it('signing with the RAW string "28800" would expire in ~29s (documents the bug)', () => {
    const jwt = new JwtService({ secret: SECRET, signOptions: { expiresIn: '28800' as any } });
    const decoded: any = jwt.decode(jwt.sign({ sub: 'x' }));
    expect(decoded.exp - decoded.iat).toBe(28); // 28800 ms -> 28s
  });

  it('signing with the COERCED number lasts 8h (the fix)', () => {
    const expiresIn = numberFromConfig(csWith('28800'), 'AUTH_JWT_EXPIRES_IN', 28800);
    const jwt = new JwtService({ secret: SECRET, signOptions: { expiresIn } });
    const decoded: any = jwt.decode(jwt.sign({ sub: 'x' }));
    expect(decoded.exp - decoded.iat).toBe(28800); // 8 hours
  });
});
