'use client';

import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { supabase } from '@/app/database/supabaseClient';
import { toast } from 'react-hot-toast';
import { useSession } from '@/app/component/SessionProvider';
import { BonCerfa } from './utils';
import { RowBSD } from '@/app/register/interface/BSD_Interface';
import { findMeta } from '@/app/auth/parameter/components/ClusterParams/utils';
import LinkBonComponent from './LinkBonComponent';


interface LinkBonProps {
  pdf_id: number;
  isOpen?: boolean;
  onClose?: () => void;
  onLink?: (bsd_id: string) => void;
  onCreate?: (bsd_id: string) => void;
}

interface BonInfos {
  numeroBon?: string;
  date?: string;
  dechet?: {
    nom?: string;
    codeCED?: string;
    tonnage?: number;
  };
  site?: {
    nom?: string;
    siret?: string;
  };
  prestataire?: {
    nom?: string;
    siret?: string;
  };
  site_raw?: string;
  presta_raw?: string;
}

function formatCED(ced: string): string {
  let code = ced.replace(/[\s*]/g, '');
  if (code.length === 6) {
    code = code.slice(0, 2) + " " + code.slice(2, 4) + " " + code.slice(4, 6);
  }
  return code;
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

function extractValidDates(infos: BonInfos): Date[] {
  const dates = [
    cleanDate(infos?.date)
  ];

  return dates.filter((date): date is Date => date !== null && !isNaN(date.getTime()));
}

export default function LinkBon({ pdf_id, onLink, onCreate }: LinkBonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBsdId, setSelectedBsdId] = useState<string>('');
  const [bonPdf, setBonPdf] = useState<BonCerfa | null>(null);
  const [candidateBSDs, setCandidateBSDs] = useState<RowBSD[]>([]);
  const [filteredCandidateBSDs, setFilteredCandidateBSDs] = useState<RowBSD[]>([]);
  const [allBSDs, setAllBSDs] = useState<RowBSD[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minDate, setMinDate] = useState<Date | null>(null);
  const [maxDate, setMaxDate] = useState<Date | null>(null);
  const [siteAddresses, setSiteAddresses] = useState<{[key: string]: {adresse: string, nom: string}}>({});
  const [pdfSiteName, setPdfSiteName] = useState<string>('');
  const [pdfPrestaName, setPdfPrestaName] = useState<string>('');
  const [perfectMatch, setPerfectMatch] = useState<RowBSD | null>(null);
  const [dataReady, setDataReady] = useState<boolean>(false);
  const { entreprise_id, user_id } = useSession();

  // Fonction pour comparer les IDs (numéro de bon vs numeroBon dans other_infos)
  const compareIds = (pdfNumeroBon: string, bsdNumeroBon: string): boolean => {
    if (!pdfNumeroBon || !bsdNumeroBon) return false;
    
    // Nettoyer les chaînes (supprimer espaces et caractères spéciaux)
    const cleanPdfId = pdfNumeroBon.replace(/[\s\-_]/g, '').toLowerCase();
    const cleanBsdId = bsdNumeroBon.replace(/[\s\-_]/g, '').toLowerCase();
    
    return cleanPdfId === cleanBsdId;
  };

  // Fonction pour comparer les noms des entreprises de manière floue
  const compareCompanyNames = (name1: string, name2: string, minLength: number = 4): boolean => {
    if (!name1 || !name2) return false;
    
    // Nettoyer les noms (minuscules, supprimer caractères spéciaux)
    const clean1 = name1.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const clean2 = name2.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    
    // Si les noms sont identiques, retourner true
    if (clean1 === clean2) return true;
    
    // Chercher la plus longue sous-chaîne commune
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

  // Fonction pour calculer la similarité entre deux chaînes
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

  // Fonction pour appliquer tous les filtres et trouver le perfect match
  // Utilise les SIRET enrichis via findMeta pour les comparaisons
  const applyAllFilters = (pdfCodeCED: string, pdfSiteSiret: string, pdfPrestaSiret: string, pdfDate: Date, pdfTonnage: number, pdfNumeroBon: string) => {
    console.log('applyAllFilters appelé avec:', {
      pdfCodeCED,
      pdfSiteSiret,
      pdfPrestaSiret,
      pdfDate,
      pdfTonnage,
      pdfNumeroBon,
      allBSDsLength: allBSDs.length
    });

    // Appliquer tous les filtres et calculer les scores
    const filteredResults = allBSDs.map(bsd => {
      // Récupérer les données du BSD
      const bsdCodeCED = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.code?.replace(/[\s*]/g, '') || '';
      const bsdSiteSiret = bsd.infos_json?.formAPI?.createFormInput?.emitter?.company?.siret?.replace(/\s/g, '') || '';
      const bsdPrestaSiret = bsd.infos_json?.formAPI?.createFormInput?.recipient?.company?.siret?.replace(/\s/g, '') || '';
      const bsdSiteName = bsd.infos_json?.formAPI?.createFormInput?.emitter?.company?.name || '';
      const bsdPrestaName = bsd.infos_json?.formAPI?.createFormInput?.recipient?.company?.name || '';
      const bsdCreatedDate = new Date(bsd.created_at);
      const bsdTonnage = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.quantity || 0;
      const bsdNumeroBon = bsd.other_infos?.numeroBon || '';
      const bsdWasteName = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.name || '';

      // Récupérer les données du PDF
      const pdfWasteName = bonPdf?.dechet?.nom || '';

      // Calculer les correspondances pour chaque critère
      const results = {
        bsd,
        // Filtre Code CED
        codeCEDMatch: pdfCodeCED && bsdCodeCED ? 
          bsdCodeCED.trim().replaceAll(' ', '').replace('*', '') === pdfCodeCED.trim().replaceAll(' ', '').replace('*', '') : false,
        
        // Filtre Site (SIRET strict - utilise les SIRET enrichis via findMeta)
        siteMatch: pdfSiteSiret && bsdSiteSiret ? 
          pdfSiteSiret === bsdSiteSiret : false,
        
        // Filtre Prestataire (SIRET strict - utilise les SIRET enrichis via findMeta)
        prestaMatch: pdfPrestaSiret && bsdPrestaSiret ? 
          pdfPrestaSiret === bsdPrestaSiret : false,
        
        // Filtre Date (±2 jours)
        dateMatch: pdfDate ? (() => {
          const diffDays = Math.abs((bsdCreatedDate.getTime() - pdfDate.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays <= 2;
        })() : false,
        
        // Filtre Tonnage (±50%)
        tonnageMatch: pdfTonnage > 0 && bsdTonnage > 0 ? (() => {
          const minTonnage = pdfTonnage * 0.5;
          const maxTonnage = pdfTonnage * 1.5;
          return bsdTonnage >= minTonnage && bsdTonnage <= maxTonnage;
        })() : false,

        // Filtre Nom du déchet (pas utilisé pour perfect match)
        wasteNameMatch: pdfWasteName && bsdWasteName ? 
          compareCompanyNames(pdfWasteName, bsdWasteName, 3) : false,
        
        // Filtre ID (numéro de bon)
        idMatch: compareIds(pdfNumeroBon, bsdNumeroBon),
        
        // Scores de similarité pour l'affichage
        siteNameSimilarity: calculateSimilarity(pdfSiteName, bsdSiteName),
        prestaNameSimilarity: calculateSimilarity(pdfPrestaName, bsdPrestaName),
        wasteNameSimilarity: calculateSimilarity(pdfWasteName, bsdWasteName)
      };

      // Vérifier si c'est un perfect match
      const isPerfectMatch = 
        results.codeCEDMatch &&
        results.siteMatch &&
        results.prestaMatch &&
        results.dateMatch &&
        results.tonnageMatch &&
        results.idMatch;

      return {
        ...results,
        isPerfectMatch
      };
    });

    // Trouver le perfect match
    const perfectMatchResult = filteredResults.find(result => result.isPerfectMatch);
    setPerfectMatch(perfectMatchResult ? perfectMatchResult.bsd : null);

    // Séparer les BSDs qui passent les filtres de ceux qui ne les passent pas
    const passingBSDs = filteredResults.filter(result => 
      result.codeCEDMatch || result.siteMatch || result.prestaMatch || result.dateMatch || result.tonnageMatch || result.wasteNameMatch || result.idMatch
    );

    console.log('Résultats du filtrage:', {
      total: allBSDs.length,
      passing: passingBSDs.length,
      perfectMatch: perfectMatchResult ? 'Trouvé' : 'Non trouvé'
    });

    // Mettre à jour les états
    setCandidateBSDs(passingBSDs.map(result => result.bsd));
    setFilteredCandidateBSDs(passingBSDs.map(result => result.bsd));

    return filteredResults;
  };

  const fetchBonData = async () => {
    try {
      setLoading(true);
      setError(null);
      setDataReady(false);

      // Fetch Bon PDF data
      const { data: pdfData, error: pdfError } = await supabase
        .from('bon_pdf')
        .select('infos')
        .eq('pdf_id', pdf_id)
        .eq('entreprise_id', entreprise_id)
        .single();

      if (pdfError) throw new Error('Erreur lors de la récupération du PDF');
      if (!pdfData) throw new Error('PDF non trouvé');

      setBonPdf(pdfData.infos);

      // Récupérer les mappings de l'entreprise pour traduire site_raw et presta_raw
      const { data: entrepriseData, error: entrepriseError } = await supabase
        .from('entreprise')
        .select('params_mapping_site, params_mapping_presta')
        .eq('id', entreprise_id)
        .single();

      if (entrepriseError) {
        console.warn('Erreur lors de la récupération des mappings entreprise:', entrepriseError);
      }

      // Traduire site_raw et presta_raw avec findMeta et récupérer les SIRET correspondants
      let translatedSiteName = pdfData.infos?.site?.nom || '';
      let translatedPrestaName = pdfData.infos?.prestataire?.nom || '';
      
      // Créer une copie des données pour les enrichir avec les SIRET de findMeta
      const enrichedInfos = { ...pdfData.infos };

      if (entrepriseData) {
        const siteMapping = entrepriseData.params_mapping_site || {};
        const prestaMapping = entrepriseData.params_mapping_presta || {};

        if (pdfData.infos?.site_raw) {
          const metaSite = findMeta(pdfData.infos.site_raw, siteMapping, 'site');
          if (metaSite && metaSite.nom) {
            translatedSiteName = metaSite.nom;
            setPdfSiteName(metaSite.nom);
            // Enrichir les données avec le SIRET trouvé par findMeta
            if (metaSite.siret) {
              enrichedInfos.site = {
                ...enrichedInfos.site,
                siret: metaSite.siret
              };
            }
            console.log('Site enrichi via findMeta:', { nom: metaSite.nom, siret: metaSite.siret });
          }
        }

        if (pdfData.infos?.presta_raw) {
          const metaPresta = findMeta(pdfData.infos.presta_raw, prestaMapping, 'presta');
          if (metaPresta && metaPresta.nom) {
            translatedPrestaName = metaPresta.nom;
            setPdfPrestaName(metaPresta.nom);
            // Enrichir les données avec le SIRET trouvé par findMeta
            if (metaPresta.siret) {
              enrichedInfos.prestataire = {
                ...enrichedInfos.prestataire,
                siret: metaPresta.siret
              };
            }
            console.log('Prestataire enrichi via findMeta:', { nom: metaPresta.nom, siret: metaPresta.siret });
          }
        }
      }

      // Mettre à jour bonPdf avec les données enrichies
      setBonPdf(enrichedInfos);

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
      const pdfCodeCED = pdfData.infos?.dechet?.codeCED?.replace(/[\s*]/g, '') || '';
      
      // Extraire les SIRET du PDF (enrichis via findMeta si disponibles)
      const pdfSiteSiret = pdfData.infos?.site?.siret?.replace(/\s/g, '') || '';
      const pdfPrestaSiret = pdfData.infos?.prestataire?.siret?.replace(/\s/g, '') || '';

      // Récupérer tous les BSDs dans une plage de dates large
      const startDate = new Date(minDateValue);
      startDate.setDate(minDateValue.getDate() - 30);
      const endDate = new Date(maxDateValue);
      endDate.setDate(maxDateValue.getDate() + 30);

      const { data: bsdData, error: bsdError } = await supabase
        .from('bsd')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .eq('entreprise_id', entreprise_id);

      if (bsdError) throw new Error('Erreur lors de la récupération des BSDs');

      // Mettre à jour allBSDs
      setAllBSDs(bsdData);

      // Enrichir les informations des sites
      await enrichSiteInfo(bsdData);
      
      // Marquer les données comme prêtes
      setDataReady(true);
      
      // Appliquer les filtres
      const pdfDate = validDates[0]; // Prendre la première date valide
      const pdfTonnage = pdfData.infos?.dechet?.tonnage || 0;
      const pdfNumeroBon = pdfData.infos?.numeroBon || '';
      
      applyAllFilters(pdfCodeCED, pdfSiteSiret, pdfPrestaSiret, pdfDate, pdfTonnage, pdfNumeroBon);
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

      // D'abord, récupérer l'ID du bon_pdf
      const { data: bonPdfData, error: bonPdfError } = await supabase
        .from('bon_pdf')
        .select('id')
        .eq('pdf_id', pdf_id)
        .eq('entreprise_id', entreprise_id)
        .single();

      if (bonPdfError) throw new Error('Erreur lors de la récupération du Bon PDF');
      if (!bonPdfData) throw new Error('Bon PDF non trouvé');

      // Mettre à jour le bon_pdf avec le linked_bsd_id
      const { error: updateBonPdfError } = await supabase
        .from('bon_pdf')
        .update({
          linked_bsd_id: selectedBsdId
        })
        .eq('id', bonPdfData.id)
        .eq('entreprise_id', entreprise_id);

      if (updateBonPdfError) throw new Error('Erreur lors de la mise à jour du Bon PDF');

      // Mettre à jour le lien du bon_pdf_extracted_linked dans la table bsd
      const { error: updateBsdError } = await supabase
        .from('bsd')
        .update({
          bon_extracted_then_linked_id: bonPdfData.id
        })
        .eq('id', selectedBsdId)
        .eq('entreprise_id', entreprise_id);

      if (updateBsdError) throw new Error('Erreur lors de la mise à jour du BSD');

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

      if (updateError) throw new Error('Erreur lors de la liaison du Bon');

      toast.success('Bon lié avec succès');
      setIsModalOpen(false);
      setSelectedBsdId('');

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

     const handleCreateBSD = async () => {
     if (!bonPdf) {
       toast.error('Données du bon non disponibles');
       return;
     }

     try {
       setLoading(true);
       setError(null);

               // Récupérer les mappings de l'entreprise pour utiliser findMeta
        const { data: entrepriseData, error: entrepriseError } = await supabase
          .from('entreprise')
          .select('params_mapping_site, params_mapping_presta')
          .eq('id', entreprise_id)
          .single();

        if (entrepriseError) {
          console.warn('Erreur lors de la récupération des mappings entreprise:', entrepriseError);
        }

        // Utiliser findMeta pour récupérer les données traduites
        const siteMapping = entrepriseData?.params_mapping_site || {};
        const prestaMapping = entrepriseData?.params_mapping_presta || {};

               // Récupérer l'ID du bon_pdf depuis la base de données
       const { data: bonPdfData, error: bonPdfError } = await supabase
         .from('bon_pdf')
         .select('id')
         .eq('pdf_id', pdf_id)
         .eq('entreprise_id', entreprise_id)
         .single();

       if (bonPdfError) {
         console.error('Erreur lors de la récupération de l\'ID du bon_pdf:', bonPdfError);
         throw new Error('Erreur lors de la récupération de l\'ID du bon_pdf');
       }

                       // Récupérer les données traduites via findMeta
        const siteMeta = bonPdf.site_raw ? findMeta(bonPdf.site_raw, siteMapping, 'site') : null;
        const prestaMeta = bonPdf.presta_raw ? findMeta(bonPdf.presta_raw, prestaMapping, 'presta') : null;
        
        // Utiliser les SIRET enrichis du bonPdf (déjà mis à jour par findMeta dans fetchBonData)
        const enrichedSiteSiret = bonPdf.site?.siret || '';
        const enrichedPrestaSiret = bonPdf.prestataire?.siret || '';
       
        // Récupérer les données d'autocomplétion pour déterminer le type de prestataire
        const { data: autocompletionData, error: autocompletionError } = await supabase
          .from('table_autocompletion')
          .select('destinataire, transporteur')
          .eq('entreprise_id', entreprise_id);

        if (autocompletionError) {
          console.warn('Erreur lors de la récupération des données d\'autocomplétion:', autocompletionError);
        }

        // Déterminer si le prestataire est un transporteur ou un destinataire
        let isTransporter = false;
        let isDestinataire = false;
        let transporterData = null;
        let destinataireData = null;

                 if (prestaMeta && autocompletionData) {
           const prestaSiret = prestaMeta.siret?.replace(/\s/g, '');
           const prestaNom = prestaMeta.nom?.toLowerCase().trim();
           
           console.log('Recherche prestataire:', { prestaSiret, prestaNom });
           
           // Chercher dans les transporteurs
           const foundTransporter = autocompletionData.find(item => {
             const itemSiret = item.transporteur?.siret?.replace(/\s/g, '');
             const itemNom = item.transporteur?.nomBoite?.toLowerCase().trim();
             
             console.log('Transporteur:', { itemSiret, itemNom });
             
             return itemSiret === prestaSiret || itemNom === prestaNom;
           });
           
           // Chercher dans les destinataires
           const foundDestinataire = autocompletionData.find(item => {
             const itemSiret = item.destinataire?.siret?.replace(/\s/g, '');
             const itemNom = item.destinataire?.nomBoite?.toLowerCase().trim();
             
             console.log('Destinataire:', { itemSiret, itemNom });
             
             return itemSiret === prestaSiret || itemNom === prestaNom;
           });

           // Priorité : si trouvé dans les deux, on privilégie le destinataire (plus courant pour les bons de livraison)
           if (foundTransporter && foundDestinataire) {
             console.log('Prestataire trouvé dans les deux catégories, priorité au destinataire');
             isDestinataire = true;
             destinataireData = foundDestinataire.destinataire;
             console.log('Destinataire prioritaire:', destinataireData);
           } else if (foundTransporter) {
             isTransporter = true;
             transporterData = foundTransporter.transporteur;
             console.log('Transporter trouvé:', transporterData);
           } else if (foundDestinataire) {
             isDestinataire = true;
             destinataireData = foundDestinataire.destinataire;
             console.log('Destinataire trouvé:', destinataireData);
           }

          console.log('Analyse du prestataire:', {
            prestaMeta,
            isTransporter,
            isDestinataire,
            transporterData,
            destinataireData
          });

          // Si le prestataire n'est trouvé ni dans les transporteurs ni dans les destinataires,
          // on le place par défaut dans les destinataires (plus courant pour les bons de livraison)
          if (!isTransporter && !isDestinataire && prestaMeta) {
            console.log('Prestataire non trouvé dans autocompletion, placement par défaut dans destinataire');
            isDestinataire = true;
          }
        }

        // Créer un nouveau BSD basé sur les données traduites par findMeta
        const newBsdData = {
          user_id: user_id,
          entreprise_id: entreprise_id,
          infos_json: {
            formAPI: {
              createFormInput: {
                                 emitter: {
                   company: {
                     name: siteMeta?.nom || pdfSiteName || bonPdf.site?.nom || '',
                     siret: enrichedSiteSiret || siteMeta?.siret || bonPdf.site?.siret || '',
                     address: bonPdf.site?.adresse || '',
                     country: "France",
                     contact: bonPdf.site?.contact || "",
                     phone: bonPdf.site?.tel || "",
                     mail: bonPdf.site?.email || ""
                   },
                  worksite: {
                    name: siteMeta?.nom || pdfSiteName || bonPdf.site?.nom || '',
                    address: bonPdf.site?.adresse || '',
                    city: "",
                    postalCode: "",
                    country: "France"
                  }
                },
                                                  transporter: {
                   company: {
                     name: isTransporter ? (transporterData?.nomBoite || prestaMeta?.nom || pdfPrestaName || bonPdf.prestataire?.nom || "") : "",
                     siret: isTransporter ? (enrichedPrestaSiret || transporterData?.siret || prestaMeta?.siret || bonPdf.prestataire?.siret || "") : "",
                     address: isTransporter ? (transporterData?.adresse || bonPdf.prestataire?.adresse || "") : "",
                     country: "",
                     contact: isTransporter ? (transporterData?.nomPrenom || bonPdf.prestataire?.contact || "") : "",
                     phone: isTransporter ? (transporterData?.telephone || bonPdf.prestataire?.tel || "") : "",
                     mail: isTransporter ? (transporterData?.email || bonPdf.prestataire?.email || "") : ""
                   }
                 },
                 recipient: {
                   company: {
                     name: isDestinataire ? (destinataireData?.nomBoite || prestaMeta?.nom || pdfPrestaName || bonPdf.prestataire?.nom || "") : "",
                     siret: isDestinataire ? (enrichedPrestaSiret || destinataireData?.siret || prestaMeta?.siret || bonPdf.prestataire?.siret || "") : "",
                     address: isDestinataire ? (destinataireData?.adresse || bonPdf.prestataire?.adresse || "") : "",
                     country: "",
                     contact: isDestinataire ? (destinataireData?.nomPrenom || bonPdf.prestataire?.contact || "") : "",
                     phone: isDestinataire ? (destinataireData?.telephone || bonPdf.prestataire?.tel || "") : "",
                     mail: isDestinataire ? (destinataireData?.email || bonPdf.prestataire?.email || "") : ""
                   },
                   processingOperation: bonPdf.dechet?.code_traitement || ""
                 },
                wasteDetails: {
                  code: formatCED(bonPdf.dechet?.codeCED) || "",
                  name: bonPdf.dechet?.nom || "",
                  quantity: Number(bonPdf.dechet?.tonnage) || 0,
                  quantityType: "REAL",
                  consistence: "SOLIDE",
                  isSubjectToADR: false,
                  onuCode: "",
                  packagingInfos: [{
                    type: "AUTRE",
                    quantity: 1
                  }]
                },
                takenOverAt: bonPdf.date || new Date().toISOString()
             }
           }
         },
         other_infos: {
           numeroBon: bonPdf.numeroBon || "",
           volume: "",
           volumeUnit: "",
           containerDescription: "",
           fillRate: "100"
         },
         created_at: bonPdf.date || new Date().toISOString(),
         created_on_fleap: true,
         on_track_dechets: false,
         facture_treated: false,
         pdf_ids: [pdf_id],
         source: null,
         // Informations de registre pour les bons PDF
         id_track_dechets: "Ligne de Bon PDF",
         status_track_dechets: "Ligne de Bon PDF",
         readable_id_track_dechets: null,
         bon_extracted_then_linked_id: bonPdfData.id
       };

       // Validation des données requises
       if (!user_id || !entreprise_id) {
         throw new Error('user_id ou entreprise_id manquant');
       }


               // Afficher le JSON avant envoi pour debug
        console.log('=== Type de prestataire détecté ===');
        console.log('isTransporter:', isTransporter);
        console.log('isDestinataire:', isDestinataire);
        console.log('=== JSON à envoyer à Supabase ===');
        console.log(JSON.stringify(newBsdData, null, 2));
        console.log('=== Fin du JSON ===');

              const { data: newBsd, error: createError } = await supabase
        .from('bsd')
        .insert(newBsdData)
        .select()
        .single();

       if (createError) {
         console.error('Erreur détaillée lors de la création du BSD:', createError);
         throw new Error(`Erreur lors de la création du BSD: ${createError.message}`);
       }

       // Mettre à jour le bon_pdf avec l'ID du BSD créé
       const { error: updateBonPdfError } = await supabase
         .from('bon_pdf')
         .update({
           linked_bsd_id: newBsd.id
         })
         .eq('pdf_id', pdf_id)
         .eq('entreprise_id', entreprise_id);

       if (updateBonPdfError) throw new Error('Erreur lors de la mise à jour du Bon PDF');

       // Mettre à jour le statut dans pdf_infos
       const { error: updateError } = await supabase
         .from('pdf_infos')
         .update({ 
           status: 'linked'
         })
         .eq('id', pdf_id)
         .eq('entreprise_id', entreprise_id);

       if (updateError) throw new Error('Erreur lors de la mise à jour du statut');

      toast.success('BSD créé avec succès');
      setIsModalOpen(false);

      // Appeler le callback onCreate pour informer le composant parent
      if (onCreate) {
        onCreate(newBsd.id);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour enrichir les informations des sites
  const enrichSiteInfo = async (bsds: RowBSD[]) => {
    try {
      // Extraire tous les SIRET uniques des émetteurs
      const sirets = bsds
        .map(bsd => bsd.infos_json?.formAPI?.createFormInput?.emitter?.company?.siret)
        .filter(siret => siret && siret.length >= 9)
        .map(siret => siret.replace(/\s/g, ''))
        .filter((siret, index, arr) => arr.indexOf(siret) === index);

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

  // Réappliquer les filtres quand les données changent
  useEffect(() => {
    if (dataReady && bonPdf && allBSDs.length > 0 && minDate && maxDate) {
      const pdfCodeCED = bonPdf?.dechet?.codeCED?.replace(/[\s*]/g, '') || '';
      const pdfSiteSiret = bonPdf?.site?.siret?.replace(/\s/g, '') || '';
      const pdfPrestaSiret = bonPdf?.prestataire?.siret?.replace(/\s/g, '') || '';
      const pdfDate = minDate; // Utiliser la date min comme référence
      const pdfTonnage = bonPdf?.dechet?.tonnage || 0;
      const pdfNumeroBon = bonPdf?.numeroBon || '';
      
      applyAllFilters(pdfCodeCED, pdfSiteSiret, pdfPrestaSiret, pdfDate, pdfTonnage, pdfNumeroBon);
    }
  }, [dataReady, bonPdf, allBSDs, minDate, maxDate]);

  // Réinitialiser dataReady quand le modal s'ouvre
  useEffect(() => {
    if (isModalOpen) {
      setDataReady(false);
    }
  }, [isModalOpen]);

  return (
    <LinkBonComponent 
      setIsModalOpen={setIsModalOpen}
      fetchBonData={fetchBonData}
      entreprise_id={entreprise_id}
      setError={setError}
      setLoading={setLoading}
      setSelectedBsdId={setSelectedBsdId}
      isModalOpen={isModalOpen}
      bonPdf={bonPdf}
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
      pdfPrestaName={pdfPrestaName}
      perfectMatch={perfectMatch}
      calculateSimilarity={calculateSimilarity}
      cleanDate={cleanDate}
      handleLink={handleLink}
      handleCreateBSD={handleCreateBSD}
      compareCompanyNames={compareCompanyNames}
    />
  );
}
