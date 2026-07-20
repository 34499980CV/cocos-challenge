import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('instruments')
export class Instruments {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'text' })
  ticker!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  type!: string;
}
