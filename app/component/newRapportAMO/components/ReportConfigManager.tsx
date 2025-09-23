"use client";

import { useState } from "react";
import { ReportBuilderState, SavedReportConfig } from "../types";
import { supabase } from "@/app/database/supabaseClient";
import { useSession } from "@/app/component/SessionProvider";
import useSWR from 'swr';

interface Props {
  currentState: ReportBuilderState;
  onLoadConfig: (config: ReportBuilderState) => void;
  compact?: boolean;
}

export function ReportConfigManager({ currentState, onLoadConfig, compact = false }: Props) {
  const { entreprise_id } = useSession();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [configName, setConfigName] = useState("");
  const [showLoadDialog, setShowLoadDialog] = useState(false);

  // Fetch saved configurations automatically when component mounts
  const { data, mutate } = useSWR(
    entreprise_id ? `report-configs-${entreprise_id}` : null,
    async () => {
      const { data: entreprise } = await supabase
        .from('entreprise')
        .select('params_rapport')
        .eq('id', entreprise_id)
        .single();
      
      return { configs: entreprise?.params_rapport || [] };
    }
  );

  const savedConfigs: SavedReportConfig[] = data?.configs || [];

  const handleSaveConfig = async () => {
    if (!configName.trim() || !entreprise_id) return;

    try {     
      const { data: entreprise } = await supabase
        .from('entreprise')
        .select('params_rapport')
        .eq('id', entreprise_id)
        .single();

      const currentConfigs: SavedReportConfig[] = entreprise?.params_rapport || [];
      
      // Create new config
      const newConfig: SavedReportConfig = {
        id: crypto.randomUUID(),
        name: configName.trim(),
        config: currentState,
        createdAt: new Date().toISOString()
      };

      // Add to existing configs
      const updatedConfigs = [...currentConfigs, newConfig];

      // Update database
      const { error } = await supabase
        .from('entreprise')
        .update({ params_rapport: updatedConfigs })
        .eq('id', entreprise_id);

      if (!error) {
        setConfigName("");
        setShowSaveDialog(false);
        mutate(); // Refresh the list
      }
    } catch (error) {
      console.error('Error saving config:', error);
    }
  };

  const handleLoadConfig = (config: SavedReportConfig) => {
    onLoadConfig({ ...config.config, reportTitle: config.name });
    setShowLoadDialog(false);
  };

  const handleDeleteConfig = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette configuration ?') || !entreprise_id) return;

    try {
      const { data: entreprise } = await supabase
        .from('entreprise')
        .select('params_rapport')
        .eq('id', entreprise_id)
        .single();

      const currentConfigs: SavedReportConfig[] = entreprise?.params_rapport || [];
      
      // Remove the config
      const updatedConfigs = currentConfigs.filter(c => c.id !== id);

      // Update database
      const { error } = await supabase
        .from('entreprise')
        .update({ params_rapport: updatedConfigs })
        .eq('id', entreprise_id);

      if (!error) {
        mutate(); // Refresh the list
      }
    } catch (error) {
      console.error('Error deleting config:', error);
    }
  };

  if (compact) {
    return (
      <div className="space-y-3">
        {savedConfigs && savedConfigs.length > 0 ? (
          <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
            {savedConfigs.map(config => (
              <button
                key={config.id}
                onClick={() => {
                  console.log('Loading config:', config);
                  // Charger la config en forçant le titre au nom du paramètre
                  onLoadConfig({ ...config.config, reportTitle: config.name });
                }}
                className="w-full text-left p-2 border rounded-lg hover:bg-gray-50 transition-colors flex justify-between"
              >
                <div className="font-medium text-sm">{config.name}</div>
                <div className="text-xs text-gray-500">
                  {new Date(config.createdAt).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500 p-3 border rounded-lg bg-gray-50">
            Aucune configuration sauvegardée
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-gray-800">Configurations de rapports</div>
        <div className="flex gap-2">
          <button
            className="px-4 py-2 border rounded-lg text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium transition-colors"
            onClick={() => setShowSaveDialog(true)}
          >
            Sauvegarder
          </button>
          <button
            className="px-4 py-2 border rounded-lg text-sm bg-green-50 text-green-600 hover:bg-green-100 font-medium transition-colors"
            onClick={() => setShowLoadDialog(true)}
          >
            Charger
          </button>
        </div>
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-medium mb-4">Sauvegarder la configuration</h3>
            <input
              type="text"
              className="w-full border rounded px-3 py-2 mb-4"
              placeholder="Nom de la configuration"
              value={configName}
              onChange={(e) => setConfigName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveConfig()}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                className="px-3 py-1 border rounded text-sm"
                onClick={() => setShowSaveDialog(false)}
              >
                Annuler
              </button>
              <button
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                onClick={handleSaveConfig}
                disabled={!configName.trim()}
              >
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Dialog */}
      {showLoadDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-h-96 overflow-y-auto">
            <h3 className="text-lg font-medium mb-4">Charger une configuration</h3>
            {savedConfigs.length === 0 ? (
              <p className="text-gray-500 text-sm">Aucune configuration sauvegardée</p>
            ) : (
              <div className="space-y-2">
                {savedConfigs.map((config) => (
                  <div key={config.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <div className="font-medium">{config.name}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(config.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        className="px-2 py-1 bg-green-600 text-white rounded text-xs"
                        onClick={() => handleLoadConfig(config)}
                      >
                        Charger
                      </button>
                      <button
                        className="px-2 py-1 bg-red-600 text-white rounded text-xs"
                        onClick={() => handleDeleteConfig(config.id)}
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end mt-4">
              <button
                className="px-3 py-1 border rounded text-sm"
                onClick={() => setShowLoadDialog(false)}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick access to saved configs */}
      {savedConfigs.length > 0 && (
        <div className="text-sm text-gray-600">
          {savedConfigs.length} configuration(s) sauvegardée(s)
        </div>
      )}
    </div>
  );
}
