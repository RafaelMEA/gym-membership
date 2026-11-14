import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { env } from './config/env.js';
import { memberRouter } from './modules/members/member.routes.js';
import { planRouter } from './modules/plans/plans.routes.js';
import { subscriptionRouter } from './modules/subscriptions/subscriptions.routes.js'
import { paymentRouter } from './modules/payments/payments.routes.js'
import { attendanceRouter } from './modules/attendance/attendance.routes.js'
import { webRouter } from './modules/web/web.routes.js'
import { notFoundHandler, errorHandler } from './middleware/error.js';

import cookieParser from 'cookie-parser';
import { authRouter } from './modules/auth/auth.routes.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export const app = express();

// Pages
app.set('view engine', 'ejs');
app.set('views', path.join(currentDir, 'views'));

// Static: the user's gym photos and the built Tailwind CSS.
// NOTE: `tsc` only copies .js to dist/ — images and views stay in src/,
// so these absolute paths only work when running via tsx from src/.
app.use('/assets', express.static(path.join(currentDir, 'assets')));
app.use('/static', express.static(path.join(currentDir, 'public')));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', env: env.NODE_ENV });
});

app.use(cookieParser());
app.use('/api/auth', authRouter);
app.use('/api/members', memberRouter);
app.use('/api/plans', planRouter)
app.use('/api/subscriptions', subscriptionRouter)
app.use('/api/payments', paymentRouter)
app.use('/api/attendance', attendanceRouter)

// Page routes LAST, just before the 404 handler — '/' and '/login'
// must not shadow the API or health routes above.
app.use('/', webRouter);
app.use(notFoundHandler);
app.use(errorHandler);
