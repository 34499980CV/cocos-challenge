import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('marketdata')
export class MarketData {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  instrumentid!: number;

  @Column({ type: 'timestamp' })
  date!: Date;

  @Column({ type: 'double precision' })
  close!: number;

  @Column({ type: 'double precision' })
  previousclose!: number;
}
