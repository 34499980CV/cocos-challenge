import 'reflect-metadata';
import dotenv from 'dotenv';
import app from './app';
import { AppDataSource } from './config/data-source';

dotenv.config();

const PORT = Number(process.env.PORT ?? 3000);

async function bootstrap(): Promise<void> {
  try {
    await AppDataSource.initialize();

    app.listen(PORT, () => {
      console.log(`Trading API running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('TypeORM initialization failed:', error);
    process.exit(1);
  }
}

void bootstrap();
