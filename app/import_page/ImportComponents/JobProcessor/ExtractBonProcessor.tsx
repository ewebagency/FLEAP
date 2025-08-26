import React, { useState, useEffect } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import { useSession } from '@/app/component/SessionProvider';
import { toast } from 'react-hot-toast';
import BoxIcon from '@/app/component/BoxIconWrapper';
import { useFilterContext } from '@/app/FilterContext';
import { 
    enrichExtractedData, 
    fetchAutocompletionData, 
    saveBonData, 
    updatePdfStatus,
    BonCerfa 
} from '../ExtractBon/utils';

interface ProcessingParams {
    documentType: string;
    status: string;
    limit: number;
    provider?: string;
    site?: string;
}

interface ProcessingResult {
    totalProcessed: number;
    perfectExtracts: number;
    successfulExtracts: number;
    failedExtracts: number;
    details: Array<{
        pdfId: number;
        pdfName: string;
        success: boolean;
        perfectExtract: boolean;
        error?: string;
    }>;
}

const ExtractBonProcessor: React.FC = () => {
    const { entreprise_id, user_id } = useSession();
    const { sites: filteredSites } = useFilterContext();
    const [isProcessing, setIsProcessing] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
    
    // Paramètres de traitement
    const [params, setParams] = useState<ProcessingParams>({
        documentType: 'bon',
        status: 'unread',
        limit: 10,
        provider: '',
        site: ''
    });

    // Options pour les filtres
    const documentTypes = [
        { value: 'bon', label: 'Bons de livraison' },
        { value: 'bsd', label: 'BSD' },
        { value: 'facture', label: 'Factures' }
    ];

    const statusOptions = [
        { value: 'unread', label: 'Non lu' },
        { value: 'read', label: 'Lu' },
        { value: 'extracted', label: 'Extrait' },
        { value: 'linked', label: 'Lié' },
        { value: 'splitted', label: 'Splitted' },
        { value: 'splitted_extracted', label: 'Splitted Extrait' }
    ];

    // Récupérer les providers et sites disponibles
    const [providers, setProviders] = useState<Array<{id: string, name: string}>>([]);
    const [availableSites, setAvailableSites] = useState<Array<{id: string, name: string}>>([]);

    useEffect(() => {
        if (entreprise_id) {
            fetchProvidersAndSites();
        }
    }, [entreprise_id]);

    const fetchProvidersAndSites = async () => {
        try {
            // Récupérer les providers depuis la table table_autocompletion
            const { data: providerData } = await supabase
                .from('table_autocompletion')
                .select('transporteur, destinataire')
                .eq('entreprise_id', entreprise_id);

            const uniqueProviders = new Set<string>();
            providerData?.forEach(record => {
                if (record.transporteur?.nomBoite) {
                    uniqueProviders.add(record.transporteur.nomBoite);
                }
                if (record.destinataire?.nomBoite) {
                    uniqueProviders.add(record.destinataire.nomBoite);
                }
            });

            setProviders(Array.from(uniqueProviders).map(name => ({ id: name, name })));

            // Utiliser les sites du contexte de filtre
            setAvailableSites(filteredSites.map(site => ({ 
                id: site.orgId, 
                name: site.name 
            })));
        } catch (error) {
            console.error('Erreur lors de la récupération des providers et sites:', error);
        }
    };

    const fetchDocumentsToProcess = async (): Promise<Array<{
        id: number;
        name_pdf: string;
        name_pdf_in_bucket: string;
        status: string;
        document_type?: string;
        created_at: string;
        entreprise_id: string;
        user_id: string;
    }>> => {
        const query = supabase
            .from('pdf_infos')
            .select('*')
            .eq('entreprise_id', entreprise_id)
            .eq('document_type', params.documentType)
            .eq('status', params.status)
            .order('created_at', { ascending: false })
            .limit(params.limit);

        // Filtres optionnels
        if (params.provider) {
            // Filtrer par provider (à adapter selon la structure de vos données)
            // query = query.contains('provider', { nom: params.provider });
        }

        if (params.site) {
            // Filtrer par site (à adapter selon la structure de vos données)
            // query = query.contains('site_siret_plus', [params.site]);
        }

        const { data, error } = await query;

        if (error) {
            throw new Error(`Erreur lors de la récupération des documents: ${error.message}`);
        }

        return data || [];
    };

    // Fonction pour récupérer les données connues (identique à OCRThisBon)
    const fetchKnownData = async (entreprise_id: string) => {
        const { data, error } = await supabase
            .from('table_autocompletion')
            .select('*')
            .eq('entreprise_id', entreprise_id);

        if (error) {
            throw new Error(`Erreur lors de la récupération des données: ${error.message}`);
        }

        const sites: Array<{
            id: number;
            nom: string;
            siret: string;
            adresse: string;
            contact: string;
            telephone: string;
            email: string;
        }> = [];
        const prestataires: Array<{
            id: number;
            nomBoite: string;
            nomPrenom: string;
            adresse: string;
            siret: string;
            email: string;
            telephone: string;
            transporteur_ou_destinataire: string;
        }> = [];
        const dechets: Array<{
            nom: string;
            codeCED: string;
        }> = [];

        data?.forEach(record => {
            // Sites
            if (record.site) {
                sites.push({
                    id: record.id || 0,
                    nom: record.site.nom || '',
                    siret: record.site.siret || '',
                    adresse: record.site.pointsCollecte?.[0]?.adresse || '',
                    contact: record.site.contacts?.[0]?.nom || '',
                    telephone: record.site.contacts?.[0]?.telephone || '',
                    email: record.site.contacts?.[0]?.email || ''
                });
            }

            // Transporteurs
            if (record.transporteur) {
                prestataires.push({
                    id: record.id || 0,
                    nomBoite: record.transporteur.nomBoite || '',
                    nomPrenom: record.transporteur.nomPrenom || '',
                    adresse: record.transporteur.adresse || '',
                    siret: record.transporteur.siret || '',
                    email: record.transporteur.email || '',
                    telephone: record.transporteur.telephone || '',
                    transporteur_ou_destinataire: 'transporteur'
                });
            }

            // Destinataires
            if (record.destinataire) {
                prestataires.push({
                    id: record.id || 0,
                    nomBoite: record.destinataire.nomBoite || '',
                    nomPrenom: record.destinataire.nomPrenom || '',
                    adresse: record.destinataire.adresse || '',
                    siret: record.destinataire.siret || '',
                    email: record.destinataire.email || '',
                    telephone: record.destinataire.telephone || '',
                    transporteur_ou_destinataire: 'destinataire'
                });
            }

            // Déchets
            if (record.dechet) {
                dechets.push({
                    nom: record.dechet.nom || '',
                    codeCED: record.dechet.codeCED || ''
                });
            }
        });

        return {
            sites,
            prestataires,
            dechets
        };
    };

    const processDocument = async (pdfInfo: {
        id: number;
        name_pdf: string;
        name_pdf_in_bucket: string;
        status: string;
        document_type?: string;
        created_at: string;
        entreprise_id: string;
        user_id: string;
    }): Promise<{success: boolean, perfectExtract: boolean, error?: string}> => {
        try {
            if (!entreprise_id) {
                throw new Error('ID entreprise non disponible');
            }

            // Récupérer les données connues (comme dans OCRThisBon)
            const known_data = await fetchKnownData(entreprise_id);

            if (!known_data) {
                throw new Error('Données d\'enrichissement non disponibles');
            }

            // Obtenir l'URL signée du PDF
            const { data: signedUrlData } = await supabase.storage
                .from('pdfs_bucket')
                .createSignedUrl(pdfInfo.name_pdf_in_bucket, 3600);

            if (!signedUrlData?.signedUrl) {
                throw new Error('Impossible d\'obtenir l\'URL du PDF');
            }

            // Télécharger le PDF
            const pdfResponse = await fetch(signedUrlData.signedUrl);
            if (!pdfResponse.ok) {
                throw new Error('Impossible de télécharger le PDF');
            }

            const pdfBlob = await pdfResponse.blob();
            const pdfFile = new File([pdfBlob], 'document.pdf', { type: 'application/pdf' });

            // Préparer les données pour l'API
            const formData = new FormData();
            formData.append('file', pdfFile);
            formData.append('known_data', JSON.stringify(known_data));
            
            // Ajouter le statut du PDF
            formData.append('pdf_status', pdfInfo.status);

            // Appel à l'API OCR-enrich-bon
            const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_PYTHON}/ocr-enrich-bon`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erreur lors du traitement OCR');
            }

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            // Extraire les données JSON de la réponse Gemini
            const extractedDataRaw = data.extracted_data;
            const perfect_extract = data.perfect_extract;
            
            // Si le statut est 'splitted' ou 'splitted_extracted', récupérer et préserver les données existantes
            let existingData = null;
            if (pdfInfo.status === 'splitted' || pdfInfo.status === 'splitted_extracted') {
                try {
                    const { data: existingDataResult } = await supabase
                        .from('bon_pdf')
                        .select('infos')
                        .eq('pdf_id', pdfInfo.id)
                        .single();
                    
                    if (existingDataResult?.infos) {
                        existingData = existingDataResult.infos as Partial<BonCerfa>;
                        console.log('🔍 Données existantes récupérées pour préservation:', existingData);
                    }
                } catch (error) {
                    console.warn('Erreur lors de la récupération des données existantes:', error);
                }
            }
            
            // Parse the extracted data if it's a string
            let extractedData;
            if (typeof extractedDataRaw === 'string') {
                try {
                    extractedData = JSON.parse(extractedDataRaw);
                    console.log('Parsed extracted data:', extractedData);
                } catch (error) {
                    console.error('Error parsing extracted data:', error);
                    extractedData = {};
                }
            } else {
                extractedData = extractedDataRaw;
            }

            // Fonction pour convertir le format de date DD/MM/YY vers YYYY-MM-DD (comme dans OCRThisBon)
            const convertDateToISO = (dateStr: string): string => {
                if (!dateStr) return '';
                
                // Format attendu: DD/MM/YY ou DD/MM/YYYY
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                    const day = parts[0].padStart(2, '0');
                    const month = parts[1].padStart(2, '0');
                    let year = parts[2];
                    
                    // Si l'année est sur 2 chiffres, ajouter 20
                    if (year.length === 2) {
                        year = '20' + year;
                    }
                    
                    return `${year}-${month}-${day}`;
                }
                return dateStr;
            };

            // Transform extracted data to BonCerfa format (exactement comme dans OCRThisBon)
            /*console.log('Mapping extracted data to BonCerfa format...');
            console.log('extractedData.num_bon:', extractedData.num_bon);
            console.log('extractedData.date:', extractedData.date);
            console.log('extractedData.nom_dechet:', extractedData.nom_dechet);
            console.log('extractedData.code_ced:', extractedData.code_ced);
            console.log('extractedData.poids_net:', extractedData.poids_net);
            console.log('extractedData.code_traitement:', extractedData.code_traitement);
            console.log('extractedData.nom_site:', extractedData.nom_site);
            console.log('extractedData.nom_prestataire:', extractedData.nom_prestataire);*/

            const bonCerfaData: Partial<BonCerfa> = {
                numeroBon: extractedData.num_bon || '',
                date: convertDateToISO(extractedData.date || ''),
                dechet: {
                    nom: extractedData.nom_dechet || '',
                    codeCED: extractedData.code_ced || '',
                    tonnage: extractedData.poids_net ? parseFloat(extractedData.poids_net) : 0,
                    code_traitement: extractedData.code_traitement || ''
                },
                site: {
                    nom: existingData?.site?.nom || extractedData.nom_site || '',
                    siret: existingData?.site?.siret || '',
                    adresse: existingData?.site?.adresse || '',
                    contact: existingData?.site?.contact || '',
                    tel: existingData?.site?.tel || '',
                    email: existingData?.site?.email || ''
                },
                prestataire: {
                    nom: existingData?.prestataire?.nom || extractedData.nom_prestataire || '',
                    siret: existingData?.prestataire?.siret || '',
                    adresse: existingData?.prestataire?.adresse || '',
                    contact: existingData?.prestataire?.contact || '',
                    tel: existingData?.prestataire?.tel || '',
                    email: existingData?.prestataire?.email || ''
                },
                site_raw: existingData?.site_raw || extractedData.nom_site || '',
                presta_raw: existingData?.presta_raw || extractedData.nom_prestataire || ''
            };

            console.log('Transformed BonCerfa data:', bonCerfaData);

            // Enrichir les données avec les informations de known_data (version simplifiée)
            const enrichedData = { ...bonCerfaData };

            // Enrichir le site si une correspondance est trouvée
            if (enrichedData.site?.nom && known_data.sites.length > 0) {
                const matchingSite = known_data.sites.find(site => 
                    site.nom.toLowerCase() === enrichedData.site!.nom.toLowerCase()
                );
                
                if (matchingSite) {
                    enrichedData.site = {
                        nom: matchingSite.nom,
                        siret: matchingSite.siret,
                        adresse: matchingSite.adresse,
                        contact: matchingSite.contact,
                        tel: matchingSite.telephone,
                        email: matchingSite.email
                    };
                    console.log('Site enrichi avec données BDD:', matchingSite);
                }
            }

            // Enrichir le prestataire si une correspondance est trouvée
            if (enrichedData.prestataire?.nom && known_data.prestataires.length > 0) {
                const matchingPrestataire = known_data.prestataires.find(prest => 
                    prest.nomBoite.toLowerCase() === enrichedData.prestataire!.nom.toLowerCase()
                );
                
                if (matchingPrestataire) {
                    enrichedData.prestataire = {
                        nom: matchingPrestataire.nomBoite,
                        siret: matchingPrestataire.siret,
                        adresse: matchingPrestataire.adresse,
                        contact: matchingPrestataire.nomPrenom,
                        tel: matchingPrestataire.telephone,
                        email: matchingPrestataire.email
                    };
                    console.log('Prestataire enrichi avec données BDD:', matchingPrestataire);
                }
            }

            // Sauvegarder les données enrichies dans la table bon_pdf (comme dans ExtractBon.tsx)
            const saveResult = await saveBonData(pdfInfo.id, entreprise_id, user_id || '', enrichedData, perfect_extract, pdfInfo.status);
            
            if (!saveResult.success) {
                throw new Error(saveResult.error || 'Erreur lors de la sauvegarde');
            }

            // Mettre à jour le statut du PDF
            let newStatus = 'extracted';
            
            // Si le statut initial est 'splitted', vérifier les conditions pour passer à 'splitted_extracted'
            if (pdfInfo.status === 'splitted') {
                // Vérifier qu'il y a une date ET un tonnage
                const hasDate = enrichedData.date && enrichedData.date.trim() !== '';
                const hasTonnage = enrichedData.dechet?.tonnage && enrichedData.dechet.tonnage > 0;
                
                if (hasDate && hasTonnage) {
                    newStatus = 'splitted_extracted';
                    console.log('✅ Conditions remplies : date et tonnage présents → passage à splitted_extracted');
                } else {
                    newStatus = 'splitted'; // Garder le statut splitted si conditions non remplies
                    console.log('⚠️ Conditions non remplies :', { hasDate, hasTonnage, date: enrichedData.date, tonnage: enrichedData.dechet?.tonnage });
                }
            }
            
            const updateResult = await updatePdfStatus(pdfInfo.id, newStatus, enrichedData, entreprise_id);
            
            if (!updateResult.success) {
                console.warn(`Erreur lors de la mise à jour du statut: ${updateResult.error}`);
            }

            return {
                success: true,
                perfectExtract: perfect_extract || false
            };

        } catch (error) {
            return {
                success: false,
                perfectExtract: false,
                error: error instanceof Error ? error.message : 'Erreur inconnue'
            };
        }
    };

    const startProcessing = async () => {
        setIsProcessing(true);
        setProcessingResult(null);

        try {
            const documents = await fetchDocumentsToProcess();
            
            if (documents.length === 0) {
                toast('Aucun document à traiter avec les critères sélectionnés', {
                    icon: 'ℹ️',
                    duration: 6000
                });
                setIsProcessing(false);
                return;
            }

            toast(`Début du traitement de ${documents.length} documents...`, {
                icon: '🚀',
                duration: 6000
            });

            const results: ProcessingResult = {
                totalProcessed: documents.length,
                perfectExtracts: 0,
                successfulExtracts: 0,
                failedExtracts: 0,
                details: []
            };

            // Traiter chaque document
            for (let i = 0; i < documents.length; i++) {
                const doc = documents[i];
                toast(`Traitement ${i + 1}/${documents.length}: ${doc.name_pdf}`, {
                    icon: '📄',
                    duration: 6000
                });

                const result = await processDocument(doc);
                
                results.details.push({
                    pdfId: doc.id,
                    pdfName: doc.name_pdf,
                    success: result.success,
                    perfectExtract: result.perfectExtract,
                    error: result.error
                });

                if (result.success) {
                    results.successfulExtracts++;
                    if (result.perfectExtract) {
                        results.perfectExtracts++;
                    }
                } else {
                    results.failedExtracts++;
                }

                // Petite pause entre les traitements pour éviter la surcharge
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            setProcessingResult(results);
            
            // Afficher le résumé
            const message = `Traitement terminé ! ${results.successfulExtracts}/${results.totalProcessed} documents traités avec succès. ${results.perfectExtracts} extractions parfaites.`;
            toast.success(message, {
                duration: 10000
            });

        } catch (error) {
            console.error('Erreur lors du traitement:', error);
            toast.error(`Erreur lors du traitement: ${error instanceof Error ? error.message : 'Erreur inconnue'}`, {
                duration: 10000
            });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="w-full">
            {/* Bouton principal */}
            <button
                onClick={() => setShowModal(true)}
                disabled={isProcessing}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
                <BoxIcon name="cog" color="white" type="solid" />
                Traitement en lot
                {isProcessing && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
            </button>

            {/* Modal de configuration */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">Configuration du traitement en lot</h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <BoxIcon name="x" color="gray" type="solid" />
                            </button>
                        </div>

                        {/* Formulaire de configuration */}
                        <div className="space-y-4">
                            {/* Type de document */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Type de document
                                </label>
                                <select
                                    value={params.documentType}
                                    onChange={(e) => setParams(prev => ({ ...prev, documentType: e.target.value }))}
                                    className="w-full p-2 border border-gray-300 rounded-md"
                                >
                                    {documentTypes.map(type => (
                                        <option key={type.value} value={type.value}>
                                            {type.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Statut */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Statut
                                </label>
                                <select
                                    value={params.status}
                                    onChange={(e) => setParams(prev => ({ ...prev, status: e.target.value }))}
                                    className="w-full p-2 border border-gray-300 rounded-md"
                                >
                                    {statusOptions.map(status => (
                                        <option key={status.value} value={status.value}>
                                            {status.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Limite */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Nombre maximum de documents (plus récents en premier)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={params.limit}
                                    onChange={(e) => setParams(prev => ({ ...prev, limit: parseInt(e.target.value) || 1 }))}
                                    className="w-full p-2 border border-gray-300 rounded-md"
                                />
                            </div>

                            {/* Provider (optionnel) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Provider (optionnel)
                                </label>
                                <select
                                    value={params.provider}
                                    onChange={(e) => setParams(prev => ({ ...prev, provider: e.target.value }))}
                                    className="w-full p-2 border border-gray-300 rounded-md"
                                >
                                    <option value="">Tous les providers</option>
                                    {providers.map(provider => (
                                        <option key={provider.id} value={provider.id}>
                                            {provider.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Site (optionnel) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Site (optionnel)
                                </label>
                                <select
                                    value={params.site}
                                    onChange={(e) => setParams(prev => ({ ...prev, site: e.target.value }))}
                                    className="w-full p-2 border border-gray-300 rounded-md"
                                >
                                    <option value="">Tous les sites</option>
                                    {availableSites.map(site => (
                                        <option key={site.id} value={site.id}>
                                            {site.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Résumé des paramètres */}
                        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                            <h3 className="font-medium text-gray-700 mb-2">Résumé des paramètres :</h3>
                            <ul className="text-sm text-gray-600 space-y-1">
                                <li>• Type : {documentTypes.find(t => t.value === params.documentType)?.label}</li>
                                <li>• Statut : {statusOptions.find(s => s.value === params.status)?.label}</li>
                                <li>• Limite : {params.limit} documents</li>
                                {params.provider && <li>• Provider : {params.provider}</li>}
                                {params.site && <li>• Site : {availableSites.find(s => s.id === params.site)?.name}</li>}
                            </ul>
                        </div>

                        {/* Boutons d'action */}
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={() => {
                                    setShowModal(false);
                                    startProcessing();
                                }}
                                disabled={isProcessing}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                            >
                                {isProcessing ? 'Traitement en cours...' : 'Lancer le traitement'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de résultats */}
            {processingResult && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">Résultats du traitement</h2>
                            <button
                                onClick={() => setProcessingResult(null)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <BoxIcon name="x" color="gray" type="solid" />
                            </button>
                        </div>

                        {/* Résumé statistiques */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-blue-50 p-4 rounded-lg text-center">
                                <div className="text-2xl font-bold text-blue-600">{processingResult.totalProcessed}</div>
                                <div className="text-sm text-blue-600">Total traité</div>
                            </div>
                            <div className="bg-green-50 p-4 rounded-lg text-center">
                                <div className="text-2xl font-bold text-green-600">{processingResult.successfulExtracts}</div>
                                <div className="text-sm text-green-600">Succès</div>
                            </div>
                            <div className="bg-yellow-50 p-4 rounded-lg text-center">
                                <div className="text-2xl font-bold text-yellow-600">{processingResult.perfectExtracts}</div>
                                <div className="text-sm text-yellow-600">Extractions parfaites</div>
                            </div>
                            <div className="bg-red-50 p-4 rounded-lg text-center">
                                <div className="text-2xl font-bold text-red-600">{processingResult.failedExtracts}</div>
                                <div className="text-sm text-red-600">Échecs</div>
                            </div>
                        </div>

                        {/* Détails des traitements */}
                        <div className="space-y-2">
                            <h3 className="font-medium text-gray-700">Détails par document :</h3>
                            <div className="max-h-96 overflow-y-auto">
                                {processingResult.details.map((detail, index) => (
                                    <div
                                        key={index}
                                        className={`p-3 rounded-lg border ${
                                            detail.success
                                                ? detail.perfectExtract
                                                    ? 'bg-green-50 border-green-200'
                                                    : 'bg-blue-50 border-blue-200'
                                                : 'bg-red-50 border-red-200'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <div className="font-medium text-sm">{detail.pdfName}</div>
                                                {detail.error && (
                                                    <div className="text-xs text-red-600 mt-1">{detail.error}</div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {detail.success && (
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                        detail.perfectExtract
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-blue-100 text-blue-800'
                                                    }`}>
                                                        {detail.perfectExtract ? 'Parfait' : 'Succès'}
                                                    </span>
                                                )}
                                                {!detail.success && (
                                                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                        Échec
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end mt-6">
                            <button
                                onClick={() => setProcessingResult(null)}
                                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExtractBonProcessor;
