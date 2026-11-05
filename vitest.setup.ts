import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';

process.env.JWT_SECRET ??= 'secret-de-test-0123456789abcdef0123456789';
process.env.DB_ENCRYPTION_KEY ??= 'clau-de-test';

afterEach(() => {
  vi.restoreAllMocks();
});
