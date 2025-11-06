'use client'
import { supabase } from "@/app/database/supabaseClient";
import { SessionMore, useSession } from "../../../SessionProvider";
import { useEffect, useState } from "react";
import { Facture, Operation } from "../types";
import NewMainFinancialChart from "./NewMainFinancialChart";
import NewPieFinancialChart from "./NewPieFinancialChart";
import NewTableFinancial from "./NewTableFinancial";
import NewBordereauxFinancial from "./NewBordereauxFinancial";
import { useFilterContext } from '@/app/FilterContext';
import { getFiliere, getMappingTableFiliere } from '@/app/register/RegisterComponents/Modal/FormulaireFull/utils_new';
import OptiButton from "../../../Analyse/Optimisation/OptiButton";
import RepComponent from "./RepComponent";
import { cofounders_user_id } from "@/app/component/SideBar";
import { useAnalysis } from "@/app/analysis/AnalysisProvider";
import useSWR from 'swr';
import LoadingState from '@/app/component/LoadingState';

// Fonction pour déterminer si une ligne est un revenu
export const isRevenue = (
    line: Operation, 
    params_mapping_operation: Record<string, string[]> | null
): boolean => {
    // Condition 1: Montant négatif
    if (line.montant_ht < 0) {
        console.log('🟢 Revenue détecté (montant négatif):', line.montant_ht, line.type_operation);
        return true;
    }

    // Condition 2: Type d'opération contient "rachat" (insensible à la casse)
    const normalizedType = line.type_operation.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normalizedType.includes('rachat')) {
        console.log('🟢 Revenue détecté (type contient rachat):', line.type_operation, 'montant:', line.montant_ht);
        return true;
    }

    // Condition 3: Type d'opération mappé vers une catégorie contenant "rachat"
    if (params_mapping_operation) {
        for (const [category, operations] of Object.entries(params_mapping_operation)) {
            if (category.toLowerCase().includes('rachat') && operations.includes(line.type_operation)) {
                console.log('🟢 Revenue détecté (mapping):', line.type_operation, '→', category, 'montant:', line.montant_ht);
                return true;
            }
        }
    }

    return false;
};

