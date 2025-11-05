import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('answersheet_submissions')
export class AnswerSheetSubmissions {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'question_set_id' })
  questionSetId: string;

  @Column({ name: 'parent_id', type: 'text', nullable: true })
  parentId: string;

  @Column('text', { array: true, name: 'file_urls' })
  fileUrls: string[];

  @Column({
    type: 'text',
    default: 'RECEIVED',
  })
  status: 'RECEIVED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'jsonb', name: 'results_history', nullable: true })
  resultsHistory: Array<{
    date: string; // ISO date string
    result: string; // e.g., "Pass", "Fail"
    userId: string;
  }>;

  @Column({ name: 'response_message', nullable: true })
  response_message: string;

  @CreateDateColumn({ nullable: true })
  created_at: Date;

  @UpdateDateColumn({ nullable: true })
  updated_at: Date;

  @Column({ type: 'text', nullable: true })
  created_by: string;

  @Column({ type: 'text', nullable: true })
  updated_by: string;
}
