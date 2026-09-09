"use client";

import { useState } from "react";
import type { Customer } from "@/lib/api";
import { EditCustomerForm } from "./EditCustomerForm";

/** Table des clients finaux du tenant — voir/modifier coordonnées et
 * mot de passe via EditCustomerForm en modal. */
export function CustomerTable({
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
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">Nom</th>
              <th className="px-4 py-3 font-medium">Téléphone</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Compte</th>
              <th className="px-4 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr
                key={customer.id}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
              >
                <td className="px-4 py-3 text-slate-900">{customer.name}</td>
                <td className="px-4 py-3 text-slate-600">{customer.phone}</td>
                <td className="px-4 py-3 text-slate-600">
                  {customer.email || "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      customer.has_password
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {customer.has_password ? "Connecté" : "Sans mot de passe"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setEditing(customer)}
                    className="text-xs font-medium text-indigo-600 hover:underline"
                  >
                    Modifier
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
