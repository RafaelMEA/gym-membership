import express from 'express';
import { env } from './config/env.js';
import { memberRouter } from './modules/members/member.routes.js';
import { planRouter } from './modules/plans/plans.routes.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';

import cookieParser from 'cookie-parser';
import { authRouter } from './modules/auth/auth.routes.js';

export const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', env: env.NODE_ENV });
});

app.use(cookieParser());
app.use('/api/auth', authRouter);
app.use('/api/members', memberRouter);
app.use('/api/plans', planRouter)
app.use(notFoundHandler);
app.use(errorHandler);
