import 'reflect-metadata';
import dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { Instruments, MarketData, Orders, Users } from '../entities';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not defined. Add it to your .env file before starting the API.');
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: databaseUrl,
  ssl: { rejectUnauthorized: false },
  entities: [Instruments, MarketData, Orders, Users],
  synchronize: false,
  logging: false,
  connectTimeoutMS: 15000,
});
