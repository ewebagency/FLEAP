'use client';

import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { supabase } from '@/app/database/supabaseClient';
import { toast } from 'react-hot-toast';
import { useSession } from '@/app/component/SessionProvider';
import { BSDCerfa } from './ExtractBSD';
import { RowBSD } from '@/app/register/interface/BSD_Interface';


interface LinkBSDProps {
  pdf_id: number;
  isOpen?: boolean;
  onClose?: () => void;
  onLink?: (bsd_id: string) => void;
}

interface BSDInfos {
  collecteurTransporteur?: {
    datePriseEnCharge?: string;
  };
  declarationmetteur?: {
    date?: string;
  };
  realisationOperation?: {
    date?: string;
  };
  expedition?: {
    dateEnvoi?: string;
  };
  transport?: {
    dateEnlevement?: string;
    dateReception?: string;
  };
}

function cleanDate(input: string | undefined): Date | null {
  if (!input) return null;
  
  const normalized = input.trim().replace(/[^0-9]/g, '-').replace(/-+/g, '-');
  const patterns: RegExp[] = [
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/,     // DD-MM-YYYY
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,     // YYYY-MM-DD
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;

    let year: number, month: number, day: number;

    if (pattern === patterns[0]) {
      // DD-MM-YYYY
      day = parseInt(match[1], 10);
      month = parseInt(match[2], 10);
      year = parseInt(match[3], 10);
    } else {
      // YYYY-MM-DD
      year = parseInt(match[1], 10);
      month = parseInt(match[2], 10);
      day = parseInt(match[3], 10);
    }

    const currentYear = new Date().getFullYear();
    if (year < currentYear - 5 || year > currentYear + 5) return null;

    const date = new Date(year, month - 1, day);
    // Vérifie que la date est valide (ex : pas 2025-02-31)
    if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
      return date;
    }
  }

  return null;
}

function extractValidDates(infos: BSDInfos): Date[] {
  const dates = [
    cleanDate(infos?.collecteurTransporteur?.datePriseEnCharge),
    cleanDate(infos?.declarationmetteur?.date),
    cleanDate(infos?.realisationOperation?.date),
    cleanDate(infos?.expedition?.dateEnvoi),
    cleanDate(infos?.transport?.dateEnlevement),
    cleanDate(infos?.transport?.dateReception)
  ];

  return dates.filter((date): date is Date => date !== null && !isNaN(date.getTime()));
}

