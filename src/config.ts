/**
 * Single server URL — backend binds HTTP (REST) and WebSocket on the same server.
 * - REST:      {SERVER_URL}/auth/login
 * - Socket.IO: {SERVER_URL}
 *
 * Override per environment with EXPO_PUBLIC_SERVER_URL (e.g. in .env):
 *   EXPO_PUBLIC_SERVER_URL=http://192.168.0.2:3000
 */
export const SERVER_URL: string =
  process.env.EXPO_PUBLIC_SERVER_URL ?? 'http://localhost:3000';
