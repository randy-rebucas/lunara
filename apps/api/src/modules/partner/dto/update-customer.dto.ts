import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Deliberately has no `phone` field. A customer's phone number is their login credential for
 * phone-OTP auth (see AuthService.login/requestOtp) with no separate verification flag the way
 * email has `isEmailVerified` — letting a partner silently repoint it here would let any partner
 * a customer has ever ordered from redirect that customer's OTP to a number the partner controls
 * and take over the account. Global ValidationPipe(forbidNonWhitelisted: true) rejects a `phone`
 * field in the request body outright rather than silently dropping it.
 */
export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;
}
