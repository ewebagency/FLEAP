'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import { toast } from 'react-hot-toast';
import { useSession } from '@/app/component/SessionProvider';
import { PdfInfo } from '../interface/pdf_interface';
import { LinkOrCreate, LinkResult } from '../utils/link';
import { create_in_bdd, create_in_bdd_preview } from '../utils/link_or_create_bdd';
import { link_in_bdd } from '../utils/link_or_create_bdd';
import { RowBSD } from '@/app/register/interface/BSD_Interface';

interface LinkMetaProps {
  pdf_id: number;
  isOpen?: boolean;
  onClose?: () => void;
  onLink?: (bsd_id: string) => void;
  onCreate?: (bsd_id: string) => void;
}

// Types explicites pour les données du PDF (infos_raw)
interface PdfDechetItem {
  ced?: string;
  d_r?: string;
  nom?: string;
  date?: string;
  tour?: string;
  num_bon?: string;
  num_bsd?: string;
  tonnage?: string;
}

interface PdfInfosRaw {
  dechet?: PdfDechetItem[];
  site_raw?: string;
  type_doc?: string;
  presta_raw?: string;
  num_facture?: string;
}

const getPdfInfosRaw = (pdf: PdfInfo): PdfInfosRaw => (pdf.infos_raw as unknown as PdfInfosRaw);

// Types pour la structure minimale utilisée de infos_json côté BSD
interface BsdFormCompany { name?: string }
interface BsdWorkSite { name?: string }
interface BsdWasteDetails { code?: string; name?: string }
interface BsdCreateFormInput {
  takenOverAt?: string;
  recipient?: { company?: BsdFormCompany };
  transporter?: { company?: BsdFormCompany };
  emitter?: { company?: BsdFormCompany; workSite?: BsdWorkSite };
  wasteDetails?: BsdWasteDetails;
}
interface BsdInfosJson { formAPI?: { createFormInput?: BsdCreateFormInput } }

const getBsdInfos = (bsd: RowBSD): BsdInfosJson => (bsd.infos_json as unknown as BsdInfosJson);

// Helpers purs pour séparer la logique
const normalizeNumbers = (value: string): string => value.replace(/[^\d]/g, '').replace(/\s/g, '');

const getEffectiveBsdDate = (bsd: RowBSD): Date => {
  const takenOverAt = getBsdInfos(bsd).formAPI?.createFormInput?.takenOverAt;
  return new Date(takenOverAt || bsd.created_at);
};

