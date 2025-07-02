'use client';

import { Dialog } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { BSDCerfa } from './ExtractBSD';
import { RowBSD } from '@/app/register/interface/BSD_Interface';
import CreateLineBasedOnBSDPDF from './CreateLineBasedOnBSDPDF';

interface LinkBSDComponentProps {
  setIsModalOpen: (open: boolean) => void;
  fetchBSDData: (level: number) => void;
  entreprise_id: string | null;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  setselectedBsdId: (id: string) => void;
  isModalOpen: boolean;
  bsdPdf: BSDCerfa | null;
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
  customFilters: Array<{id: string, text: string, enabled: boolean}>;
  newFilterText: string;
  setNewFilterText: (text: string) => void;
  addCustomFilter: () => void;
  removeCustomFilter: (id: string) => void;
  toggleCustomFilter: (id: string) => void;
  applyFilters: (pdfCodeCED: string, pdfDestinataireSiret: string, pdfTransporteurSiren: string, minDate: Date, maxDate: Date, pdfSiteNames?: string[]) => void;
  calculateSimilarity: (str1: string, str2: string) => number;
  cleanDate: (input: string | undefined) => Date | null;
  handleLink: () => void;
  compareCompanyNames: (name1: string, name2: string) => boolean;
  codeCEDFilter: boolean;
  setCodeCEDFilter: (enabled: boolean) => void;
  siretSirenFilter: boolean;
  setSiretSirenFilter: (enabled: boolean) => void;
  addressFilter: boolean;
  setAddressFilter: (enabled: boolean) => void;
  dateFilter: boolean;
  setDateFilter: (enabled: boolean) => void;
  dateRange: number;
  setDateRange: (range: number) => void;
  tonnageFilter: boolean;
  setTonnageFilter: (enabled: boolean) => void;
  tonnageRange: number;
  setTonnageRange: (range: number) => void;
}

