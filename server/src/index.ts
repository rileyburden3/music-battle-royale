import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

import usersRouter from './routes/users.js';
import battlesRouter from './routes/battles.js';
import songsRouter from './routes/songs.js';
import rankingsRouter from './routes/rankings.js';
import leaderboardRouter from './routes/leaderboard.js';
import notificationsRouter from './routes/notifications.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000, standardHeaders: true });
app.use('/api/', limiter);

// Logging + parsing
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Routes
app.use('/api/users', usersRouter);
app.use('/api/battles', battlesRouter);
app.use('/api/songs', songsRouter);
app.use('/api/rankings', rankingsRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/notifications', notificationsRouter);

// 404
app.use((_req, res) => res.status(404).json({ success: false, error: 'Not found' }));

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🥊 Battle Royale server running on port ${PORT}`);
});

export default app;
