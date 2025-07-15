'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import toast from 'react-hot-toast';
import { RowBSDPreview } from '../ImportExcels/ButtonImportExcels';

// Types pour les données standardisées
type StandardizedData = { [standard: string]: string | number };


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

  // Charger les IDs existants au montage du composant
  useEffect(() => {
    if (isOpen && entreprise_id) {
      setIsLoadingIds(true);
      getExistingReadableIds(entreprise_id)
        .then(ids => {
          setExistingIds(ids);
          setIsLoadingIds(false);
        })
        .catch(error => {
          console.error('Erreur lors du chargement des IDs existants:', error);
          toast.error('Erreur lors du chargement des données existantes');
          setIsLoadingIds(false);
        });
    }
  }, [isOpen, entreprise_id]);

  // Préparer les données d'aperçu
  useEffect(() => {
    if (existingIds.length > 0 && dataReadyToSend.length > 0) {
      const existingIdsSet = new Set(existingIds);
      const preview = dataReadyToSend.map(row => ({
        row,
        willBeAdded: !existingIdsSet.has(row.readable_id_track_dechets || ''),
        readableId: row.readable_id_track_dechets || ''
      }));
      setPreviewData(preview);
    }
  }, [existingIds, dataReadyToSend]);

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
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h3 className="text-xl font-semibold">Aperçu de l&apos;import</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            disabled={isLoading}
          >
            ✕
          </button>
        </div>

        {/* Statistiques */}
        <div className="p-6 bg-gray-50 border-b">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="bg-white p-4 rounded-lg">
              <div className="text-2xl font-bold text-gray-700">{stats.total}</div>
              <div className="text-sm text-gray-500">Total</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="text-2xl font-bold text-green-600">{stats.toBeAdded}</div>
              <div className="text-sm text-green-500">À ajouter</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-600">{stats.toBeSkipped}</div>
              <div className="text-sm text-yellow-500">Doublons (ignorés)</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="text-2xl font-bold text-blue-600">
                {stats.total > 0 ? Math.round((stats.toBeAdded / stats.total) * 100) : 0}%
              </div>
              <div className="text-sm text-blue-500">Taux d&apos;ajout</div>
            </div>
          </div>
        </div>

        {/* Contenu */}
        <div className="overflow-auto max-h-[60vh]">
          {isLoadingIds ? (
            <div className="p-6 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Chargement des données existantes...</p>
            </div>
          ) : (
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Statut</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">ID</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Date</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Code CED</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Déchet</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Quantité</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Site</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Transporteur</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Destinataire</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Opération</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {previewData.map((item, index) => (
                      <tr 
                        key={index} 
                        className={`hover:bg-gray-50 ${
                          item.willBeAdded ? 'bg-white' : 'bg-yellow-50'
                        }`}
                      >
                        <td className="px-3 py-2">
                          {item.willBeAdded ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              ✓ Ajout
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              ⚠ Doublon
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-900">
                          {item.row.readable_id_track_dechets}
                        </td>
                        <td className="px-3 py-2 text-gray-900">
                          {formatDate(item.row.created_at)}
                        </td>
                        <td className="px-3 py-2 text-gray-900 font-mono">
                          {item.row.infos_json.formAPI.createFormInput.wasteDetails.code}
                        </td>
                        <td className="px-3 py-2 text-gray-900">
                          {item.row.infos_json.formAPI.createFormInput.wasteDetails.name}
                        </td>
                        <td className="px-3 py-2 text-gray-900">
                          {item.row.infos_json.formAPI.createFormInput.wasteDetails.quantity} T
                        </td>
                        <td className="px-3 py-2 text-gray-900">
                          {item.row.infos_json.formAPI.createFormInput.emitter.company.name}
                        </td>
                        <td className="px-3 py-2 text-gray-900">
                          {item.row.infos_json.formAPI.createFormInput.transporter.company.name}
                        </td>
                        <td className="px-3 py-2 text-gray-900">
                          {item.row.infos_json.formAPI.createFormInput.recipient.company.name}
                        </td>
                        <td className="px-3 py-2 text-gray-900">
                          {item.row.infos_json.formAPI.createFormInput.recipient.processingOperation}
                        </td>
                      </tr>
                    ))}
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