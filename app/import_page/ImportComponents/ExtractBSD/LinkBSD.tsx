'use client';

import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { supabase } from '@/app/database/supabaseClient';
import { toast } from 'react-hot-toast';
import { useSession } from '@/app/component/SessionProvider';
import { BSDCerfa } from './ExtractBSD';
import { RowBSD } from '@/app/register/interface/BSD_Interface';
import { LinkBSDComponent } from './LinkBSDComponent';


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

export default function LinkBSD({ pdf_id, onLink }: LinkBSDProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBsdId, setselectedBsdId] = useState<string>('');
  const [bsdPdf, setBsdPdf] = useState<BSDCerfa | null>(null);
  const [candidateBSDs, setCandidateBSDs] = useState<RowBSD[]>([]);
  const [filteredCandidateBSDs, setFilteredCandidateBSDs] = useState<RowBSD[]>([]);
  const [allBSDs, setAllBSDs] = useState<RowBSD[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minDate, setMinDate] = useState<Date | null>(null);
  const [maxDate, setMaxDate] = useState<Date | null>(null);
  const [siteAddresses, setSiteAddresses] = useState<{[key: string]: {adresse: string, nom: string}}>({});
  const [pdfSiteName, setPdfSiteName] = useState<string>('');
  // Nouveaux états pour les filtres individuels
  const [codeCEDFilter, setCodeCEDFilter] = useState<boolean>(true);
  const [siretSirenFilter, setSiretSirenFilter] = useState<boolean>(true);
  const [addressFilter, setAddressFilter] = useState<boolean>(true);
  const [dateFilter, setDateFilter] = useState<boolean>(true);
  const [tonnageFilter, setTonnageFilter] = useState<boolean>(true);
  const [dateRange, setDateRange] = useState<number>(10); // Marge de jours pour le filtre de date
  const [tonnageRange, setTonnageRange] = useState<number>(5); // Marge de pourcentage pour le filtre de tonnage
  const [addressSimilarityThreshold, setAddressSimilarityThreshold] = useState<number>(40); // Seuil de similarité d'adresse
  const [nameSimilarityThreshold, setNameSimilarityThreshold] = useState<number>(0); // Seuil de similarité de nom
  const [customFilters, setCustomFilters] = useState<Array<{id: string, text: string, enabled: boolean}>>([]); // Filtres personnalisés
  const [newFilterText, setNewFilterText] = useState<string>(''); // Texte du nouveau filtre
  const [dataReady, setDataReady] = useState<boolean>(false); // État pour indiquer que toutes les données sont prêtes
  const { entreprise_id } = useSession();

  // Configuration des filtres individuels
  const filterConfig = {
    dateRange: dateRange,
    tonnageRange: tonnageRange,
    addressThreshold: addressSimilarityThreshold,
    nameThreshold: nameSimilarityThreshold
  };

  // Fonction centralisée pour appliquer tous les filtres et calculer les scores
  const applyAllFilters = (pdfCodeCED: string, pdfDestinataireSiret: string, pdfTransporteurSiren: string, minDate: Date, maxDate: Date, pdfSiteNames: string[] = []) => {
    console.log('applyAllFilters appelé avec:', {
      pdfCodeCED,
      pdfDestinataireSiret,
      pdfTransporteurSiren,
      minDate,
      maxDate,
      pdfSiteNames,
      allBSDsLength: allBSDs.length,
      filters: { codeCEDFilter, siretSirenFilter, dateFilter, tonnageFilter, addressFilter }
    });

    // Si aucun filtre n'est activé, afficher tous les BSDs
    if (!codeCEDFilter && !siretSirenFilter && !dateFilter && !tonnageFilter && !addressFilter && customFilters.length === 0) {
      console.log('Aucun filtre activé, affichage de tous les BSDs');
      setCandidateBSDs(allBSDs);
      setFilteredCandidateBSDs(allBSDs);
      return allBSDs.map(bsd => ({ bsd, passesAllFilters: true }));
    }

    // Extraire les dates spécifiques du PDF
    const datePriseEnCharge = cleanDate(bsdPdf?.collecteurTransporteur?.datePriseEnCharge);
    const datePresentation = cleanDate(bsdPdf?.declarationEmetteur?.date);
    const dateTraitement = cleanDate(bsdPdf?.realisationOperation?.date);
    const dateDeclaration = cleanDate(bsdPdf?.declarationEmetteur?.date);

    // Calculer la plage de dates pour le filtrage
    let startDate: Date, endDate: Date;
    
    if (dateFilter) {
      if (datePriseEnCharge) {
        startDate = new Date(datePriseEnCharge);
        startDate.setDate(datePriseEnCharge.getDate() - dateRange);
        endDate = new Date(datePriseEnCharge);
        endDate.setDate(datePriseEnCharge.getDate() + dateRange);
      } else if (datePresentation) {
        startDate = new Date(datePresentation);
        startDate.setDate(datePresentation.getDate() - dateRange);
        endDate = new Date(datePresentation);
        endDate.setDate(datePresentation.getDate() + dateRange);
      } else if (dateTraitement) {
        startDate = new Date(dateTraitement);
        startDate.setDate(dateTraitement.getDate() - dateRange);
        endDate = new Date(dateTraitement);
        endDate.setDate(dateTraitement.getDate() + dateRange);
      } else if (dateDeclaration) {
        startDate = new Date(dateDeclaration);
        startDate.setDate(dateDeclaration.getDate() - dateRange);
        endDate = new Date(dateDeclaration);
        endDate.setDate(dateDeclaration.getDate() + dateRange);
      } else {
        startDate = new Date(minDate);
        startDate.setDate(minDate.getDate() - dateRange);
        endDate = new Date(maxDate);
        endDate.setDate(maxDate.getDate() + dateRange);
      }
    } else {
      // Si le filtre de date est désactivé, utiliser une plage très large
      startDate = new Date(minDate);
      startDate.setDate(minDate.getDate() - 365);
      endDate = new Date(maxDate);
      endDate.setDate(maxDate.getDate() + 365);
    }

    // Appliquer tous les filtres et calculer les scores
    const filteredResults = allBSDs.map(bsd => {
      // Récupérer les données du BSD
      const bsdCodeCED = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.code?.replace(/[\s*]/g, '') || '';
      const bsdDestinataireSiret = bsd.infos_json?.formAPI?.createFormInput?.recipient?.company?.siret?.replace(/\s/g, '') || '';
      const bsdTransporteurSiret = bsd.infos_json?.formAPI?.createFormInput?.transporter?.company?.siret?.replace(/\s/g, '') || '';
      const bsdEmitterName = bsd.infos_json?.formAPI?.createFormInput?.emitter?.company?.name || '';
      const bsdWorkSiteName = bsd.infos_json?.formAPI?.createFormInput?.emitter?.workSite?.name || '';
      const bsdCreatedDate = new Date(bsd.created_at);
      const bsdTonnage = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.quantity || 0;

      // Récupérer les données du PDF
      const pdfTransporteurName = bsdPdf?.collecteurTransporteur?.nom || '';
      const pdfDestinataireName = bsdPdf?.installationDestination?.nom || '';
      const pdfEmitterName = bsdPdf?.emetteur?.nom || '';
      const pdfAddress = bsdPdf?.emetteur?.adresse || '';
      const pdfTonnage = bsdPdf?.dechet?.poids || 0;
      const pdfTonnageHeure = Number(bsdPdf?.expedition?.heure) || 0;

      // Calculer les correspondances pour chaque critère
      const results = {
        bsd,
        // Filtre Code CED
        codeCEDMatch: codeCEDFilter ? bsdCodeCED.slice(0, 5) === pdfCodeCED.slice(0, 5) : true,
        
        // Filtre SIRET/SIREN et noms - CORRECTION: il suffit d'avoir UN match (transporteur OU destinataire)
        transporteurMatch: siretSirenFilter ? (
          compareSirenSiret(pdfTransporteurSiren, bsdTransporteurSiret) ||
          compareCompanyNames(pdfTransporteurName, bsd.infos_json?.formAPI?.createFormInput?.transporter?.company?.name || '', 4)
        ) : true,
        
        destinataireMatch: siretSirenFilter ? (
          compareSirenSiret(pdfDestinataireSiret, bsdDestinataireSiret) ||
          compareCompanyNames(pdfDestinataireName, bsd.infos_json?.formAPI?.createFormInput?.recipient?.company?.name || '', 4)
        ) : true,
        
        // Filtre Dates
        dateMatch: dateFilter ? (bsdCreatedDate >= startDate && bsdCreatedDate <= endDate) : true,
        
        // Filtre Tonnage - CORRECTION: ne filtrer que si le PDF a un tonnage
        tonnageMatch: tonnageFilter && pdfTonnage > 0 ? (
          bsdTonnage > 0 ? (
            bsdTonnage >= pdfTonnage * (1 - tonnageRange / 100) && 
            bsdTonnage <= pdfTonnage * (1 + tonnageRange / 100)
          ) : true // Si le BSD n'a pas de tonnage, ne pas filtrer
        ) : true,

        // Filtre Tonnage Heure - CORRECTION: ne filtrer que si le PDF a un tonnage heure
        tonnageHeureMatch: tonnageFilter && pdfTonnageHeure > 0 ? (
          bsdTonnage > 0 ? (
            bsdTonnage >= pdfTonnageHeure * (1 - tonnageRange / 100) && 
            bsdTonnage <= pdfTonnageHeure * (1 + tonnageRange / 100)
          ) : true // Si le BSD n'a pas de tonnage heure, ne pas filtrer
        ) : true,
        
        
        // Filtre Sites (noms) - CORRECTION: ne filtrer que si on a des noms de sites
        siteNameMatch: addressFilter && pdfSiteNames.length > 0 ? (
          pdfSiteNames.some(pdfSiteName => 
            compareCompanyNames(pdfSiteName, bsdEmitterName, 4) ||
            (bsdWorkSiteName && compareCompanyNames(pdfSiteName, bsdWorkSiteName, 4))
          )
        ) : true,
        
        // Filtre Sites (codes postaux) - CORRECTION: ne filtrer que si on a des adresses
        postalCodeMatch: addressFilter && pdfAddress ? (() => {
          const siret = bsd.infos_json?.formAPI?.createFormInput?.emitter?.company?.siret?.replace(/\s/g, '');
          const candidateAddress = siteAddresses[siret]?.adresse || '';
          return comparePostalCodes(pdfAddress, candidateAddress);
        })() : true,
        
        // Filtres personnalisés
        customFiltersMatch: matchesCustomFilters(bsd),
        
        // Scores de similarité pour l'affichage
        nameSimilarity: calculateSimilarity(pdfEmitterName, bsdEmitterName),
        
        // Correspondance spécifique du nom du site
        pdfSiteNameMatch: pdfSiteNames.length > 0 && bsdEmitterName ? 
          pdfSiteNames.some(pdfSiteName => compareCompanyNames(pdfSiteName, bsdEmitterName, 4)) : false,
          
        // Correspondance spécifique des noms des prestataires
        prestataireMatch: (
          compareCompanyNames(pdfTransporteurName, bsd.infos_json?.formAPI?.createFormInput?.transporter?.company?.name || '', 4) ||
          compareCompanyNames(pdfDestinataireName, bsd.infos_json?.formAPI?.createFormInput?.recipient?.company?.name || '', 4)
        )
      };

      // Vérifier si le BSD passe tous les filtres activés - CORRECTION: pour SIRET/SIREN, il suffit d'avoir UN match
      const siretSirenMatch = siretSirenFilter ? (results.transporteurMatch || results.destinataireMatch) : true;
      
      const passesAllFilters = 
        results.codeCEDMatch &&
        (siretSirenMatch || results.prestataireMatch) &&
        results.dateMatch &&
        (results.tonnageMatch || results.tonnageHeureMatch) &&
        (results.siteNameMatch || results.postalCodeMatch) &&
        results.customFiltersMatch;

      return {
        ...results,
        passesAllFilters
      };
    });

    // Séparer les BSDs qui passent les filtres de ceux qui ne les passent pas
    const passingBSDs = filteredResults.filter(result => result.passesAllFilters);
    const failingBSDs = filteredResults.filter(result => !result.passesAllFilters);

    console.log('Résultats du filtrage:', {
      total: allBSDs.length,
      passing: passingBSDs.length,
      failing: failingBSDs.length
    });

    // Mettre à jour les états
    setCandidateBSDs(passingBSDs.map(result => result.bsd));
    setFilteredCandidateBSDs(passingBSDs.map(result => result.bsd));

    return filteredResults;
  };

  // Fonction legacy pour compatibilité (maintenant dépréciée)
  const applyFilters = (pdfCodeCED: string, pdfDestinataireSiret: string, pdfTransporteurSiren: string, minDate: Date, maxDate: Date, pdfSiteNames: string[] = []) => {
    applyAllFilters(pdfCodeCED, pdfDestinataireSiret, pdfTransporteurSiren, minDate, maxDate, pdfSiteNames);
  };

  const fetchBSDData = async () => {
    try {
      setLoading(true);
      setError(null);
      setDataReady(false); // Réinitialiser l'état de données prêtes

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

      // Récupérer les informations de site_siret_plus depuis pdf_infos
      const { data: pdfInfosData, error: pdfInfosError } = await supabase
        .from('pdf_infos')
        .select('site_siret_plus')
        .eq('id', pdf_id)
        .eq('entreprise_id', entreprise_id)
        .single();

      if (pdfInfosError) {
        console.error('Erreur lors de la récupération des infos PDF:', pdfInfosError);
      }

      // Récupérer les noms des sites depuis table_autocompletion
      let pdfSiteNames: string[] = [];
      if (pdfInfosData?.site_siret_plus && pdfInfosData.site_siret_plus.length > 0) {
        const firstSiteSiret = pdfInfosData.site_siret_plus[0]; // Prendre le premier élément comme demandé
        
        const { data: autocompletionData, error: autocompletionError } = await supabase
          .from('table_autocompletion')
          .select('site')
          .eq('entreprise_id', entreprise_id);

        if (!autocompletionError && autocompletionData) {
          // Chercher le site correspondant au SIRET
          const matchingSite = autocompletionData.find(item => 
            item.site?.siret?.replace(/\s/g, '') === firstSiteSiret.replace(/\s/g, '')
          );
          
          if (matchingSite?.site?.nom) {
            pdfSiteNames = [matchingSite.site.nom];
            setPdfSiteName(matchingSite.site.nom);
            console.log('Nom du site trouvé pour le PDF:', matchingSite.site.nom);
          }
        }
      }

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

      // Récupérer tous les BSDs (toujours, pas seulement si allBSDs est vide)
      // Calculer une plage de dates très large pour récupérer tous les BSDs possibles
      const startDate = new Date(minDateValue);
      startDate.setDate(minDateValue.getDate() - 30); // 30 jours en arrière
      const endDate = new Date(maxDateValue);
      endDate.setDate(maxDateValue.getDate() + 30); // 30 jours en avant

      const { data: bsdData, error: bsdError } = await supabase
        .from('bsd')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .eq('entreprise_id', entreprise_id);

      if (bsdError) throw new Error('Erreur lors de la récupération des BSDs');
      
      // Mettre à jour allBSDs avec les nouvelles données
      setAllBSDs(bsdData);

      // Enrichir les informations des sites avec les données fraîchement récupérées
      await enrichSiteInfo(bsdData);
      
      // Marquer les données comme prêtes AVANT d'appliquer les filtres
      setDataReady(true);
      
      // Appliquer les filtres selon les checkboxes activées
      applyFilters(pdfCodeCED, pdfDestinataireSiret, pdfTransporteurSiren, minDateValue, maxDateValue, pdfSiteNames);
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

      // Mettre à jour localement les BSDs candidats pour refléter le changement
      setAllBSDs(prevBSDs => 
        prevBSDs.map(bsd => 
          bsd.id === Number(selectedBsdId) 
            ? { ...bsd, bsd_extracted_then_linked_id: bsdPdfData.id, pdf_ids: new_pdf_ids }
            : bsd
        )
      );

      // Mettre à jour les BSDs candidats filtrés
      setCandidateBSDs(prevCandidates => 
        prevCandidates.map(bsd => 
          bsd.id === Number(selectedBsdId) 
            ? { ...bsd, bsd_extracted_then_linked_id: bsdPdfData.id, pdf_ids: new_pdf_ids }
            : bsd
        )
      );

      // Mettre à jour les BSDs filtrés
      setFilteredCandidateBSDs(prevFiltered => 
        prevFiltered.map(bsd => 
          bsd.id === Number(selectedBsdId) 
            ? { ...bsd, bsd_extracted_then_linked_id: bsdPdfData.id, pdf_ids: new_pdf_ids }
            : bsd
        )
      );

      toast.success('BSD lié avec succès');
      setIsModalOpen(false);
      setselectedBsdId('');

      // Appeler le callback onLink pour informer le composant parent
      if (onLink) {
        onLink(selectedBsdId);
      }
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

  // Fonction pour comparer les SIREN/SIRET de manière floue
  const compareSirenSiret = (siren_pdf: string, siren_bsd: string): boolean => {
    // Si le BSD n'a pas de SIREN/SIRET, ne pas filtrer ce BSD
    if (siren_bsd.trim() === '') return true;
    
    // Si le PDF n'a pas de SIREN/SIRET, ne pas filtrer ce BSD
    if (siren_pdf.trim() === '') return true;
    
    // Nettoyer les chaînes (garder seulement les chiffres)
    const clean_siren_pdf = siren_pdf.replace(/\D/g, '');
    const clean_siren_bsd = siren_bsd.replace(/\D/g, '');
    
    // Si les chaînes sont identiques, retourner true
    if (clean_siren_pdf === clean_siren_bsd) return true;
    
    // Pour SIREN (9 chiffres) : au moins 6 chiffres doivent correspondre
    if (clean_siren_pdf.length === 9 && clean_siren_bsd.length === 9) {
      let matches = 0;
      for (let i = 0; i < 9; i++) {
        if (clean_siren_pdf[i] === clean_siren_bsd[i]) matches++;
      }
      return matches >= 6; // 6 chiffres sur 9
    }
    
    // Pour SIRET (14 chiffres) : au moins 10 chiffres doivent correspondre
    if (clean_siren_pdf.length === 14 && clean_siren_bsd.length === 14) {
      let matches = 0;
      for (let i = 0; i < 14; i++) {
        if (clean_siren_pdf[i] === clean_siren_bsd[i]) matches++;
      }
      return matches >= 10; // 10 chiffres sur 14
    }
    
    // Si les longueurs ne correspondent pas, essayer de comparer les premiers chiffres
    const minLength = Math.min(clean_siren_pdf.length, clean_siren_bsd.length);
    if (minLength >= 6) {
      let matches = 0;
      for (let i = 0; i < minLength; i++) {
        if (clean_siren_pdf[i] === clean_siren_bsd[i]) matches++;
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

  // Fonction pour trouver la plus longue sous-chaîne commune
  const findLongestCommonSubstring = (str1: string, str2: string): string => {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(0));
    let maxLength = 0;
    let endIndex = 0;
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2[i - 1] === str1[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1] + 1;
          if (matrix[i][j] > maxLength) {
            maxLength = matrix[i][j];
            endIndex = j;
          }
        }
      }
    }
    
    return str1.substring(endIndex - maxLength, endIndex);
  };

  // Fonction pour comparer les noms des prestataires de manière floue
  const compareCompanyNames = (name1: string, name2: string, minLength: number = 4): boolean => {
    if (!name1 || !name2) return false;
    
    // Nettoyer les noms (minuscules, supprimer caractères spéciaux)
    const clean1 = name1.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const clean2 = name2.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    
    // Si les noms sont identiques, retourner true
    if (clean1 === clean2) return true;
    
    const longestCommon = findLongestCommonSubstring(clean1, clean2);
    
    // Si la sous-chaîne commune fait au moins minLength caractères, calculer un score
    if (longestCommon.length >= minLength) {
      const score = (longestCommon.length / Math.max(clean1.length, clean2.length)) * 100;
      return score >= 40; // Au moins 40% de similarité
    }
    
    // Vérifier aussi les mots communs (pour les noms comme "Entreprise ABC" vs "ABC SARL")
    const words1 = clean1.split(/\s+/);
    const words2 = clean2.split(/\s+/);
    
    const commonWords = words1.filter(word => 
      word.length >= minLength && words2.some(word2 => word2.length >= minLength && word === word2)
    );
    
    if (commonWords.length > 0) {
      const wordScore = (commonWords.length / Math.max(words1.length, words2.length)) * 100;
      return wordScore >= 30; // Au moins 30% de mots communs
    }
    
    return false;
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

      // Récupérer les adresses et noms depuis la table autocompletion
      const { data: autocompletionData, error: autocompletionError } = await supabase
        .from('table_autocompletion')
        .select('site')
        .eq('entreprise_id', entreprise_id);

      if (autocompletionError) {
        console.error('Erreur lors de la récupération des adresses:', autocompletionError);
        return;
      }

      // Créer un mapping SIRET -> adresse et nom
      const addressMapping: {[key: string]: {adresse: string, nom: string}} = {};
      autocompletionData?.forEach(item => {
        if (item.site?.siret) {
          const siret = item.site.siret.replace(/\s/g, '');
          const adresse = item.site.pointsCollecte && item.site.pointsCollecte.length > 0 
            ? item.site.pointsCollecte[0].adresse 
            : item.site.adresseSiege || '';
          const nom = item.site.nom || '';
          
          if (siret && (adresse || nom)) {
            addressMapping[siret] = { adresse, nom };
          }
        }
      });

      setSiteAddresses(addressMapping);
      console.log('Informations des sites chargées:', Object.keys(addressMapping).length, 'sites');
    } catch (error) {
      console.error('Erreur lors de l\'enrichissement des sites:', error);
    }
  };

  // Fonctions pour gérer les filtres personnalisés
  const addCustomFilter = () => {
    if (newFilterText.trim()) {
      const newFilter = {
        id: Date.now().toString(),
        text: newFilterText.trim(),
        enabled: true
      };
      setCustomFilters([...customFilters, newFilter]);
      setNewFilterText('');
    }
  };

  const removeCustomFilter = (filterId: string) => {
    setCustomFilters(customFilters.filter(filter => filter.id !== filterId));
  };

  const toggleCustomFilter = (filterId: string) => {
    setCustomFilters(customFilters.map(filter => 
      filter.id === filterId ? { ...filter, enabled: !filter.enabled } : filter
    ));
  };

  // Fonction pour vérifier si un BSD correspond aux filtres personnalisés
  const matchesCustomFilters = (bsd: RowBSD): boolean => {
    if (customFilters.length === 0) return true;
    
    // Convertir le JSON BSD en texte pour la recherche
    const bsdText = JSON.stringify(bsd.infos_json).toLowerCase();
    
    // Vérifier que tous les filtres activés correspondent
    return customFilters
      .filter(filter => filter.enabled)
      .every(filter => bsdText.includes(filter.text.toLowerCase()));
  };

  // Réappliquer les filtres quand les paramètres changent
  useEffect(() => {
    // Vérifier que toutes les données nécessaires sont chargées ET que dataReady est true
    if (dataReady && bsdPdf && allBSDs.length > 0 && minDate && maxDate) {
      const pdfCodeCED = bsdPdf?.dechet?.code?.replace(/[\s*]/g, '') || '';
      const pdfDestinataireSiret = bsdPdf?.installationDestination?.siret?.replace(/\s/g, '') || '';
      const pdfTransporteurSiren = bsdPdf?.collecteurTransporteur?.siren?.replace(/\s/g, '') || '';
      
      // Récupérer les noms des sites du PDF
      let pdfSiteNames: string[] = [];
      if (pdfSiteName) {
        pdfSiteNames = [pdfSiteName];
      }
      
      console.log('Réapplication des filtres avec:', {
        bsdCount: allBSDs.length,
        siteAddressesCount: Object.keys(siteAddresses).length,
        pdfSiteName,
        filters: { codeCEDFilter, siretSirenFilter, dateFilter, tonnageFilter, addressFilter }
      });
      
      applyFilters(pdfCodeCED, pdfDestinataireSiret, pdfTransporteurSiren, minDate, maxDate, pdfSiteNames);
    } else {
      console.log('Conditions non remplies pour appliquer les filtres:', {
        dataReady,
        hasBsdPdf: !!bsdPdf,
        allBSDsLength: allBSDs.length,
        hasMinDate: !!minDate,
        hasMaxDate: !!maxDate,
        siteAddressesCount: Object.keys(siteAddresses).length
      });
    }
  }, [dataReady, customFilters, codeCEDFilter, siretSirenFilter, dateFilter, dateRange, tonnageFilter, tonnageRange, addressFilter, siteAddresses, pdfSiteName]);

  // Réinitialiser dataReady quand le modal s'ouvre
  useEffect(() => {
    if (isModalOpen) {
      setDataReady(false);
    }
  }, [isModalOpen]);

  return (
    <LinkBSDComponent 
    setIsModalOpen={setIsModalOpen}
    fetchBSDData={fetchBSDData}
    entreprise_id={entreprise_id}
    setError={setError}
    setLoading={setLoading}
    setselectedBsdId={setselectedBsdId}
      isModalOpen={isModalOpen}
      bsdPdf={bsdPdf}
      pdf_id={pdf_id}
      filteredCandidateBSDs={filteredCandidateBSDs}
      allBSDs={allBSDs}
      loading={loading}
      error={error}
      selectedBsdId={selectedBsdId}
      minDate={minDate}
      maxDate={maxDate}
      siteAddresses={siteAddresses}
      pdfSiteName={pdfSiteName}
      customFilters={customFilters}
      newFilterText={newFilterText}
      setNewFilterText={setNewFilterText}
      addCustomFilter={addCustomFilter}
      removeCustomFilter={removeCustomFilter}
      toggleCustomFilter={toggleCustomFilter}
      calculateSimilarity={calculateSimilarity}
      cleanDate={cleanDate}
      handleLink={handleLink}
      compareCompanyNames={compareCompanyNames}
      // Nouveaux paramètres pour les filtres individuels
      codeCEDFilter={codeCEDFilter}
      setCodeCEDFilter={setCodeCEDFilter}
      siretSirenFilter={siretSirenFilter}
      setSiretSirenFilter={setSiretSirenFilter}
      addressFilter={addressFilter}
      setAddressFilter={setAddressFilter}
      dateFilter={dateFilter}
      setDateFilter={setDateFilter}
      dateRange={dateRange}
      setDateRange={setDateRange}
      tonnageFilter={tonnageFilter}
      setTonnageFilter={setTonnageFilter}
      tonnageRange={tonnageRange}
      setTonnageRange={setTonnageRange}
      applyFilters={applyFilters}
    />
  );
}
