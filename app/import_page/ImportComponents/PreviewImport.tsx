'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import toast from 'react-hot-toast';
import { RowBSDPreview } from '../ImportExcels/ButtonImportExcels';
import { calculateTauxTri } from '@/app/component/Analyse/Operationelle/TauxTri';
import { calculateTauxValorisation } from '@/app/component/Analyse/Environnementale/TauxValorisation';
import { BSD } from '@/app/analysis/AnalysisProvider';




interface PreviewImportProps {
  dataReadyToSend: RowBSDPreview[];
  entreprise_id: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

// Fonction pour récupérer tous les readable_id_track_dechets existants
const getExistingReadableIds = async (entreprise_id: string): Promise<string[]> => {
  const existingIds: string[] = [];
  let from = 0;
  const limit = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('bsd')
      .select('readable_id_track_dechets')
      .eq('entreprise_id', entreprise_id)
      .range(from, from + limit - 1);
      
    if (error) throw error;
    if (!data || data.length === 0) break;
    
    // Filtrer les IDs non-null côté client
    data.forEach(row => {
      if (row.readable_id_track_dechets && row.readable_id_track_dechets.trim() !== '') {
        existingIds.push(row.readable_id_track_dechets);
      }
    });
    
    // Si on a moins de 1000 résultats, on a fini
    if (data.length < limit) break;
    from += limit;
  }
  
  return existingIds;
};

