import { io, type Socket } from 'socket.io-client';
import type { QueryClient } from '@tanstack/react-query';
import type { ClientToServer, ServerToClient } from '@cafe/shared';
import { ambilToken } from './api.js';

export type CafeSocket = Socket<ServerToClient, ClientToServer>;

let socket: CafeSocket | null = null;

/** Token di handshake — server yang menaruh socket ini di room `kitchen`. */
export const getSocket = (): CafeSocket => {
  socket ??= io({
    transports: ['websocket', 'polling'],
    auth: { token: ambilToken() ?? '' },
  });
  return socket;
};

export const resetSocket = (): void => {
  socket?.disconnect();
  socket = null;
};

/**
 * Refetch saat reconnect. Ini yang membuat antrian tersusul lengkap setelah
 * WiFi dapur drop — tanpa ini order yang masuk saat mati hilang selamanya.
 */
export const pasangReconnect = (
  qc: QueryClient,
  setTersambung: (v: boolean) => void,
): (() => void) => {
  const s = getSocket();

  const onConnect = () => {
    setTersambung(true);
    void qc.invalidateQueries();
  };
  const onDisconnect = () => setTersambung(false);

  s.on('connect', onConnect);
  s.on('disconnect', onDisconnect);
  setTersambung(s.connected);

  return () => {
    s.off('connect', onConnect);
    s.off('disconnect', onDisconnect);
  };
};
