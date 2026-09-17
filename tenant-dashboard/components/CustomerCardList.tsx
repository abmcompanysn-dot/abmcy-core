"use client";

import { useState } from "react";
import type { Customer } from "@/lib/api";
import { EditCustomerForm } from "./EditCustomerForm";

/** Version mobile de CustomerTable : une carte par client. */
export function CustomerCardList({
  customers,
  onUpdated,
}: {
  customers: Customer[];
  onUpdated: (customer: Customer) => void;
}) {
  const [editing, setEditing] = useState<Customer | null>(null);

  if (customers.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        Aucun client pour le moment. Un client est créé automatiquement dès
        sa première commande.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {customers.map((customer) => (
        <button
          key={customer.id}
          onClick={() => setEditing(customer)}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">
              {customer.name}
            </p>
            <p className="text-xs text-slate-500">{customer.phone}</p>
            {customer.email && (
              <p className="truncate text-xs text-slate-500">{customer.email}</p>
            )}
          </div>
          <span
            className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              customer.has_password
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {customer.has_password ? "Connecté" : "Sans mot de passe"}
          </span>
        </button>
      ))}

      {editing && (
        <EditCustomerForm
          customer={editing}
          onUpdated={(updated) => {
            onUpdated(updated);
            setEditing(updated);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
