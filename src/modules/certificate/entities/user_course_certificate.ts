import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'user_course_certificate' })
export class UserCourseCertificate {
  @PrimaryGeneratedColumn('uuid')
  usercertificateId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column()
  courseId: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column()
  certificateId: string;

  @Column()
  status: string;

  @Column({ type: 'timestamptz', nullable: true })
  issuedOn: Date;

  @CreateDateColumn({
    type: 'timestamptz',
    default: () => 'now()',
    nullable: false,
  })
  createdOn: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
    default: () => 'now()',
    nullable: false,
  })
  updatedOn: Date;
}