const isDateWithinRange = (bsd: RowBSD, pdfDate: string, maxDays: number): boolean => {
  if (!pdfDate) return true;
  const bsdDate = getEffectiveBsdDate(bsd);
  const pdfDateObj = new Date(pdfDate);
  const diffTime = Math.abs(bsdDate.getTime() - pdfDateObj.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays <= maxDays;
};

const getBsdRecipient = (bsd: RowBSD): string => getBsdInfos(bsd).formAPI?.createFormInput?.recipient?.company?.name || '';
const getBsdTransporter = (bsd: RowBSD): string => getBsdInfos(bsd).formAPI?.createFormInput?.transporter?.company?.name || '';
const getBsdSite = (bsd: RowBSD): string => getBsdInfos(bsd).formAPI?.createFormInput?.emitter?.company?.name || '';
const getBsdWasteCode = (bsd: RowBSD): string => getBsdInfos(bsd).formAPI?.createFormInput?.wasteDetails?.code || '';
const getBsdWasteName = (bsd: RowBSD): string => getBsdInfos(bsd).formAPI?.createFormInput?.wasteDetails?.name || '';

export default function LinkMeta({ pdf_id, onLink, onCreate }: LinkMetaProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBsdId, setSelectedBsdId] = useState<string>('');
  const [pdfInfo, setPdfInfo] = useState<PdfInfo | null>(null);
  const [linkResult, setLinkResult] = useState<LinkResult | null>(null);
  const [candidateBSDs, setCandidateBSDs] = useState<RowBSD[]>([]);
  const [filteredBSDs, setFilteredBSDs] = useState<RowBSD[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataReady, setDataReady] = useState<boolean>(false);
  const [mappings, setMappings] = useState<{
    params_mapping_site: Record<string, string[]>;
    params_mapping_presta: Record<string, string[]>;
    params_mapping_nom_dechet: Record<string, string[]>;
  } | null>(null);
  const [filters, setFilters] = useState({
    dateRange: 8, // jours
    showDateFilter: true,
    showPrestataireFilter: true,
    showSiteFilter: true,
    showCedFilter: true,
    showWasteNameFilter: false,
    wasteNameThreshold: 0.8
  });
  const { entreprise_id, user_id } = useSession() as { entreprise_id: string; user_id?: string };
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewJson, setPreviewJson] = useState<Record<string, unknown> | null>(null);
  const [previewIndexDechet, setPreviewIndexDechet] = useState<number>(0);

  // Fonction pour récupérer les mappings de traduction
  const fetchMappings = async () => {
    try {
      const { data: entrepriseData, error: entrepriseError } = await supabase
        .from('entreprise')
        .select('params_mapping_site, params_mapping_presta, params_mapping_nom_dechet')
        .eq('id', entreprise_id)
        .single();

      if (entrepriseError) {
        return;
      }

      if (entrepriseData) {
        setMappings({
          params_mapping_site: entrepriseData.params_mapping_site || {},
          params_mapping_presta: entrepriseData.params_mapping_presta || {},
          params_mapping_nom_dechet: entrepriseData.params_mapping_nom_dechet || {}
        });
      }
    } catch (error) {
      // ignore logging
    }
  };

  // Fonction pour récupérer les informations du PDF
  const fetchPdfData = async () => {
    try {
      setLoading(true);
      setError(null);
      setDataReady(false);

      // Récupérer les mappings en parallèle
      await fetchMappings();

      // Récupérer les informations du PDF
      const { data: pdfData, error: pdfError } = await supabase
        .from('pdf_infos')
        .select('*')
        .eq('id', pdf_id)
        .eq('entreprise_id', entreprise_id)
        .single();

      if (pdfError) throw new Error('Erreur lors de la récupération du PDF');
      if (!pdfData) throw new Error('PDF non trouvé');

      setPdfInfo(pdfData);
      setDataReady(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour lancer la liaison automatique
  const handleAutoLink = async () => {
    if (!pdfInfo || !entreprise_id) {
      toast.error('Données PDF non disponibles');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Lancer la fonction LinkOrCreate
      const result = await LinkOrCreate(pdfInfo, parseInt(entreprise_id));

      setLinkResult(result);

      // Récupérer tous les candidats BSD pour affichage
      await fetchAllCandidateBSDs();

      // Afficher un toast selon le résultat
      switch (result.action) {
        case 'to_link':
          toast.success(`Liaison automatique réussie ! BSD ${result.id_link} sélectionné.`);
          break;
        case 'to_create':
          toast.success('Aucun BSD correspondant trouvé. Création recommandée.');
          break;
        case 'to_check_by_user':
          if (result.id_link) {
            toast.success(`Candidat unique trouvé : BSD ${result.id_link}. Vérification recommandée.`);
          } else {
            toast('Plusieurs candidats trouvés. Vérification manuelle requise.');
          }
          break;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour récupérer tous les BSDs candidats récents
  const fetchAllCandidateBSDs = async () => {
    try {
      // Récupérer les BSDs des 30 derniers jours
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: bsdData, error: bsdError } = await supabase
        .from('bsd')
        .select('*')
        .eq('entreprise_id', entreprise_id)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      if (bsdError) throw new Error('Erreur lors de la récupération des BSDs candidats');
      setCandidateBSDs(bsdData || []);
    } catch (error) {
      console.error('Erreur lors de la récupération des candidats:', error);
    }
  };

  // Fonction pour obtenir la traduction d'un champ
  const getTranslation = (value: string, mappingType: 'site' | 'presta' | 'nom_dechet'): { translated: string; found: boolean } => {
    if (!mappings || !value) {
      return { translated: value, found: false };
    }

    const mapping = mappingType === 'site' ? mappings.params_mapping_site :
                   mappingType === 'presta' ? mappings.params_mapping_presta :
                   mappings.params_mapping_nom_dechet;

    // Chercher la correspondance
    for (const [translatedValue, originalValues] of Object.entries(mapping)) {
      // Extraire le nom (partie avant le |) de la clé traduite
      const translatedName = translatedValue.split('|')[0];
      const normalizedValue = value.toLowerCase().trim();

      // Vérifier si la valeur actuelle correspond à une des valeurs originales
      const matchInOriginals = Array.isArray(originalValues) && originalValues.some(original => 
        (original || '').toLowerCase().trim() === normalizedValue
      );

      // OU si elle correspond directement au nom de la clé (avant le |)
      const matchInKeyName = translatedName.toLowerCase().trim() === normalizedValue;

      if (matchInOriginals || matchInKeyName) {
        return { translated: translatedName, found: true };
      }
    }

    return { translated: value, found: false };
  };

  // Helpers de fuzzy matching (Levenshtein)
  const computeLevenshteinDistance = (a: string, b: string): number => {
    const s = a.toLowerCase().trim();
    const t = b.toLowerCase().trim();
    const m = s.length;
    const n = t.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = s[i - 1] === t[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,        // deletion
          dp[i][j - 1] + 1,        // insertion
          dp[i - 1][j - 1] + cost  // substitution
        );
      }
    }
    return dp[m][n];
  };

  const computeSimilarity = (a: string, b: string): number => {
    if (!a || !b) return 0;
    const dist = computeLevenshteinDistance(a, b);
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;
    return 1 - dist / maxLen;
  };

    // Fonction pour filtrer les BSDs selon les critères de liaison
  const filterBSDs = useCallback(() => {
    if (!pdfInfo || !candidateBSDs.length) {
      setFilteredBSDs(candidateBSDs);
      return;
    }

    const normalizedPdf = getPdfInfosRaw(pdfInfo);
    const pdfDate = normalizedPdf.dechet && Array.isArray(normalizedPdf.dechet) && normalizedPdf.dechet.length > 0 
      ? (normalizedPdf.dechet[0]?.date as string) 
      : '';
    const pdfPrestataire = normalizedPdf.presta_raw || '';
    const pdfSite = normalizedPdf.site_raw || '';
    const pdfCed = normalizedPdf.dechet && Array.isArray(normalizedPdf.dechet) && normalizedPdf.dechet.length > 0 
      ? (normalizedPdf.dechet[0]?.ced as string) 
      : '';

    const filtered = candidateBSDs.filter(bsd => {

        // Filtre sur la date (priorité à takenOverAt si présent, sinon created_at)
        if (filters.showDateFilter && pdfDate) {
          if (!isDateWithinRange(bsd, pdfDate, filters.dateRange)) return false;
        }

        // Filtre sur le prestataire (destinataire OU transporteur)
        if (filters.showPrestataireFilter && pdfPrestataire) {
          const bsdRecipient = getBsdRecipient(bsd);
          const bsdTransporter = getBsdTransporter(bsd);
          
          // Obtenir la traduction du prestataire du PDF
          const prestaTranslated = getTranslation(pdfPrestataire, 'presta').translated.split('|')[0];
          
          const recipientMatch = bsdRecipient.toLowerCase() === prestaTranslated.toLowerCase();
          const transporterMatch = bsdTransporter.toLowerCase() === prestaTranslated.toLowerCase();
          
          if (!recipientMatch && !transporterMatch) return false;
        }

        // Filtre sur le site
        if (filters.showSiteFilter && pdfSite) {
          const siteTranslated = getTranslation(pdfSite, 'site').translated.split('|')[0];
          const bsdSite = getBsdSite(bsd);
          if (bsdSite.toLowerCase() !== siteTranslated.toLowerCase()) return false;
        }

        // Filtre sur le nom du déchet (fuzzy matching)
        if (filters.showWasteNameFilter) {
          const pdfWasteName = (normalizedPdf.dechet && Array.isArray(normalizedPdf.dechet) && normalizedPdf.dechet.length > 0)
            ? ((normalizedPdf.dechet[0] as Record<string, unknown>).nom as string)
            : '';
          const pdfWasteTranslated = getTranslation(pdfWasteName, 'nom_dechet').translated.split('|')[0];
          const bsdWasteName = getBsdWasteName(bsd);
          const score = computeSimilarity(pdfWasteTranslated, bsdWasteName);
          if (score < filters.wasteNameThreshold) return false;
        }

        // Filtre sur le CED (chiffres uniquement)
        if (filters.showCedFilter && pdfCed) {
          const bsdCed = getBsdWasteCode(bsd);
          
          // Obtenir la traduction du nom du déchet du PDF
          const nomDechet = normalizedPdf.dechet && Array.isArray(normalizedPdf.dechet) && normalizedPdf.dechet.length > 0 
            ? (normalizedPdf.dechet[0] as Record<string, unknown>).nom as string 
            : '';
          const dechetTranslated = getTranslation(nomDechet, 'nom_dechet').translated.split('|')[0];
          
          const pdfCedNumbers = normalizeNumbers(pdfCed);
          const bsdCedNumbers = normalizeNumbers(bsdCed);
          if (pdfCedNumbers && bsdCedNumbers && pdfCedNumbers !== bsdCedNumbers) return false;
        }
        return true;
      });

    setFilteredBSDs(filtered);
  }, [candidateBSDs, pdfInfo, filters]);

  // Appliquer les filtres quand les données changent
  useEffect(() => {
    filterBSDs();
  }, [filterBSDs]);

  // Réinitialiser les données quand le modal s'ouvre
  useEffect(() => {
    if (isModalOpen) {
      setDataReady(false);
      setLinkResult(null);
      setCandidateBSDs([]);
      setFilteredBSDs([]);
      setSelectedBsdId('');
      setError(null);
      fetchPdfData();
    }
  }, [isModalOpen]);

  return (
    <>
      {/* Bouton pour ouvrir le modal */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        Liaison Meta
      </button>

      {/* Modal simplifié */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
              &#8203;
            </span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium text-gray-900">
                    Liaison Automatique
                  </h2>
                  {pdfInfo && <div className="grid grid-cols-3 gap-4 text-base">
                        <div>
                            <span className="font-medium">Nom:</span> {pdfInfo.name_pdf}
                        </div>
                        <div>
                            <span className="font-medium">Statut:</span> {pdfInfo.status}
                        </div>
                        <div>
                            <span className="font-medium">Type:</span> {pdfInfo.document_type}
                        </div>                      
                  </div> }
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Informations du PDF */}
                {pdfInfo && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    
                    {/* Informations extraites du PDF */}
                    {pdfInfo.infos_raw && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h4 className="text-base font-semibold text-gray-900 mb-3">Données extraites</h4>
                        <div className="grid grid-cols-3 gap-4 text-base">
                           <div>
                             <span className="font-medium">Site:</span>
                             {(() => {
                               const info = getPdfInfosRaw(pdfInfo);
                               const siteRaw = info.site_raw || '';
                               const { translated, found } = getTranslation(siteRaw, 'site');
                               return (
                                 <span className={found ? '' : 'text-red-600'}>
                                   {translated || 'vide'}
                                   {!found && siteRaw && <span className="text-red-500 text-xs ml-1">(Non trouvé)</span>}
                                 </span>
                               );
                             })()}
                           </div>
                           <div>
                             <span className="font-medium">Prestataire:</span>
                             {(() => {
                               const info = getPdfInfosRaw(pdfInfo);
                               const prestaRaw = info.presta_raw || '';
                               const { translated, found } = getTranslation(prestaRaw, 'presta');
                               return (
                                 <span className={found ? '' : 'text-red-600'}>
                                   {translated || 'vide'}
                                   {!found && prestaRaw && <span className="text-red-500 text-xs ml-1">(Non trouvé)</span>}
                                 </span>
                               );
                             })()}
                           </div>
                           <div>
                            {(() => {
                              const info = getPdfInfosRaw(pdfInfo);
                              return <>
                                <span className="font-medium">Type document:</span> {info.type_doc || 'vide'}
                              </>;
                            })()}
                           </div>                          
                          {(getPdfInfosRaw(pdfInfo).num_facture) && (
                            <div>
                              <span className="font-medium">Numéro facture:</span> {getPdfInfosRaw(pdfInfo).num_facture}
                            </div>
                          )}
                         </div>
                        
                        {/* Détails des déchets */}
                        {(() => { const info = getPdfInfosRaw(pdfInfo); return (info.dechet && Array.isArray(info.dechet)); })() && (
                          <div className="mt-3">
                            <h5 className="text-sm font-semibold text-gray-800 mb-2">Déchets ({getPdfInfosRaw(pdfInfo).dechet?.length})</h5>
                            <div className="space-y-2">
                              {getPdfInfosRaw(pdfInfo).dechet?.map((dechet: PdfDechetItem, index: number) => (
                                <div key={index} className="p-3 bg-white rounded border text-base">
                                                                          <div className="grid grid-cols-3 gap-3">
                                      <div><span className="font-medium">Date:</span> {(() => {
                                      const d = dechet.date || '';
                                      if (!d) return 'vide';
                                      const dt = new Date(d);
                                      return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('fr-FR');
                                    })()}</div>
                                      <div><span className="font-medium">CED:</span> {dechet.ced || 'vide'}</div>
                                      <div>
                                        <span className="font-medium">Nom:</span>
                                        {(() => {
                                        const nomDechet = dechet.nom || '';
                                        const { translated, found } = getTranslation(nomDechet, 'nom_dechet');
                                        return (
                                          <span className={found ? '' : 'text-red-600'}>
                                            {translated || 'vide'}
                                            {!found && nomDechet && <span className="text-red-500 text-xs ml-1">(Non trouvé)</span>}
                                          </span>
                                        );
                                        })()}
                                      </div>
                                      <div><span className="font-medium">Num bon:</span> {dechet.num_bon || 'vide'}</div>
                                      {dechet.num_bsd && (
                                        <div><span className="font-medium">Num BSD:</span> {dechet.num_bsd}</div>
                                      )}
                                      <div><span className="font-medium">Tonnage:</span> {dechet.tonnage || 'vide'}</div>
                                    </div>
                                 </div>
                               ))}
                             </div>
                           </div>
                         )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-4 items-center">
                    {/* Bouton de liaison automatique */}
                    <div className="mb-4 w-3/5">
                    <button
                        onClick={handleAutoLink}
                        disabled={loading || !dataReady}
                        className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Analyse en cours...
                        </>
                        ) : (
                        <>
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Lancer la liaison automatique
                        </>
                        )}
                    </button>
                    </div>
                    {/* Résultat de la liaison */}
                    {linkResult && (
                    <div className="mb-4 p-2 border rounded-lg w-2/5">
                        <div className="space-y-2">
                        <div>
                            <span className="font-medium">Action recommandée:</span>
                            <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${
                            linkResult.action === 'to_link' ? 'bg-green-100 text-green-800' :
                            linkResult.action === 'to_create' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                            }`}>
                            {linkResult.action === 'to_link' ? 'Liaison automatique' :
                            linkResult.action === 'to_create' ? 'Création recommandée' :
                            'Vérification manuelle'}
                            </span>
                        </div>
                        {linkResult.id_link && (
                            <div>
                            <span className="font-medium">BSD suggéré:</span> {linkResult.id_link}
                            </div>
                        )}
                        {linkResult.candidates && linkResult.candidates.length > 0 && (
                            <div>
                            <span className="font-medium">Candidats trouvés:</span> {linkResult.candidates.length}
                            </div>
                        )}
                        </div>
                    </div>
                    )}                    
                </div>



                {/* Filtres pour les candidats BSD */}
                 {(candidateBSDs.length > 0 || linkResult) && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-gray-900">
                        Candidats BSD ({filteredBSDs.length}/{candidateBSDs.length})
                      </h3>
                      <button
                        onClick={() => setFilters(prev => ({ ...prev, dateRange: prev.dateRange === 2 ? 8 : 2 }))}
                        className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        Écart: {filters.dateRange}j
                      </button>
                    </div>
                    
                    {/* Contrôles de filtres */}
                    <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                      <h4 className="text-xs font-medium text-gray-700 mb-2">Filtres actifs</h4>
                      <div className="flex flex-wrap gap-2">
                        <label className="flex items-center text-xs">
                          <input
                            type="checkbox"
                            checked={filters.showDateFilter}
                            onChange={(e) => setFilters(prev => ({ ...prev, showDateFilter: e.target.checked }))}
                            className="mr-1"
                          />
                          Date (±{filters.dateRange}j)
                        </label>
                        <label className="flex items-center text-xs">
                          <input
                            type="checkbox"
                            checked={filters.showPrestataireFilter}
                            onChange={(e) => setFilters(prev => ({ ...prev, showPrestataireFilter: e.target.checked }))}
                            className="mr-1"
                          />
                          Prestataire
                        </label>
                        <label className="flex items-center text-xs">
                          <input
                            type="checkbox"
                            checked={filters.showSiteFilter}
                            onChange={(e) => setFilters(prev => ({ ...prev, showSiteFilter: e.target.checked }))}
                            className="mr-1"
                          />
                          Site
                        </label>
                        <label className="flex items-center text-xs">
                          <input
                            type="checkbox"
                            checked={filters.showCedFilter}
                            onChange={(e) => setFilters(prev => ({ ...prev, showCedFilter: e.target.checked }))}
                            className="mr-1"
                          />
                          CED
                        </label>
                        <label className="flex items-center text-xs">
                          <input
                            type="checkbox"
                            checked={filters.showWasteNameFilter}
                            onChange={(e) => setFilters(prev => ({ ...prev, showWasteNameFilter: e.target.checked }))}
                            className="mr-1"
                          />
                          Déchet ({filters.wasteNameThreshold*100}%)
                        </label>
                        <div className="flex items-center text-xs hidden">
                          <span className="mr-1">Seuil:</span>
                          <input
                            type="number"
                            min={50}
                            max={100}
                            step={5}
                            value={Math.round(filters.wasteNameThreshold * 100)}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              const clamped = Math.max(0, Math.min(100, isNaN(v) ? 80 : v));
                              setFilters(prev => ({ ...prev, wasteNameThreshold: clamped / 100 }));
                            }}
                            className="w-16 border border-gray-300 rounded px-1 py-0.5"
                          />
                          <span className="ml-1">%</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {filteredBSDs.map((bsd) => (
                        <div
                          key={bsd.id}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedBsdId === bsd.id.toString()
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => setSelectedBsdId(bsd.id.toString())}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-medium text-sm">
                                BSD {bsd.readable_id_track_dechets || bsd.id}
                              </div>
                              <div className="text-base text-gray-700 mt-2">
                                <div className="grid grid-cols-3 gap-3">
                                  <div>
                                    <span className="font-medium">ID:</span>
                                    <span className="ml-1">{bsd.id}</span>
                                  </div>
                                  <div>
                                    <span className="font-medium">Site :</span>
                                    {(() => {
                                      const siteName = getBsdInfos(bsd).formAPI?.createFormInput?.emitter?.company?.name || '';
                                      const { translated, found } = getTranslation(siteName, 'site');
                                      return (
                                        <span className={`ml-1 ${found ? '' : 'text-red-600'}`}>
                                          {translated || 'vide'}
                                          {!found && siteName && <span className="text-red-500 text-xs ml-1">(Non trouvé)</span>}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  <div>
                                    <span className="font-medium">Destinataire:</span>
                                    {(() => {
                                      const recipientName = getBsdInfos(bsd).formAPI?.createFormInput?.recipient?.company?.name || '';
                                      const { translated, found } = getTranslation(recipientName, 'presta');
                                      return (
                                        <span className={`ml-1 ${found ? '' : 'text-red-600'}`}>
                                          {translated || 'vide'}
                                          {!found && recipientName && <span className="text-red-500 text-xs ml-1">(Non trouvé)</span>}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  <div>
                                    <span className="font-medium">Transporteur:</span>
                                    {(() => {
                                      const transporterName = getBsdInfos(bsd).formAPI?.createFormInput?.transporter?.company?.name || '';
                                      const { translated, found } = getTranslation(transporterName, 'presta');
                                      return (
                                        <span className={`ml-1 ${found ? '' : 'text-red-600'}`}>
                                          {translated || 'vide'}
                                          {!found && transporterName && <span className="text-red-500 text-xs ml-1">(Non trouvé)</span>}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  <div>
                                    <span className="font-medium">Déchet:</span>
                                    <span className="ml-1">{getBsdInfos(bsd).formAPI?.createFormInput?.wasteDetails?.name || 'vide'}</span>
                                  </div>
                                  <div>
                                    <span className="font-medium">CED:</span>
                                    <span className="ml-1">{getBsdInfos(bsd).formAPI?.createFormInput?.wasteDetails?.code || 'vide'}</span>
                                  </div>
                                  <div>
                                    <span className="font-medium">Date:</span>
                                    <span className="ml-1">{new Date(getBsdInfos(bsd).formAPI?.createFormInput?.takenOverAt || bsd.created_at).toLocaleDateString()}</span>
                                  </div>
                                  {bsd.other_infos?.numeroBon && (
                                    <div>
                                      <span className="font-medium">Num bon:</span>
                                      <span className="ml-1">{bsd.other_infos.numeroBon}</span>
                                    </div>
                                  )}
                                  {bsd.readable_id_track_dechets && (
                                    <div>
                                      <span className="font-medium">Num BSD:</span>
                                      <span className="ml-1">{bsd.readable_id_track_dechets}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="ml-2">
                              <input
                                type="radio"
                                name="selectedBsd"
                                checked={selectedBsdId === bsd.id.toString()}
                                onChange={() => setSelectedBsdId(bsd.id.toString())}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                              />
                            </div>
                          </div>
                        </div>
                                             ))}
                     </div>
                   </div>
                 )}

                 {/* Boutons d'action */}
                 {linkResult && (
                   <div className="mb-6">
                     <h3 className="text-sm font-medium text-gray-900 mb-3">Actions disponibles</h3>
                     <div className="flex space-x-3">
                         <button
                           onClick={async () => {
                           if (!entreprise_id || !pdfInfo) return;
                           const targetId = linkResult?.id_link || selectedBsdId;
                           if (!targetId) { toast.error('Aucun BSD sélectionné'); return; }
                           console.log('[UI] Lier click', { targetId, pdfId: pdfInfo.id });
                           try {
                             // index de déchet par défaut 0
                             const res = await link_in_bdd(parseInt(entreprise_id), String(targetId), String(pdfInfo.id), 0);
                             if (res?.ok) {
                               toast.success(`BSD ${targetId} lié avec succès`);
                             } else {
                               toast.error('Échec de la liaison');
                             }
                           } catch (e) {
                             const msg = e instanceof Error ? e.message : 'Erreur lors de la liaison';
                             console.error('[UI] link_in_bdd error', e);
                             toast.error(msg);
                           }
                         }}
                         disabled={linkResult.action === 'to_create'}
                         className={`flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${linkResult.action === 'to_create' ? 'bg-green-600 opacity-50 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'}`}
                       >
                         Lier
                         </button>
                       <button
                          onClick={async () => {
                            if (!entreprise_id || !pdfInfo) return;
                            try {
                              setLoading(true);
                              const idx = 0; // premier déchet par défaut
                              const prev = await create_in_bdd_preview(parseInt(entreprise_id), String(pdfInfo.id), idx, String(user_id || ''));
                              setPreviewIndexDechet(idx);
                              setPreviewJson(prev.preview as Record<string, unknown>);
                              setIsPreviewOpen(true);
                            } catch (e) {
                              const msg = e instanceof Error ? e.message : 'Erreur lors de la prévisualisation';
                              toast.error(msg);
                            } finally {
                              setLoading(false);
                            }
                          }}
                         disabled={linkResult.action === 'to_link'}
                         className={`flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${linkResult.action === 'to_link' ? 'bg-blue-600 opacity-50 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'}`}
                       >
                         Créer
                         </button>
                     </div>
                   </div>
                 )}

                 {/* Message d'erreur */}
                {error && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <div className="text-sm text-red-800">{error}</div>
                  </div>
                )}
                {isPreviewOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium text-gray-900">Prévisualisation de la création BSD (déchet #{previewIndexDechet})</h3>
                        <button className="text-gray-400 hover:text-gray-600" onClick={() => setIsPreviewOpen(false)}>
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                      </div>
                      <pre className="bg-gray-50 border border-gray-200 rounded p-3 h-64 overflow-auto text-xs">{JSON.stringify(previewJson, null, 2)}</pre>
                      <div className="mt-4 flex justify-end space-x-2">
                        <button
                          onClick={() => setIsPreviewOpen(false)}
                          className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={async () => {
                            if (!entreprise_id || !pdfInfo) return;
                            try {
                              setLoading(true);
                              const res = await create_in_bdd(parseInt(entreprise_id), String(pdfInfo.id), previewIndexDechet, { user_id: String(user_id || '') });
                              if (res?.ok) {
                                toast.success('BSD créé avec succès');
                                setIsPreviewOpen(false);
                                await fetchAllCandidateBSDs();
                              } else {
                                toast.error('Échec de la création');
                              }
                            } catch (e) {
                              const msg = e instanceof Error ? e.message : 'Erreur lors de la création';
                              toast.error(msg);
                            } finally {
                              setLoading(false);
                            }
                          }}
                          className="px-3 py-1.5 text-sm rounded text-white bg-blue-600 hover:bg-blue-700"
                        >
                          Confirmer
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
