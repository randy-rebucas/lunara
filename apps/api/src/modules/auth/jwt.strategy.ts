import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type { JwtPayload } from '@lunara/types';
import { getJwtSecret } from '../../common/config/jwt-config';

function fromCookie(req: Request): string | null {
  return (req?.cookies as Record<string, string> | undefined)?.portal_token ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        fromCookie,
      ]),
      secretOrKey: getJwtSecret(),
    });
  }

  validate(payload: JwtPayload) {
    return payload;
  }
}
