import { create } from "zustand";
import { UserPresence } from "@/types/presence";

interface PresenceState {
  currentUser: UserPresence;
  peers: UserPresence[];

  setCurrentUser: (user: Partial<UserPresence>) => void;
  setPeers: (peers: UserPresence[]) => void;
  addOrUpdatePeer: (peer: UserPresence) => void;
  removePeer: (clientId: number | string) => void;
  updateCursor: (blockId: string, offset: number) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  currentUser: {
    clientId: Math.floor(Math.random() * 1000000),
    userId: "user-local",
    name: "You",
    color: "#38bdf8",
    cursor: null,
    lastActive: Date.now(),
  },
  peers: [],

  setCurrentUser: (user) =>
    set((state) => ({
      currentUser: { ...state.currentUser, ...user },
    })),

  setPeers: (peers) => set({ peers }),

  addOrUpdatePeer: (peer) =>
    set((state) => {
      const idx = state.peers.findIndex((p) => p.clientId === peer.clientId);
      if (idx !== -1) {
        const next = [...state.peers];
        next[idx] = { ...next[idx], ...peer, lastActive: Date.now() };
        return { peers: next };
      }
      return { peers: [...state.peers, { ...peer, lastActive: Date.now() }] };
    }),

  removePeer: (clientId) =>
    set((state) => ({
      peers: state.peers.filter((p) => p.clientId !== clientId),
    })),

  updateCursor: (blockId, offset) =>
    set((state) => ({
      currentUser: {
        ...state.currentUser,
        cursor: { blockId, offset },
        lastActive: Date.now(),
      },
    })),
}));
