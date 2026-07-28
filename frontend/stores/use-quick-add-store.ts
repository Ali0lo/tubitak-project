"use client";

import { create } from "zustand";

interface QuickAddState {
  isOpen: boolean;
  openQuickAdd: () => void;
  closeQuickAdd: () => void;
}

export const useQuickAddStore = create<QuickAddState>((set) => ({
  isOpen: false,
  openQuickAdd: () => set({ isOpen: true }),
  closeQuickAdd: () => set({ isOpen: false }),
}));
