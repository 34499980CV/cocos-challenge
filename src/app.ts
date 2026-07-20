import express from 'express';
import portfolioRoutes from './routes/portfolio.routes';
import instrumentsRoutes from './routes/instruments.routes';
import ordersRoutes from './routes/orders.routes';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/portfolio', portfolioRoutes);
app.use('/api/instruments', instrumentsRoutes);
app.use('/api/orders', ordersRoutes);

app.use(errorHandler);

export default app;
