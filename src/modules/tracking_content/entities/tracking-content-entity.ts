import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'content_tracking' })
export class ContentTracking {
  @PrimaryGeneratedColumn('uuid')
  contentTrackingId: string;

  @Column('uuid')
  userId: string;

  @Column()
  courseId: string;

  @Column()
  batchId: string;

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
}
