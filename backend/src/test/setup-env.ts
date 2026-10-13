// Runs before every test file. Gives the app's env validation values that are safe for tests
// and makes sure nothing can point at the development database.

try {
  // Picks up MONGODB_URI_TEST from backend/.env. Variables already set win over the file.
  process.loadEnvFile();
} catch {
  // No .env file (e.g. CI): everything needed is set below or provided by the environment.
}

process.env.NODE_ENV = 'test';
process.env.CLIENT_ORIGIN ??= 'http://localhost:5173';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-0123456789abcdef';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-0123456789abcdef';

// Only ever the dedicated test database. Without one, DB-backed tests skip themselves.
process.env.MONGODB_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/unused';
