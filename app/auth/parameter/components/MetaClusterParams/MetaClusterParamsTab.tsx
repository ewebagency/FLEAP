"use client";

import React, { useState, useCallback } from 'react';
import { useSession } from '@/app/component/SessionProvider';
import { toast } from 'react-hot-toast';
import { supabase } from '@/app/database/supabaseClient';
import { MAPPING_CONFIGS, MappingTypeConfig, Mapping } from './mappingConfig';
import { useMappingData } from './useMappingData';
import MappingSection from './MappingSection';
import { verifierEtMettreAJourAlerte } from '@/app/import_page/ImportComponents/ExtractMetaDoc/utils/alerte';
import { RAW_FIELD_CLASS, REFERENCE_ENTITY_CLASS } from './fieldStyles';

export default function MetaClusterParamsTab() {
    const { entreprise_id } = useSession();
    const { rawValues, metaValues, mappings, isLoading, error, saveMapping } = useMappingData(entreprise_id || undefined);
    
    // État global pour les modifications
    const [localMappings, setLocalMappings] = useState<Record<string, Mapping>>({});
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [updatingAlertes, setUpdatingAlertes] = useState(false);

    // Initialiser les mappings locaux avec les mappings existants
    React.useEffect(() => {
        if (mappings && Object.keys(mappings).length > 0) {
            setLocalMappings(mappings);
        }
    }, [mappings]);

    // Gérer les modifications locales d'un mapping
    const handleMappingChange = useCallback((config: MappingTypeConfig, newMapping: Mapping) => {
        setLocalMappings(prev => ({
            ...prev,
            [config.key]: newMapping
        }));
        setHasUnsavedChanges(true);
    }, []);

    // Sauvegarder toutes les modifications
    const handleSaveAll = useCallback(async () => {
        if (!hasUnsavedChanges) return;

        setIsSaving(true);
        try {
            // Sauvegarder tous les mappings modifiés
            const savePromises = Object.entries(localMappings).map(([key, mapping]) => {
                const config = MAPPING_CONFIGS.find(c => c.key === key);
                if (config) {
                    return saveMapping(config, mapping);
                }
                return Promise.resolve();
            });

            await Promise.all(savePromises);
            setHasUnsavedChanges(false);
            toast.success('Tous les mappings ont été sauvegardés avec succès');

            // Mettre à jour les alertes sur tous les PDFs après la sauvegarde
            if (entreprise_id) {
                setUpdatingAlertes(true);
                toast.loading('Mise à jour des alertes sur tous les PDFs...', { duration: 0 });
                
                try {
                    // Récupérer tous les PDFs de l'entreprise
                    const { data: pdfs, error: pdfError } = await supabase
                        .from('pdf_infos')
                        .select('id')
                        .eq('entreprise_id', entreprise_id);

                    if (pdfError) {
                        throw new Error(`Erreur lors de la récupération des PDFs: ${pdfError.message}`);
                    }

                    if (pdfs && pdfs.length > 0) {
                        let successCount = 0;
                        let errorCount = 0;

                        // Traiter chaque PDF individuellement
                        for (const pdf of pdfs) {
                            try {
                                await verifierEtMettreAJourAlerte(pdf.id, entreprise_id);
                                successCount++;
                            } catch (error) {
                                console.error(`Erreur lors de la vérification du PDF ${pdf.id}:`, error);
                                errorCount++;
                            }
                        }

                        toast.dismiss();
                        if (errorCount === 0) {
                            toast.success(`Alertes mises à jour avec succès sur ${successCount} PDFs`);
                        } else {
                            toast.error(`Mise à jour terminée : ${successCount} succès, ${errorCount} erreurs`);
                        }
                    } else {
                        toast.dismiss();
                        toast.success('Aucun PDF à traiter');
                    }
                } catch (error) {
                    toast.dismiss();
                    console.error('Erreur lors de la mise à jour des alertes:', error);
                    toast.error('Erreur lors de la mise à jour des alertes');
                } finally {
                    setUpdatingAlertes(false);
                }
            }
        } catch (err) {
            console.error('Erreur lors de la sauvegarde:', err);
            toast.error('Erreur lors de la sauvegarde des mappings');
        } finally {
            setIsSaving(false);
        }
    }, [hasUnsavedChanges, localMappings, saveMapping, entreprise_id]);

    // Ouvrir le PDF dans une nouvelle fenêtre
    const handleOpenPdf = async (rawValue: { nom: string; pdfId: string; pdf_id: string }) => {
        try {
            // Récupérer les informations du PDF depuis pdf_infos
            const { data: pdfInfo, error: pdfError } = await supabase
                .from('pdf_infos')
                .select('name_pdf_in_bucket')
                .eq('id', rawValue.pdf_id)
                .eq('entreprise_id', entreprise_id)
                .single();

            if (pdfError) {
                console.error('Erreur lors de la récupération des infos PDF:', pdfError);
                toast.error('Impossible de récupérer les informations du PDF');
                return;
            }

            if (!pdfInfo?.name_pdf_in_bucket) {
                toast.error('Nom du fichier PDF non trouvé');
                return;
            }

            // Créer l'URL signée
            const { data: urlData, error: urlError } = await supabase
                .storage
                .from('pdfs_bucket')
                .createSignedUrl(pdfInfo.name_pdf_in_bucket, 3600);

            if (urlError || !urlData?.signedUrl) {
                console.error('Erreur lors de la création de l\'URL:', urlError);
                toast.error('Impossible d\'ouvrir le fichier');
                return;
            }

            // Ouvrir le PDF dans une nouvelle fenêtre
            window.open(urlData.signedUrl, '_blank');
        } catch (err) {
            console.error('Erreur lors de l\'ouverture du PDF:', err);
            toast.error('Erreur lors de l\'ouverture du PDF');
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="text-lg text-gray-600">Chargement des données de mapping...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 w-[90%]">
                    <div className="text-red-800 text-center">
                        <h3 className="text-lg font-semibold mb-2">Erreur de chargement</h3>
                        <p>{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex justify-center">
            <div className="bg-white rounded-lg shadow-lg p-4 w-[95%]">
                {/* Bouton Enregistrer fixe en haut */}
                {hasUnsavedChanges && (
                    <div className="sticky top-0 z-50 bg-white border-b border-gray-200 py-4 mb-6 -mx-8 px-8 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 text-orange-600 text-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                    </svg>
                                    Modifications non sauvegardées
                                </div>
                            </div>
                            
                            <button
                                onClick={handleSaveAll}
                                disabled={isSaving || updatingAlertes}
                                className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-6 py-3 rounded-md transition-all duration-200 flex items-center gap-3 text-lg font-medium shadow-lg"
                            >
                                {isSaving ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Enregistrement...
                                    </>
                                ) : updatingAlertes ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Mise à jour des alertes...
                                    </>
                                ) : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                        </svg>
                                        Enregistrer toutes les modifications
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

				<h2 className="text-2xl font-bold text-gray-800 mb-6">Associer les données brutes aux entités de référence</h2>
				<div className="mb-6 px-10">
					<div className="flex items-center justify-center gap-3 text-sm select-none">
						<span className={`px-2 py-1 rounded ${RAW_FIELD_CLASS}`}>Champs bruts PDF</span>
						<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
							<path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 11-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
						</svg>
						<span className={`px-2 py-1 rounded ${REFERENCE_ENTITY_CLASS}`}>Entités de référence</span>
					</div>
				</div>
                
                {/* Sections de mapping pour chaque type */}
                {MAPPING_CONFIGS.map((config) => (
                    <MappingSection
                        key={config.key}
                        config={config}
                        rawValues={rawValues[config.key] || []}
                        metaValues={metaValues[config.key] || []}
                        mappings={localMappings[config.key] || {}}
                        onMappingChange={handleMappingChange}
                        onOpenPdf={handleOpenPdf}
                    />
                ))}
            </div>
        </div>
    );
}
