import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

let ioInstance = null;

export function createRealtimeServer(httpServer) {
  if (ioInstance) return ioInstance;

  ioInstance = new Server(httpServer, {
    cors: {
      origin: env.clientUrl,
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  ioInstance.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const payload = jwt.verify(token, env.jwtSecret);
      socket.data.admin = payload;
      next();
    } catch {
      next(new Error("Invalid or expired session"));
    }
  });

  ioInstance.on("connection", (socket) => {
    const admin = socket.data.admin;

    if (admin?.adminId) {
      socket.join(`admin:${admin.adminId}`);
    }

    socket.on("disconnect", () => {
      socket.leaveAll();
    });
  });

  return ioInstance;
}

export function broadcastRealtime(event, payload = {}) {
  if (!ioInstance) return;

  ioInstance.emit(event, {
    ...payload,
    timestamp: new Date().toISOString(),
  });
}

export function broadcastToAdmin(adminId, event, payload = {}) {
  if (!ioInstance || !adminId) return;

  ioInstance.to(`admin:${adminId}`).emit(event, {
    ...payload,
    timestamp: new Date().toISOString(),
  });
}

export function getRealtimeServer() {
  return ioInstance;
}
