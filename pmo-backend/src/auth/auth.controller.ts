import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  UseFilters,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto';
import { Public, CurrentUser, Roles } from './decorators';
import { JwtAuthGuard, RolesGuard } from './guards';
import { OAuthFailureFilter } from './filters/oauth-failure.filter';
import { JwtPayload } from '../common/interfaces';

@ApiTags('Authentication')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
  @ApiOperation({
    summary: 'User login',
    description: 'Authenticate user with email/username and password',
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful, returns JWT token and user info',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or account locked',
  })
  @ApiResponse({ status: 429, description: 'Too many login attempts' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // PHASE BBBA (BBBA-0a): public self-registration is CLOSED. This endpoint is now an
  // admin-only account-creation surface (invite). It creates an account with NO role and
  // NO module access — dashboard-only until an administrator grants permissions.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  @ApiBearerAuth('JWT-auth')
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Admin-only account creation (CSU institutional users)', description: 'Creates an account with NO module access (dashboard-only) until an administrator grants module permissions. Replaces public self-registration.' })
  @ApiResponse({ status: 201, description: 'Account created — dashboard-only until access is granted' })
  @ApiResponse({ status: 400, description: 'Validation error or passwords do not match' })
  @ApiResponse({ status: 403, description: 'Forbidden — administrator role required' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('request-password-reset')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({
    summary: 'Request password reset (public)',
    description: 'Creates a pending reset request for admin review',
  })
  @ApiResponse({
    status: 200,
    description: 'Request submitted (always returns success for security)',
  })
  async requestPasswordReset(
    @Body() body: { identifier: string; notes?: string },
  ) {
    return this.authService.createPasswordResetRequest(
      body.identifier,
      body.notes,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Returns the authenticated user profile',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  async getProfile(@CurrentUser() user: JwtPayload) {
    return this.authService.getProfile(user.sub);
  }

  // NNN-H: authenticated profile update (display name + phone)
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update own profile',
    description: 'Updates the authenticated user display name and phone',
  })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      displayName?: string;
      phone?: string;
      position?: string;
      office?: string;
      campus?: string;
      profile_completed?: boolean;
    },
  ) {
    return this.authService.updateProfile(user.sub, body);
  }

  // NNN-G: authenticated self-service change password
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 600000 } }) // 3 attempts per 10 minutes
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Change own password',
    description:
      'Authenticated self-service password change (separate from public reset). Requires current password.',
  })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({
    status: 400,
    description: 'Validation error, wrong current password, or SSO-only account',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Too many attempts' })
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    },
  ) {
    return this.authService.changePassword(user.sub, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'User logout',
    description: 'Logs out the user (audit trail only, JWT remains valid)',
  })
  @ApiResponse({ status: 204, description: 'Logout successful' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  async logout(@CurrentUser() user: JwtPayload) {
    await this.authService.logout(user.sub);
  }

  // Phase HT: Google OAuth routes (Directives 204–206)
  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({
    summary: 'Initiate Google OAuth login',
    description: 'Redirects to Google consent screen',
  })
  async googleLogin() {
    // Passport handles redirect to Google OAuth — no body needed
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  // PHASE BBBD (Track 4): on rejection (e.g. non-@carsu.edu.ph), redirect to a branded page
  // instead of returning raw 401 JSON.
  @UseFilters(OAuthFailureFilter)
  @ApiOperation({
    summary: 'Google OAuth callback',
    description: 'Handles Google OAuth response and redirects to frontend',
  })
  async googleCallback(@Req() req: any, @Res() res: Response) {
    const { access_token } = await this.authService.loginWithGoogleUser(
      req.user.id,
    );
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3001',
    );
    res.redirect(
      `${frontendUrl}/auth/callback?token=${encodeURIComponent(access_token)}`,
    );
  }

  // Phase HY: OpenLDAP login — credentials in body (username + password)
  @Public()
  @Post('ldap')
  @UseGuards(AuthGuard('ldap'))
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per minute — mirrors /auth/login
  @ApiOperation({
    summary: 'LDAP login',
    description: 'Authenticate with institutional LDAP/AD credentials',
  })
  @ApiResponse({ status: 200, description: 'Returns JWT access token' })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or account not found',
  })
  @ApiResponse({ status: 503, description: 'LDAP server not configured' })
  async ldapLogin(@Req() req: any) {
    return this.authService.loginWithLdapUser(req.user.id);
  }
}
