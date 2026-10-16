import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { publicUser } from '../auth/auth.controller';
import { AuthUser, CurrentUser } from '../common/auth';
import { isValidLocation } from '../common/locations';
import { normalizePhone } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';

class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(60) name?: string;
  @IsOptional() @IsEmail() email?: string;
}

class ChangePasswordDto {
  @IsOptional() @IsString() current?: string;
  @IsString() @MinLength(6) @MaxLength(72) next: string;
}

class AddressDto {
  @IsString() @MinLength(2) @MaxLength(60) fullName: string;
  @IsString() phone: string;
  @IsString() division: string;
  @IsString() district: string;
  @IsString() @MinLength(2) @MaxLength(60) area: string;
  @IsString() @MinLength(4) @MaxLength(200) line: string;
  @IsOptional() @IsString() @MaxLength(20) label?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

@Controller('account')
export class AccountController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('profile')
  async profile(@CurrentUser() auth: AuthUser) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.id } });
    return { user: { ...publicUser(user), hasPassword: !!user.passwordHash, createdAt: user.createdAt } };
  }

  @Patch('profile')
  async updateProfile(@CurrentUser() auth: AuthUser, @Body() dto: UpdateProfileDto) {
    const email = dto.email?.toLowerCase().trim();
    if (email) {
      const taken = await this.prisma.user.findFirst({ where: { email, NOT: { id: auth.id } } });
      if (taken) throw new BadRequestException('That email is already used by another account');
    }
    const user = await this.prisma.user.update({ where: { id: auth.id }, data: { name: dto.name?.trim(), email } });
    return { user: publicUser(user) };
  }

  @Post('password')
  async changePassword(@CurrentUser() auth: AuthUser, @Body() dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.id } });
    if (user.passwordHash && !(dto.current && (await compare(dto.current, user.passwordHash)))) {
      throw new BadRequestException('Current password is wrong');
    }
    await this.prisma.user.update({ where: { id: auth.id }, data: { passwordHash: await hash(dto.next, 10) } });
    return { ok: true };
  }

  @Get('addresses')
  async addresses(@CurrentUser() auth: AuthUser) {
    return this.prisma.address.findMany({ where: { userId: auth.id }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] });
  }

  @Post('addresses')
  async createAddress(@CurrentUser() auth: AuthUser, @Body() dto: AddressDto) {
    const data = this.clean(dto);
    const count = await this.prisma.address.count({ where: { userId: auth.id } });
    if (count >= 10) throw new BadRequestException('You can save up to 10 addresses');
    const isDefault = dto.isDefault || count === 0;
    return this.prisma.$transaction(async (tx) => {
      if (isDefault) await tx.address.updateMany({ where: { userId: auth.id }, data: { isDefault: false } });
      return tx.address.create({ data: { ...data, userId: auth.id, isDefault } });
    });
  }

  @Patch('addresses/:id')
  async updateAddress(@CurrentUser() auth: AuthUser, @Param('id') id: string, @Body() dto: AddressDto) {
    const existing = await this.prisma.address.findFirst({ where: { id, userId: auth.id } });
    if (!existing) throw new NotFoundException('Address not found');
    const data = this.clean(dto);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) await tx.address.updateMany({ where: { userId: auth.id }, data: { isDefault: false } });
      return tx.address.update({ where: { id }, data: { ...data, isDefault: dto.isDefault ?? existing.isDefault } });
    });
  }

  @Delete('addresses/:id')
  async deleteAddress(@CurrentUser() auth: AuthUser, @Param('id') id: string) {
    const existing = await this.prisma.address.findFirst({ where: { id, userId: auth.id } });
    if (!existing) throw new NotFoundException('Address not found');
    await this.prisma.address.delete({ where: { id } });
    if (existing.isDefault) {
      const next = await this.prisma.address.findFirst({ where: { userId: auth.id }, orderBy: { createdAt: 'desc' } });
      if (next) await this.prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    return { ok: true };
  }

  private clean(dto: AddressDto) {
    if (!isValidLocation(dto.division, dto.district)) throw new BadRequestException('Pick a valid division and district');
    return {
      fullName: dto.fullName.trim(),
      phone: normalizePhone(dto.phone),
      division: dto.division,
      district: dto.district,
      area: dto.area.trim(),
      line: dto.line.trim(),
      label: dto.label?.trim() || 'Home',
    };
  }
}