export const LinkBSDComponent = ({
  setIsModalOpen,
  fetchBSDData,
  entreprise_id,
  setError,
  setLoading,
  setselectedBsdId,
  isModalOpen,
  bsdPdf,
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
  customFilters,
  newFilterText,
  setNewFilterText,
  addCustomFilter,
  removeCustomFilter,
  toggleCustomFilter,
  calculateSimilarity,
  cleanDate,
  handleLink,
  compareCompanyNames,
  codeCEDFilter,
  setCodeCEDFilter,
  siretSirenFilter,
  setSiretSirenFilter,
  addressFilter,
  setAddressFilter,
  dateFilter,
  setDateFilter,
  dateRange,
  setDateRange,
  applyFilters,
  tonnageFilter,
  setTonnageFilter,
  tonnageRange,
  setTonnageRange
}: LinkBSDComponentProps) => {

  // Fonction pour comparer les SIREN/SIRET de manière floue
  const compareSirenSiret = (siren1: string, siren2: string): boolean => {
    if (!siren1 || !siren2) return false;
    
    // Nettoyer les chaînes (garder seulement les chiffres)
    const clean1 = siren1.replace(/\D/g, '');
    const clean2 = siren2.replace(/\D/g, '');
    
    // Si les chaînes sont identiques, retourner true
    if (clean1 === clean2) return true;
    
    // Pour SIREN (9 chiffres) : au moins 6 chiffres doivent correspondre
    if (clean1.length === 9 && clean2.length === 9) {
      let matches = 0;
      for (let i = 0; i < 9; i++) {
        if (clean1[i] === clean2[i]) matches++;
      }
      return matches >= 6; // 6 chiffres sur 9
    }
    
    // Pour SIRET (14 chiffres) : au moins 10 chiffres doivent correspondre
    if (clean1.length === 14 && clean2.length === 14) {
      let matches = 0;
      for (let i = 0; i < 14; i++) {
        if (clean1[i] === clean2[i]) matches++;
      }
      return matches >= 10; // 10 chiffres sur 14
    }
    
    // Si les longueurs ne correspondent pas, essayer de comparer les premiers chiffres
    const minLength = Math.min(clean1.length, clean2.length);
    if (minLength >= 6) {
      let matches = 0;
      for (let i = 0; i < minLength; i++) {
        if (clean1[i] === clean2[i]) matches++;
      }
      // Pour les SIREN, au moins 6 chiffres
      if (minLength <= 9) return matches >= 6;
      // Pour les SIRET, au moins 10 chiffres
      return matches >= 10;
    }
    
    return false;
  };

  // Fonction pour extraire le code postal d'une adresse
  const extractPostalCode = (address: string): string => {
    if (!address) return '';
    
    // Pattern pour trouver un code postal français (5 chiffres)
    const postalCodePattern = /\b\d{5}\b/;
    const match = address.match(postalCodePattern);
    
    return match ? match[0] : '';
  };

  // Fonction pour comparer les codes postaux
  const comparePostalCodes = (address1: string, address2: string): boolean => {
    const postalCode1 = extractPostalCode(address1);
    const postalCode2 = extractPostalCode(address2);
    
    // Si aucune des deux adresses n'a de code postal, ne pas filtrer
    if (!postalCode1 && !postalCode2) return true;
    
    // Si une seule adresse a un code postal, ne pas filtrer (on ne peut pas comparer)
    if (!postalCode1 || !postalCode2) return true;
    
    return postalCode1 === postalCode2;
  };

    return (
<div>
        <>
      <button
        onClick={() => {
          setIsModalOpen(true);
          fetchBSDData(0);
        }}
        className="px-3 py-1.5 border border-[var(--green-medium)] text-[var(--green-medium)] rounded-md text-xs hover:bg-green-50 w-[100px] text-center"
      >
        Lier BSD
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
                Lier un BSD au PDF
              </Dialog.Title>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Contrôles de filtrage */}
            <div className="mb-4 flex justify-between gap-4">
              {/* Filtres individuels */}
              <div className="flex-1 p-3 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-sm mb-3">Filtres disponibles</h3>
                
                <div className="space-y-3">
                  {/* Filtre Code CED */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={codeCEDFilter}
                        onChange={(e) => setCodeCEDFilter(e.target.checked)}
                        className="h-4 w-4 text-blue-600"
                      />
                      <span className="text-sm font-medium text-blue-600">Code CED</span>
                    </div>
                    <span className="text-xs text-gray-500">Filtre sur le code déchet</span>
                  </div>

                  {/* Filtre SIRET/SIREN */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={siretSirenFilter}
                        onChange={(e) => setSiretSirenFilter(e.target.checked)}
                        className="h-4 w-4 text-green-600"
                      />
                      <span className="text-sm font-medium text-green-600">SIRET/SIREN</span>
                    </div>
                    <span className="text-xs text-gray-500">Filtre sur transporteur/destinataire</span>
                  </div>

                  {/* Filtre Adresse */}
                  <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={addressFilter}
                        onChange={(e) => setAddressFilter(e.target.checked)}
                        className="h-4 w-4 text-purple-600"
                      />
                      <span className="text-sm font-medium text-purple-600">Adresse émetteur</span>
                </div>
                    <span className="text-xs text-gray-500">Filtre sur similarité d&apos;adresse</span>
              </div>
              
                  {/* Filtre Date */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={dateFilter}
                        onChange={(e) => setDateFilter(e.target.checked)}
                        className="h-4 w-4 text-orange-600"
                      />
                      <span className="text-sm font-medium text-orange-600">Date</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">±</span>
                      <input
                        type="number"
                        value={dateRange}
                        onChange={(e) => setDateRange(parseInt(e.target.value) || 15)}
                        className="w-12 px-1 py-1 text-xs border border-gray-300 rounded"
                        min="1"
                        max="365"
                      />
                      <span className="text-xs text-gray-500">jours</span>
                    </div>
                  </div>

                  {/* Filtre Tonnage */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={tonnageFilter}
                        onChange={(e) => setTonnageFilter(e.target.checked)}
                        className="h-4 w-4 text-red-600"
                      />
                      <span className="text-sm font-medium text-red-600">Tonnage</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">±</span>
                      <input
                        type="number"
                        value={tonnageRange}
                        onChange={(e) => setTonnageRange(parseInt(e.target.value) || 20)}
                        className="w-12 px-1 py-1 text-xs border border-gray-300 rounded"
                        min="1"
                        max="100"
                      />
                      <span className="text-xs text-gray-500">%</span>
                    </div>
                  </div>
              </div>

              {/* Légende des couleurs */}
                {/*<div className="mt-3 pt-3 border-t border-gray-200">
                  <h4 className="text-xs font-medium text-gray-700 mb-2">Légende :</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-blue-100 border border-blue-300 rounded"></div>
                    <span className="text-blue-600">Code CED</span>
                  </div>
                  <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
                    <span className="text-green-600">SIRET/SIREN</span>
                  </div>
                  <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-orange-100 border border-orange-300 rounded"></div>
                    <span className="text-orange-600">Dates</span>
                  </div>
                  <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-purple-100 border border-purple-300 rounded"></div>
                    <span className="text-purple-600">Adresses</span>
                  </div>
                  <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div>
                    <span className="text-red-600">Tonnage</span>
                  </div>
                  </div>
                </div>*/}
              </div>

              {/* Filtres personnalisés */}
              <div className="flex-1 p-3 bg-blue-50 rounded-lg">
                <h3 className="font-medium text-sm mb-2">Filtres personnalisés</h3>
                
                {/* Ajouter un nouveau filtre */}
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newFilterText}
                    onChange={(e) => setNewFilterText(e.target.value)}
                    placeholder="Rechercher dans le JSON BSD..."
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    onKeyPress={(e) => e.key === 'Enter' && addCustomFilter()}
                  />
                  <button
                    onClick={addCustomFilter}
                    disabled={!newFilterText.trim()}
                    className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>

                {/* Liste des filtres existants */}
                {customFilters.length > 0 && (
                  <div className="space-y-1 max-h-20 overflow-y-auto">
                    {customFilters.map(filter => (
                      <div key={filter.id} className="flex items-center gap-1 p-1 bg-white rounded border text-xs">
                        <input
                          type="checkbox"
                          checked={filter.enabled}
                          onChange={() => toggleCustomFilter(filter.id)}
                          className="h-3 w-3 text-blue-600"
                        />
                        <span className={`flex-1 ${filter.enabled ? 'text-gray-900' : 'text-gray-500 line-through'}`}>
                          {filter.text}
                        </span>
                        <button
                          onClick={() => removeCustomFilter(filter.id)}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Aide */}
                <div className="mt-1 pt-1 border-t border-blue-200">
                  <p className="text-xs text-blue-700">
                    💡 Recherche dans tout le JSON BSD
                  </p>
                </div>
              </div>
            </div>

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
                {/* BSD PDF Information */}
                {bsdPdf && (
                    <div className="bg-gray-50 p-4 rounded-lg w-[60%] h-[400px] overflow-y-auto">
                      
                      {/* Dates Section */}
                      <div className="mb-8">
                        <div className="text-sm grid grid-cols-4 gap-2">
                          <div>
                            <div className="text-gray-600">Prise en charge:</div>
                            <div className="text-orange-600 bg-gray-50 px-2 py-1 rounded font-medium">
                              {bsdPdf.collecteurTransporteur?.datePriseEnCharge || 'Non spécifié'}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-600">Présentation:</div>
                            <div className="text-orange-600 bg-gray-50 px-2 py-1 rounded font-medium">
                              {bsdPdf.declarationEmetteur?.date || 'Non spécifié'}
                            </div>
                          </div>
                      <div>
                            <div className="text-gray-600">Traitement:</div>
                            <div className="text-orange-600 bg-gray-50 px-2 py-1 rounded font-medium">
                              {bsdPdf.realisationOperation?.date || 'Non spécifié'}
                            </div>
                      </div>
                      <div>
                            <div className="text-gray-600">Déclaration:</div>
                            <div className="text-orange-600 bg-gray-50 px-2 py-1 rounded font-medium">
                              {bsdPdf.declarationEmetteur?.date || 'Non spécifié'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Déchet Section */}
                      <div className="mb-12">
                        <div className="text-sm grid grid-cols-4 gap-2">
                          <div>
                            <div className="text-gray-600">Déchet:</div>
                            <div>{bsdPdf.dechet?.denominationUsuelle || 'Non spécifié'}</div>
                          </div>
                          <div>
                            <div className="text-gray-600">CED:</div>
                            <div className="text-blue-600 bg-gray-50 px-2 py-1 rounded font-medium">
                              {bsdPdf.dechet?.code || 'Non spécifié'}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-600">Code DR:</div>
                            <div>{bsdPdf.realisationOperation?.code || 'Non spécifié'}</div>
                      </div>
                      <div>
                            <div className="text-gray-600">Quantité:</div>
                            <div>{bsdPdf.dechet?.poids ? `${bsdPdf.dechet.poids} tonnes` : 'Non spécifié'}</div>
                            <div>{bsdPdf.expedition?.heure ? `${bsdPdf.expedition.heure} tonnes` : ''}</div>
                          </div>
                        </div>
                      </div>

                      {/* Émetteur Section */}
                      <div className="mb-8">
                        <h4 className="font-medium text-sm text-gray-700 mb-1">Émetteur</h4>
                        <div className="space-y-0 text-sm">
                          <div className="flex justify-start gap-2">
                            <span className="text-gray-600">Nom:</span>
                            <span>{bsdPdf.emetteur?.nom || 'Non spécifié'}</span>
                            {pdfSiteName && (
                              <span className="bg-purple-500 text-white px-2 py-1 rounded text-md font-medium mt-[-5px]">
                                {pdfSiteName}
                              </span>
                            )}
                          </div>
                          <div className="flex justify-start gap-2">
                            <span className="text-gray-600">Adresse:</span>
                            <span className="text-purple-600 bg-gray-50 px-2 py-1 rounded font-medium">
                              {bsdPdf.emetteur?.adresse || 'Non spécifié'}
                            </span>
                          </div>
                        </div>
                      </div>


                      {/* Prestataires Section */}
                      <div className="flex justify-between gap-2 mt-4">
                        {/* Transporteur Section */}
                        <div className="mb-1">
                          <h4 className="font-medium text-sm text-gray-700 mb-1">Transporteur</h4>
                          <div className="space-y-0 text-sm">
                            <div className="flex justify-start gap-2">
                              <div className="text-gray-600">Nom:</div>
                              <div>{bsdPdf.collecteurTransporteur?.nom || 'Non spécifié'}</div>
                            </div>
                            <div className="flex justify-start gap-2">
                              <div className="text-gray-600">SIREN:</div>
                              <div className="text-green-600 bg-gray-50 px-2 py-1 rounded font-medium">
                                {bsdPdf.collecteurTransporteur?.siren || 'Non spécifié'}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Destinataire Section */}
                        <div className="mb-1">
                          <h4 className="font-medium text-sm text-gray-700 mb-1">Destinataire</h4>
                          <div className="space-y-0 text-sm">
                            <div className="flex justify-start gap-2">
                              <div className="text-gray-600">Nom:</div>
                              <div>{bsdPdf.installationDestination?.nom || 'Non spécifié'}</div>
                            </div>
                            <div className="flex justify-start gap-2">
                              <div className="text-gray-600">SIRET:</div>
                              <div className="text-green-600 bg-gray-50 px-2 py-1 rounded font-medium">
                                {bsdPdf.installationDestination?.siret || 'Non spécifié'}
                              </div>
                            </div>
                          </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Candidate BSDs List */}
                  <div className="w-[40%] h-[400px]">
                  <h3 className="font-medium mb-2">BSDs candidats ({filteredCandidateBSDs.length})</h3>
                  {filteredCandidateBSDs.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-500 mb-4">Aucun BSD trouvé avec les filtres actuels</p>
                      <p className="text-xs text-gray-400">Essayez de désactiver certains filtres pour élargir la recherche</p>
                    </div>
                  ) : (
                      <div className="space-y-2 max-h-[350px] overflow-y-auto">
                        {filteredCandidateBSDs
                          .map((bsd) => {
                            const siret = bsd.infos_json?.formAPI?.createFormInput?.emitter?.company?.siret?.replace(/\s/g, '');
                            const candidateAddress = siteAddresses[siret]?.adresse || 'Adresse non trouvée';
                            const pdfAddress = bsdPdf?.emetteur?.adresse || '';
                            // Comparaison des codes postaux au lieu de la similarité d'adresse
                            const postalCodeMatch = comparePostalCodes(pdfAddress, candidateAddress);
                            
                            const pdfEmitterName = bsdPdf?.emetteur?.nom || '';
                            const candidateEmitterName = bsd.infos_json?.formAPI?.createFormInput?.emitter?.company?.name || '';
                            const nameSimilarity = calculateSimilarity(pdfEmitterName, candidateEmitterName);
                            
                            // Comparaison spécifique du nom du site du PDF avec le nom de l'émetteur du BSD
                            const siteNameMatch = pdfSiteName && candidateEmitterName ? compareCompanyNames(pdfSiteName, candidateEmitterName) : false;
                            
                            // Comparaisons pour les couleurs
                            const pdfCodeCED = bsdPdf?.dechet?.code?.replace(/[\s*]/g, '') || '';
                            const bsdCodeCED = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.code?.replace(/[\s*]/g, '') || '';
                            const codeCEDMatch = pdfCodeCED === bsdCodeCED;
                            
                            const pdfTransporteurSiren = bsdPdf?.collecteurTransporteur?.siren?.replace(/\s/g, '') || '';
                            const bsdTransporteurSiret = bsd.infos_json?.formAPI?.createFormInput?.transporter?.company?.siret?.replace(/\s/g, '') || '';
                            const transporteurSirenMatch = compareSirenSiret(pdfTransporteurSiren, bsdTransporteurSiret);
                            
                            // Si pas de match SIREN, essayer avec le nom du transporteur
                            let transporteurMatch = transporteurSirenMatch;
                            if (!transporteurSirenMatch) {
                              const pdfTransporteurName = bsdPdf?.collecteurTransporteur?.nom || '';
                              const bsdTransporteurName = bsd.infos_json?.formAPI?.createFormInput?.transporter?.company?.name || '';
                              transporteurMatch = compareCompanyNames(pdfTransporteurName, bsdTransporteurName);
                            }
                            
                            const pdfDestinataireSiret = bsdPdf?.installationDestination?.siret?.replace(/\s/g, '') || '';
                            const bsdDestinataireSiret = bsd.infos_json?.formAPI?.createFormInput?.recipient?.company?.siret?.replace(/\s/g, '') || '';
                            const destinataireSiretMatch = compareSirenSiret(pdfDestinataireSiret, bsdDestinataireSiret);
                            
                            // Si pas de match SIRET, essayer avec le nom du destinataire
                            let destinataireMatch = destinataireSiretMatch;
                            if (!destinataireSiretMatch) {
                              const pdfDestinataireName = bsdPdf?.installationDestination?.nom || '';
                              const bsdDestinataireName = bsd.infos_json?.formAPI?.createFormInput?.recipient?.company?.name || '';
                              destinataireMatch = compareCompanyNames(pdfDestinataireName, bsdDestinataireName);
                            }
                            
                            // Comparaison des dates
                            const bsdCreatedDate = new Date(bsd.created_at);
                            const pdfDatePriseEnCharge = cleanDate(bsdPdf?.collecteurTransporteur?.datePriseEnCharge);
                            const pdfDatePresentation = cleanDate(bsdPdf?.declarationEmetteur?.date);
                            const pdfDateTraitement = cleanDate(bsdPdf?.realisationOperation?.date);
                            
                            let dateMatch = false;
                            if (pdfDatePriseEnCharge) {
                              const diffDays = Math.abs((bsdCreatedDate.getTime() - pdfDatePriseEnCharge.getTime()) / (1000 * 60 * 60 * 24));
                              dateMatch = diffDays <= 3; // ±3 jours pour la prise en charge
                            } else if (pdfDatePresentation) {
                              const diffDays = Math.abs((bsdCreatedDate.getTime() - pdfDatePresentation.getTime()) / (1000 * 60 * 60 * 24));
                              dateMatch = diffDays <= 15; // ±15 jours pour la présentation
                            } else if (pdfDateTraitement) {
                              const diffDays = Math.abs((bsdCreatedDate.getTime() - pdfDateTraitement.getTime()) / (1000 * 60 * 60 * 24));
                              dateMatch = diffDays <= 20; // ±20 jours pour le traitement
                            }
                            
                            // Comparaison du tonnage
                            const pdfTonnage = bsdPdf?.dechet?.poids || 0;
                            const bsdTonnage = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.quantity || 0;
                            let tonnageMatch = false;
                            
                            if (pdfTonnage > 0 && bsdTonnage > 0) {
                              const minTonnage = pdfTonnage * (1 - tonnageRange / 100);
                              const maxTonnage = pdfTonnage * (1 + tonnageRange / 100);
                              tonnageMatch = bsdTonnage >= minTonnage && bsdTonnage <= maxTonnage;
                            }
                            
                            return { bsd, postalCodeMatch, nameSimilarity, codeCEDMatch, transporteurMatch, destinataireMatch, dateMatch, tonnageMatch, siteNameMatch };
                          })
                                                      .map(({ bsd, postalCodeMatch, nameSimilarity, codeCEDMatch, transporteurMatch, destinataireMatch, dateMatch, tonnageMatch, siteNameMatch }) => (
                        <label
                          key={bsd.id}
                          className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="radio"
                            name="bsd"
                            value={bsd.id}
                            checked={selectedBsdId === String(bsd.id)}
                            onChange={(e) => setselectedBsdId(e.target.value)}
                            className="h-4 w-4 text-blue-600"
                          />
                              <div className="flex-1 space-y-1">
                              <div className="flex justify-between">
                            <p className={`font-medium ${codeCEDMatch ? 'text-blue-600 px-2 py-1 rounded' : ''}`}>
                              {bsd.infos_json.formAPI.createFormInput.wasteDetails.code}
                              {codeCEDMatch && <span className="ml-1 text-xs">✓</span>}
                            </p>
                                <p className="text-sm text-orange-600 px-2 py-1 rounded">
                                  {new Date(bsd.created_at).toLocaleDateString()}
                                  {dateMatch && <span className="ml-1 text-xs">✓</span>}
                                </p>
                                <div>
                                <p>{bsd.id}</p>
                                  <p className={`text-sm ${bsd.bsd_extracted_then_linked_id ? 'text-red-600 px-2 py-1 rounded' : 'text-green-500'}`}>
                                    {bsd.bsd_extracted_then_linked_id ? 'Déjà lié' : 'Non lié'}
                                  </p>
                                </div>
                              </div>
                            <p className="text-sm text-gray-600">
                              {bsd.infos_json.formAPI.createFormInput.emitter.company.name} → {bsd.infos_json.formAPI.createFormInput.recipient.company.name}
                                  <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                                    nameSimilarity >= 80 ? 'bg-blue-100 text-blue-800' :
                                    nameSimilarity >= 60 ? 'bg-orange-100 text-orange-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {nameSimilarity}%
                                  </span>
                                  {siteNameMatch && (
                                    <span className="ml-2 px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                      Site ✓
                                    </span>
                                  )}
                            </p>
                            <p className="text-sm text-gray-500">
                                  {(() => {
                                    const siret = bsd.infos_json?.formAPI?.createFormInput?.emitter?.company?.siret?.replace(/\s/g, '');
                                    const candidateAddress = siteAddresses[siret]?.adresse || 'Adresse non trouvée';
                                    return (
                                      <>
                                        {addressFilter && postalCodeMatch && (
                                        <span className="px-2 py-1 mr-2 rounded text-xs font-medium bg-green-100 text-green-800">
                                          Code postal ✓
                                        </span>
                                        )}
                                        <span className="text-purple-600 px-2 py-1 rounded text-sm">
                                          {candidateAddress}
                                        </span>
                                      </>
                                    );
                                  })()}
                                </p>
                                <div className="flex justify-between">
                                  <p className={`text-sm ${transporteurMatch ? 'text-green-600 px-2 py-1 rounded' : 'text-gray-500'}`}>
                                    {bsd.infos_json.formAPI.createFormInput.transporter.company.siret}
                                    {transporteurMatch && <span className="ml-1 text-xs">✓</span>}
                                  </p>
                                  <p className={`text-sm ${destinataireMatch ? 'text-green-600 px-2 py-1 rounded' : 'text-gray-500'}`}>
                                    {bsd.infos_json.formAPI.createFormInput.recipient.company.siret}
                                    {destinataireMatch && <span className="ml-1 text-xs">✓</span>}
                                  </p>
                                </div>
                                <p className="text-sm flex justify-end text-gray-500">
                                  {bsd.infos_json.formAPI.createFormInput.wasteDetails.quantity || 'Non spécifié'} tonnes
                                  {tonnageMatch && <span className="ml-1 text-xs text-red-600">✓</span>}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between items-center">
                    {bsdPdf && <CreateLineBasedOnBSDPDF bsdPdf={bsdPdf} pdf_id={pdf_id} />}
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
</>
    </div>
    )
}
