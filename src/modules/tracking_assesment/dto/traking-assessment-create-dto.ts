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
    assessmentTrackingId: string;

    @Expose()
    createdOn: Date;

    @Expose()
    lastAttemptedOn: Date;


    @ApiProperty({
        type: () => String,
        description: "User Id",
    })
    @Expose()
    @IsUUID(undefined, { message: 'User Id must be a valid UUID' })
    @IsNotEmpty()
    userId: string;

    @ApiPropertyOptional({
        type: () => String,
        description: "Course Id",
    })
    @Expose()
    @IsString()
    @IsOptional()
    @IsNotEmpty()
    courseId: string;

    @ApiPropertyOptional({
        type: () => String,
        description: "Batch Id",
    })
    @Expose()
    @IsString()
    @IsOptional()
    @IsNotEmpty()
    batchId: string;

    @ApiPropertyOptional({
        type: () => String,
        description: "Content values",
    })
    @Expose()
    @IsString()
    @IsOptional()
    @IsNotEmpty()
    contentId: string;

    @ApiPropertyOptional({
        type: () => String,
        description: "Attempt Id",
    })
    @Expose()
    @IsString()
    @IsOptional()
    @IsNotEmpty()
    attemptId: string;



    @ApiPropertyOptional({
        type: String,
        description: "Assessment Summary",
        default: [],
    })
    @Expose()
    @IsArray()
    @IsOptional()
    @IsNotEmpty()
    assessmentSummary: string[];



    @ApiPropertyOptional({
        type: () => Number,
        description: "Total max score values",
    })
    @Expose()
    @IsNumber()
    @IsOptional()
    @IsNotEmpty()
    totalMaxScore: number;

    @ApiPropertyOptional({
        type: () => Number,
        description: "Total score values",
    })
    @Expose()
    @IsNumber()
    @IsOptional()
    @IsNotEmpty()
    totalScore: number;

    @ApiPropertyOptional({
        type: () => Number,
        description: "Time Spent",
    })
    @Expose()
    @IsNumber()
    @IsOptional()
    @IsNotEmpty()
    timeSpent: number;

    constructor(obj?: Partial<CreateAssessmentTrackingDto>) {
        if (obj) {
            Object.assign(this, obj);
        }
    }
}
