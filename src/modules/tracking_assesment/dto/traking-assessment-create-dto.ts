import { Expose } from "class-transformer";
import {
    IsNotEmpty,
    IsString,
    IsNumber,
    IsDateString,
    IsUUID,
    IsOptional,
    IsArray,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateAssessmentTrackingDto {
    @Expose()
    assessment_tracking_id: string;

    @ApiProperty({
        type: () => String,
        description: "User Id",
    })
    @Expose()
    @IsUUID(undefined, { message: 'User Id must be a valid UUID' })
    @IsNotEmpty()
    user_id: string;

    @ApiPropertyOptional({
        type: () => String,
        description: "Course Id",
    })
    @Expose()
    @IsString()
    course_id: string;

    @ApiPropertyOptional({
        type: () => String,
        description: "Batch Id",
    })
    @Expose()
    @IsString()
    batch_id: string;

    @ApiPropertyOptional({
        type: () => String,
        description: "Content values",
    })
    @Expose()
    @IsString()
    content_id: string;

    @ApiPropertyOptional({
        type: () => String,
        description: "Attempt Id",
    })
    @Expose()
    @IsString()
    attempt_id: string;

    @Expose()
    @IsDateString()
    created_on: Date;

    @ApiPropertyOptional({
        type: () => String,
        description: "Grand total values",
    })
    @Expose()
    @IsString()
    grand_total: string;

    @ApiPropertyOptional({
        type: () => Date,
        description: "Last Attempted Date",
    })
    @Expose()
    @IsDateString()
    @IsOptional()
    last_attempted_on: Date;

    @ApiPropertyOptional({
        type: String,
        description: "Assessment Summary",
        default: [],
    })
    @Expose()
    @IsArray()
    @IsOptional()
    assessment_summary: string[];



    @ApiPropertyOptional({
        type: () => Number,
        description: "Total max score values",
    })
    @Expose()
    @IsNumber()
    total_max_score: number;

    @ApiPropertyOptional({
        type: () => Number,
        description: "Total score values",
    })
    @Expose()
    @IsNumber()
    total_score: number;

    constructor(obj?: Partial<CreateAssessmentTrackingDto>) {
        if (obj) {
            Object.assign(this, obj);
        }
    }
}
