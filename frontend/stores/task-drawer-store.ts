"use client";

import { create } from "zustand";

interface TaskDrawerState {
  isOpen: boolean;
  selectedTaskId: string | null;
  openDrawer: (taskId: string) => void;
  closeDrawer: () => void;
}

export const useTaskDrawerStore = create<TaskDrawerState>((set) => ({
  isOpen: false,
  selectedTaskId: null,
  openDrawer: (taskId: string) => set({ isOpen: true, selectedTaskId: taskId }),
  closeDrawer: () => set({ isOpen: false, selectedTaskId: null }),
}));
