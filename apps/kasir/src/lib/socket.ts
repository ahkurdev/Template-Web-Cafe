import { io, type Socket } from 'socket.io-client';
import type { QueryClient } from '@tanstack/react-query';
import type { ClientToServer, ServerToClient } from '@cafe/shared';
import { ambilToken } from './api.js';

export type CafeSocket = Socket<ServerToClient, ClientToServer>;

let socket: CafeSocket | null = null;

/**
 * Satu socket untuk seluruh app. Token dikirim di handshake — server yang
 * menentukan room dari role di JWT, klien tidak boleh memilih room sendiri.
 */
export const getSocket = (): CafeSocket => {
  socket ??= io({
    transports: ['websocket', 'polling'],
    auth: { token: ambilToken() ?? '' },
  });
  return socket;
};

/** Dipanggil setelah login/logout: handshake lama membawa token lama. */
export const resetSocket = (): void => {
  socket?.disconnect();
  socket = null;
};

/**
 * Socket untuk kecepatan, HTTP untuk kebenaran. Tanpa refetch saat reconnect,
 * order yang masuk selama koneksi mati tidak pernah muncul di layar kasir.
 */
export const pasangReconnect = (
  qc: QueryClient,
  setOffline: (v: boolean) => void,
): (() => void) => {
  const s = getSocket();

  const onConnect = () => {
    setOffline(false);
    void qc.invalidateQueries();
  };
  const onDisconnect = () => setOffline(true);

  s.on('connect', onConnect);
  s.on('disconnect', onDisconnect);
  setOffline(!s.connected);

  return () => {
    s.off('connect', onConnect);
    s.off('disconnect', onDisconnect);
  };
};
