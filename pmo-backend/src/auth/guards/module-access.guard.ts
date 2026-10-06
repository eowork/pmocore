import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EntityManager } from '@mikro-orm/core';
import { REQUIRE_MODULE_KEY } from '../decorators/require-module.decorator';
import { JwtPayload } from '../../common/interfaces';
import { UserPermissionOverride } from '../../database/entities';
import { actionForHttpMethod, levelAllowsAction } from '../../common/enums';

/**
 * PHASE BBBA (Track 1, BBBA-1c) — authoritative default-DENY module access.
 *
 * Backend counterpart to the frontend `usePermissions.canAccessModule()` flip.
 * Runs AFTER JwtAuthGuard/RolesGuard (so `request.user` is populated). Only gates
 * handlers/controllers carrying `@RequireModule(...)`; everything else passes through.
 *
 * Grant order:
 *   - no `@RequireModule` metadata → allow (not a gated route)
 *   - SuperAdmin → allow
 *   - Admin role → allow (admins administer all modules)
 *   - Contractor role → allow ONLY for 'coi' (mirrors CONTRACTOR_ALLOWED_MODULES)
 *   - otherwise → allow ONLY if a `user_permission_overrides` row grants can_access=true
 */
@Injectable()
export class ModuleAccessGuard implements CanActivate {
  private readonly logger = new Logger(ModuleAccessGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly em: EntityManager,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredModule = this.reflector.getAllAndOverride<string>(
      REQUIRE_MODULE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Not a module-gated route.
    if (!requiredModule) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload;

    if (!user) {
      throw new ForbiddenException('Access denied');
    }

    // SuperAdmin bypasses all checks.
    if (user.is_superadmin) {
      return true;
    }

    const roles = user.roles || [];

    // Admins administer every module.
    if (roles.includes('Admin')) {
      return true;
    }

    const action = actionForHttpMethod(request.method);

    // Contractors are scoped to COI, read-only (kept tight — they may NOT read other modules).
    if (roles.includes('Contractor')) {
      if (requiredModule === 'coi' && action === 'read') {
        return true;
      }
      this.logger.warn(
        `MODULE_ACCESS_DENIED: user=${user.sub}, module=${requiredModule}, action=${action}, reason=CONTRACTOR_SCOPE`,
      );
      throw new ForbiddenException('MODULE_ACCESS_DENIED');
    }

    // PHASE BBBE (Track 1 / Task H): VISIBILITY LAYER — any authenticated CSU user may READ module
    // data (analytics, lists, detail/overview). "Viewing analytics ≠ modifying records." Default-DENY
    // is scoped to WRITES only (it was previously over-applied to reads → broken dashboard, R-342).
    if (action === 'read') {
      return true;
    }

    // AUTHORIZATION LAYER — writes require an explicit override grant AND a sufficient level.
    // Phase HU: university_operations has 2 independent per-pillar sub-modules
    // (university-operations-physical / -financial). The whole controller is gated by the
    // single class-level @RequireModule('university_operations'), so a write would otherwise
    // be checked ONLY against the parent key's level — ignoring a sub-module-scoped
    // Approver/Manager grant entirely (the exact gap Phase HU's sub-module split was meant to
    // enable). When the required module is the parent, also check both sub-modules and allow
    // if ANY of the three grants a sufficient level for this action.
    const em = this.em.fork();
    const candidateKeys =
      requiredModule === 'university_operations'
        ? [
            'university_operations',
            'university-operations-physical',
            'university-operations-financial',
          ]
        : [requiredModule];

    const overrides = await em.find(UserPermissionOverride, {
      userId: user.sub,
      moduleKey: { $in: candidateKeys },
    });

    const granted = overrides.filter((o) => o.canAccess);
    if (granted.length === 0) {
      this.logger.warn(
        `MODULE_ACTION_DENIED: user=${user.sub}, module=${requiredModule}, action=${action}, reason=NO_GRANT`,
      );
      throw new ForbiddenException('MODULE_ACTION_DENIED');
    }
    if (granted.some((o) => levelAllowsAction(o.grantedLevel, action))) {
      return true;
    }

    this.logger.warn(
      `MODULE_ACTION_DENIED: user=${user.sub}, module=${requiredModule}, action=${action}, levels=${granted.map((o) => o.grantedLevel ?? 'none').join(',')}`,
    );
    throw new ForbiddenException('MODULE_ACTION_DENIED');
  }
}
