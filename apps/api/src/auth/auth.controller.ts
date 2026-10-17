import { BadRequestException, Body, Controller, Get, HttpCode, HttpException, HttpStatus, Post, Res, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { IsEmail, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';
import { createHash, randomInt } from 'crypto';
import type { Response } from 'express';
import { AuthUser, clearAuthCookie, CurrentUser, effectivePermissions, Public, setAuthCookie } from '../common/auth';
import { SmsService } from '../common/sms.service';
import { normalizePhone } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';

class RegisterDto {
  @IsString() @MinLength(2) @MaxLength(60) name: string;
  @IsString() phone: string;
  @IsString() @MinLength(6) @MaxLength(72) password: string;
  @IsOptional() @IsEmail() email?: string;
}

class LoginDto {
  /** Phone number or email */
  @IsString() login: string;
  @IsString() password: string;
}

class OtpRequestDto {
  @IsString() phone: string;
}

class OtpVerifyDto {
  @IsString() phone: string;
  @IsString() @Length(6, 6) code: string;
  @IsOptional() @IsString() @MaxLength(60) name?: string;
}

export function publicUser(user: Pick<User, 'id' | 'name' | 'phone' | 'email' | 'role' | 'coins' | 'permissions' | 'marketingSms'>) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    role: user.role,
    coins: user.coins,
    permissions: effectivePermissions(user),
    marketingSms: user.marketingSms,
  };
}

function hashOtp(phone: string, code: string) {
  return createHash('sha256').update(`${phone}:${code}:${process.env.JWT_SECRET}`).digest('hex');
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly sms: SmsService,
  ) {}

  private async signIn(res: Response, user: User) {
    const token = await this.jwt.signAsync({ sub: user.id, role: user.role });
    setAuthCookie(res, token);
    return { user: publicUser(user) };
  }

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const phone = normalizePhone(dto.phone);
    const email = dto.email?.toLowerCase().trim() || null;
    const exists = await this.prisma.user.findFirst({ where: { OR: [{ phone }, ...(email ? [{ email }] : [])] } });
    if (exists) throw new BadRequestException('An account with this phone or email already exists. Log in instead.');
    const user = await this.prisma.user.create({
      data: { name: dto.name.trim(), phone, email, passwordHash: await hash(dto.password, 10), cart: { create: {} } },
    });
    return this.signIn(res, user);
  }

  @Public()
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const login = dto.login.trim();
    let user: User | null = null;
    if (login.includes('@')) {
      user = await this.prisma.user.findUnique({ where: { email: login.toLowerCase() } });
    } else {
      user = await this.prisma.user.findUnique({ where: { phone: normalizePhone(login) } });
    }
    if (!user?.passwordHash || !user.isActive || !(await compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Wrong phone/email or password');
    }
    return this.signIn(res, user);
  }

  /** Sends a 6-digit code by SMS. With SMS_PROVIDER=console the code is logged, and returned outside production for local testing. */
  @Public()
  @HttpCode(200)
  @Post('otp/request')
  async otpRequest(@Body() dto: OtpRequestDto) {
    const phone = normalizePhone(dto.phone);
    const recent = await this.prisma.otpCode.count({
      where: { phone, createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) } },
    });
    if (recent >= 3) throw new HttpException('Too many codes requested. Try again in 10 minutes.', HttpStatus.TOO_MANY_REQUESTS);
    const code = String(randomInt(100000, 999999));
    const otp = await this.prisma.otpCode.create({
      data: { phone, codeHash: hashOtp(phone, code), expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
    });
    const consoleMode = this.sms.provider === 'console';
    const sms = await this.sms.send(phone, `Your Tuktak Bazaar login code is ${code}. It expires in 5 minutes. Never share it.`, 'otp');
    if (!sms.ok) {
      // The code never reached the phone, so it shouldn't count towards the 3-per-10-minutes limit.
      await this.prisma.otpCode.delete({ where: { id: otp.id } });
      throw new HttpException('We could not send the code just now. Try again in a minute.', HttpStatus.SERVICE_UNAVAILABLE);
    }
    const isNew = !(await this.prisma.user.findUnique({ where: { phone }, select: { id: true } }));
    return { sent: true, isNewUser: isNew, ...(consoleMode && process.env.NODE_ENV !== 'production' ? { devCode: code } : {}) };
  }

  @Public()
  @HttpCode(200)
  @Post('otp/verify')
  async otpVerify(@Body() dto: OtpVerifyDto, @Res({ passthrough: true }) res: Response) {
    const phone = normalizePhone(dto.phone);
    const otp = await this.prisma.otpCode.findFirst({
      where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp || otp.attempts >= 5) throw new UnauthorizedException('Code expired. Request a new one.');
    if (otp.codeHash !== hashOtp(phone, dto.code)) {
      await this.prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw new UnauthorizedException('Wrong code');
    }
    await this.prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
    let user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      user = await this.prisma.user.create({ data: { phone, name: dto.name?.trim() || 'Tuktak Bazaar customer', cart: { create: {} } } });
    }
    if (!user.isActive) throw new UnauthorizedException('This account is disabled');
    return this.signIn(res, user);
  }

  @Public()
  @HttpCode(200)
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    clearAuthCookie(res);
    return { ok: true };
  }

  @Public()
  @Get('me')
  async me(@CurrentUser() auth?: AuthUser) {
    if (!auth) return { user: null };
    const user = await this.prisma.user.findUnique({ where: { id: auth.id } });
    const unread = await this.prisma.notification.count({ where: { userId: auth.id, readAt: null } });
    const cart = await this.prisma.cartItem.count({ where: { cart: { userId: auth.id } } });
    return { user: user ? publicUser(user) : null, unreadNotifications: unread, cartCount: cart };
  }
}
