"use client";

import { motion } from "framer-motion";
import {
  Wrench,
  Store,
  Cog,
  Database,
  Image as ImageIcon,
  Mail,
  CreditCard,
  type LucideIcon,
} from "lucide-react";
import { useInView } from "@/lib/use-in-view";

type BlockDef = {
  id: string;
  label: string;
  sublabel: string;
  icon: LucideIcon;
  col: string;
  row: string;
  accent: string;
};

// Disposition en grille 5 colonnes x 3 rangées (voir grid-template en dur
// dans le JSX plus bas). Chaque bloc représente un vrai composant du
// système décrit dans README.md / CLAUDE.md.
const BLOCKS: BlockDef[] = [
  {
    id: "admin",
    label: "Dashboard Admin",
    sublabel: "ad.abmcy.com",
    icon: Wrench,
    col: "col-start-2",
    row: "row-start-1",
    accent: "border-slate-300 bg-white",
  },
  {
    id: "tenant",
    label: "Dashboard Tenant",
    sublabel: "dash.abmcy.com (HANI'S...)",
    icon: Store,
    col: "col-start-4",
    row: "row-start-1",
    accent: "border-slate-300 bg-white",
  },
  {
    id: "api",
    label: "Moteur central",
    sublabel: "API sécurisée · api.abmcy.com",
    icon: Cog,
    col: "col-start-3",
    row: "row-start-2",
    accent: "border-indigo-300 bg-indigo-50",
  },
  {
    id: "postgres",
    label: "Base de données sécurisée",
    sublabel: "Isolation stricte par client",
    icon: Database,
    col: "col-start-1",
    row: "row-start-3",
    accent: "border-sky-300 bg-sky-50",
  },
  {
    id: "imgbb",
    label: "Stockage cloud",
    sublabel: "Photos produits & réalisations",
    icon: ImageIcon,
    col: "col-start-2",
    row: "row-start-3",
    accent: "border-emerald-300 bg-emerald-50",
  },
  {
    id: "resend",
    label: "Moteur de notifications",
    sublabel: "Emails automatiques aux clients",
    icon: Mail,
    col: "col-start-4",
    row: "row-start-3",
    accent: "border-amber-300 bg-amber-50",
  },
  {
    id: "cinetpay",
    label: "Passerelle de paiement",
    sublabel: "Mobile money & cartes bancaires",
    icon: CreditCard,
    col: "col-start-5",
    row: "row-start-3",
    accent: "border-rose-300 bg-rose-50",
  },
];

// Connexions dessinées entre les centres des blocs (par id), dans l'ordre
// où elles doivent apparaître après que tous les blocs soient posés.
const CONNECTIONS: [string, string][] = [
  ["admin", "api"],
  ["tenant", "api"],
  ["api", "postgres"],
  ["api", "imgbb"],
  ["api", "resend"],
  ["api", "cinetpay"],
];

// Coordonnées approximatives (en % de la zone de la grille) du centre de
// chaque bloc, utilisées uniquement pour tracer les lignes SVG. Calculées à
// partir de la grille 5 colonnes x 3 rangées ci-dessous.
const POSITIONS: Record<string, { x: number; y: number }> = {
  admin: { x: 30, y: 12 },
  tenant: { x: 70, y: 12 },
  api: { x: 50, y: 50 },
  postgres: { x: 10, y: 88 },
  imgbb: { x: 30, y: 88 },
  resend: { x: 70, y: 88 },
  cinetpay: { x: 90, y: 88 },
};

function ConnectionLine({
  from,
  to,
  delay,
  active,
}: {
  from: string;
  to: string;
  delay: number;
  active: boolean;
}) {
  const a = POSITIONS[from];
  const b = POSITIONS[to];
  const length = Math.hypot(b.x - a.x, b.y - a.y) * 4; // approximation en unités SVG

  return (
    <g>
      <line
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke="currentColor"
        strokeWidth={0.6}
        className="text-slate-200"
      />
      <motion.line
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke="currentColor"
        strokeWidth={0.6}
        strokeLinecap="round"
        className="text-indigo-400"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={active ? { pathLength: 1, opacity: 1 } : {}}
        transition={{ duration: 0.7, delay, ease: "easeInOut" }}
        style={{ vectorEffect: "non-scaling-stroke" }}
      />
      {/* Petit point lumineux qui voyage le long de la ligne, une fois tracée */}
      {active && (
        <motion.circle
          r={0.9}
          fill="currentColor"
          className="text-indigo-500"
          initial={{ offsetDistance: "0%", opacity: 0 }}
          animate={{ offsetDistance: "100%", opacity: [0, 1, 1, 0] }}
          transition={{
            duration: 1.6,
            delay: delay + 0.8,
            repeat: Infinity,
            repeatDelay: 1.4,
            ease: "linear",
          }}
          style={{
            offsetPath: `path("M ${a.x} ${a.y} L ${b.x} ${b.y}")`,
          }}
        />
      )}
      <title>
        {length > 0 ? `${from} → ${to}` : ""}
      </title>
    </g>
  );
}

function Block({ block, delay, active }: { block: BlockDef; delay: number; active: boolean }) {
  const Icon = block.icon;
  return (
    <motion.div
      className={`${block.col} ${block.row} relative z-10 flex flex-col items-center justify-center gap-1 rounded-2xl border px-3 py-4 text-center shadow-sm ${block.accent}`}
      initial={{ opacity: 0, y: 28, scale: 0.85 }}
      animate={active ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <Icon className="h-6 w-6 text-slate-700" strokeWidth={1.75} aria-hidden />
      <span className="text-sm font-semibold text-slate-900">{block.label}</span>
      <span className="text-[11px] leading-tight text-slate-500">{block.sublabel}</span>
    </motion.div>
  );
}

export function ArchitectureAnimation() {
  const { ref, isInView } = useInView<HTMLDivElement>({ threshold: 0.25 });

  const blockDelayStep = 0.12;
  const linesStartDelay = BLOCKS.length * blockDelayStep + 0.25;
  const lineDelayStep = 0.15;

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-5xl">
      {/* Grille de blocs : 5 colonnes, 3 rangées, mêmes proportions que POSITIONS */}
      <div className="relative grid min-h-[420px] grid-cols-5 grid-rows-3 items-center gap-3 sm:min-h-[480px] sm:gap-6">
        {/* SVG des lignes de connexion, superposé derrière les blocs */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden
        >
          {CONNECTIONS.map(([from, to], i) => (
            <ConnectionLine
              key={`${from}-${to}`}
              from={from}
              to={to}
              active={isInView}
              delay={linesStartDelay + i * lineDelayStep}
            />
          ))}
        </svg>

        {BLOCKS.map((block, i) => (
          <Block
            key={block.id}
            block={block}
            active={isInView}
            delay={i * blockDelayStep}
          />
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-slate-400 sm:hidden">
        Faites défiler horizontalement le schéma si besoin sur petit écran.
      </p>
    </div>
  );
}