const NewFinancialSource = () => {
    const {user_id, entreprise_id} = useSession()
    const { segmentDates, filieres, sites } = useFilterContext();
    const { filieres_ou_prestataires } = useAnalysis();
    //const [entreprise_id, setEntreprise_id] = useState<string | null>(null);
    const [factures, setFactures] = useState<Facture[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [mappingTable, setMappingTable] = useState<{ ced: string, filiere: string }[]>([]);
    const [mappingNomFiliere, setMappingNomFiliere] = useState<{ nom: string; filiere: string }[]>([]);
    const [optiFactures, setOptiFactures] = useState<Facture[]>([]);
    const [isOptiActive, setIsOptiActive] = useState(false);

    // Récupérer params_mapping_operation depuis la BDD
    const { data: paramsData } = useSWR(
        entreprise_id ? ['params_mapping_operation', entreprise_id] : null,
        async () => {
            const { data, error } = await supabase
                .from('entreprise')
                .select('params_mapping_operation')
                .eq('id', entreprise_id)
                .single();
            
            if (error) {
                console.error('Error fetching params_mapping_operation:', error);
                return null;
            }
            
            return data?.params_mapping_operation as Record<string, string[]> | null;
        }
    );
    
    const params_mapping_operation = paramsData || null;
    
    useEffect(() => {
        if (!entreprise_id) return;
        
        const fetchData = async () => {
            setIsLoading(true);
            try {
                //setEntreprise_id(entreprise_id);
                
                let allFactures: Facture[] = [];
                let page = 0;
                const pageSize = 1000;
                let hasMore = true;

                while (hasMore) {
                    const { data, error } = await supabase
                        .from('facture')
                        .select('*')
                        .eq('entreprise_id', entreprise_id)
                        .range(page * pageSize, (page + 1) * pageSize - 1);
                    
                    if (error) {
                        console.error('Error fetching factures:', error);
                        break;
                    }

                    if (data && data.length > 0) {
                        allFactures = [...allFactures, ...data];
                        page++;
                    } else {
                        hasMore = false;
                    }
                }
                
                setFactures(allFactures);
            } catch (error) {
                console.error('Error in fetchData:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [entreprise_id]);

    useEffect(() => {
        const fetchMappingTable = async () => {
            if (!entreprise_id) return;
            const mapping = await getMappingTableFiliere(entreprise_id);
            setMappingTable(mapping || []);
        };
        fetchMappingTable();
    }, [entreprise_id]);

    useEffect(() => {
        const fetchMappingNom = async () => {
            if (!entreprise_id) return;
            try {
                const res = await fetch(`/api/get_mapping_nom_filiere?entreprise_id=${entreprise_id}`);
                if (res.ok) {
                    const data = await res.json();
                    setMappingNomFiliere((data?.data || data) as { nom: string; filiere: string }[]);
                }
            } catch (e) {
                console.error('Error fetching mapping_nom_filiere', e);
            }
        };
        fetchMappingNom();
    }, [entreprise_id]);


    const validFactures = factures.map(facture => {
        // Vérifier la cohérence des montants
        const sommeDeparts = facture.infos_json.departs.reduce((sum, depart) => {
            return sum + depart.line_body.reduce((lineSum, line) => {
                // Si c'est un rachat, le montant doit être négatif
                const montant = line.type_operation === "Rachat" 
                    ? -Math.abs(line.montant_ht)  // Force le montant en négatif
                    : line.montant_ht;
                return lineSum + montant;
            }, 0);
        }, 0);
        
        const ecart = Math.abs(sommeDeparts - facture.infos_json.footer.total_ht);
        
        // Si l'écart est trop grand (> 10), on ignore cette facture
        if (ecart > 10 && false) {
            console.log(`Facture ${facture.id} ignorée - Écart de ${ecart}€`, {
                sommeDeparts,
                total_ht: facture.infos_json.footer.total_ht
            });
            return {
                ...facture,
                infos_json: {
                    ...facture.infos_json,
                    departs: [] // Facture ignorée
                }
            };
        }

        const selectedFilieres = filieres.filter(f => f.checked).map(f => f.name);
        if (selectedFilieres.length === 0) {
            return {
                ...facture,
                infos_json: {
                    ...facture.infos_json,
                    departs: []
                }
            };
        }

        const validDeparts = facture.infos_json.departs.filter(depart => {
            const header = depart.line_header;
            const date = new Date(header.date_depart);
            
            // Vérifications date
            if (!isNaN(date.getTime())) {
                if (segmentDates.debut && date < segmentDates.debut) return false;
                if (segmentDates.fin && date > segmentDates.fin) return false;
            }

            // Filtre sur le site_siret
            const checkedSites = sites.filter(site => site.checked).map(site => site.orgId);
            if (checkedSites.length > 0) {
                const siteSiret = header.site_siret;
                // Si "----" est coché, on accepte les sites vides ou les sites cochés
                if (checkedSites.includes('----')) {
                    if (siteSiret && siteSiret !== '' && !checkedSites.includes(siteSiret)) {
                        return false;
                    }
                } else if (!siteSiret || !checkedSites.includes(siteSiret)) {
                    return false;
                }
            } else {
                return false;
            }

            if (filieres_ou_prestataires.nom === 'filiere_nom') {
                const wasteName = header?.dechet_description || header?.type_dechet || '';
                const allMappedNames = new Set(mappingNomFiliere.map(m => m.nom));
                const selectedFiliereNames = new Set(
                    mappingNomFiliere
                        .filter(m => selectedFilieres.filter(f => f !== 'Autres').includes(m.filiere))
                        .map(m => m.nom)
                );
                const hasAutres = selectedFilieres.includes('Autres');

                if (hasAutres && selectedFilieres.length === 1) {
                    return !allMappedNames.has(wasteName);
                } else if (hasAutres) {
                    return selectedFiliereNames.has(wasteName) || !allMappedNames.has(wasteName);
                } else {
                    return selectedFiliereNames.has(wasteName);
                }
            } else {
                // Nettoyage du code CED
                const cleanedCed = header.code_dechet?.replaceAll(' ', '').replace('*', '').trim() || '';
                
                // Liste de tous les CEDs mappés
                const allMappedCEDs = new Set(mappingTable.map(m => 
                    m.ced.replaceAll(' ', '').replace('*', '').trim()
                ));

                // Liste des CEDs des filières sélectionnées (sauf Autres)
                const selectedFiliereCEDs = new Set(
                    mappingTable
                        .filter(m => selectedFilieres.filter(f => f !== 'Autres').includes(m.filiere))
                        .map(m => m.ced.replaceAll(' ', '').replace('*', '').trim())
                );

                const hasAutres = selectedFilieres.includes('Autres');

                if (hasAutres && selectedFilieres.length === 1) {
                    return !allMappedCEDs.has(cleanedCed);
                } else if (hasAutres) {
                    return selectedFiliereCEDs.has(cleanedCed) || !allMappedCEDs.has(cleanedCed);
                } else {
                    return selectedFiliereCEDs.has(cleanedCed);
                }
            }
        });

        return {
            ...facture,
            infos_json: {
                ...facture.infos_json,
                departs: validDeparts
            }
        };
    }).filter(facture => facture.infos_json.departs.length > 0);

    const handleOptiChange = (optiActivated: boolean, optimizedFactures: Facture[]) => {
        setIsOptiActive(optiActivated);
        setOptiFactures(optimizedFactures);
    };

    const displayFactures = isOptiActive ? optiFactures : validFactures;

    return (
        <div>
            <LoadingState
                isLoading={isLoading}
                isEmpty={!isLoading && validFactures.length === 0}
                loadingMessage="Chargement des données financières..."
                emptyMessage="Aucune facture disponible"
                height="400px"
            >
            {entreprise_id && <div className="space-y-4 p-2">
                <div className="flex justify-between items-center">
                    <div className="flex-grow">
                        <NewBordereauxFinancial 
                            factures={displayFactures} 
                            params_mapping_operation={params_mapping_operation}
                        />
                    </div>
                    <div className="ml-4">
                        <OptiButton validFactures={validFactures} onOptiChange={handleOptiChange} />
                    </div>
                </div>

                {/* Main chart + RepComponent */}
                {cofounders_user_id(user_id) && false ?
                    <div className="flex justify-between bg-white rounded-lg">
                        <div className="w-[80%]">
                            <NewMainFinancialChart 
                                factures={displayFactures} 
                                entreprise_id={entreprise_id || ''} 
                                params_mapping_operation={params_mapping_operation}
                            />
                        </div>
                        {/*<div className="w-[20%]">
                            <RepComponent factures={displayFactures} financier_or_tonnage="financier"/>
                        </div>*/}
                    </div>
                :
                    <div className="flex justify-between bg-white rounded-lg">
                        <div className="w-[100%]">
                            <NewMainFinancialChart 
                                factures={displayFactures} 
                                entreprise_id={entreprise_id} 
                                params_mapping_operation={params_mapping_operation}
                            />
                        </div>
                    </div>
                }

                {/* Tableau + Pie chart */}
                <div className="flex flex-row justify-between gap-2">
                    <div className="bg-white rounded-lg w-[60%]">
                        <NewTableFinancial 
                            factures={displayFactures} 
                            entreprise_id={entreprise_id} 
                            params_mapping_operation={params_mapping_operation}
                        />
                    </div>
                    <div className="bg-white rounded-lg w-[40%]">
                        <div className="p-2">
                            <h2 className="text-xs text-gray-500 font-thin">Répartition par filière</h2>
                        </div>
                        <NewPieFinancialChart 
                            factures={displayFactures} 
                            entreprise_id={entreprise_id} 
                            params_mapping_operation={params_mapping_operation}
                        />
                    </div>
                </div>
            </div>}
            </LoadingState>
        </div>
    );
};

export default NewFinancialSource;