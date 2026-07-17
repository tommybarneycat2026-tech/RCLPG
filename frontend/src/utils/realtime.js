import { io } from "socket.io-client";

let socket = null;

function getSocketUrl() {
  return import.meta.env.VITE_SOCKET_URL || window.location.origin;
}

function emitLocalEvent(eventName, payload) {
  window.dispatchEvent(
    new CustomEvent(`realtime:${eventName}`, { detail: payload }),
  );
}

export function connectRealtime(token) {
  if (!token) return null;

  if (socket?.connected) {
    return socket;
  }

  socket = io(getSocketUrl(), {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.onAny((eventName, payload) => {
    emitLocalEvent(eventName, payload);
  });

  socket.on("connect_error", () => {
    // Intentionally ignored; the UI will keep retrying in the background.
  });

  return socket;
}

export function disconnectRealtime() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function subscribeRealtime(eventName, callback) {
  const handler = (event) => callback(event.detail);
  window.addEventListener(`realtime:${eventName}`, handler);

  return () => {
    window.removeEventListener(`realtime:${eventName}`, handler);
  };
}
