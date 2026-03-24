import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SidebarState {
  collapsed: boolean;
  mobileOpen: boolean;
  activePanel: string | null;
  toggle: () => void;
  setCollapsed: (collapsed: boolean) => void;
  setMobileOpen: (open: boolean) => void;
  setActivePanel: (panel: string | null) => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: false,
      mobileOpen: false,
      activePanel: null,
      toggle: () => set((s) => ({ collapsed: !s.collapsed })),
      setCollapsed: (collapsed) => set({ collapsed }),
      setMobileOpen: (mobileOpen) => set({ mobileOpen }),
      setActivePanel: (activePanel) => set({ activePanel }),
    }),
    {
      name: "okrunit-sidebar",
      partialize: (state) => ({ collapsed: state.collapsed }),
    },
  ),
);
