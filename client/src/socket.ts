import { io, Socket } from "socket.io-client";

// "undefined" means the URL will be computed from the `window.location` object
const DEV_ENDPOINT = "http://localhost:3010/";
const URL = process.env.NODE_ENV === "production" ? undefined : DEV_ENDPOINT;

export const socket: Socket = io(URL);
