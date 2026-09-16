"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Bell,
  Box,
  Image as ImageIcon,
  Layers,
  MessageSquare,
  Scissors,
  Settings,
  Star,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useFeatures } from "@/lib/features-context";
import {
  ApiError,
  getTrafficSummary,
  listOrders,
  type Order,
  type TrafficSummary,
} from "@/lib/api";
import { formatDate, formatFCFA } from "@/lib/format";
import { OrderStatusBadge } from "./OrderStatusBadge";

// Grille d'accès rapide façon "hub" — chaque entrée dépend d'un feature
// flag (comme NavBar) sauf Commandes, Trafic et Paramètres qui sont
// toujours disponibles.
const QUICK_LINKS = [
  { href: "/catalogue", label: "Catalogue", icon: Box, feature: "products_enabled" as const },
  { href: "/tissus", label: "Tissus", icon: Scissors, feature: "fabrics_enabled" as const },
  { href: "/galerie", label: "Galerie", icon: ImageIcon, feature: "gallery_enabled" as const },
  { href: "/avis", label: "Avis", icon: Star, feature: "reviews_enabled" as const },
];

export function MobileHome() {
  const { apiKey, isStaffSession } = useAuth();
  const { features } = useFeatures();
  const [traffic, setTraffic] = useState<TrafficSummary | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;

    Promise.all([getTrafficSummary(apiKey), listOrders(apiKey)])
      .then(([trafficResult, orders]) => {
        if (cancelled) return;
        setTraffic(trafficResult);
        setRecentOrders(orders.slice(0, 5));
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError ? err.message : "Impossible de charger votre activité."
        );
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  const enabledQuickLinks = QUICK_LINKS.filter((l) => features?.[l.feature]);

  return (
    <div className="-mx-4 -mt-4 md:hidden">
      {/* Bandeau vert : identité + activité 24h. Le motif diagonal et les
          coins arrondis reprennent le ton "app mobile" demandé, avec les
          seules données réellement disponibles côté API (pas de solde ni
          de compteur de vues du site public, qui n'existent pas). */}
      <div
        className="relative overflow-hidden rounded-b-3xl bg-emerald-800 px-5 pb-8 pt-6 text-white"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 2px, transparent 2px, transparent 14px)",
        }}
      >
        <div className="flex items-center justify-between">
          <Link
            href="/parametres"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 transition-colors hover:bg-white/25"
            aria-label="Paramètres"
          >
            <Settings className="h-4.5 w-4.5" strokeWidth={1.75} />
          </Link>
          <Link
            href="/trafic"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 transition-colors hover:bg-white/25"
            aria-label="Trafic"
          >
            <Bell className="h-4.5 w-4.5" strokeWidth={1.75} />
          </Link>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-100">
            Activité des dernières 24h
          </p>
          <p className="mt-2 text-4xl font-bold tabular-nums">
            {traffic ? traffic.request_count.toLocaleString("fr-FR") : "—"}
            <span className="ml-2 text-base font-medium text-emerald-100">
              requêtes
            </span>
          </p>
          {traffic && (
            <p className="mt-1 text-xs text-emerald-100">
              {traffic.tenant_slug}
            </p>
          )}
        </div>
      </div>

      <div className="px-1 pt-6">
        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {/* Grille d'accès rapide */}
        <div className="grid grid-cols-4 gap-3">
          <QuickLink href="/" label="Commandes" icon={Layers} />
          {enabledQuickLinks.map((l) => (
            <QuickLink key={l.href} href={l.href} label={l.label} icon={l.icon} />
          ))}
          {isStaffSession && (
            <QuickLink href="/clients" label="Clients" icon={Users} />
          )}
          {isStaffSession && features?.staff_enabled && (
            <QuickLink href="/equipe" label="Équipe" icon={MessageSquare} />
          )}
        </div>

        {/* Activité récente : dernières commandes */}
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Activité récente
            </h2>
            <Link
              href="/"
              className="text-xs font-medium text-emerald-700 hover:underline"
            >
              Tout voir
            </Link>
          </div>

          {recentOrders === null ? (
            <p className="mt-4 text-sm text-slate-400">Chargement...</p>
          ) : recentOrders.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">
              Aucune commande pour le moment.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {recentOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/commandes/${order.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {order.customer_name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatDate(order.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-semibold text-slate-900">
                      {formatFCFA(order.total_amount)}
                    </span>
                    <OrderStatusBadge status={order.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: typeof Box;
}) {
  return (
    <Link href={href} className="flex flex-col items-center gap-1.5">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
        <Icon className="h-5.5 w-5.5" strokeWidth={1.75} />
      </span>
      <span className="text-center text-xs font-medium text-slate-700">
        {label}
      </span>
    </Link>
  );
}