export default function LinkBSD({ pdf_id }: LinkBSDProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBsdId, setselectedBsdId] = useState<string>('');
  const [bsdPdf, setBsdPdf] = useState<BSDCerfa | null>(null);
  const [candidateBSDs, setCandidateBSDs] = useState<RowBSD[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minDate, setMinDate] = useState<Date | null>(null);
  const [maxDate, setMaxDate] = useState<Date | null>(null);
  const [siteAddresses, setSiteAddresses] = useState<{[key: string]: string}>({});
  const { entreprise_id } = useSession();

  const fetchBSDData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch BSD PDF data
      const { data: pdfData, error: pdfError } = await supabase
        .from('bsd_pdf')
        .select('infos')
        .eq('pdf_id', pdf_id)
        .eq('entreprise_id', entreprise_id)
        .single();

      if (pdfError) throw new Error('Erreur lors de la récupération du PDF');
      if (!pdfData) throw new Error('PDF non trouvé');

      setBsdPdf(pdfData.infos);

      // Extraire et valider les dates
      const validDates = extractValidDates(pdfData.infos);
      console.log("validDates", validDates);

      if (validDates.length === 0) {
        throw new Error('Aucune date valide trouvée dans le PDF');
      }

      // Trouver la date min et max
      const minDateValue = new Date(Math.min(...validDates.map((d: Date) => d.getTime())));
      const maxDateValue = new Date(Math.max(...validDates.map((d: Date) => d.getTime())));

      // Mettre à jour l'état avec les dates min/max
      setMinDate(minDateValue);
      setMaxDate(maxDateValue);

      // Nettoyer le code CED du PDF
      const pdfCodeCED = pdfData.infos?.dechet?.code?.replace(/[\s*]/g, '') || '';
      
      // Extraire les SIRET/SIREN du PDF
      const pdfDestinataireSiret = pdfData.infos?.installationDestination?.siret?.replace(/\s/g, '') || '';
      const pdfTransporteurSiren = pdfData.infos?.collecteurTransporteur?.siren?.replace(/\s/g, '') || '';
      
      // Extraire les dates spécifiques du PDF
      const datePriseEnCharge = cleanDate(pdfData.infos?.collecteurTransporteur?.datePriseEnCharge);
      const datePresentation = cleanDate(pdfData.infos?.declarationEmetteur?.date);
      const dateTraitement = cleanDate(pdfData.infos?.realisationOperation?.date);
      const dateDeclaration = cleanDate(pdfData.infos?.declarationEmetteur?.date);

      // Calculer les plages de dates selon la priorité
      let startDate: Date, endDate: Date;
      
      if (datePriseEnCharge) {
        // ±3 jours pour la date de prise en charge
        startDate = new Date(datePriseEnCharge);
        startDate.setDate(datePriseEnCharge.getDate() - 3);
        endDate = new Date(datePriseEnCharge);
        endDate.setDate(datePriseEnCharge.getDate() + 3);
      } else if (datePresentation) {
        // ±15 jours pour la date de présentation
        startDate = new Date(datePresentation);
        startDate.setDate(datePresentation.getDate() - 15);
        endDate = new Date(datePresentation);
        endDate.setDate(datePresentation.getDate() + 15);
      } else if (dateTraitement) {
        // ±20 jours pour la date de traitement
        startDate = new Date(dateTraitement);
        startDate.setDate(dateTraitement.getDate() - 20);
        endDate = new Date(dateTraitement);
        endDate.setDate(dateTraitement.getDate() + 20);
      } else if (dateDeclaration) {
        // ±30 jours pour la date de déclaration
        startDate = new Date(dateDeclaration);
        startDate.setDate(dateDeclaration.getDate() - 30);
        endDate = new Date(dateDeclaration);
        endDate.setDate(dateDeclaration.getDate() + 30);
      } else {
        // Fallback sur les dates min/max avec ±35 jours
        startDate = new Date(minDateValue);
        startDate.setDate(minDateValue.getDate() - 35);
        endDate = new Date(maxDateValue);
        endDate.setDate(maxDateValue.getDate() + 35);
      }

      // Fetch candidate BSDs
      const { data: bsdData, error: bsdError } = await supabase
        .from('bsd')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .eq('entreprise_id', entreprise_id);

      if (bsdError) throw new Error('Erreur lors de la récupération des BSDs');
      
      // Filtrer les BSDs selon les critères
      const filteredBSDs = (bsdData || []).filter(bsd => {
        // Exclure les BSDs qui ont déjà été liés à un PDF extrait
        if (bsd.bsd_extracted_then_linked_id) return false;
        
        // 1. Filtre sur le code CED (replaceAll)
        const bsdCodeCED = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.code?.replace(/[\s*]/g, '') || '';
        if (bsdCodeCED !== pdfCodeCED) return false;
        
        // 2. Filtre sur SIRET du destinataire OU SIREN du transporteur (9 premiers chiffres)
        const bsdDestinataireSiret = bsd.infos_json?.formAPI?.createFormInput?.recipient?.company?.siret?.replace(/\s/g, '') || '';
        const bsdTransporteurSiret = bsd.infos_json?.formAPI?.createFormInput?.transporter?.company?.siret?.replace(/\s/g, '') || '';
        
        const bsdTransporteurSiren9 = bsdTransporteurSiret.substring(0, 9);
        
        const trasnporteurMatch = pdfTransporteurSiren && bsdTransporteurSiren9 && pdfTransporteurSiren === bsdTransporteurSiren9;
        const destinataireMatch = pdfDestinataireSiret && bsdDestinataireSiret && pdfDestinataireSiret === bsdDestinataireSiret;
        
        if (!trasnporteurMatch && !destinataireMatch) return false;
        
        return true;
      });
      
      setCandidateBSDs(filteredBSDs);
      
      // Enrichir les informations des sites
      await enrichSiteInfo(filteredBSDs);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async () => {
    if (!selectedBsdId) {
      toast.error('Veuillez sélectionner un BSD');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // D'abord, récupérer l'ID du bsd_pdf
      const { data: bsdPdfData, error: bsdPdfError } = await supabase
        .from('bsd_pdf')
        .select('id')
        .eq('pdf_id', pdf_id)
        .eq('entreprise_id', entreprise_id)
        .single();

      if (bsdPdfError) throw new Error('Erreur lors de la récupération du BS PDF');
      if (!bsdPdfData) throw new Error('BS PDF non trouvé');

      // Mettre à jour le bsd_pdf avec le linked_bsd_id
      const { error: updateBsdPdfError } = await supabase
        .from('bsd_pdf')
        .update({
          linked_bsd_id: selectedBsdId
        })
        .eq('id', bsdPdfData.id)
        //.eq('pdf_id', pdf_id)
        .eq('entreprise_id', entreprise_id);

      if (updateBsdPdfError) throw new Error('Erreur lors de la mise à jour du BS PDF');

      // Mettre à jour le lien du bsd_pdf_extracted_linked dans la table bsd
      const { error: updateBsdPdfExtractedLinkedIdError } = await supabase
        .from('bsd')
        .update({
          bsd_extracted_then_linked_id: bsdPdfData.id
        })
        .eq('id', selectedBsdId)
        .eq('entreprise_id', entreprise_id);

      if (updateBsdPdfError) throw new Error('Erreur lors de la mise à jour du BS PDF');      


      // Récupérer les pdf_ids actuels du BSD
      const { data: ligne_register, error: ligne_register_error } = await supabase
        .from('bsd')
        .select('pdf_ids')
        .eq('id', selectedBsdId)
        .eq('entreprise_id', entreprise_id)
        .single();

      if (ligne_register_error) throw new Error('Erreur lors de la récupération du BSD');
      if (!ligne_register) throw new Error('BSD non trouvé');

      // S'assurer que pdf_ids est un tableau, même s'il est null
      const current_pdf_ids = ligne_register.pdf_ids || [];
      const new_pdf_ids = [...current_pdf_ids, pdf_id];

      // Mettre à jour le BSD avec le nouveau pdf_id
      const { error: update_pdf_ids_error } = await supabase
        .from('bsd')
        .update({
          pdf_ids: new_pdf_ids
        })
        .eq('id', selectedBsdId)
        .eq('entreprise_id', entreprise_id);

      if (update_pdf_ids_error) throw new Error('Erreur lors de la mise à jour des pdf_ids');

      // Mettre à jour le statut dans pdf_infos
      const { error: updateError } = await supabase
        .from('pdf_infos')
        .update({ 
          status: 'linked'
        })
        .eq('id', pdf_id)
        .eq('entreprise_id', entreprise_id);

      if (updateError) throw new Error('Erreur lors de la liaison du BSD');

      toast.success('BSD lié avec succès');
      setIsModalOpen(false);
      setselectedBsdId('');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour calculer la similarité entre deux chaînes (distance de Levenshtein simplifiée)
  const calculateSimilarity = (str1: string, str2: string): number => {
    if (!str1 || !str2) return 0;
    
    const s1 = str1.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const s2 = str2.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    
    if (s1 === s2) return 100;
    
    const matrix = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
    
    for (let i = 0; i <= s1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= s2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= s2.length; j++) {
      for (let i = 1; i <= s1.length; i++) {
        const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    const maxLength = Math.max(s1.length, s2.length);
    const similarity = ((maxLength - matrix[s2.length][s1.length]) / maxLength) * 100;
    return Math.round(similarity);
  };

  // Fonction pour enrichir les informations des sites
  const enrichSiteInfo = async (bsds: RowBSD[]) => {
    try {
      // Extraire tous les SIRET uniques des émetteurs
      const sirets = bsds
        .map(bsd => bsd.infos_json?.formAPI?.createFormInput?.emitter?.company?.siret)
        .filter(siret => siret && siret.length >= 9)
        .map(siret => siret.replace(/\s/g, ''))
        .filter((siret, index, arr) => arr.indexOf(siret) === index); // Supprimer les doublons

      if (sirets.length === 0) return;

      // Récupérer les adresses depuis la table autocompletion
      const { data: autocompletionData, error: autocompletionError } = await supabase
        .from('table_autocompletion')
        .select('site')
        .eq('entreprise_id', entreprise_id);

      if (autocompletionError) {
        console.error('Erreur lors de la récupération des adresses:', autocompletionError);
        return;
      }

      // Créer un mapping SIRET -> adresse
      const addressMapping: {[key: string]: string} = {};
      autocompletionData?.forEach(item => {
        if (item.site?.siret && item.site?.pointsCollecte && item.site.pointsCollecte.length > 0) {
          const siret = item.site.siret.replace(/\s/g, '');
          const adresse = item.site.pointsCollecte[0].adresse;
          if (siret && adresse) {
            addressMapping[siret] = adresse;
          }
        }
      });

      setSiteAddresses(addressMapping);
    } catch (error) {
      console.error('Erreur lors de l\'enrichissement des sites:', error);
    }
  };

  return (
    <>
      <button
        onClick={() => {
          setIsModalOpen(true);
          fetchBSDData();
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
          <Dialog.Panel className="mx-auto max-w-[70%] w-full bg-white rounded-lg shadow-xl p-6">
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
                            <div>{bsdPdf.collecteurTransporteur?.datePriseEnCharge || 'Non spécifié'}</div>
                          </div>
                          <div>
                            <div className="text-gray-600">Présentation:</div>
                            <div>{bsdPdf.declarationEmetteur?.date || 'Non spécifié'}</div>
                          </div>
                      <div>
                            <div className="text-gray-600">Traitement:</div>
                            <div>{bsdPdf.realisationOperation?.date || 'Non spécifié'}</div>
                      </div>
                      <div>
                            <div className="text-gray-600">Déclaration:</div>
                            <div>{bsdPdf.declarationEmetteur?.date || 'Non spécifié'}</div>
                          </div>
                        </div>
                      </div>

                      {/* Déchet Section */}
                      <div className="mb-16">
                        <div className="text-sm grid grid-cols-4 gap-2">
                          <div>
                            <div className="text-gray-600">Déchet:</div>
                            <div>{bsdPdf.dechet?.denominationUsuelle || 'Non spécifié'}</div>
                          </div>
                          <div>
                            <div className="text-gray-600">CED:</div>
                            <div>{bsdPdf.dechet?.code || 'Non spécifié'}</div>
                          </div>
                          <div>
                            <div className="text-gray-600">Code DR:</div>
                            <div>{bsdPdf.realisationOperation?.code || 'Non spécifié'}</div>
                      </div>
                      <div>
                            <div className="text-gray-600">Quantité:</div>
                            <div>{bsdPdf.dechet?.poids ? `${bsdPdf.dechet.poids} tonnes` : 'Non spécifié'}</div>
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
                          </div>
                          <div className="flex justify-start gap-2">
                            <span className="text-gray-600">Adresse:</span>
                            <span>{bsdPdf.emetteur?.adresse || 'Non spécifié'}</span>
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
                              <div>{bsdPdf.collecteurTransporteur?.siren || 'Non spécifié'}</div>
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
                              <div>{bsdPdf.installationDestination?.siret || 'Non spécifié'}</div>
                            </div>
                          </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Candidate BSDs List */}
                  <div className="w-[40%] h-[400px]">
                  <h3 className="font-medium mb-2">BSDs candidats</h3>
                  {candidateBSDs.length === 0 ? (
                    <p className="text-sm text-gray-500">Aucun BSD trouvé pour cette date</p>
                  ) : (
                      <div className="space-y-2 max-h-[350px] overflow-y-auto">
                        {candidateBSDs
                          .map((bsd) => {
                            const siret = bsd.infos_json?.formAPI?.createFormInput?.emitter?.company?.siret?.replace(/\s/g, '');
                            const candidateAddress = siteAddresses[siret] || 'Adresse non trouvée';
                            const pdfAddress = bsdPdf?.emetteur?.adresse || '';
                            const addressSimilarity = calculateSimilarity(pdfAddress, candidateAddress);
                            
                            const pdfEmitterName = bsdPdf?.emetteur?.nom || '';
                            const candidateEmitterName = bsd.infos_json?.formAPI?.createFormInput?.emitter?.company?.name || '';
                            const nameSimilarity = calculateSimilarity(pdfEmitterName, candidateEmitterName);
                            
                            return { bsd, addressSimilarity, nameSimilarity };
                          })
                          .filter(({ addressSimilarity }) => addressSimilarity >= 40)
                          .map(({ bsd, addressSimilarity, nameSimilarity }) => (
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
                            <p className="font-medium">{bsd.infos_json.formAPI.createFormInput.wasteDetails.code}</p>
                                <p className="text-sm text-black">
                                  {new Date(bsd.created_at).toLocaleDateString()}
                                </p>
                                <p>{bsd.id}</p>
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
                            </p>
                            <p className="text-sm text-gray-500">
                                  {(() => {
                                    const siret = bsd.infos_json?.formAPI?.createFormInput?.emitter?.company?.siret?.replace(/\s/g, '');
                                    const candidateAddress = siteAddresses[siret] || 'Adresse non trouvée';
                                    return (
                                      <>
                                        <span className={`px-2 py-1 mr-2 rounded text-xs font-medium ${
                                          addressSimilarity >= 80 ? 'bg-green-100 text-green-800' :
                                          addressSimilarity >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                          'bg-red-100 text-red-800'
                                        }`}>
                                          {addressSimilarity}%
                                        </span>
                                        {candidateAddress}
                                      </>
                                    );
                                  })()}
                                </p>
                                <p className="text-sm flex justify-end text-gray-500">
                                  {bsd.infos_json.formAPI.createFormInput.wasteDetails.quantity || 'Non spécifié'} tonnes
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                  </div>
                </div>

                {/* Action Buttons */}
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
              </>
            )}
          </Dialog.Panel>
        </div>
      </Dialog>
    </>
  );
}
