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
  const [filteredCandidateBSDs, setFilteredCandidateBSDs] = useState<RowBSD[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minDate, setMinDate] = useState<Date | null>(null);
  const [maxDate, setMaxDate] = useState<Date | null>(null);
  const [siteAddresses, setSiteAddresses] = useState<{[key: string]: string}>({});
  const [filterLevel, setFilterLevel] = useState<number>(1); // Niveau de filtrage (1-4)
  const [addressSimilarityThreshold, setAddressSimilarityThreshold] = useState<number>(40); // Seuil de similarité d'adresse
  const [nameSimilarityThreshold, setNameSimilarityThreshold] = useState<number>(0); // Seuil de similarité de nom
  const { entreprise_id } = useSession();

  // Configuration des niveaux de filtrage
  const filterLevels = {
    1: {
      name: "Strict",
      description: "Code CED + SIRET/SIREN + Dates précises + Adresse ≥40%",
      dateRange: { priseEnCharge: 3, presentation: 15, traitement: 20, declaration: 30, fallback: 35 },
      addressThreshold: 40,
      nameThreshold: 0
    },
    2: {
      name: "Modéré", 
      description: "Code CED + SIRET/SIREN + Dates étendues",
      dateRange: { priseEnCharge: 7, presentation: 30, traitement: 40, declaration: 60, fallback: 70 },
      addressThreshold: 30,
      nameThreshold: 0
    },
    3: {
      name: "Large",
      description: "Code CED + Dates très étendues",
      dateRange: { priseEnCharge: 15, presentation: 60, traitement: 80, declaration: 120, fallback: 140 },
      addressThreshold: 0,
      nameThreshold: 0
    },
    4: {
      name: "Très large",
      description: "Code CED uniquement",
      dateRange: { priseEnCharge: 30, presentation: 120, traitement: 160, declaration: 240, fallback: 280 },
      addressThreshold: 0,
      nameThreshold: 0
    }
  };

  const fetchBSDData = async (level: number = filterLevel) => {
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

      // Calculer les plages de dates selon le niveau de filtrage
      const currentLevel = filterLevels[level as keyof typeof filterLevels];
      let startDate: Date, endDate: Date;
      
      if (datePriseEnCharge) {
        startDate = new Date(datePriseEnCharge);
        startDate.setDate(datePriseEnCharge.getDate() - currentLevel.dateRange.priseEnCharge);
        endDate = new Date(datePriseEnCharge);
        endDate.setDate(datePriseEnCharge.getDate() + currentLevel.dateRange.priseEnCharge);
      } else if (datePresentation) {
        startDate = new Date(datePresentation);
        startDate.setDate(datePresentation.getDate() - currentLevel.dateRange.presentation);
        endDate = new Date(datePresentation);
        endDate.setDate(datePresentation.getDate() + currentLevel.dateRange.presentation);
      } else if (dateTraitement) {
        startDate = new Date(dateTraitement);
        startDate.setDate(dateTraitement.getDate() - currentLevel.dateRange.traitement);
        endDate = new Date(dateTraitement);
        endDate.setDate(dateTraitement.getDate() + currentLevel.dateRange.traitement);
      } else if (dateDeclaration) {
        startDate = new Date(dateDeclaration);
        startDate.setDate(dateDeclaration.getDate() - currentLevel.dateRange.declaration);
        endDate = new Date(dateDeclaration);
        endDate.setDate(dateDeclaration.getDate() + currentLevel.dateRange.declaration);
      } else {
        startDate = new Date(minDateValue);
        startDate.setDate(minDateValue.getDate() - currentLevel.dateRange.fallback);
        endDate = new Date(maxDateValue);
        endDate.setDate(maxDateValue.getDate() + currentLevel.dateRange.fallback);
      }

      // Fetch candidate BSDs
      const { data: bsdData, error: bsdError } = await supabase
        .from('bsd')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .eq('entreprise_id', entreprise_id);

      if (bsdError) throw new Error('Erreur lors de la récupération des BSDs');
      
      // Filtrer les BSDs selon les critères du niveau
      const filteredBSDs = (bsdData || []).filter(bsd => {
        // Exclure les BSDs qui ont déjà été liés à un PDF extrait
        if (bsd.bsd_extracted_then_linked_id) return false;
        
        // 1. Filtre sur le code CED (toujours obligatoire)
        const bsdCodeCED = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.code?.replace(/[\s*]/g, '') || '';
        if (bsdCodeCED !== pdfCodeCED) return false;
        
        // 2. Filtre sur SIRET/SIREN selon le niveau
        if (level <= 2) { // Niveaux 1 et 2 : SIRET/SIREN obligatoire
        const bsdDestinataireSiret = bsd.infos_json?.formAPI?.createFormInput?.recipient?.company?.siret?.replace(/\s/g, '') || '';
        const bsdTransporteurSiret = bsd.infos_json?.formAPI?.createFormInput?.transporter?.company?.siret?.replace(/\s/g, '') || '';
        
        const bsdTransporteurSiren9 = bsdTransporteurSiret.substring(0, 9);
        
          const transporteurMatch = pdfTransporteurSiren && bsdTransporteurSiren9 && pdfTransporteurSiren === bsdTransporteurSiren9;
        const destinataireMatch = pdfDestinataireSiret && bsdDestinataireSiret && pdfDestinataireSiret === bsdDestinataireSiret;
        
          if (!transporteurMatch && !destinataireMatch) return false;
        }
        // Niveaux 3 et 4 : pas de filtre SIRET/SIREN
        
        return true;
      });
      
      setCandidateBSDs(filteredBSDs);
      
      // Mettre à jour les seuils de similarité
      setAddressSimilarityThreshold(currentLevel.addressThreshold);
      setNameSimilarityThreshold(currentLevel.nameThreshold);
      
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

  // Fonction pour essayer le niveau suivant si aucun BSD trouvé
  const tryNextFilterLevel = () => {
    if (filterLevel < 4) {
      const nextLevel = filterLevel + 1;
      setFilterLevel(nextLevel);
      fetchBSDData(nextLevel);
    }
  };

  // Calculer les BSDs filtrés par similarité d'adresse
  useEffect(() => {
    if (candidateBSDs.length > 0 && siteAddresses && bsdPdf) {
      const filtered = candidateBSDs
        .map((bsd) => {
          const siret = bsd.infos_json?.formAPI?.createFormInput?.emitter?.company?.siret?.replace(/\s/g, '');
          const candidateAddress = siteAddresses[siret] || 'Adresse non trouvée';
          const pdfAddress = bsdPdf?.emetteur?.adresse || '';
          const addressSimilarity = calculateSimilarity(pdfAddress, candidateAddress);
          
          const pdfEmitterName = bsdPdf?.emetteur?.nom || '';
          const candidateEmitterName = bsd.infos_json?.formAPI?.createFormInput?.emitter?.company?.name || '';
          const nameSimilarity = calculateSimilarity(pdfEmitterName, candidateEmitterName);
          
          // Comparaisons pour les couleurs
          const pdfCodeCED = bsdPdf?.dechet?.code?.replace(/[\s*]/g, '') || '';
          const bsdCodeCED = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.code?.replace(/[\s*]/g, '') || '';
          const codeCEDMatch = pdfCodeCED === bsdCodeCED;
          
          const pdfTransporteurSiren = bsdPdf?.collecteurTransporteur?.siren?.replace(/\s/g, '') || '';
          const bsdTransporteurSiret = bsd.infos_json?.formAPI?.createFormInput?.transporter?.company?.siret?.replace(/\s/g, '') || '';
          const bsdTransporteurSiren9 = bsdTransporteurSiret.substring(0, 9);
          const transporteurMatch = pdfTransporteurSiren && bsdTransporteurSiren9 && pdfTransporteurSiren === bsdTransporteurSiren9;
          
          const pdfDestinataireSiret = bsdPdf?.installationDestination?.siret?.replace(/\s/g, '') || '';
          const bsdDestinataireSiret = bsd.infos_json?.formAPI?.createFormInput?.recipient?.company?.siret?.replace(/\s/g, '') || '';
          const destinataireMatch = pdfDestinataireSiret && bsdDestinataireSiret && pdfDestinataireSiret === bsdDestinataireSiret;
          
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
          
          return { bsd, addressSimilarity, nameSimilarity, codeCEDMatch, transporteurMatch, destinataireMatch, dateMatch };
        })
        .filter(({ addressSimilarity }) => {
          // Pour les niveaux 2, 3 et 4, ne pas filtrer sur l'adresse
          if (filterLevel >= 2) return true;
          return addressSimilarity >= addressSimilarityThreshold;
        })
        .map(({ bsd }) => bsd);
      
      setFilteredCandidateBSDs(filtered);
    } else {
      setFilteredCandidateBSDs([]);
    }
  }, [candidateBSDs, siteAddresses, bsdPdf, filterLevel, addressSimilarityThreshold]);

  return (
    <>
      <button
        onClick={() => {
          setIsModalOpen(true);
          setFilterLevel(1); // Reset au niveau 1
          fetchBSDData(1);
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
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-sm">Niveau de filtrage</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">
                    {filterLevels[filterLevel as keyof typeof filterLevels].name}
                  </span>
                  <button
                    onClick={tryNextFilterLevel}
                    disabled={filterLevel >= 4 || filteredCandidateBSDs.length > 0}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Relâcher les critères
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-2 text-xs">
                {Object.entries(filterLevels).map(([level, config]) => (
                  <button
                    key={level}
                    onClick={() => {
                      setFilterLevel(parseInt(level));
                      fetchBSDData(parseInt(level));
                    }}
                    className={`p-2 rounded text-left ${
                      filterLevel === parseInt(level)
                        ? 'bg-blue-100 border-blue-300 border'
                        : 'bg-white border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium">{config.name}</div>
                    <div className="text-gray-600 text-xs">{config.description}</div>
                  </button>
                ))}
              </div>

              {/* Légende des couleurs */}
              <div className="mt-3 pt-3 border-t border-gray-200">
                <h4 className="text-xs font-medium text-gray-700 mb-2">Légende des couleurs :</h4>
                <div className="grid grid-cols-5 gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-gray-50 border border-gray-200 rounded"></div>
                    <span className="text-blue-600">Code CED</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-gray-50 border border-gray-200 rounded"></div>
                    <span className="text-green-600">SIRET/SIREN</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-gray-50 border border-gray-200 rounded"></div>
                    <span className="text-orange-600">Dates</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-gray-50 border border-gray-200 rounded"></div>
                    <span className="text-purple-600">Adresses</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs">✓</span>
                    <span className="text-gray-600">Correspondance</span>
                  </div>
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
                      <div className="mb-16">
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
                      <p className="text-sm text-gray-500 mb-4">Aucun BSD trouvé avec le niveau de filtrage actuel</p>
                      {filterLevel < 4 && (
                        <button
                          onClick={tryNextFilterLevel}
                          className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Essayer le niveau suivant
                        </button>
                      )}
                    </div>
                  ) : (
                      <div className="space-y-2 max-h-[350px] overflow-y-auto">
                        {filteredCandidateBSDs
                          .map((bsd) => {
                            const siret = bsd.infos_json?.formAPI?.createFormInput?.emitter?.company?.siret?.replace(/\s/g, '');
                            const candidateAddress = siteAddresses[siret] || 'Adresse non trouvée';
                            const pdfAddress = bsdPdf?.emetteur?.adresse || '';
                            const addressSimilarity = calculateSimilarity(pdfAddress, candidateAddress);
                            
                            const pdfEmitterName = bsdPdf?.emetteur?.nom || '';
                            const candidateEmitterName = bsd.infos_json?.formAPI?.createFormInput?.emitter?.company?.name || '';
                            const nameSimilarity = calculateSimilarity(pdfEmitterName, candidateEmitterName);
                            
                            // Comparaisons pour les couleurs
                            const pdfCodeCED = bsdPdf?.dechet?.code?.replace(/[\s*]/g, '') || '';
                            const bsdCodeCED = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.code?.replace(/[\s*]/g, '') || '';
                            const codeCEDMatch = pdfCodeCED === bsdCodeCED;
                            
                            const pdfTransporteurSiren = bsdPdf?.collecteurTransporteur?.siren?.replace(/\s/g, '') || '';
                            const bsdTransporteurSiret = bsd.infos_json?.formAPI?.createFormInput?.transporter?.company?.siret?.replace(/\s/g, '') || '';
                            const bsdTransporteurSiren9 = bsdTransporteurSiret.substring(0, 9);
                            const transporteurMatch = pdfTransporteurSiren && bsdTransporteurSiren9 && pdfTransporteurSiren === bsdTransporteurSiren9;
                            
                            const pdfDestinataireSiret = bsdPdf?.installationDestination?.siret?.replace(/\s/g, '') || '';
                            const bsdDestinataireSiret = bsd.infos_json?.formAPI?.createFormInput?.recipient?.company?.siret?.replace(/\s/g, '') || '';
                            const destinataireMatch = pdfDestinataireSiret && bsdDestinataireSiret && pdfDestinataireSiret === bsdDestinataireSiret;
                            
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
                            
                            return { bsd, addressSimilarity, nameSimilarity, codeCEDMatch, transporteurMatch, destinataireMatch, dateMatch };
                          })
                          .map(({ bsd, addressSimilarity, nameSimilarity, codeCEDMatch, transporteurMatch, destinataireMatch, dateMatch }) => (
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
                                        {filterLevel < 2 && (
                                        <span className={`px-2 py-1 mr-2 rounded text-xs font-medium ${
                                          addressSimilarity >= 80 ? 'bg-green-100 text-green-800' :
                                          addressSimilarity >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                          'bg-red-100 text-red-800'
                                        }`}>
                                          {addressSimilarity}%
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
