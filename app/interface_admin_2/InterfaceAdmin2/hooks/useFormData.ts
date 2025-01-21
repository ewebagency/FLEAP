import { useState, useEffect } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import { defaultFormData } from '../utils/defaultValues';
import { FactureLine } from '../types/interfaces';
import { getNestedValue } from '../utils/helpers';

/**
 * Hook principal pour la gestion des données du formulaire et du système de filtrage
 * @param currentPdfId - ID du PDF en cours
 * @param entrepriseId - ID de l'entreprise
 */
export const useFormData = (currentPdfId: string | null, entrepriseId: string | null) => {
    // État du formulaire sans localStorage
    const [formData, setFormData] = useState<FactureLine>(defaultFormData);

    // État pour stocker les BSDs bruts
    const [allOptions, setAllOptions] = useState<FactureLine[]>([]);
    
    // Structure des filtres pour chaque départ
    const [departFilters, setDepartFilters] = useState<Array<{
        departIndex: number;
        filters: {
            field: string;
            value: string;
        }[];
    }>>([]);

    // Filtrage des BSDs par départ
    const [filteredOptionsByDepart, setFilteredOptionsByDepart] = useState<FactureLine[][]>([]);

    // Ajout des types nécessaires
    type DepartFilter = {
        departIndex: number;
        filters: {
            field: string;
            value: string;
        }[];
    };

    type DepartData = {
        line_header: {
            site_nom: string;
            site_siret: string;
            code_dechet?: string;
            type_dechet?: string;
            [key: string]: string | undefined;
        };
        [key: string]: unknown;
    };

    // Charger les données existantes de la facture
    useEffect(() => {
        const loadExistingFacture = async () => {
            if (!currentPdfId) return;

            const { data: existingFacture, error } = await supabase
                .from('facture')
                .select('infos_json')
                .eq('pdf_infos_id', currentPdfId)
                .single();

            if (error) {
                if (error.code !== 'PGRST116') {
                    console.error('Erreur lors de la récupération de la facture:', error);
                }
                return;
            }

            if (existingFacture?.infos_json) {
                console.log('Données existantes chargées:', existingFacture.infos_json);
                
                // Mettre à jour le formulaire avec les données existantes
                const formattedData = {
                    ...existingFacture.infos_json,
                    header: {
                        ...existingFacture.infos_json.header,
                        date_facture: new Date(existingFacture.infos_json.header.date_facture).toISOString()
                    },
                    departs: existingFacture.infos_json.departs.map((depart: DepartData) => ({
                        ...depart,
                        line_header: {
                            ...depart.line_header,
                            site_nom: depart.line_header.site_nom || '',
                            site_siret: depart.line_header.site_siret || '',
                        }
                    }))
                };
                
                setFormData(formattedData);
                
                // Initialiser les filtres pour chaque départ
                const initialFilters = formattedData.departs.map((depart: DepartData, index: number) => ({
                    departIndex: index,
                    filters: [
                        // Filtre pour le site avec le SIRET
                        {
                            field: 'formAPI.createFormInput.emitter.company.siret',
                            value: depart.line_header.site_siret
                        },
                        // Autres filtres...
                        ...(depart.line_header.code_dechet ? [{
                            field: 'formAPI.createFormInput.wasteDetails.code',
                            value: depart.line_header.code_dechet
                        }] : []),
                        ...(depart.line_header.type_dechet ? [{
                            field: 'formAPI.createFormInput.wasteDetails.name',
                            value: depart.line_header.type_dechet
                        }] : []),
                        ...(formattedData.header.prestataire_siret ? [
                            {
                                field: 'formAPI.createFormInput.transporter.company.siret',
                                value: formattedData.header.prestataire_siret
                            },
                            {
                                field: 'formAPI.createFormInput.recipient.company.siret',
                                value: formattedData.header.prestataire_siret
                            }
                        ] : [])
                    ].filter(filter => filter.value) // Filtrer les valeurs vides
                }));
                
                setDepartFilters(initialFilters);
            }
        };

        loadExistingFacture();
    }, [currentPdfId]);

    // Charger les BSDs au démarrage
    useEffect(() => {
        const fetchBSDs = async () => {
            if (!entrepriseId) return;

            const { data, error } = await supabase
                .from('bsd')
                .select('infos_json')
                .eq('entreprise_id', entrepriseId);

            if (error) {
                console.error('Erreur lors de la récupération des BSDs:', error);
                return;
            }
            
            setAllOptions(data.map(d => d.infos_json));
        };

        fetchBSDs();
    }, [entrepriseId]);

    // Application des filtres
    useEffect(() => {
        const newFilteredOptions = formData.departs.map((_, departIndex) => {
            const currentFilters = departFilters.find(f => f.departIndex === departIndex)?.filters || [];
            
            console.log(`Filtres pour départ ${departIndex}:`, currentFilters);

            if (currentFilters.length === 0) return allOptions;

            return allOptions.filter(option => 
                currentFilters.every(filter => {
                    const value = getNestedValue(option, filter.field);
                    return value === filter.value;
                })
            );
        });

        setFilteredOptionsByDepart(newFilteredOptions);
    }, [departFilters, allOptions, formData.departs.length]);

    /**
     * Mise à jour des filtres pour un départ spécifique
     * @param departIndex - Index du départ
     * @param field - Chemin du champ à filtrer
     * @param value - Valeur du filtre
     */
    const updateDepartFilters = (departIndex: number, field: string, value: string) => {
        const newDepartFilters = [...departFilters];
        const departFilterIndex = newDepartFilters.findIndex(f => f.departIndex === departIndex);

        if (departFilterIndex === -1) {
            newDepartFilters.push({
                departIndex,
                filters: [{ field, value }]
            });
        } else {
            const existingFilters = newDepartFilters[departFilterIndex].filters;
            const filterIndex = existingFilters.findIndex(f => f.field === field);

            if (filterIndex === -1) {
                existingFilters.push({ field, value });
            } else {
                existingFilters[filterIndex].value = value;
            }
        }

        setDepartFilters(newDepartFilters);
    };

    // Fonction pour mettre à jour le formulaire
    const updateFormData = (newData: FactureLine, departIndex?: number) => {
        setFormData(newData);
        
        if (typeof departIndex === 'number') {
            const depart = newData.departs[departIndex];
            
            if (depart.line_header.code_dechet) {
                updateDepartFilters(departIndex, 'formAPI.createFormInput.wasteDetails.code', depart.line_header.code_dechet);
            }
            if (depart.line_header.type_dechet) {
                updateDepartFilters(departIndex, 'formAPI.createFormInput.wasteDetails.name', depart.line_header.type_dechet);
            }
            if (depart.line_header.site_siret) {
                updateDepartFilters(departIndex, 'formAPI.createFormInput.emitter.company.siret', depart.line_header.site_siret);
            }
            if (newData.header.prestataire_siret) {
                updateDepartFilters(departIndex, 'formAPI.createFormInput.transporter.company.siret', newData.header.prestataire_siret);
                updateDepartFilters(departIndex, 'formAPI.createFormInput.recipient.company.siret', newData.header.prestataire_siret);
            }
        }
    };

    const resetFilteredFields = () => {
        setDepartFilters([]);
        
        setFormData(prev => ({
            ...prev,
            header: {
                ...prev.header,
                prestataire_nom: '',
                prestataire_siret: '',
            },
            departs: prev.departs.map(depart => ({
                ...depart,
                line_header: {
                    ...depart.line_header,
                    site_nom: '',
                    site_siret: '',
                    type_dechet: '',
                    code_dechet: '',
                    filiere: ''
                }
            }))
        }));
    };

    return {
        formData,
        setFormData: updateFormData,
        allOptions,
        filteredOptionsByDepart,
        departFilters,
        resetFilteredFields
    };
}; 