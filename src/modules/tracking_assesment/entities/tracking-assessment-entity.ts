import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class AssessmentTracking {
  @PrimaryGeneratedColumn('uuid')
  assessment_tracking_id: string;

  @Column('uuid')
  user_id: string;

  @Column()
  course_id: string;

  @Column()
  batch_id: string;

  @Column()
  content_id: string;

  @Column()
  attempt_id: string;

  @Column({ type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
  created_on: Date;

  @Column()
  grand_total: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  last_attempted_on: Date;

  @Column('jsonb')
  assessment_summary: Record<string, any>;

  @Column('double precision')
  total_max_score: number;

  @Column('double precision')
  total_score: number;

  @Column({ type: 'timestamp with time zone' })
  updated_on: Date;
}
