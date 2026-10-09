import type { RequestHandler } from 'express';
import { getHealthReport } from '../services/health.service.js';

export const getHealth: RequestHandler = (_req, res) => {
  const report = getHealthReport();
  res.status(report.status === 'ok' ? 200 : 503).json(report);
};
