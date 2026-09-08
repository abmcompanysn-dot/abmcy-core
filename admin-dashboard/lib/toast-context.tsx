"use client";

// Système léger de notifications temporaires ("Tenant créé avec succès",
// etc.), copié à l'identique depuis tenant-dashboard/lib/toast-context.tsx
// pour garder la même expérience entre les deux dashboards ABMCY. Pas de
// librairie externe — juste un contexte React avec une liste de messages,
// auto-disparition après ~3s. Monté une seule fois dans app/layout.tsx.

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastKind = "success" | "error" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  /** Affiche une notification temporaire (auto-disparition après ~3s). */
  showToast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 3000;

const KIND_STYLES: Record<ToastKind, string> = {
  success: "bg-emerald-600 text-white",
  error: "bg-red-600 text-white",
  info: "bg-slate-800 text-white",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((message: string, kind: ToastKind = "success") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto max-w-sm rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg transition-opacity ${KIND_STYLES[toast.kind]}`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast doit être utilisé dans un <ToastProvider>.");
  }
  return ctx;
}
