import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EntityManager } from '@mikro-orm/core';
import { AuthService } from './auth.service';
import { ActivityLogService } from '../activity-logs/activity-log.service';
import {
  User,
  UserRole,
  Role,
  Permission,
  RolePermission,
  UserPermissionOverride,
  UserModuleAssignment,
  UserPillarAssignment,
} from '../database/entities';

describe('AuthService', () => {
  let service: AuthService;

  const mockEm = {
    findOne: jest.fn(),
    find: jest.fn(),
    flush: jest.fn(),
    persistAndFlush: jest.fn(),
    create: jest.fn(),
    getConnection: jest.fn(() => ({
      execute: jest.fn().mockResolvedValue([]),
    })),
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  const mockActivityLog = {
    logAction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: EntityManager, useValue: mockEm },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ActivityLogService, useValue: mockActivityLog },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  describe('service instantiation', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('validateUser', () => {
    it('should return null when user does not exist', async () => {
      mockEm.findOne.mockResolvedValueOnce(null);

      const result = await service.validateUser(
        'nonexistent@test.com',
        'password',
      );

      expect(result).toBeNull();
      expect(mockEm.findOne).toHaveBeenCalledWith(User, expect.any(Object));
    });

    it('should return null when account is inactive', async () => {
      mockEm.findOne.mockResolvedValueOnce({
        id: 'test-uuid',
        email: 'test@test.com',
        passwordHash: 'hash',
        isActive: false,
        googleId: null,
        failedLoginAttempts: 0,
        accountLockedUntil: null,
      });

      const result = await service.validateUser('test@test.com', 'password');

      expect(result).toBeNull();
    });

    it('should return null when account is locked', async () => {
      const futureDate = new Date(Date.now() + 60000);
      mockEm.findOne.mockResolvedValueOnce({
        id: 'test-uuid',
        email: 'test@test.com',
        passwordHash: 'hash',
        isActive: true,
        googleId: null,
        failedLoginAttempts: 5,
        accountLockedUntil: futureDate,
      });

      const result = await service.validateUser('test@test.com', 'password');

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException when credentials are invalid', async () => {
      mockEm.findOne.mockResolvedValueOnce(null);

      await expect(
        service.login({ identifier: 'invalid@test.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getProfile', () => {
    it('should throw UnauthorizedException when user not found', async () => {
      mockEm.findOne.mockResolvedValueOnce(null);

      await expect(service.getProfile('nonexistent-uuid')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return user profile with roles and permissions', async () => {
      mockEm.findOne.mockResolvedValueOnce({
        id: 'test-uuid',
        email: 'test@test.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        avatarUrl: null,
        rankLevel: null,
        campus: null,
      });

      mockEm.find.mockImplementation((entity: any) => {
        if (entity === UserRole) {
          return Promise.resolve([
            { roleId: 'role-uuid', userId: 'test-uuid', isSuperadmin: false },
          ]);
        }
        if (entity === Role) {
          return Promise.resolve([{ id: 'role-uuid', name: 'Admin' }]);
        }
        if (entity === RolePermission) {
          return Promise.resolve([
            { roleId: 'role-uuid', permissionId: 'perm-1' },
            { roleId: 'role-uuid', permissionId: 'perm-2' },
          ]);
        }
        if (entity === Permission) {
          return Promise.resolve([
            { id: 'perm-1', name: 'read:users' },
            { id: 'perm-2', name: 'write:users' },
          ]);
        }
        if (entity === UserPermissionOverride) return Promise.resolve([]);
        if (entity === UserModuleAssignment) return Promise.resolve([]);
        if (entity === UserPillarAssignment) return Promise.resolve([]);
        return Promise.resolve([]);
      });

      const result = await service.getProfile('test-uuid');

      expect(result).toMatchObject({
        id: 'test-uuid',
        email: 'test@test.com',
        first_name: 'Test',
        last_name: 'User',
        avatar_url: null,
        roles: [{ id: 'role-uuid', name: 'Admin' }],
        is_superadmin: false,
        permissions: ['read:users', 'write:users'],
      });
    });
  });

  describe('logout', () => {
    it('should complete without error', async () => {
      await expect(service.logout('test-uuid')).resolves.not.toThrow();
    });
  });

  // T-LDAP-JIT: shared LDAP resolver used by both the unified login path and /api/auth/ldap.
  describe('findOrCreateLdapUser', () => {
    const ORIGINAL_FLAG = process.env.LDAP_AUTO_PROVISION;

    afterEach(() => {
      if (ORIGINAL_FLAG === undefined) delete process.env.LDAP_AUTO_PROVISION;
      else process.env.LDAP_AUTO_PROVISION = ORIGINAL_FLAG;
    });

    it('rejects a non-@carsu.edu.ph email and creates nothing', async () => {
      process.env.LDAP_AUTO_PROVISION = 'true';

      const result = await service.findOrCreateLdapUser({
        email: 'someone@gmail.com',
      });

      expect(result).toBeNull();
      expect(mockEm.create).not.toHaveBeenCalled();
      expect(mockEm.persistAndFlush).not.toHaveBeenCalled();
    });

    it('returns the existing local user without creating a duplicate', async () => {
      const existing = {
        id: 'u1',
        email: 'juan@carsu.edu.ph',
        isActive: true,
        deletedAt: null,
      };
      mockEm.findOne.mockResolvedValueOnce(existing);

      const result = await service.findOrCreateLdapUser({
        email: 'juan@carsu.edu.ph',
      });

      expect(result).toBe(existing);
      expect(mockEm.create).not.toHaveBeenCalled();
    });

    it('creates a dashboard-only account when the flag is on and no row exists', async () => {
      process.env.LDAP_AUTO_PROVISION = 'true';
      mockEm.findOne.mockResolvedValueOnce(null); // no existing user
      mockEm.getConnection.mockReturnValueOnce({
        execute: jest.fn().mockResolvedValue([]), // username free
      });
      const created = {
        id: 'new-uuid',
        email: 'maria@carsu.edu.ph',
        isActive: true,
      };
      mockEm.create.mockReturnValueOnce(created);
      mockEm.persistAndFlush.mockResolvedValueOnce(undefined);

      const result = await service.findOrCreateLdapUser({
        email: 'maria@carsu.edu.ph',
        firstName: 'Maria',
        lastName: 'Santos',
      });

      expect(result).toBe(created);
      expect(mockEm.create).toHaveBeenCalledWith(
        User,
        expect.objectContaining({
          email: 'maria@carsu.edu.ph',
          passwordHash: '',
          isActive: true,
          profileCompleted: false,
        }),
      );
      // Dashboard-only: no role or module assignment is created here.
      expect(mockEm.persistAndFlush).toHaveBeenCalledWith(created);
    });

    it('uses the LDAP uid as the local username when provided (falls back to email local-part otherwise)', async () => {
      process.env.LDAP_AUTO_PROVISION = 'true';
      mockEm.findOne.mockResolvedValueOnce(null);
      mockEm.getConnection.mockReturnValueOnce({
        execute: jest.fn().mockResolvedValue([]),
      });
      const created = { id: 'u9', email: 'herbert.caringal@carsu.edu.ph', isActive: true };
      mockEm.create.mockReturnValueOnce(created);
      mockEm.persistAndFlush.mockResolvedValueOnce(undefined);

      await service.findOrCreateLdapUser({
        email: 'herbert.caringal@carsu.edu.ph', // local-part 'herbert.caringal'
        uid: 'hbcaringal', // ...but the directory uid is different
        firstName: 'Herbert',
        lastName: 'Caringal',
      });

      // Username should be the uid, not the email local-part.
      expect(mockEm.create).toHaveBeenCalledWith(
        User,
        expect.objectContaining({ username: 'hbcaringal' }),
      );
    });

    it('creates nothing when the flag is off and no row exists (fail-closed)', async () => {
      process.env.LDAP_AUTO_PROVISION = 'false';
      mockEm.findOne.mockResolvedValueOnce(null);

      const result = await service.findOrCreateLdapUser({
        email: 'ghost@carsu.edu.ph',
      });

      expect(result).toBeNull();
      expect(mockEm.create).not.toHaveBeenCalled();
    });

    it('resolves the raced row on a 23505 unique-constraint conflict', async () => {
      process.env.LDAP_AUTO_PROVISION = 'true';
      const raced = {
        id: 'raced-uuid',
        email: 'race@carsu.edu.ph',
        isActive: true,
      };
      mockEm.findOne
        .mockResolvedValueOnce(null) // initial lookup: none
        .mockResolvedValueOnce(raced); // post-conflict re-fetch
      mockEm.getConnection.mockReturnValueOnce({
        execute: jest.fn().mockResolvedValue([]),
      });
      mockEm.create.mockReturnValueOnce({ id: 'tmp' });
      mockEm.persistAndFlush.mockRejectedValueOnce({ code: '23505' });

      const result = await service.findOrCreateLdapUser({
        email: 'race@carsu.edu.ph',
      });

      expect(result).toBe(raced);
    });
  });
});
