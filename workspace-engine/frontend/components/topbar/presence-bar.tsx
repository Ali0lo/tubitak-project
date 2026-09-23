"use client";

import React from "react";
import { usePresenceStore } from "@/stores/presence-store";
import { getInitials } from "@/lib/utils";

export function PresenceBar() {
  const { currentUser, peers } = usePresenceStore();

  return (
    <div className="flex items-center -space-x-1.5 overflow-hidden">
      {/* Current User Avatar */}
      <div
        style={{ borderColor: currentUser.color }}
        className="relative inline-flex items-center justify-center w-6 h-6 rounded-full border-2 bg-slate-900 text-[10px] font-bold text-white shadow-sm ring-1 ring-white dark:ring-slate-900 select-none"
        title={`${currentUser.name} (You)`}
      >
        {getInitials(currentUser.name)}
      </div>

      {/* Connected Peers Avatars */}
      {peers.map((peer) => (
        <div
          key={peer.clientId}
          style={{
            borderColor: peer.color,
            backgroundColor: peer.color,
          }}
          className="relative inline-flex items-center justify-center w-6 h-6 rounded-full border-2 text-[10px] font-bold text-white shadow-sm ring-1 ring-white dark:ring-slate-900 select-none animate-in fade-in zoom-in-75 duration-200"
          title={`${peer.name} (Viewing)`}
        >
          {getInitials(peer.name)}
          <span className="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full bg-emerald-400 ring-1 ring-white" />
        </div>
      ))}
    </div>
  );
}
