"use client";

import { ExportOptionsState } from "../types";

interface Props {
  value: ExportOptionsState;
  onChange: (value: ExportOptionsState) => void;
}

export function ExportOptions({ value, onChange }: Props) {
  const toggle = (key: keyof ExportOptionsState) => {
    onChange({ ...value, [key]: !value[key] });
  };

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="font-semibold mb-2 text-gray-800">Contenu de l&apos;export</div>
      <div className="space-y-1">
        <label className="flex items-center gap-3 text-sm hover:bg-gray-100 p-2 rounded cursor-pointer">
          <input type="checkbox" checked={value.includeTitle} onChange={() => toggle('includeTitle')} className="w-4 h-4" />
          <span className="font-medium">Titre</span>
        </label>
        <label className="flex items-center gap-3 text-sm hover:bg-gray-100 p-2 rounded cursor-pointer">
          <input type="checkbox" checked={value.includeKPIs} onChange={() => toggle('includeKPIs')} className="w-4 h-4" />
          <span className="font-medium">KPIs</span>
        </label>
        <label className="flex items-center gap-3 text-sm hover:bg-gray-100 p-2 rounded cursor-pointer">
          <input type="checkbox" checked={value.includeTable} onChange={() => toggle('includeTable')} className="w-4 h-4" />
          <span className="font-medium">Tableau des lignes déchets</span>
        </label>
        <label className="flex items-center gap-3 text-sm hover:bg-gray-100 p-2 rounded cursor-pointer">
          <input type="checkbox" checked={value.includeCharts} onChange={() => toggle('includeCharts')} className="w-4 h-4" />
          <span className="font-medium">Graphiques</span>
        </label>
        <label className="flex items-center gap-3 text-sm hover:bg-gray-100 p-2 rounded cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(value.includeLinePdfs)}
            onChange={() => toggle('includeLinePdfs')}
            className="w-4 h-4"
          />
          <span className="font-medium">Ajouter les PDF liés aux lignes</span>
        </label>
      </div>
    </div>
  );
}


