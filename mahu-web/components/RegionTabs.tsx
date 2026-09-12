"use client";

import { useRouter, useSearchParams } from "next/navigation";

const REGIONS = [
  { label: "Toute l'Afrique", value: "" },
  { label: "Afrique de l'Ouest", value: "Ouest" },
  { label: "Afrique de l'Est", value: "Est" },
  { label: "Afrique du Nord", value: "Nord" },
  { label: "Afrique Centrale", value: "Centrale" },
];

export default function RegionTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeRegion = searchParams.get("region") || "";

  function selectRegion(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("region", value);
    } else {
      params.delete("region");
    }
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/");
  }

  return (
    <div className="mb-8 flex gap-4 overflow-x-auto border-b border-[var(--border-color)] pb-3">
      {REGIONS.map((region) => (
        <button
          key={region.value}
          onClick={() => selectRegion(region.value)}
          className={`shrink-0 border-b-2 pb-1 text-sm font-semibold whitespace-nowrap ${
            activeRegion === region.value
              ? "border-[var(--accent-red)] text-[var(--accent-red)]"
              : "border-transparent text-[var(--text-muted)]"
          }`}
        >
          {region.label}
        </button>
      ))}
    </div>
  );
}