const PreviewImport: React.FC<PreviewImportProps> = ({
  dataReadyToSend,
  entreprise_id,
  isOpen,
  onClose,
  onConfirm,
  isLoading = false
}) => {
  const [existingIds, setExistingIds] = useState<string[]>([]);
  const [isLoadingIds, setIsLoadingIds] = useState(false);
  const [previewData, setPreviewData] = useState<Array<{
    row: RowBSDPreview;
    willBeAdded: boolean;
    readableId: string;
  }>>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [mappingTable, setMappingTable] = useState<Array<{ced: string, filiere: string}>>([]);
  const [isLoadingMapping, setIsLoadingMapping] = useState(false);
  const [hasLoadedIds, setHasLoadedIds] = useState(false);

  // Charger le mapping CED-filière depuis la table entreprise
  useEffect(() => {
    if (isOpen && entreprise_id) {
      const fetchMappingTable = async () => {
        setIsLoadingMapping(true);
        try {
          const { data, error } = await supabase
            .from('entreprise')
            .select('mapping_ced_filiere')
            .eq('id', entreprise_id)
            .single();

          if (error) throw error;
          
          if (data?.mapping_ced_filiere) {
            setMappingTable(data.mapping_ced_filiere);
          } else {
            setMappingTable([]);
          }
        } catch (error) {
          console.error('Erreur lors du chargement du mapping CED-filière:', error);
          setMappingTable([]);
        } finally {
          setIsLoadingMapping(false);
        }
      };

      fetchMappingTable();
    }
  }, [isOpen, entreprise_id]);

  // Calcul des KPIs
  const kpis = useMemo(() => {
    const bsdsToAdd = previewData.filter(item => item.willBeAdded).map(item => item.row);
    
    
    // Calculer le tonnage total
    const totalWeight = bsdsToAdd.reduce((sum, bsd) => {
      return sum + (bsd.infos_json.formAPI.createFormInput.wasteDetails.quantity || 0);
    }, 0);
    
    // Utiliser les fonctions exportées des composants d'analyse
    // Conversion temporaire pour la compatibilité des types
    const bsdsAsBSD = bsdsToAdd as unknown as BSD[];
    const { tauxTri } = calculateTauxTri(bsdsAsBSD, mappingTable, { nom: 'filiere' });
    const { globalValorizationRate, materialValorizationRate, processedBsdsCount } = calculateTauxValorisation(bsdsAsBSD);

    return {
      totalWeight,
      tauxTri,
      globalValorizationRate,
      materialValorizationRate,
      processedBsdsCount
    };
  }, [previewData, mappingTable]);

  

  // Charger les IDs existants au montage du composant
  useEffect(() => {
    if (isOpen && entreprise_id) {
      setIsLoadingIds(true);
      setHasLoadedIds(false);
      getExistingReadableIds(entreprise_id)
        .then(ids => {
          setExistingIds(ids);
          setIsLoadingIds(false);
          setHasLoadedIds(true);
        })
        .catch(error => {
          console.error('Erreur lors du chargement des IDs existants:', error);
          toast.error('Erreur lors du chargement des données existantes');
          setIsLoadingIds(false);
          setHasLoadedIds(true);
        });
    }
  }, [isOpen, entreprise_id]);

  // Préparer les données d'aperçu
  useEffect(() => {
    if (!isOpen) return;
    if (!hasLoadedIds) return;
    const existingIdsSet = new Set(existingIds);
    const preview = (dataReadyToSend || []).map(row => ({
      row,
      willBeAdded: !existingIdsSet.has(row.readable_id_track_dechets || ''),
      readableId: row.readable_id_track_dechets || ''
    }));
    setPreviewData(preview);
  }, [isOpen, hasLoadedIds, existingIds, dataReadyToSend]);

  // Calculer les statistiques
  const stats = {
    total: previewData.length,
    toBeAdded: previewData.filter(item => item.willBeAdded).length,
    toBeSkipped: previewData.filter(item => !item.willBeAdded).length
  };

  // Formater la date
  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('fr-FR');
    } catch {
      return dateStr;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header avec KPIs et stats */}
        <div className="p-3 border-b bg-blue-50">
          <div className="flex justify-between items-center gap-3">
            {/* KPIs */}
            <div className="flex gap-3">
              <div className="bg-white p-2 rounded-lg border border-blue-200">
                <div className="text-lg font-bold text-blue-600">{kpis.totalWeight.toFixed(1)}</div>
                <div className="text-xs text-blue-500">Tonnage</div>
              </div>
              <div className="bg-white p-2 rounded-lg border border-green-200">
                <div className="text-lg font-bold text-green-600">{kpis.tauxTri.toFixed(1)}%</div>
                <div className="text-xs text-green-500">Tri</div>
              </div>
              <div className="bg-white p-2 rounded-lg border border-purple-200">
                <div className="text-lg font-bold text-purple-600">{kpis.materialValorizationRate.toFixed(1)}%</div>
                <div className="text-xs text-purple-500">Valo matière</div>
              </div>
              <div className="bg-white p-2 rounded-lg border border-orange-200">
                <div className="text-lg font-bold text-orange-600">{kpis.globalValorizationRate.toFixed(1)}%</div>
                <div className="text-xs text-orange-500">Valo globale</div>
              </div>
            </div>
            
            {/* Stats doublons */}
            <div className="flex gap-3">
              <div className="bg-green-50 p-2 rounded-lg border border-green-200">
                <div className="text-lg font-bold text-green-600">{stats.toBeAdded}</div>
                <div className="text-xs text-green-500">À ajouter</div>
              </div>
              <div className="bg-yellow-50 p-2 rounded-lg border border-yellow-200">
                <div className="text-lg font-bold text-yellow-600">{stats.toBeSkipped}</div>
                <div className="text-xs text-yellow-500">Doublons</div>
              </div>
            </div>
            
            {/* Bouton fermer */}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 p-2"
              disabled={isLoading}
            >
              ✕
            </button>
          </div>
        </div>

                {/* Toggle colonnes avancées */}
        <div className="p-2 bg-gray-50 border-b flex justify-end">
          <label className="flex items-center cursor-pointer gap-2">
            <input
              type="checkbox"
              checked={showAdvanced}
              onChange={() => setShowAdvanced(v => !v)}
              className="form-checkbox h-4 w-4 text-blue-600"
            />
            <span className="text-sm text-gray-700 whitespace-nowrap">Colonnes avancées</span>
          </label>
        </div>

        {/* Contenu */}
        <div className="overflow-auto max-h-[65vh]">
          {isLoadingIds ? (
            <div className="p-6 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Chargement des données existantes...</p>
            </div>
          ) : (
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm table-fixed">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-2 text-left font-medium text-gray-700 w-24">Statut</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-700 w-28">ID</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-700 w-24">Date</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-700 w-24">Code CED</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-700 w-32">Déchet</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-700 w-20">Quantité</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-700 w-32">Site</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-700 w-32">Transporteur</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-700 w-32">Destinataire</th>
                      <th className="px-2 py-2 text-left font-medium text-gray-700 w-24">Opération</th>
                      {showAdvanced && (
                        <>
                          <th className="px-2 py-2 text-left font-medium text-gray-700 w-20">Valo 1</th>
                          <th className="px-2 py-2 text-left font-medium text-gray-700 w-20">Tonne 1</th>
                          <th className="px-2 py-2 text-left font-medium text-gray-700 w-20">Valo 2</th>
                          <th className="px-2 py-2 text-left font-medium text-gray-700 w-20">Tonne 2</th>
                          <th className="px-2 py-2 text-left font-medium text-gray-700 w-20">Valo 3</th>
                          <th className="px-2 py-2 text-left font-medium text-gray-700 w-20">Tonne 3</th>
                          <th className="px-2 py-2 text-left font-medium text-gray-700 w-16">Tri</th>
                          <th className="px-2 py-2 text-left font-medium text-gray-700 w-16">REP</th>
                          <th className="px-2 py-2 text-left font-medium text-gray-700 w-28">SIRET Transporteur</th>
                          <th className="px-2 py-2 text-left font-medium text-gray-700 w-28">SIRET Destinataire</th>
                          <th className="px-2 py-2 text-left font-medium text-gray-700 w-32">Adresse Installation</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {previewData.map((item, index) => {
                      const form = item.row.infos_json.formAPI.createFormInput;
                      const otherInfos = item.row.other_infos || {};
                      const valoParts = form.recipient.valoParts || [];
                      return (
                        <tr 
                          key={index} 
                          className={`hover:bg-gray-50 ${
                            item.willBeAdded ? 'bg-white' : 'bg-yellow-50'
                          }`}
                        >
                          <td className="px-2 py-2">{item.willBeAdded ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              ✓ Ajout
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              ⚠ Doublon
                            </span>
                          )}</td>
                          <td className="px-2 py-2 text-gray-900">{item.row.readable_id_track_dechets}</td>
                          <td className="px-2 py-2 text-gray-900">{formatDate(item.row.created_at)}</td>
                          <td className="px-2 py-2 text-gray-900 font-mono">{form.wasteDetails.code}</td>
                          <td className="px-2 py-2 text-gray-900">{form.wasteDetails.name}</td>
                          <td className="px-2 py-2 text-gray-900">{form.wasteDetails.quantity} T</td>
                          <td className="px-2 py-2 text-gray-900">{form.emitter.company.name}</td>
                          <td className="px-2 py-2 text-gray-900">{form.transporter.company.name}</td>
                          <td className="px-2 py-2 text-gray-900">{form.recipient.company.name}</td>
                          <td className="px-2 py-2 text-gray-900">{form.recipient.processingOperation}</td>
                          {showAdvanced && (
                            <>
                              <td className="px-2 py-2 text-gray-900">{valoParts[0]?.code_valo || ''}</td>
                              <td className="px-2 py-2 text-gray-900">{valoParts[0]?.tonnage ?? ''}</td>
                              <td className="px-2 py-2 text-gray-900">{valoParts[1]?.code_valo || ''}</td>
                              <td className="px-2 py-2 text-gray-900">{valoParts[1]?.tonnage ?? ''}</td>
                              <td className="px-2 py-2 text-gray-900">{valoParts[2]?.code_valo || ''}</td>
                              <td className="px-2 py-2 text-gray-900">{valoParts[2]?.tonnage ?? ''}</td>
                              <td className="px-2 py-2 text-gray-900">{otherInfos.tri === true ? 'Oui' : otherInfos.tri === false ? 'Non' : ''}</td>
                              <td className="px-2 py-2 text-gray-900">{otherInfos.rep?.sent_to_rep === true ? 'Oui' : ''}</td>
                              <td className="px-2 py-2 text-gray-900">{form.transporter.company.siret}</td>
                              <td className="px-2 py-2 text-gray-900">{form.recipient.company.siret}</td>
                              <td className="px-2 py-2 text-gray-900">{form.recipient.company.address}</td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            disabled={isLoading}
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            disabled={isLoading || stats.toBeAdded === 0}
          >
            {isLoading ? (
              <>
                <span className="inline-block animate-spin mr-2">↻</span>
                Import en cours...
              </>
            ) : (
              `Importer ${stats.toBeAdded} ligne${stats.toBeAdded > 1 ? 's' : ''}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreviewImport; 