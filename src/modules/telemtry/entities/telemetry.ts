import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    BaseEntity,
  } from 'typeorm';
  
  @Entity('telemetry')
  export class Telemetry extends BaseEntity {
    @PrimaryGeneratedColumn()
    id: number;
  
    @Column({ type: 'bigint', nullable: false })
    syncts: number;
  
    @Column({ type: 'jsonb', nullable: false })
    params: object;
  
    @Column({ type: 'bigint', nullable: false })
    ets: number;
  
    @Column({ type: 'jsonb', nullable: false })
    events: object;
  
    @Column({ type: 'varchar', nullable: false })
    mid: string;
  
    @Column({ type: 'varchar', nullable: false })
    api_id: string;
  
    @Column({ type: 'varchar', nullable: false })
    ver: string;
  
    @Column({ type: 'varchar', nullable: false })
    channel: string;
  
    @Column({ type: 'varchar', nullable: false })
    pid: string;
  }
  