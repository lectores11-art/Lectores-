"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type DetailPanelContent = {
  kind: string;
  title: string;
  subtitle?: string;
  description?: string;
  meta?: Array<{ label: string; value: string }>;
  imageUrl?: string | null;
  primaryAction?: { label: string; href?: string; onClick?: () => void };
  secondaryAction?: { label: string; href?: string; onClick?: () => void };
  emptyHint?: string;
} | null;

type DetailPanelContextValue = {
  detail: DetailPanelContent;
  setDetail: (detail: DetailPanelContent) => void;
  clearDetail: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchPlaceholder: string;
  setSearchPlaceholder: (p: string) => void;
};

const DetailPanelContext = createContext<DetailPanelContextValue | null>(null);

export function DetailPanelProvider({ children }: { children: ReactNode }) {
  const [detail, setDetailState] = useState<DetailPanelContent>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchPlaceholder, setSearchPlaceholder] = useState(
    "Buscar título, autor o tema…"
  );

  const setDetail = useCallback((next: DetailPanelContent) => {
    setDetailState(next);
    if (next) setMobileOpen(true);
  }, []);

  const clearDetail = useCallback(() => {
    setDetailState(null);
    setMobileOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      detail,
      setDetail,
      clearDetail,
      mobileOpen,
      setMobileOpen,
      searchQuery,
      setSearchQuery,
      searchPlaceholder,
      setSearchPlaceholder,
    }),
    [
      detail,
      setDetail,
      clearDetail,
      mobileOpen,
      searchQuery,
      searchPlaceholder,
    ]
  );

  return (
    <DetailPanelContext.Provider value={value}>
      {children}
    </DetailPanelContext.Provider>
  );
}

export function useDetailPanel() {
  const ctx = useContext(DetailPanelContext);
  if (!ctx) {
    throw new Error("useDetailPanel must be used within DetailPanelProvider");
  }
  return ctx;
}
