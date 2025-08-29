import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { IsOptional, IsUUID } from 'class-validator';

@Entity({ name: 'content_tracking' })
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
