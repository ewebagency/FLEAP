"use client";

import { useMemo, useState } from "react";

interface Props {
  allSites: string[];
  selectedSites: string[];
  onChange: (sites: string[]) => void;
  labelFor?: (site: string) => string;
  extraIndexForSearch?: (site: string) => string[];
}

export function SiteSearch({ allSites, selectedSites, onChange, labelFor, extraIndexForSearch }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query) return allSites;
    const q = query.toLowerCase();
    return allSites.filter(s => {
      if (s.toLowerCase().includes(q)) return true;
      const extras = extraIndexForSearch ? extraIndexForSearch(s) : [];
      return extras.some(e => (e || '').toString().toLowerCase().includes(q));
    });
  }, [allSites, query, extraIndexForSearch]);

  const toggle = (site: string) => {
    if (selectedSites.includes(site)) onChange(selectedSites.filter(s => s !== site));
    else onChange([...selectedSites, site]);
  };

  const selectAll = () => onChange([...allSites]);
  const clearAll = () => onChange([]);

  const displayedSites = filtered.slice(0, 3);
  const hasMoreSites = filtered.length > 3;

  return (
    <div className="border rounded-lg p-3 bg-gray-50">
      {/* Ligne 1: Titre et boutons */}
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold text-gray-800">
          Sites {allSites.length > 0 && `(${allSites.length} total)`}
        </div>
        <div className="flex gap-2">
          <button className="text-xs px-2 py-1 border rounded bg-blue-50 text-blue-600 hover:bg-blue-100" onClick={selectAll}>Tout sélectionner</button>
          <button className="text-xs px-2 py-1 border rounded bg-red-50 text-red-600 hover:bg-red-100" onClick={clearAll}>Tout désélectionner</button>
        </div>
      </div>
      {/* Ligne 1.5: Aperçu rapide des sites sélectionnés (ligne par site) */}
      <div className="mb-2 text-xs text-gray-600">
        {selectedSites.length > 0 ? (
          <div>
            <div className="font-medium text-gray-700 mb-1">Sélection:</div>
            <ul className="list-disc list-inside space-y-0.5">
              {selectedSites.map(s => (
                <li key={s} className="break-words">{labelFor ? labelFor(s) : s}</li>
              ))}
            </ul>
          </div>
        ) : (
          <span className="text-gray-400">Aucun site sélectionné</span>
        )}
      </div>
      
      {/* Ligne 2: Recherche */}
      <input
        className="w-full border rounded px-3 py-2 text-sm mb-3"
        placeholder="Rechercher un site..."
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      
      {/* Ligne 3: Sites (max 3) */}
      <div className="border rounded bg-white">
        {displayedSites.map(site => (
          <label key={site} className="flex items-center gap-3 text-sm px-3 py-2 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer">
            <input type="checkbox" checked={selectedSites.includes(site)} onChange={() => toggle(site)} className="w-4 h-4" />
            <span className="font-medium">{labelFor ? labelFor(site) : site}</span>
          </label>
        ))}
        {hasMoreSites && (
          <div className="text-sm text-gray-500 px-3 py-2 bg-gray-100">
            ... et {filtered.length - 3} autres sites. Utilisez la recherche pour les trouver.
          </div>
        )}
        {filtered.length === 0 && (
          <div className="text-sm text-gray-500 px-3 py-2">Aucun site trouvé</div>
        )}
      </div>
    </div>
  );
}


