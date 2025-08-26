'use client';

import { Dialog } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useState, useEffect } from 'react';
import { BonCerfa } from './utils';
import { RowBSD } from '@/app/register/interface/BSD_Interface';
import Meta from './Meta';

interface LinkBonComponentProps {
  setIsModalOpen: (open: boolean) => void;
  fetchBonData: () => void;
  entreprise_id: string | null;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  setSelectedBsdId: (id: string) => void;
  isModalOpen: boolean;
  bonPdf: BonCerfa | null;
  pdf_id: number;
  filteredCandidateBSDs: RowBSD[];
  allBSDs: RowBSD[];
  loading: boolean;
  error: string | null;
  selectedBsdId: string;
  minDate: Date | null;
  maxDate: Date | null;
  siteAddresses: {[key: string]: {adresse: string, nom: string}};
  pdfSiteName: string;
  pdfPrestaName: string;
  perfectMatch: RowBSD | null;
  calculateSimilarity: (str1: string, str2: string) => number;
  cleanDate: (input: string | undefined) => Date | null;
  handleLink: () => void;
  handleCreateBSD: () => void;
  compareCompanyNames: (name1: string, name2: string) => boolean;
}

export default function LinkBonComponent({
  setIsModalOpen,
  fetchBonData,
  entreprise_id,
  setError,
  setLoading,
  setSelectedBsdId,
  isModalOpen,
  bonPdf,
  pdf_id,
  filteredCandidateBSDs,
  allBSDs,
  loading,
  error,
  selectedBsdId,
  minDate,
  maxDate,
  siteAddresses,
  pdfSiteName,
  pdfPrestaName,
  perfectMatch,
  calculateSimilarity,
  cleanDate,
  handleLink,
  handleCreateBSD,
  compareCompanyNames
}: LinkBonComponentProps) {

  // États pour les filtres
  const [activeFilters, setActiveFilters] = useState({
    site: true,
    presta: true,
    codeCED: true,
    date: true,
    tonnage: true,
    numeroBon: true
  });

  // États pour les paramètres de filtrage
  const [filterParams, setFilterParams] = useState({
    tonnageTolerance: 50, // ±50% par défaut
    dateTolerance: 2, // ±2 jours par défaut
  });

  const [displayedBSDs, setDisplayedBSDs] = useState<RowBSD[]>([]);

  // État pour le modal de prévisualisation
  const [showPreview, setShowPreview] = useState(false);

  // Fonction pour formater les dates de manière cohérente
  const formatDate = (date: Date | null) => {
    if (!date) return 'Vide';
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Fonction pour appliquer les filtres
  const applyFilters = (bsds: RowBSD[]) => {
    if (!bonPdf) return bsds;

    return bsds.filter(bsd => {
      // Récupérer les données du BSD
      const bsdCodeCED = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.code?.replace(/[\s*]/g, '') || '';
      const bsdSiteSiret = bsd.infos_json?.formAPI?.createFormInput?.emitter?.company?.siret?.replace(/\s/g, '') || '';
      const bsdPrestaSiret = bsd.infos_json?.formAPI?.createFormInput?.recipient?.company?.siret?.replace(/\s/g, '') || '';
      const bsdSiteName = bsd.infos_json?.formAPI?.createFormInput?.emitter?.company?.name || '';
      const bsdPrestaName = bsd.infos_json?.formAPI?.createFormInput?.recipient?.company?.name || '';
      const bsdCreatedDate = new Date(bsd.created_at);
      const bsdTonnage = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.quantity || 0;
      const bsdNumeroBon = bsd.other_infos?.numeroBon || '';

      // Récupérer les données du PDF avec les SIRET enrichis via findMeta
      const pdfCodeCED = bonPdf?.dechet?.codeCED?.replace(/[\s*]/g, '') || '';
      
      // Utiliser les SIRET enrichis si disponibles, sinon les SIRET bruts du PDF
      const pdfSiteSiret = bonPdf?.site?.siret?.replace(/\s/g, '') || '';
      const pdfPrestaSiret = bonPdf?.prestataire?.siret?.replace(/\s/g, '') || '';
      
      // Si on a des noms traduits (via findMeta), on peut avoir des SIRET correspondants
      // Ces SIRET sont déjà inclus dans les données du bonPdf enrichies
      
      const pdfDate = cleanDate(bonPdf?.date);
      const pdfTonnage = bonPdf?.dechet?.tonnage || 0;
      const pdfNumeroBon = bonPdf?.numeroBon || '';

      // Appliquer les filtres actifs avec comparaisons strictes
      if (activeFilters.codeCED && pdfCodeCED && bsdCodeCED) {
        const codeCEDMatch = bsdCodeCED.slice(0, 5) === pdfCodeCED.slice(0, 5);
        if (!codeCEDMatch) return false;
      }

      if (activeFilters.site && pdfSiteSiret && bsdSiteSiret) {
        const siteSiretMatch = pdfSiteSiret === bsdSiteSiret;
        if (!siteSiretMatch) return false;
      }

      if (activeFilters.presta && pdfPrestaSiret && bsdPrestaSiret) {
        const prestaSiretMatch = pdfPrestaSiret === bsdPrestaSiret;
        if (!prestaSiretMatch) return false;
      }

      if (activeFilters.date && pdfDate) {
        const diffDays = Math.abs((bsdCreatedDate.getTime() - pdfDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > filterParams.dateTolerance) return false;
      }

      if (activeFilters.tonnage && pdfTonnage > 0 && bsdTonnage > 0) {
        const tolerance = filterParams.tonnageTolerance / 100;
        const minTonnage = pdfTonnage * (1 - tolerance);
        const maxTonnage = pdfTonnage * (1 + tolerance);
        if (bsdTonnage < minTonnage || bsdTonnage > maxTonnage) return false;
      }

      if (activeFilters.numeroBon && pdfNumeroBon && bsdNumeroBon) {
        const idMatch = pdfNumeroBon.replace(/[\s\-_]/g, '').toLowerCase() === bsdNumeroBon.replace(/[\s\-_]/g, '').toLowerCase();
        if (!idMatch) return false;
      }

      return true;
    });
  };

  // Mettre à jour les BSDs affichés quand les filtres ou les données changent
  useEffect(() => {
    setDisplayedBSDs(applyFilters(filteredCandidateBSDs));
  }, [activeFilters, filteredCandidateBSDs, bonPdf]);

  // Fonction pour basculer un filtre
  const toggleFilter = (filterName: keyof typeof activeFilters) => {
    setActiveFilters(prev => ({
      ...prev,
      [filterName]: !prev[filterName]
    }));
  };

  return (
    <div>
      <button
        onClick={() => {
          setIsModalOpen(true);
          fetchBonData();
        }}
        className="py-1.5 border border-[var(--green-medium)] text-[var(--green-medium)] rounded-md text-xs hover:bg-green-50 w-[50px] text-center"
      >
        Lier Bon
      </button>

      <Dialog 
        open={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-[80%] w-full bg-white rounded-lg shadow-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <Dialog.Title className="text-lg font-medium">
                Lier un Bon de Livraison au PDF
              </Dialog.Title>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

                             {/* Filtres */}
             <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                 <h4 className="text-sm font-medium text-gray-700 mb-2">Filtres actifs :</h4>
                 
                 {/* Filtres à cocher en 4 colonnes */}
                 <div className="grid grid-cols-4 gap-3">
                     <label className="flex items-center space-x-2 text-xs">
                         <input
                             type="checkbox"
                             checked={activeFilters.site}
                             onChange={() => toggleFilter('site')}
                             className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                         />
                         <span>Site</span>
                     </label>
                     <label className="flex items-center space-x-2 text-xs">
                         <input
                             type="checkbox"
                             checked={activeFilters.presta}
                             onChange={() => toggleFilter('presta')}
                             className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                         />
                         <span>Prestataire</span>
                     </label>
                     <label className="flex items-center space-x-2 text-xs">
                         <input
                             type="checkbox"
                             checked={activeFilters.codeCED}
                             onChange={() => toggleFilter('codeCED')}
                             className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                         />
                         <span>CED</span>
                     </label>
                     <label className="flex items-center space-x-2 text-xs">
                         <input
                             type="checkbox"
                             checked={activeFilters.numeroBon}
                             onChange={() => toggleFilter('numeroBon')}
                             className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                         />
                         <span>N° Bon</span>
                     </label>
                     
                     {/* Date avec paramètre ± */}
                     <div className="flex items-center space-x-2 text-xs">
                         <label className="flex items-center space-x-1">
                             <input
                                 type="checkbox"
                                 checked={activeFilters.date}
                                 onChange={() => toggleFilter('date')}
                                 className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                             />
                             <span>Date ±</span>
                         </label>
                         <input
                             type="number"
                             min="1"
                             max="30"
                             value={filterParams.dateTolerance}
                             onChange={(e) => setFilterParams(prev => ({
                                 ...prev,
                                 dateTolerance: parseInt(e.target.value) || 2
                             }))}
                             className="w-12 px-1 py-1 border rounded text-xs"
                             disabled={!activeFilters.date}
                         />
                         <span>j</span>
                     </div>
                     
                     {/* Tonnage avec paramètre ± */}
                     <div className="flex items-center space-x-2 text-xs">
                         <label className="flex items-center space-x-1">
                             <input
                                 type="checkbox"
                                 checked={activeFilters.tonnage}
                                 onChange={() => toggleFilter('tonnage')}
                                 className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                             />
                             <span>Tonnage ±</span>
                         </label>
                         <input
                             type="number"
                             min="10"
                             max="100"
                             value={filterParams.tonnageTolerance}
                             onChange={(e) => setFilterParams(prev => ({
                                 ...prev,
                                 tonnageTolerance: parseInt(e.target.value) || 50
                             }))}
                             className="w-12 px-1 py-1 border rounded text-xs"
                             disabled={!activeFilters.tonnage}
                         />
                         <span>%</span>
                     </div>
                     
                     <div className="text-xs text-gray-500">
                         <span>Nom déchet (affiché uniquement)</span>
                     </div>
                     
                     <div className="text-xs text-gray-500">
                         {Object.values(activeFilters).filter(Boolean).length} filtre(s) actif(s)
                     </div>
                 </div>
             </div>            

            {/* Perfect Match Alert */}
            {perfectMatch && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">
                      Perfect Match Trouvé !
                    </h3>
                    <div className="mt-2 text-sm text-green-700">
                      <p>Un BSD correspond parfaitement à ce bon de livraison :</p>
                      <p className="font-medium">BSD #{perfectMatch.readable_id_track_dechets}</p>
                      <p>Numéro de bon : {perfectMatch.other_infos?.numeroBon}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm">
                {error}
              </div>
            )}

            {loading ? (
              <div className="text-center py-4">Chargement...</div>
            ) : (
              <>
                <div className="flex justify-between items-start gap-6 mb-6">
                  {/* Bon PDF Information */}
                  {bonPdf && (
                    <div className="w-[50%]">
                        <h3 className="font-medium mb-2">Bon PDF</h3>
                                                                     <Meta
                          numeroBon={bonPdf.numeroBon || 'Vide'}
                          codeCED={bonPdf.dechet?.codeCED || 'Vide'}
                          date={formatDate(cleanDate(bonPdf?.date))}
                          tonnage={bonPdf.dechet?.tonnage ? `${bonPdf.dechet.tonnage} tonnes` : 'Vide'}
                          site={bonPdf.site?.nom || 'Vide'}
                          prestataire={bonPdf.prestataire?.nom || 'Vide'}
                          dechet={bonPdf.dechet?.nom || 'Vide'}
                          siteTranslation={pdfSiteName}
                          prestaTranslation={pdfPrestaName}
                          siteSiret={bonPdf.site?.siret || ''}
                          prestaSiret={bonPdf.prestataire?.siret || ''}
                          showTranslations={true}
                          showMatchIndicators={false}
                        />
                    </div>
                  )}

                  {/* Candidate BSDs List */}
                  <div className="w-[50%] h-[400px]">
                    <h3 className="font-medium mb-2">BSDs candidats ({displayedBSDs.length})</h3>
                    
                    {displayedBSDs.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-sm text-gray-500 mb-4">Aucun BSD trouvé correspondant à ce bon</p>
                        <p className="text-xs text-gray-400">Vous pouvez créer un nouveau BSD à partir de ce bon</p>
                      </div>
                                         ) : (
                       <div className="space-y-2 max-h-[350px] overflow-y-auto">
                         {displayedBSDs.map((bsd) => {
                           // Comparaisons pour les couleurs avec les SIRET enrichis via findMeta
                           const pdfCodeCED = bonPdf?.dechet?.codeCED?.replace(/[\s*]/g, '') || '';
                           const bsdCodeCED = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.code?.replace(/[\s*]/g, '') || '';
                           const codeCEDMatch = Boolean(pdfCodeCED && bsdCodeCED && pdfCodeCED.slice(0, 5) === bsdCodeCED.slice(0, 5));
                           
                           // Utiliser les SIRET enrichis du PDF (via findMeta) pour la comparaison
                           const pdfSiteSiret = bonPdf?.site?.siret?.replace(/\s/g, '') || '';
                           const bsdSiteSiret = bsd.infos_json?.formAPI?.createFormInput?.emitter?.company?.siret?.replace(/\s/g, '') || '';
                           const siteSiretMatch = Boolean(pdfSiteSiret && bsdSiteSiret && pdfSiteSiret === bsdSiteSiret);
                           
                           const pdfPrestaSiret = bonPdf?.prestataire?.siret?.replace(/\s/g, '') || '';
                           const bsdPrestaSiret = bsd.infos_json?.formAPI?.createFormInput?.recipient?.company?.siret?.replace(/\s/g, '') || '';
                           const prestaSiretMatch = Boolean(pdfPrestaSiret && bsdPrestaSiret && pdfPrestaSiret === bsdPrestaSiret);
                           
                           // Comparaison des dates
                           const bsdCreatedDate = new Date(bsd.created_at);
                           const pdfDate = cleanDate(bonPdf?.date);
                           let dateMatch = false;
                           if (pdfDate) {
                             const diffDays = Math.abs((bsdCreatedDate.getTime() - pdfDate.getTime()) / (1000 * 60 * 60 * 24));
                             dateMatch = diffDays <= filterParams.dateTolerance;
                           }
                           
                           const pdfDateFormatted = formatDate(cleanDate(bonPdf?.date));
                           const bsdDateFormatted = formatDate(bsdCreatedDate);
                          
                          // Comparaison du tonnage
                          const pdfTonnage = bonPdf?.dechet?.tonnage || 0;
                          const bsdTonnage = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.quantity || 0;
                          let tonnageMatch = false;
                          
                          if (pdfTonnage > 0 && bsdTonnage > 0) {
                            const tolerance = filterParams.tonnageTolerance / 100;
                            const minTonnage = pdfTonnage * (1 - tolerance);
                            const maxTonnage = pdfTonnage * (1 + tolerance);
                            tonnageMatch = bsdTonnage >= minTonnage && bsdTonnage <= maxTonnage;
                          }
                          
                          return (
                            <label
                              key={bsd.id}
                              className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                            >
                              <input
                                type="radio"
                                name="bsd"
                                value={bsd.id}
                                checked={selectedBsdId === String(bsd.id)}
                                onChange={(e) => setSelectedBsdId(e.target.value)}
                                className="h-4 w-4 text-blue-600"
                              />
                              <div className="flex-1">
                                <Meta
                                  numeroBon={bsd.other_infos?.numeroBon || 'Vide'}
                                  codeCED={bsd.infos_json.formAPI.createFormInput.wasteDetails.code}
                                  date={bsdDateFormatted}
                                  tonnage={`${bsd.infos_json.formAPI.createFormInput.wasteDetails.quantity || 'Vide'} tonnes`}
                                  site={bsd.infos_json.formAPI.createFormInput.emitter.company.name}
                                  prestataire={bsd.infos_json.formAPI.createFormInput.recipient.company.name}
                                  dechet={bsd.infos_json.formAPI.createFormInput.wasteDetails.name}
                                  siteSiret={bsd.infos_json.formAPI.createFormInput.emitter.company.siret || ''}
                                  prestaSiret={bsd.infos_json.formAPI.createFormInput.recipient.company.siret || ''}
                                  bsdId={String(bsd.id)}
                                  showTranslations={false}
                                  showMatchIndicators={true}
                                  isMatch={{
                                    codeCED: codeCEDMatch,
                                    date: dateMatch,
                                    tonnage: tonnageMatch,
                                    site: siteSiretMatch,
                                    prestataire: prestaSiretMatch
                                  }}
                                />
                                
                                {/* Statut de liaison */}
                                <div className="text-sm mt-2">
                                  <div className="text-gray-600">Statut:</div>
                                  <div className={`px-2 py-1 rounded font-medium ${bsd.bsd_extracted_then_linked_id ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'}`}>
                                    {bsd.bsd_extracted_then_linked_id ? 'Déjà lié' : 'Non lié'}
                                  </div>
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between items-center">
                  <button
                    onClick={() => setShowPreview(true)}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Création...' : 'Créer un BSD'}
                  </button>
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleLink}
                      disabled={!selectedBsdId || loading}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Liaison...' : 'Lier'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Modal de prévisualisation du BSD */}
      <Dialog 
        open={showPreview} 
        onClose={() => setShowPreview(false)} 
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-2xl w-full bg-white rounded-lg shadow-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <Dialog.Title className="text-lg font-medium">
                Aperçu du BSD à créer
              </Dialog.Title>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {bonPdf && (
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-2">Informations extraites du bon PDF :</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Numéro de bon :</span>
                      <div className="text-gray-900">{bonPdf.numeroBon || 'Non spécifié'}</div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Date :</span>
                      <div className="text-gray-900">{formatDate(cleanDate(bonPdf?.date))}</div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Code CED :</span>
                      <div className="text-gray-900">{bonPdf.dechet?.codeCED || 'Non spécifié'}</div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Tonnage :</span>
                      <div className="text-gray-900">{bonPdf.dechet?.tonnage ? `${bonPdf.dechet.tonnage} tonnes` : 'Non spécifié'}</div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Site :</span>
                      <div className="text-gray-900">{pdfSiteName || bonPdf.site?.nom || 'Non spécifié'}</div>
                      {bonPdf.site?.siret && (
                        <div className="text-xs text-gray-500">SIRET: {bonPdf.site.siret}</div>
                      )}
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Prestataire :</span>
                      <div className="text-gray-900">{pdfPrestaName || bonPdf.prestataire?.nom || 'Non spécifié'}</div>
                      {bonPdf.prestataire?.siret && (
                        <div className="text-xs text-gray-500">SIRET: {bonPdf.prestataire.siret}</div>
                      )}
                    </div>
                    <div className="col-span-2">
                      <span className="font-medium text-gray-700">Déchet :</span>
                      <div className="text-gray-900">{bonPdf.dechet?.nom || 'Non spécifié'}</div>
                    </div>
                  </div>
                </div>

                                 {/* Alerte si pas de correspondance findMeta */}
                 {(!pdfSiteName || !pdfPrestaName) && (
                   <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                     <h4 className="font-medium text-red-800 mb-2">⚠️ Attention - Correspondances manquantes :</h4>
                     <ul className="text-sm text-red-700 space-y-1">
                       {!pdfSiteName && (
                         <li>• <strong>Site</strong> : Aucune correspondance trouvée dans les mappings entreprise</li>
                       )}
                       {!pdfPrestaName && (
                         <li>• <strong>Prestataire</strong> : Aucune correspondance trouvée dans les mappings entreprise</li>
                       )}
                       <li>• Le BSD sera créé avec les noms bruts extraits du PDF</li>
                       <li>• Vous devrez corriger manuellement ces informations après création</li>
                     </ul>
                   </div>
                 )}


                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    onClick={() => setShowPreview(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => {
                      setShowPreview(false);
                      handleCreateBSD();
                    }}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Création...' : 'Créer le BSD'}
                  </button>
                </div>
              </div>
            )}
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
}
