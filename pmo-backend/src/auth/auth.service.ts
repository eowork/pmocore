import { Injectable, UnauthorizedException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { EntityManager } from '@mikro-orm/core';
import { JwtPayload } from '../common/interfaces';
import { ActivityLogService } from '../activity-logs/activity-log.service';
import { ActivityAction } from '../activity-logs/activity-log.entity';
import { LoginDto, RegisterDto } from './dto';
import {
  User,
  UserRole,
  Role,
  Permission,
  RolePermission,
  UserPermissionOverride,
  UserModuleAssignment,
  UserPillarAssignment,
  PasswordResetRequest,
} from '../database/entities';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // PHASE BBCH (Track 6, R-377): CSU domain for LDAP-ready account provisioning. Enforced on
  // registration (new accounts) and on Google SSO; existing accounts are unaffected at login.
  static readonly ALLOWED_DOMAIN = 'carsu.edu.ph';

  constructor(
    private readonly em: EntityManager,
    private readonly jwtService: JwtService,
    private readonly activityLog: ActivityLogService,
  ) {}

  async validateUser(identifier: string, password: string): Promise<any> {
    const user = await this.em.findOne(User, {
      $or: [
        { email: { $ilike: identifier } },
        { username: { $ilike: identifier } },
      ],
    });

    if (!user) {
      return null;
    }

    // Check if account is locked
    if (
      user.accountLockedUntil &&
      new Date(user.accountLockedUntil) > new Date()
    ) {
      this.logger.warn(
        `LOGIN_FAILURE: user_id=${user.id}, reason=ACCOUNT_LOCKED`,
      );
      return null;
    }

    // Check if account is active
    if (!user.isActive) {
      this.logger.warn(
        `LOGIN_FAILURE: user_id=${user.id}, reason=ACCOUNT_INACTIVE`,
      );
      return null;
    }

    // Accounts with no local password hash — route to LDAP if configured.
    // Covers both Google-only accounts (googleId set) and LDAP-provisioned accounts.
    if (!user.passwordHash || user.passwordHash === '') {
      const ldapOk = await this.attemptLdapAuth(identifier, password);
      if (ldapOk) {
        this.logger.log(`LDAP_UNIFIED_SUCCESS: user_id=${user.id}`);
        user.failedLoginAttempts = 0;
        user.accountLockedUntil = undefined;
        await this.em.flush();
        return {
          id: user.id,
          email: user.email,
          username: user.username,
          password_hash: user.passwordHash,
          is_active: user.isActive,
          google_id: user.googleId,
          failed_login_attempts: user.failedLoginAttempts,
          account_locked_until: user.accountLockedUntil,
          first_name: user.firstName,
          last_name: user.lastName,
          rank_level: user.rankLevel,
          campus: user.campus,
          must_change_password: user.mustChangePassword,
          profile_completed: user.profileCompleted,
        };
      }
      this.logger.warn(
        `LOGIN_FAILURE: user_id=${user.id}, reason=NO_LOCAL_PASSWORD_LDAP_FAIL`,
      );
      return null;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      const attempts = (user.failedLoginAttempts ?? 0) + 1;
      user.failedLoginAttempts = attempts;
      if (attempts >= 5) {
        user.accountLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      await this.em.flush();
      this.logger.warn(
        `LOGIN_FAILURE: user_id=${user.id}, reason=INVALID_PASSWORD`,
      );
      void this.activityLog.logAction(
        { sub: user.id, email: user.email ?? '', roles: [], is_superadmin: false },
        ActivityAction.FAILED_LOGIN,
        'auth',
        user.id,
        { reason: 'INVALID_PASSWORD' },
      );
      return null;
    }

    // Reset failed attempts on success
    user.failedLoginAttempts = 0;
    user.accountLockedUntil = undefined;
    await this.em.flush();

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      password_hash: user.passwordHash,
      is_active: user.isActive,
      google_id: user.googleId,
      failed_login_attempts: user.failedLoginAttempts,
      account_locked_until: user.accountLockedUntil,
      first_name: user.firstName,
      last_name: user.lastName,
      rank_level: user.rankLevel,
      campus: user.campus,
      must_change_password: user.mustChangePassword,
      profile_completed: user.profileCompleted,
    };
  }

  async register(dto: RegisterDto): Promise<{ message: string }> {
    if (dto.password !== dto.confirm_password) {
      throw new BadRequestException('Passwords do not match');
    }
    // PHASE BBCH (Track 6, R-377): LDAP readiness — restrict NEW accounts to the CSU domain.
    // Enforced at registration only (not login) so existing non-CSU accounts keep working,
    // honoring the standing "do not break existing authentication" constraint.
    const email = dto.email.trim().toLowerCase();
    if (!email.endsWith(`@${AuthService.ALLOWED_DOMAIN}`)) {
      throw new BadRequestException(
        `Only @${AuthService.ALLOWED_DOMAIN} accounts may be registered.`,
      );
    }
    // PHASE BBCH (Track 6, R-377): derive the LDAP-style username from the email local part
    // (e.g. mzalcantara@carsu.edu.ph → mzalcantara) so it matches the future sAMAccountName.
    const username = email.split('@')[0];
    // PR-A: raw SQL duplicate check — more reliable than ORM $or with as any cast
    const conn = this.em.getConnection();
    const dup = await conn.execute(
      `SELECT id FROM users WHERE (email = ? OR username = ?) AND deleted_at IS NULL LIMIT 1`,
      [email, username],
    );
    if (dup.length > 0) {
      throw new ConflictException('An account with this email already exists');
    }
    const nameParts = dto.full_name.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
    const hash = await bcrypt.hash(dto.password, 10);
    const user = this.em.create(User, {
      username,
      email,
      passwordHash: hash,
      firstName,
      lastName,
      status: 'ACTIVE',
      isActive: true,
      // PHASE BBBC (Track 4): admin-created accounts must change the initial password at first login.
      mustChangePassword: true,
      metadata: {
        department: dto.department,
        position: dto.position,
        phone: dto.phone,
        userType: dto.user_type || 'CSU_PERSONNEL',
        userTypeOther: dto.user_type_other,
        registeredAt: new Date().toISOString(),
        registrationSource: 'admin-invite',
      },
    });
    // PR-A: catch PostgreSQL 23505 unique constraint violation (race condition guard)
    try {
      await this.em.persistAndFlush(user);
    } catch (err: any) {
      if (err?.code === '23505' || (err?.message && (err.message as string).includes('unique constraint'))) {
        throw new ConflictException('An account with this email already exists');
      }
      throw err;
    }
    // PHASE BBBA (BBBA-0b): NO automatic role assignment. New accounts are dashboard-only
    // (default-DENY) until an administrator grants a role + module access via Access Control.
    // (Superseded the ZG-A auto-Staff grant, which combined with default-ALLOW let any
    // registrant self-provision full Staff access.)
    this.logger.log(`ADMIN_ACCOUNT_CREATE: email=${email}, username=${username}, status=ACTIVE, access=DASHBOARD_ONLY`);
    return { message: 'Account created. The user has dashboard-only access until an administrator grants module permissions.' };
  }

  async login(dto: LoginDto) {
    // ZA-1: Pre-check activation status — ACCOUNT_INACTIVE is distinct from INVALID_CREDENTIALS.
    const account = await this.em.findOne(
      User,
      { $or: [{ email: { $ilike: dto.identifier } }, { username: { $ilike: dto.identifier } }] },
      { filters: false },
    );
    if (account && !account.isActive) {
      this.logger.warn(`LOGIN_FAILURE: user_id=${account.id}, reason=ACCOUNT_INACTIVE`);
      throw new UnauthorizedException('ACCOUNT_INACTIVE');
    }

    const user = await this.validateUser(dto.identifier, dto.password);

    if (!user) {
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    // PHASE BBBG (Track 4): first-login detection + last-login tracking. `account` is the
    // managed User entity (same identity-map row validateUser flushed), so lastLoginAt is current.
    const isFirstLogin = !!account && !account.lastLoginAt;
    if (account) {
      account.lastLoginAt = new Date();
      await this.em.flush();
    }

    // Aggregate roles
    const userRoles = await this.em.find(
      UserRole,
      { userId: user.id },
      { filters: false },
    );
    const roleIds = userRoles.map((ur) => ur.roleId);
    const roleEntities =
      roleIds.length > 0
        ? await this.em.find(Role, { id: { $in: roleIds } })
        : [];
    const roleNameById = new Map(roleEntities.map((r) => [r.id, r.name]));
    const roles = userRoles
      .map((ur) => roleNameById.get(ur.roleId))
      .filter(Boolean) as string[];
    // PHASE BBBD (Track 1b): rank 10 = SuperAdmin authority IN ADDITION to the is_superadmin flag,
    // so a user designated "SuperAdmin (Rank 10)" in User Management is recognized as such (R-321).
    const is_superadmin =
      userRoles.some((ur) => ur.isSuperadmin) ||
      (user.rank_level != null && user.rank_level <= 10);

    // Aggregate permissions via role_permissions
    let permissions: string[] = [];
    if (roleIds.length > 0) {
      const rolePerms = await this.em.find(
        RolePermission,
        { roleId: { $in: roleIds } },
        { filters: false },
      );
      const permIds = Array.from(
        new Set(rolePerms.map((rp) => rp.permissionId)),
      );
      if (permIds.length > 0) {
        const permEntities = await this.em.find(Permission, {
          id: { $in: permIds },
        });
        permissions = Array.from(new Set(permEntities.map((p) => p.name)));
      }
    }

    // Module overrides
    const overrides = await this.em.find(
      UserPermissionOverride,
      { userId: user.id },
      { filters: false },
    );
    const module_overrides = overrides.reduce(
      (acc, o) => {
        acc[o.moduleKey] = o.canAccess;
        return acc;
      },
      {} as Record<string, boolean>,
    );
    // PHASE BBBC (Track 8d): per-module CRUD level for granted modules.
    const module_levels = overrides.reduce(
      (acc, o) => {
        if (o.canAccess && o.grantedLevel) acc[o.moduleKey] = o.grantedLevel;
        return acc;
      },
      {} as Record<string, string>,
    );

    // Module assignments
    const moduleAssignments = await this.em.find(
      UserModuleAssignment,
      { userId: user.id },
      { filters: false },
    );
    const module_assignments = moduleAssignments.map((m) => m.module);

    // Pillar assignments
    let pillar_assignments: string[] = [];
    try {
      const pillars = await this.em.find(
        UserPillarAssignment,
        { userId: user.id },
        { filters: false },
      );
      pillar_assignments = pillars.map((p) => p.pillarType);
    } catch {
      this.logger.warn(
        `PILLAR_RBAC_UNAVAILABLE: defaulting to [] for user=${user.id}`,
      );
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles,
      is_superadmin,
      campus: user.campus || undefined,
    };

    this.logger.log(
      `LOGIN_SUCCESS: user_id=${user.id}, superadmin=${is_superadmin}, first=${isFirstLogin}`,
    );
    void this.activityLog.logAction(
      payload,
      isFirstLogin ? ActivityAction.FIRST_LOGIN : ActivityAction.LOGIN,
      'auth',
      user.id,
    );

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        roles,
        is_superadmin,
        permissions,
        module_overrides,
        module_levels,
        module_assignments,
        pillar_assignments,
        rank_level: user.rank_level,
        campus: user.campus,
        must_change_password: user.must_change_password,
        profile_completed: user.profile_completed,
        role: roles.length > 0 ? { name: roles[0] } : undefined,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.em.findOne(User, { id: userId });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Roles (with id)
    const userRoles = await this.em.find(
      UserRole,
      { userId },
      { filters: false },
    );
    const roleIds = userRoles.map((ur) => ur.roleId);
    const roleEntities =
      roleIds.length > 0
        ? await this.em.find(Role, { id: { $in: roleIds } })
        : [];
    const roleById = new Map(roleEntities.map((r) => [r.id, r]));
    const rolesData = userRoles.map((ur) => ({
      id: ur.roleId,
      name: roleById.get(ur.roleId)?.name || '',
      is_superadmin: ur.isSuperadmin,
    }));

    // Permissions
    let permissions: string[] = [];
    if (roleIds.length > 0) {
      const rolePerms = await this.em.find(
        RolePermission,
        { roleId: { $in: roleIds } },
        { filters: false },
      );
      const permIds = Array.from(
        new Set(rolePerms.map((rp) => rp.permissionId)),
      );
      if (permIds.length > 0) {
        const permEntities = await this.em.find(Permission, {
          id: { $in: permIds },
        });
        permissions = Array.from(new Set(permEntities.map((p) => p.name)));
      }
    }

    // Module overrides
    const overrides = await this.em.find(
      UserPermissionOverride,
      { userId },
      { filters: false },
    );
    const module_overrides = overrides.reduce(
      (acc, o) => {
        acc[o.moduleKey] = o.canAccess;
        return acc;
      },
      {} as Record<string, boolean>,
    );
    // PHASE BBBC (Track 8d): per-module CRUD level for granted modules.
    const module_levels = overrides.reduce(
      (acc, o) => {
        if (o.canAccess && o.grantedLevel) acc[o.moduleKey] = o.grantedLevel;
        return acc;
      },
      {} as Record<string, string>,
    );

    // Module assignments
    const moduleAssignments = await this.em.find(
      UserModuleAssignment,
      { userId },
      { filters: false },
    );
    const module_assignments = moduleAssignments.map((m) => m.module);

    // Pillar assignments
    let pillar_assignments: string[] = [];
    try {
      const pillars = await this.em.find(
        UserPillarAssignment,
        { userId },
        { filters: false },
      );
      pillar_assignments = pillars.map((p) => p.pillarType);
    } catch {
      this.logger.warn(
        `PILLAR_RBAC_UNAVAILABLE: defaulting to [] for user=${userId}`,
      );
    }

    const roles = rolesData.map((r) => ({ id: r.id, name: r.name }));

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      first_name: user.firstName,
      last_name: user.lastName,
      avatar_url: user.avatarUrl,
      rank_level: user.rankLevel,
      campus: user.campus,
      // NNN-H: profile-page fields
      phone: user.phone,
      display_name: user.displayName,
      last_login_at: user.lastLoginAt,
      last_password_change_at: user.lastPasswordChangeAt,
      must_change_password: user.mustChangePassword,
      profile_completed: user.profileCompleted,
      position: user.metadata?.position,
      office: user.metadata?.office,
      // NNN-G: SSO-only accounts (Google, no local password) cannot change password
      is_sso: !!user.googleId && !user.passwordHash,
      roles,
      // PHASE BBBD (Track 1b): flag OR rank 10 (R-321).
      is_superadmin:
        rolesData.some((r) => r.is_superadmin) ||
        (user.rankLevel != null && user.rankLevel <= 10),
      permissions,
      module_overrides,
      module_levels,
      module_assignments,
      pillar_assignments,
      role: roles.length > 0 ? { name: roles[0].name } : undefined,
    };
  }

  // NNN-G: authenticated self-service password change (distinct from public reset flow)
  async changePassword(
    userId: string,
    dto: { currentPassword: string; newPassword: string; confirmPassword: string },
  ): Promise<{ message: string }> {
    if (!dto.currentPassword || !dto.newPassword || !dto.confirmPassword) {
      throw new BadRequestException('All password fields are required');
    }
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('New passwords do not match');
    }
    if (dto.newPassword.length < 8) {
      throw new BadRequestException(
        'New password must be at least 8 characters',
      );
    }
    const user = await this.em.findOne(User, { id: userId });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (user.googleId && !user.passwordHash) {
      throw new BadRequestException(
        'Account uses Google Sign-In — password change is not available',
      );
    }
    const isValid = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash || '',
    );
    if (!isValid) {
      throw new BadRequestException('Current password is incorrect');
    }
    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException(
        'New password must differ from the current password',
      );
    }
    user.passwordHash = await bcrypt.hash(dto.newPassword, 12);
    user.lastPasswordChangeAt = new Date();
    // PHASE BBBC (Track 4): clear the forced-change flag once the user sets their own password.
    user.mustChangePassword = false;
    await this.em.flush();
    this.logger.log(`PASSWORD_CHANGE: user_id=${userId}`);
    void this.activityLog.logAction(
      { sub: userId, email: user.email ?? '', roles: [], is_superadmin: false },
      ActivityAction.PASSWORD_CHANGE,
      'auth',
      userId,
    );
    return { message: 'Password changed successfully' };
  }

  // NNN-H + PHASE BBBD (Track 5): self-service profile update + onboarding completion.
  async updateProfile(
    userId: string,
    dto: {
      displayName?: string;
      phone?: string;
      position?: string;
      office?: string;
      campus?: string;
      profile_completed?: boolean;
    },
  ) {
    const user = await this.em.findOne(User, { id: userId });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    // PHASE BBBG (Track 4): capture pre-state so PROFILE_COMPLETED fires only on the false→true transition.
    const wasProfileIncomplete = !user.profileCompleted;
    if (dto.displayName !== undefined) {
      user.displayName = dto.displayName?.trim() || undefined;
    }
    if (dto.phone !== undefined) {
      user.phone = dto.phone?.trim() || undefined;
    }
    if (dto.campus !== undefined) {
      user.campus = dto.campus?.trim() || undefined;
    }
    // PHASE BBBD (Track 5): position/office captured in metadata (no structured columns yet).
    if (dto.position !== undefined || dto.office !== undefined) {
      user.metadata = {
        ...(user.metadata || {}),
        ...(dto.position !== undefined ? { position: dto.position?.trim() } : {}),
        ...(dto.office !== undefined ? { office: dto.office?.trim() } : {}),
      };
    }
    if (dto.profile_completed !== undefined) {
      user.profileCompleted = dto.profile_completed;
    }
    await this.em.flush();
    this.logger.log(`PROFILE_UPDATE: user_id=${userId}`);
    const actor = { sub: userId, email: user.email ?? '', roles: [], is_superadmin: false };
    void this.activityLog.logAction(
      actor,
      ActivityAction.PROFILE_UPDATE,
      'auth',
      userId,
    );
    // PHASE BBBG (Track 4): onboarding completion event (transition only).
    if (dto.profile_completed === true && wasProfileIncomplete) {
      void this.activityLog.logAction(
        actor,
        ActivityAction.PROFILE_COMPLETED,
        'auth',
        userId,
      );
    }
    return this.getProfile(userId);
  }

  async logout(userId: string): Promise<void> {
    this.logger.log(`LOGOUT: user_id=${userId}`);
    void this.activityLog.logAction(
      { sub: userId, email: '', roles: [], is_superadmin: false },
      ActivityAction.LOGOUT,
      'auth',
      userId,
    );
  }

  async createPasswordResetRequest(
    identifier: string,
    notes?: string,
  ): Promise<{ message: string }> {
    try {
      const entity = this.em.create(PasswordResetRequest, {
        identifier,
        notes: notes ?? undefined,
      });
      await this.em.persistAndFlush(entity);
      this.logger.log(`PASSWORD_RESET_REQUEST: identifier=${identifier}`);
      // PHASE BBBG (Track 4): audit the request. Public/unauthenticated — resolve the requester
      // best-effort so the activity log has a valid actor; skip the audit if no account matches.
      const requester = await this.em.findOne(
        User,
        { $or: [{ email: { $ilike: identifier } }, { username: { $ilike: identifier } }] },
        { filters: false },
      );
      if (requester) {
        void this.activityLog.logAction(
          { sub: requester.id, email: requester.email ?? identifier, roles: [], is_superadmin: false },
          ActivityAction.PASSWORD_RESET_REQUESTED,
          'password_reset',
          entity.id,
          { identifier },
        );
      }
    } catch (err) {
      this.logger.warn(
        `PASSWORD_RESET_REQUEST_FAILED: identifier=${identifier}, error=${err.message}`,
      );
    }
    return {
      message: 'Reset request submitted. An administrator will contact you.',
    };
  }

  // T-UNI: Programmatic LDAP auth for the unified login endpoint.
  // Called when an account has no local passwordHash (LDAP or SSO-only accounts).
  // Returns false immediately if LDAP_URL is not configured — no network call, no hang.
  private async attemptLdapAuth(username: string, password: string): Promise<boolean> {
    const ldapUrl = process.env.LDAP_URL || '';
    if (!ldapUrl) return false;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const LdapAuth = require('ldapauth-fork');
    const auth = new LdapAuth({
      url: ldapUrl,
      bindDN: process.env.LDAP_BIND_DN || '',
      bindCredentials: process.env.LDAP_BIND_PASSWORD || '',
      searchBase: process.env.LDAP_SEARCH_BASE || '',
      searchFilter: process.env.LDAP_SEARCH_FILTER || '(mail={{username}})',
      tlsOptions: {
        rejectUnauthorized: (process.env.LDAP_TLS_REJECT_UNAUTHORIZED ?? 'true') === 'true',
      },
    });

    return new Promise((resolve) => {
      auth.authenticate(username, password, (err: any, _user: any) => {
        auth.close(() => {});
        resolve(!err && !!_user);
      });
    });
  }

  private async buildSsoTokenForUser(
    userId: string,
  ): Promise<{ access_token: string }> {
    const userRoles = await this.em.find(
      UserRole,
      { userId },
      { filters: false },
    );
    const roleIds = userRoles.map((ur) => ur.roleId);
    const roleEntities =
      roleIds.length > 0
        ? await this.em.find(Role, { id: { $in: roleIds } })
        : [];
    const roleNameById = new Map(roleEntities.map((r) => [r.id, r.name]));
    const roles = userRoles
      .map((ur) => roleNameById.get(ur.roleId))
      .filter(Boolean) as string[];
    const is_superadmin = userRoles.some((ur) => ur.isSuperadmin);

    const user = await this.em.findOne(User, { id: userId });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const payload: JwtPayload = {
      sub: userId,
      email: user.email,
      roles,
      // PHASE BBBD (Track 1b): flag OR rank 10 (R-321).
      is_superadmin:
        is_superadmin || (user.rankLevel != null && user.rankLevel <= 10),
      campus: user.campus || undefined,
    };

    return { access_token: this.jwtService.sign(payload) };
  }

  async loginWithLdapUser(userId: string): Promise<{ access_token: string }> {
    const token = await this.buildSsoTokenForUser(userId);
    this.logger.log(`LDAP_LOGIN_SUCCESS: user_id=${userId}`);
    return token;
  }

  async loginWithGoogleUser(userId: string): Promise<{ access_token: string }> {
    const token = await this.buildSsoTokenForUser(userId);
    this.logger.log(`GOOGLE_LOGIN_SUCCESS: user_id=${userId}`);
    return token;
  }
}
