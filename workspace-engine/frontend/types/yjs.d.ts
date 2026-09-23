declare module "yjs" {
  export class Doc {
    constructor();
    getArray<T = unknown>(name: string): Array<T>;
    getMap<T = unknown>(name: string): Map<T>;
    transact(fn: () => void, origin?: unknown): void;
    on(event: "update", callback: (update: Uint8Array, origin: unknown) => void): void;
    destroy(): void;
  }

  export class Array<T = unknown> {
    length: number;
    get(index: number): T;
    delete(index: number, length: number): void;
    push(content: T[]): void;
    observeDeep(callback: (events: unknown[]) => void): void;
  }

  export class Map<T = unknown> {
    constructor();
    set(key: string, value: T): void;
    get(key: string): T | undefined;
    toJSON(): Record<string, unknown>;
  }

  export function applyUpdate(doc: Doc, update: Uint8Array, origin?: unknown): void;
}

declare module "y-websocket" {
  import * as Y from "yjs";
  export class WebsocketProvider {
    constructor(
      serverUrl: string,
      roomname: string,
      doc: Y.Doc,
      opts?: { connect?: boolean; awareness?: unknown }
    );
    awareness: {
      setLocalStateField(field: string, value: unknown): void;
      getStates(): globalThis.Map<number, Record<string, unknown>>;
      on(event: string, callback: (event: unknown) => void): void;
    };
    destroy(): void;
  }
}
