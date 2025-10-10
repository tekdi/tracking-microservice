import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';
import { IsOptional, IsUUID } from 'class-validator';

@Entity({ name: 'content_tracking' })
@Index('idx_content_tracking_user_course_tenant', ['userId', 'courseId', 'tenantId'])
@Index('idx_content_tracking_user_tenant', ['userId', 'tenantId'])
@Index('idx_content_tracking_course_tenant', ['courseId', 'tenantId'])
@Index('idx_content_tracking_created_on', ['createdOn'])
export class ContentTracking {
  @PrimaryGeneratedColumn('uuid')
  contentTrackingId: string;

  @Column('uuid')
  userId: string;

  @Column()
  courseId: string;

  @Column()
  contentId: string;

  @Column()
  contentType: string;

  @Column()
  contentMime: string;

  @Column({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdOn: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  lastAccessOn: Date;

  @Column({ type: 'timestamp with time zone' })
  updatedOn: Date;

  @Column()
  unitId: string;

  @Column({ type: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  tenantId: string;
}
