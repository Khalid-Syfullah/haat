import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/** Turns common database errors into clear 4xx responses instead of a bare 500. */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Prisma');

  catch(err: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const send = (status: number, message: string) => res.status(status).json({ statusCode: status, message, error: HttpStatus[status] });
    switch (err.code) {
      case 'P2002': {
        const target = (err.meta?.target as string[] | string | undefined) ?? [];
        const fields = (Array.isArray(target) ? target : [target]).join(', ');
        return send(409, fields ? `Another record already uses this ${fields}` : 'This value is already in use');
      }
      case 'P2025':
        return send(404, 'Not found. It may have been deleted already.');
      case 'P2003':
        return send(409, 'This record is still in use elsewhere, so it cannot be changed this way');
      case 'P2004':
        return send(409, 'That change would break a store rule (for example, stock below zero)');
      default:
        this.logger.error(err);
        return send(500, 'Something went wrong on our side. Try again in a moment.');
    }
  }
}
