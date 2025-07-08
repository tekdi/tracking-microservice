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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
