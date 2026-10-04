import express from 'express';
import { env } from './config/env.js';
import { memberRouter } from './modules/members/member.routes.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';

export const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', env: env.NODE_ENV });
});

app.use('/api/members', memberRouter);
app.use(notFoundHandler);
app.use(errorHandler);
