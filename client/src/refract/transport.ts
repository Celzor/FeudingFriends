import Game, { type QuestionPools } from "../../../shared/Game";
import type { IMessage } from "../../../types";

const PROTOCOL = "refract-activity/1";
const GAME_PROTOCOL = "feuding-friends/1";
type Person = { id: number; name: string; avatarUrl: string | null };
const record = (v: unknown): v is Record<string, any> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);
const user = (v: any): v is Person =>
  record(v) &&
  Number.isSafeInteger(v.id) &&
  v.id > 0 &&
  typeof v.name === "string" &&
  v.name.length <= 200 &&
  (v.avatarUrl === null || typeof v.avatarUrl === "string");
const roster = (v: any): v is Person[] =>
  Array.isArray(v) &&
  v.length <= 100 &&
  v.every(user) &&
  new Set(v.map((p) => p.id)).size === v.length;

/** Uses Refract's relayed sender identity. The coordinating browser is trusted, just as in Refract Tack Toe. */
export class RefractTransport {
  connected = false;
  id = "";
  private listeners = new Map<string, Set<(...args: any[]) => void>>();
  private origin: string | null = null;
  private session = "";
  private self: Person | null = null;
  private participants: Person[] = [];
  private engine: Game | null = null;
  private pools: QuestionPools | null = null;
  private lobbyCode = "";
  private last: IMessage | null = null;
  private sequence = 0;
  private generation = 0;
  private processed = new Map<string, IMessage>();
  private pending = new Map<
    string,
    {
      resolve: (v: any) => void;
      reject: (e: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private pieces = new Map<
    string,
    { parts: string[]; total: number; time: number }
  >();
  constructor(private scope: Window = window) {
    scope.addEventListener("message", this.receive);
    this.post({ type: "ready" });
    setInterval(() => {
      if (this.self) this.send("sync", {});
      else this.post({ type: "ready" });
    }, 5000);
  }
  on(event: string, listener: (...args: any[]) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(listener);
    if (event === "message" && this.last) {
      const last = this.last;
      queueMicrotask(() => listener(last));
    }
    return this;
  }
  off(event: string, listener: (...args: any[]) => void) {
    this.listeners.get(event)?.delete(listener);
    return this;
  }
  timeout(_ms: number) {
    return this;
  }
  emitWithAck(_event: string, message: any): Promise<any> {
    if (!this.connected)
      return Promise.reject(new Error("Waiting for Refract."));
    const requestId = `${this.id}-${++this.sequence}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error("The activity host did not respond."));
      }, 10000);
      this.pending.set(requestId, { resolve, reject, timer });
      this.send("action", { requestId, message });
    });
  }
  close() {
    this.post({ type: "close" });
  }
  private emit(event: string, ...args: any[]) {
    for (const cb of this.listeners.get(event) || []) cb(...args);
  }
  private post(data: any) {
    this.scope.parent.postMessage(
      { protocol: PROTOCOL, ...data },
      this.origin || "*",
    );
  }
  private members() {
    return this.participants.map((p) => p.id);
  }
  private host() {
    return this.participants[0]?.id;
  }
  private packet(kind: string, data: any) {
    return {
      protocol: GAME_PROTOCOL,
      sessionId: this.session,
      hostId: this.host(),
      members: this.members(),
      kind,
      ...data,
    };
  }
  private broadcast(kind: string, data: any, to?: number[]) {
    const packet = this.packet(kind, data);
    const encoded = JSON.stringify(packet);
    if (new TextEncoder().encode(encoded).length <= 15000)
      this.post({ type: "broadcast", data: packet, ...(to ? { to } : {}) });
    else {
      // UTF-16 chunks kept small enough for the 16 KiB UTF-8 wire limit.
      const transfer = `${this.self.id}-${++this.sequence}`;
      const chunks = encoded.match(/[\s\S]{1,3000}/g) || [];
      if (chunks.length > 160) throw new Error("Game snapshot is too large.");
      chunks.forEach((chunk, index) =>
        this.post({
          type: "broadcast",
          data: this.packet("fragment", {
            transfer,
            index,
            total: chunks.length,
            chunk,
          }),
          ...(to ? { to } : {}),
        }),
      );
    }
  }
  private send(kind: string, data: any) {
    if (this.self?.id === this.host())
      void this.handle(this.self.id, this.packet(kind, data));
    else if (this.self) this.broadcast(kind, data, [this.host()]);
  }
  private deliver(message: IMessage) {
    if (message.type === "lobby_update") {
      this.last = message;
      this.lobbyCode = message.data.lobby.lobbyCode;
    }
    this.emit("message", message);
  }
  private async initialize(data: any, origin: string) {
    const changed =
      this.session !== data.sessionId ||
      this.self?.id !== data.self.id ||
      JSON.stringify(this.members()) !==
        JSON.stringify(data.participants.map((p: Person) => p.id));
    const preserveHost =
      this.session === data.sessionId &&
      this.self?.id === data.self.id &&
      this.self?.id === this.host() &&
      data.participants[0]?.id === this.self.id &&
      this.engine;
    this.origin = origin;
    this.self = data.self;
    this.session = data.sessionId;
    this.participants = data.participants;
    this.id = String(data.self.id);
    this.scope.document.documentElement.dataset.refractTheme = data.theme;
    if (!changed) {
      this.send("sync", {});
      return;
    }
    if (preserveHost) {
      this.registerConnections();
      this.engine.reconcileMembers(
        this.lobbyCode,
        this.participants.map((p) => ({
          id: String(p.id),
          name: `${p.name.slice(0, 30)} · ${p.id}`,
        })),
      );
      return;
    }
    const generation = ++this.generation;
    this.engine?.dispose();
    this.engine = null;
    this.processed.clear();
    this.last = null;
    this.lobbyCode = "";
    this.connected = false;
    this.emit("disconnect");
    this.emit("reset", data.self.name);
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error("Activity membership changed."));
    }
    this.pending.clear();
    if (!this.members().includes(this.self.id)) {
      this.emit("error", new Error("You have left this activity."));
      return;
    }
    try {
      if (this.self.id === this.host()) {
        if (!this.pools) {
          const response = await fetch(
            `${import.meta.env.BASE_URL}questions.json`,
          );
          if (!response.ok) throw new Error("Question data unavailable.");
          this.pools = await response.json();
        }
        if (this.self.id !== this.host() || generation !== this.generation)
          return;
        this.engine = new Game(this.pools);
        this.registerConnections();
        const created = await this.engine.onMessage(
          { id: this.id, emit: () => {} },
          {
            type: "create_lobby",
            data: { playerName: this.self.name.slice(0, 40) || "Host" },
          },
        );
        if (created.type === "error") throw new Error(created.message);
        this.lobbyCode = created.data.lobby.lobbyCode;
        this.engine.reconcileMembers(
          this.lobbyCode,
          this.participants.map((p) => ({
            id: String(p.id),
            name: `${p.name.slice(0, 30)} · ${p.id}`,
          })),
        );
        this.deliver(
          await this.engine.onMessage(
            { id: this.id, emit: () => {} },
            { type: "sync_lobby", data: { lobbyCode: this.lobbyCode } },
          ),
        );
      }
      this.connected = true;
      this.emit("connect");
      this.send("sync", {});
    } catch (e) {
      this.emit("error", e);
    }
  }
  private registerConnections() {
    for (const person of this.participants)
      this.engine.addConnection({
        id: String(person.id),
        emit: (_event, message) => {
          if (person.id === this.self.id) this.deliver(message);
          else this.broadcast("state", { message }, [person.id]);
        },
      });
  }
  private receive = (event: MessageEvent) => {
    if (
      event.source !== this.scope.parent ||
      this.scope.parent === this.scope ||
      !event.origin ||
      event.origin === "null" ||
      (this.origin && event.origin !== this.origin)
    )
      return;
    const d = event.data;
    if (!record(d) || d.protocol !== PROTOCOL) return;
    if (
      d.type === "init" &&
      typeof d.sessionId === "string" &&
      d.sessionId.length > 0 &&
      d.sessionId.length <= 200 &&
      Number.isSafeInteger(d.channelId) &&
      d.channelId > 0 &&
      user(d.self) &&
      roster(d.participants) &&
      d.participants.some((p) => p.id === d.self.id) &&
      ["dark", "light"].includes(d.theme)
    )
      void this.initialize(d, event.origin);
    else if (this.self && d.type === "participants" && roster(d.participants))
      void this.initialize(
        {
          sessionId: this.session,
          self: this.self,
          participants: d.participants,
          theme: this.scope.document.documentElement.dataset.refractTheme,
        },
        event.origin,
      );
    else if (
      this.self &&
      d.type === "message" &&
      Number.isSafeInteger(d.from) &&
      record(d.data)
    )
      void this.handle(d.from, d.data);
  };
  private async handle(from: number, d: any) {
    if (
      !this.self ||
      !this.members().includes(this.self.id) ||
      !this.members().includes(from) ||
      !record(d) ||
      d.protocol !== GAME_PROTOCOL ||
      d.sessionId !== this.session ||
      d.hostId !== this.host() ||
      JSON.stringify(d.members) !== JSON.stringify(this.members())
    )
      return;
    if (d.kind === "fragment") {
      if (
        from !== this.host() ||
        typeof d.transfer !== "string" ||
        d.transfer.length > 80 ||
        !Number.isInteger(d.total) ||
        d.total < 1 ||
        d.total > 160 ||
        !Number.isInteger(d.index) ||
        d.index < 0 ||
        d.index >= d.total ||
        typeof d.chunk !== "string" ||
        d.chunk.length > 3000
      )
        return;
      for (const [key, v] of this.pieces)
        if (Date.now() - v.time > 10000) this.pieces.delete(key);
      if (!this.pieces.has(d.transfer)) {
        if (this.pieces.size >= 4) return;
        this.pieces.set(d.transfer, {
          parts: [],
          total: d.total,
          time: Date.now(),
        });
      }
      const v = this.pieces.get(d.transfer);
      if (v.total !== d.total) return;
      v.parts[d.index] = d.chunk;
      if (v.parts.filter((p) => p !== undefined).length === v.total) {
        this.pieces.delete(d.transfer);
        try {
          await this.handle(from, JSON.parse(v.parts.join("")));
        } catch {
          /* invalid fragments */
        }
      }
      return;
    }
    if (
      d.kind === "state" &&
      from === this.host() &&
      this.self.id !== this.host() &&
      d.message?.type === "lobby_update"
    ) {
      const lobby = d.message.data?.lobby;
      if (
        !lobby ||
        lobby.hostSocketId !== String(this.host()) ||
        !Array.isArray(lobby.players) ||
        !lobby.players.some((p: any) => p.socketId === this.id) ||
        !Number.isSafeInteger(lobby.revision)
      )
        return;
      if (
        this.last &&
        this.last.data.lobby.lobbyCode === lobby.lobbyCode &&
        lobby.revision < this.last.data.lobby.revision
      )
        return;
      this.deliver(d.message);
      return;
    }
    if (
      d.kind === "reply" &&
      from === this.host() &&
      typeof d.requestId === "string"
    ) {
      const p = this.pending.get(d.requestId);
      if (p) {
        clearTimeout(p.timer);
        this.pending.delete(d.requestId);
        p.resolve(d.response);
      }
      return;
    }
    if (this.self.id !== this.host() || !this.engine || !this.lobbyCode) return;
    if (d.kind === "sync") {
      const response = await this.engine.onMessage(
        { id: String(from), emit: () => {} },
        { type: "sync_lobby", data: { lobbyCode: this.lobbyCode } },
      );
      if (from === this.self.id) this.deliver(response);
      else this.broadcast("state", { message: response }, [from]);
    } else if (
      d.kind === "action" &&
      typeof d.requestId === "string" &&
      d.requestId.length <= 100 &&
      record(d.message)
    ) {
      // Identity comes solely from the Refract relay, never from action payloads.
      const key = `${from}:${d.requestId}`;
      let response = this.processed.get(key);
      if (!response) {
        response = await this.engine.onMessage(
          { id: String(from), emit: () => {} },
          d.message,
        );
        if (this.processed.size >= 256)
          this.processed.delete(this.processed.keys().next().value);
        this.processed.set(key, response);
      }
      if (from === this.self.id) {
        const p = this.pending.get(d.requestId);
        if (p) {
          clearTimeout(p.timer);
          this.pending.delete(d.requestId);
          p.resolve(response);
        }
      } else
        this.broadcast("reply", { requestId: d.requestId, response }, [from]);
    }
  }
}
