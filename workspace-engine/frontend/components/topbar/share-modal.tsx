"use client";

import React, { useState } from "react";
import { Copy, Check, Globe, Lock, UserPlus } from "lucide-react";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  pageTitle: string;
}

export function ShareModal({ isOpen, onClose, pageTitle }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteEmail.trim()) {
      alert(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-100">
      <div className="w-full max-w-md p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl text-slate-800 dark:text-slate-100">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-semibold text-sm">Share "{pageTitle}"</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Control permissions and collaborate in real-time
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        {/* Public Web Access Toggle */}
        <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-medium">Share to Web</div>
              <div className="text-[11px] text-slate-400">
                Anyone with the link can view
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsPublic(!isPublic)}
            className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${
              isPublic ? "bg-indigo-600 justify-end" : "bg-slate-300 dark:bg-slate-700 justify-start"
            }`}
          >
            <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
          </button>
        </div>

        {/* Invite Member Form */}
        <form onSubmit={handleInvite} className="py-3 flex gap-2">
          <input
            type="email"
            placeholder="Add people by email..."
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100"
          />
          <button
            type="submit"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Invite</span>
          </button>
        </form>

        {/* Copy Link Footer */}
        <div className="pt-3 flex justify-between items-center border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Lock className="w-3.5 h-3.5" />
            <span>Only invited members can edit</span>
          </div>
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-500">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy Link</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
