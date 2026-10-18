import { io, Socket } from 'socket.io-client';

export let socket: Socket = io({
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 10000,
  transports: ['polling', 'websocket'], // Allow HTTP polling fallback over local Wi-Fi
});

export function connectSocket(token: string) {
  const currentToken = (socket.auth as { token?: string } | undefined)?.token;
  // A wake/focus recovery must not tear down a healthy socket: doing so can
  // discard in-flight acknowledgements for mutations that already committed.
  if (socket.connected && currentToken === token) return;

  if (socket.connected) socket.disconnect();
  socket.auth = { token };
  socket.connect();
}

export function disconnectSocket() {
  if (socket.connected) {
    socket.disconnect();
  }
}
