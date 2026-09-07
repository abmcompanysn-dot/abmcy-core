"use client";

// Éditeur générique de paires clé/valeur pour le champ "attributes" (JSON
// libre) des produits. Le modèle produit n'est pas spécifique à un métier :
// on ne propose donc pas de champs figés "genre/taille/couleur", mais un
// éditeur libre que le tenant remplit lui-même, avec des suggestions
// d'exemples selon son secteur d'activité en aide contextuelle.

import { useState } from "react";

export interface AttributeField {
  key: string;
  value: string;
}

export function AttributesEditor({
  fields,
  onChange,
  disabled,
  helpText,
}: {
  fields: AttributeField[];
  onChange: (fields: AttributeField[]) => void;
  disabled?: boolean;
  helpText?: string;
}) {
  const [nextKey, setNextKey] = useState("");
  const [nextValue, setNextValue] = useState("");

  function addField() {
    const key = nextKey.trim();
    if (!key) return;
    onChange([...fields, { key, value: nextValue }]);
    setNextKey("");
    setNextValue("");
  }

  function updateField(index: number, patch: Partial<AttributeField>) {
    onChange(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function removeField(index: number) {
    onChange(fields.filter((_, i) => i !== index));
  }

  return (
    <div>
      <h3 className="mb-1 text-sm font-medium text-slate-700">
        Attributs personnalisés (optionnel)
      </h3>
      {helpText && <p className="mb-2 text-xs text-slate-400">{helpText}</p>}

      {fields.length > 0 && (
        <div className="mb-3 space-y-2">
          {fields.map((field, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Nom (ex : couleur)"
                value={field.key}
                onChange={(e) => updateField(index, { key: e.target.value })}
                className="w-1/2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                disabled={disabled}
              />
              <input
                type="text"
                placeholder="Valeur (ex : Bleu)"
                value={field.value}
                onChange={(e) => updateField(index, { value: e.target.value })}
                className="w-1/2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                disabled={disabled}
              />
              <button
                type="button"
                onClick={() => removeField(index)}
                className="text-slate-400 hover:text-red-600"
                aria-label="Supprimer cet attribut"
                disabled={disabled}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Nom du nouvel attribut"
          value={nextKey}
          onChange={(e) => setNextKey(e.target.value)}
          className="w-1/2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          disabled={disabled}
        />
        <input
          type="text"
          placeholder="Valeur"
          value={nextValue}
          onChange={(e) => setNextValue(e.target.value)}
          className="w-1/2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          disabled={disabled}
        />
        <button
          type="button"
          onClick={addField}
          className="whitespace-nowrap text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
          disabled={disabled || !nextKey.trim()}
        >
          + Ajouter
        </button>
      </div>
    </div>
  );
}

/** Convertit les paires clé/valeur en objet JSON, en tentant de parser les
 * nombres, booléens et listes séparées par des virgules pour rester
 * pratique (ex : "S, M, L" -> ["S","M","L"]). */
export function attributeFieldsToObject(
  fields: AttributeField[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const { key, value } of fields) {
    const trimmedKey = key.trim();
    if (!trimmedKey) continue;
    result[trimmedKey] = parseAttributeValue(value);
  }
  return result;
}

function parseAttributeValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === "") return "";
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (!Number.isNaN(Number(trimmed)) && trimmed !== "") return Number(trimmed);
  if (trimmed.includes(",")) {
    return trimmed
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return trimmed;
}

/** Convertit un objet JSON existant (ex: chargé depuis l'API) en paires
 * clé/valeur affichables dans l'éditeur. */
export function objectToAttributeFields(
  obj: Record<string, unknown> | null | undefined
): AttributeField[] {
  if (!obj) return [];
  return Object.entries(obj).map(([key, value]) => ({
    key,
    value: Array.isArray(value)
      ? value.join(", ")
      : typeof value === "object" && value !== null
      ? JSON.stringify(value)
      : String(value),
  }));
}
