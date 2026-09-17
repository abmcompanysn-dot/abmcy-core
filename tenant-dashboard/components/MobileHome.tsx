"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Bell,
  Box,
  Copy,
  Image as ImageIcon,
  Layers,
  MessageSquare,
  Scissors,
  Settings,
  Share2,
  Star,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useFeatures } from "@/lib/features-context";
import {
  ApiError,
  getProfile,
  getTrafficSummary,
  listOrders,
  type Order,
  type TenantProfile,
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

const DEFAULT_BRAND_COLOR = "#065f46"; // emerald-800, couleur de repli si le tenant n'en a pas défini

export function MobileHome() {
  const { apiKey, isStaffSession } = useAuth();
  const { features } = useFeatures();
  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [traffic, setTraffic] = useState<TrafficSummary | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;

    Promise.all([getProfile(apiKey), getTrafficSummary(apiKey), listOrders(apiKey)])
      .then(([profileResult, trafficResult, orders]) => {
        if (cancelled) return;
        setProfile(profileResult);
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
  const brandColor = profile?.brand_color || DEFAULT_BRAND_COLOR;

  async function handleCopyLink() {
    if (!profile?.storefront_url) return;
    try {
      await navigator.clipboard.writeText(profile.storefront_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // presse-papiers indisponible — l'utilisateur peut toujours copier
      // le lien affiché à la main.
    }
  }

  async function handleShare() {
    if (!profile?.storefront_url) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: profile.name,
          url: profile.storefront_url,
        });
        return;
      } catch {
        // partage annulé ou indisponible — repli sur la copie
      }
    }
    handleCopyLink();
  }

  return (
    <div className="-mx-4 -mt-4 md:hidden">
      {/* Bandeau coloré : couleur de marque du tenant (brand_color), avec
          un motif diagonal discret pour le ton "app mobile". Coins
          arrondis en bas pour se détacher du reste de la page. */}
      <div
        className="relative overflow-hidden rounded-b-3xl px-5 pb-8 pt-6 text-white"
        style={{
          backgroundColor: brandColor,
          backgroundImage:
            "repeating-linear-gradient(135deg, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 2px, transparent 2px, transparent 14px)",
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
          <span className="text-sm font-semibold">{profile?.name ?? ""}</span>
          <Link
            href="/trafic"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 transition-colors hover:bg-white/25"
            aria-label="Trafic"
          >
            <Bell className="h-4.5 w-4.5" strokeWidth={1.75} />
          </Link>
        </div>

        {profile?.storefront_url ? (
          // Boutique publique : lien réel du site du tenant + QR partageable.
          <div className="mt-6 flex items-center gap-4 rounded-2xl bg-white p-4 text-slate-900">
            <div className="shrink-0 rounded-lg bg-white p-1.5">
              <QRCodeSVG value={profile.storefront_url} size={72} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Boutique publique
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                {profile.storefront_url.replace(/^https?:\/\//, "")}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={handleShare}
                  className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-white"
                  style={{ backgroundColor: brandColor }}
                >
                  <Share2 className="h-3 w-3" strokeWidth={2} />
                  Partager
                </button>
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600"
                >
                  <Copy className="h-3 w-3" strokeWidth={2} />
                  {copied ? "Copié" : "Copier"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          // Pas de site public renseigné : on retombe sur l'indicateur
          // d'activité (nombre de requêtes API des dernières 24h — la
          // seule donnée d'activité réellement disponible).
          <div className="mt-6 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-white/80">
              Activité des dernières 24h
            </p>
            <p className="mt-2 text-4xl font-bold tabular-nums">
              {traffic ? traffic.request_count.toLocaleString("fr-FR") : "—"}
              <span className="ml-2 text-base font-medium text-white/80">
                requêtes
              </span>
            </p>
          </div>
        )}
      </div>

      <div className="px-1 pt-6">
        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {/* Grille d'accès rapide */}
        <div className="grid grid-cols-4 gap-3">
          <QuickLink href="/" label="Commandes" icon={Layers} color={brandColor} />
          {enabledQuickLinks.map((l) => (
            <QuickLink key={l.href} href={l.href} label={l.label} icon={l.icon} color={brandColor} />
          ))}
          {isStaffSession && (
            <QuickLink href="/clients" label="Clients" icon={Users} color={brandColor} />
          )}
          {isStaffSession && features?.staff_enabled && (
            <QuickLink href="/equipe" label="Équipe" icon={MessageSquare} color={brandColor} />
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
              className="text-xs font-medium hover:underline"
              style={{ color: brandColor }}
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
  color,
}: {
  href: string;
  label: string;
  icon: typeof Box;
  color: string;
}) {
  return (
    <Link href={href} className="flex flex-col items-center gap-1.5">
      <span
        className="flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ backgroundColor: `${color}1a`, color }}
      >
        <Icon className="h-5.5 w-5.5" strokeWidth={1.75} />
      </span>
      <span className="text-center text-xs font-medium text-slate-700">
        {label}
      </span>
    </Link>
  );
}
