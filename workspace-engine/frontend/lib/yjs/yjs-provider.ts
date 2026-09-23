import * as Y from "yjs";
import { usePresenceStore } from "@/stores/presence-store";
import { UserPresence } from "@/types/presence";

export class CollaborationProvider {
  public doc: Y.Doc;
  public pageId: string;
  private socket: WebSocket | null = null;
  private wsUrl: string;
  private isDestroyed = false;
  private reconnectAttempts = 0;

  constructor(pageId: string) {
    this.pageId = pageId;
    this.doc = new Y.Doc();

    const host =
      typeof window !== "undefined"
        ? window.location.hostname
        : "localhost";
    const port = process.env.NEXT_PUBLIC_WS_PORT || "8000";
    this.wsUrl = `ws://${host}:${port}/ws/collaboration/${pageId}`;

    if (typeof window !== "undefined") {
      this.connect();
    }
  }

  private connect() {
    if (this.isDestroyed) return;

    try {
      this.socket = new WebSocket(this.wsUrl);
      this.socket.binaryType = "arraybuffer";

      this.socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.sendPresence();
      };

      this.socket.onmessage = (event) => {
        if (typeof event.data === "string") {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "room_state") {
              const presences: UserPresence[] = data.presences || [];
              usePresenceStore.getState().setPeers(presences);
            } else if (data.type === "presence_update") {
              if (data.presence) {
                usePresenceStore.getState().addOrUpdatePeer(data.presence);
              }
            } else if (data.type === "presence_leave") {
              if (data.clientId) {
                usePresenceStore.getState().removePeer(data.clientId);
              }
            }
          } catch {
            // non-json or internal message
          }
        } else if (event.data instanceof ArrayBuffer) {
          // Binary Yjs update
          const update = new Uint8Array(event.data);
          Y.applyUpdate(this.doc, update, "remote");
        }
      };

      this.socket.onclose = () => {
        if (!this.isDestroyed) {
          this.reconnectAttempts++;
          const timeout = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
          setTimeout(() => this.connect(), timeout);
        }
      };

      // Listen to local doc updates and broadcast them
      this.doc.on("update", (update: Uint8Array, origin: unknown) => {
        if (origin !== "remote" && this.socket && this.socket.readyState === WebSocket.OPEN) {
          this.socket.send(update);
        }
      });
    } catch {
      // Offline fallback
    }
  }

  public sendPresence(cursor?: { blockId: string; offset: number } | null) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

    const currentUser = usePresenceStore.getState().currentUser;
    const presenceData: UserPresence = {
      ...currentUser,
      cursor: cursor !== undefined ? cursor : currentUser.cursor,
      lastActive: Date.now(),
    };

    this.socket.send(
      JSON.stringify({
        type: "presence_update",
        presence: presenceData,
      })
    );
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.doc.destroy();
  }
}
