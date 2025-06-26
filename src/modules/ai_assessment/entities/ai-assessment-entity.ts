import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'assessment_generate_tracker' })
export class AiAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  question_set_id: string;

  @Column({
    type: 'text',
    nullable: false,
  })
  assessment_mode: 'ONLINE' | 'OFFLINE';

  @Column({
    type: 'text',
    default: 'INITIATED',
  })
  status: 'INITIATED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

  @Column({ type: 'text', nullable: true })
  response_message?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
