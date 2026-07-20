import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { OrderSide, OrderStatus, OrderType } from '../enums';

@Entity('orders')
export class Orders {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'integer' })
  userid!: number;

  @Column({ type: 'integer' })
  instrumentid!: number;

  @Column({ type: 'enum', enum: OrderSide })
  side!: OrderSide;

  @Column({ type: 'enum', enum: OrderType })
  type!: OrderType;

  @Column({ type: 'enum', enum: OrderStatus })
  status!: OrderStatus;

  @Column({ type: 'double precision' })
  size!: number;

  @Column({ type: 'double precision', nullable: true })
  price!: number | null;

  @Column({ type: 'timestamp' })
  datetime!: Date;
}
