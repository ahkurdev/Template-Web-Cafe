import { io, type Socket } from 'socket.io-client';
import type { QueryClient } from '@tanstack/react-query';
import type { ClientToServer, ServerToClient } from '@cafe/shared';

export type CafeSocket = Socket<ServerToClient, ClientToServer>;

let socket: CafeSocket | null = null;

/**
 * Satu socket untuk seluruh app. Pelanggan tanpa token — hanya boleh
 * room `menu` dan `order:<id>` miliknya (diverifikasi server).
 */
export const getSocket = (): CafeSocket => {
  socket ??= io({ transports: ['websocket', 'polling'] });
  return socket;
};

/**
 * Socket untuk kecepatan, HTTP untuk kebenaran. Tanpa refetch saat reconnect,
 * event yang terjadi selama offline hilang selamanya.
 */
export const pasangReconnect = (qc: QueryClient, setOffline: (v: boolean) => void): () => void => {
  const s = getSocket();

  const onConnect = () => {
    setOffline(false);
    void qc.invalidateQueries();
  };
  const onDisconnect = () => setOffline(true);

  s.on('connect', onConnect);
  s.on('disconnect', onDisconnect);
  return () => {
    s.off('connect', onConnect);
    s.off('disconnect', onDisconnect);
  };
};
