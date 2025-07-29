import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'assessment_tracking_score_detail' })
export class AssessmentTrackingScoreDetail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @Column('uuid')
  assessmentTrackingId: string;

  @Column()
  questionId: string;

  @Column()
  pass: string;

  @Column()
  sectionId: string;

  @Column()
  resValue: string;

  @Column('numeric')
  duration: number;

  @Column()
  score: string;

  @Column('numeric')
  maxScore: number;

  @Column()
  queTitle: string;

  @Column()
  feedback: string;
}
