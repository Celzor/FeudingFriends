import { io } from "socket.io-client";
export const isRefract = window.parent !== window;
export const socket = isRefract
  ? new (await import("./refract/transport")).RefractTransport()
  : io(import.meta.env.VITE_SERVER_URL || undefined, { autoConnect: true });
