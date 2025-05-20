import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'content_tracking_details' })
export class ContentTrackingDetail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  contentTrackingId: string;

  @Column({ type: 'character varying', nullable: false })
  userId: string;

  @Column()
  eid: string;

  @Column('jsonb')
  edata: Record<string, any>;

  @Column('numeric')
  duration: number;

  @Column()
  mode: string;

  @Column()
  pageid: string;

  @Column()
  type: string;

  @Column()
  subtype: string;

  @Column('jsonb')
  summary: Record<string, any>;

  @Column('numeric')
  progress: number;

  @Column({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdOn: Date;
  
  @Column({ type: 'timestamp with time zone' })
  updatedOn: Date;
}
