import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { Type } from "class-transformer";

export class SearchRequestDto {
	@IsString()
	@IsOptional()
	q?: string;

	@IsInt()
	@Min(1)
	@Max(100)
	@IsOptional()
	@Type(() => Number)
	take?: number = 10;

	@IsInt()
	@Min(0)
	@IsOptional()
	@Type(() => Number)
	skip?: number = 0;
}
