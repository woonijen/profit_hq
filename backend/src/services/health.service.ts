import mongoose from 'mongoose';

export interface HealthReport {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  timestamp: string;
  database: 'connected' | 'connecting' | 'disconnecting' | 'disconnected';
}

const READY_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
} as const;

export function getHealthReport(): HealthReport {
  const database = READY_STATES[mongoose.connection.readyState as keyof typeof READY_STATES];
  return {
    status: database === 'connected' ? 'ok' : 'degraded',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    database,
  };
}
