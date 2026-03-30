// ABOUTME: DTO for user login requests.
// Validates that username and password are non-empty strings.

import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'test1' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
