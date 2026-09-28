import { create } from "zustand";

export type Theme = "light" | "dark";

const THEME_KEY = "grokshell:theme";

function initialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const t = window.localStorage.getItem(THEME_KEY);
    if (t === "dark" || t === "light") return t;
  } catch {
    /* private mode */
  }
  return "light";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/** Sentinel tab id for an unsaved fresh session. */
export const NEW_TAB = "new";

interface UiStore {
  theme: Theme;
  setTheme: (t: Theme) => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  /** Open titlebar tabs — conversation ids plus at most one NEW_TAB sentinel. */
  openTabs: string[];
  activeTab: string;
  openTab: (id: string) => void;
  closeTab: (id: string) => void;
  activateTab: (id: string) => void;
}

applyTheme(initialTheme());

export const useUiStore = create<UiStore>((set, get) => ({
  theme: initialTheme(),
  setTheme: (t) => {
    applyTheme(t);
    try {
      window.localStorage.setItem(THEME_KEY, t);
    } catch {
      /* private mode */
    }
    set({ theme: t });
  },
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  settingsOpen: false,
  setSettingsOpen: (open) => set({ settingsOpen: open }),

  openTabs: [NEW_TAB],
  activeTab: NEW_TAB,

  openTab: (id) =>
    set((s) => ({
      openTabs: s.openTabs.includes(id) ? s.openTabs : [...s.openTabs, id],
      activeTab: id,
    })),

  closeTab: (id) =>
    set((s) => {
      const openTabs = s.openTabs.filter((t) => t !== id);
      if (openTabs.length === 0) return { openTabs: [NEW_TAB], activeTab: NEW_TAB };
      const idx = s.openTabs.indexOf(id);
      const activeTab =
        s.activeTab === id ? openTabs[Math.max(0, idx - 1)] ?? openTabs[0] : s.activeTab;
      return { openTabs, activeTab };
    }),

  activateTab: (id) => set({ activeTab: id }),
}));
