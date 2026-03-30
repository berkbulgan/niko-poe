// ABOUTME: DTO for testing a regex pattern against sample text.
// Used by the POST /regex-filters/test endpoint.

import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TestRegexDto {
  @ApiProperty({ example: '\\+[89]\\d to maximum Life' })
  @IsString()
  @IsNotEmpty()
  pattern!: string;

  @ApiProperty({
    example: '+92 to maximum Life\n+45 to maximum Mana\n+38% to Fire Resistance',
  })
  @IsString()
  @IsNotEmpty()
  text!: string;
}
