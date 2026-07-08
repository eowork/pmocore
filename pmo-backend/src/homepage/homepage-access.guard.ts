import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { JwtPayload } from '../common/interfaces';
import { UserPermissionOverride } from '../database/entities';

/**
 * T-HOME-CMS-6 (TH6-5) — Public Website / Homepage Management access.
 *
 * SuperAdmin always passes; everyone else (including Admins) needs an explicit
 * `user_permission_overrides` row with moduleKey='homepage' and canAccess=true.
 *
 * Deliberately NOT ModuleAccessGuard: that guard auto-allows any Admin
 * ("Admins administer every module"), which is exactly the behavior this
 * restriction removes for public-website content. Same override table, same
 * lookup shape — only the Admin bypass differs.
 */
@Injectable()
export class HomepageAccessGuard implements CanActivate {
  private readonly logger = new Logger(HomepageAccessGuard.name);

  constructor(private readonly em: EntityManager) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload;

    if (!user) {
      throw new ForbiddenException('Access denied');
    }

    if (user.is_superadmin) {
      return true;
    }

    const override = await this.em.fork().findOne(UserPermissionOverride, {
      userId: user.sub,
      moduleKey: 'homepage',
    });

    if (override?.canAccess) {
      return true;
    }

    this.logger.warn(
      `HOMEPAGE_ACCESS_DENIED: user=${user.sub}, reason=NO_HOMEPAGE_GRANT`,
    );
    throw new ForbiddenException('HOMEPAGE_ACCESS_DENIED');
  }
}
