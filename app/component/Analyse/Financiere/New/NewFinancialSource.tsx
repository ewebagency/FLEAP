'use client'
import { supabase } from "@/app/database/supabaseClient";
import { SessionMore, useSession } from "../../../SessionProvider";
import { useEffect, useState } from "react";
import { Facture } from "../types";
import NewMainFinancialChart from "./NewMainFinancialChart";
import NewPieFinancialChart from "./NewPieFinancialChart";
import NewTableFinancial from "./NewTableFinancial";
import NewBordereauxFinancial from "./NewBordereauxFinancial";
import { useFilterContext } from '@/app/FilterContext';
import { getFiliere, getMappingTableFiliere } from '@/app/register/RegisterComponents/Modal/FormulaireFull/utils_new';
import OptiButton from "../../../Analyse/Optimisation/OptiButton";
import RepComponent from "./RepComponent";
import { cofounders_user_id } from "@/app/component/SideBar";

const NewFinancialSource = () => {
    const {user_id, entreprise_id} = useSession()
    const { segmentDates, filieres, sites } = useFilterContext();
    //const [entreprise_id, setEntreprise_id] = useState<string | null>(null);
    const [factures, setFactures] = useState<Facture[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [mappingTable, setMappingTable] = useState<{ ced: string, filiere: string }[]>([]);
    const [optiFactures, setOptiFactures] = useState<Facture[]>([]);
    const [isOptiActive, setIsOptiActive] = useState(false);
    
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

    // Au début du composant
    console.log('=== Configuration des filtres ===');
    console.log('Filières configurées:', filieres.map(f => ({
        nom: f.name,
        active: f.checked
    })));
    console.log('Sites configurés:', sites.map(s => ({
        orgId: s.orgId,
        nom: s.name,
        active: s.checked
    })));
    console.log('Période:', {
        debut: segmentDates.debut?.toLocaleDateString(),
        fin: segmentDates.fin?.toLocaleDateString()
    });

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

            // Si uniquement "Autres" est sélectionné
            if (hasAutres && selectedFilieres.length === 1) {
                return !allMappedCEDs.has(cleanedCed);
            }
            // Si "Autres" est sélectionné avec d'autres filières
            else if (hasAutres) {
                return selectedFiliereCEDs.has(cleanedCed) || !allMappedCEDs.has(cleanedCed);
            }
            // Si "Autres" n'est pas sélectionné
            else {
                return selectedFiliereCEDs.has(cleanedCed);
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

    if (isLoading) {
        return <div className="flex justify-center items-center p-4">
            <div className="text-gray-500">Chargement des données...</div>
        </div>;
    }

    const displayFactures = isOptiActive ? optiFactures : validFactures;

    return (
        <div>
            {entreprise_id && <div className="space-y-4 p-2">
                <div className="flex justify-between items-center">
                    <div className="flex-grow">
                        <NewBordereauxFinancial factures={displayFactures} />
                    </div>
                    <div className="ml-4">
                        <OptiButton validFactures={validFactures} onOptiChange={handleOptiChange} />
                    </div>
                </div>

                {/* Main chart + RepComponent */}
                {cofounders_user_id(user_id) ?
                    <div className="flex justify-between bg-white rounded-lg">
                        <div className="w-[80%]">
                            <NewMainFinancialChart factures={displayFactures} entreprise_id={entreprise_id} />
                        </div>
                        <div className="w-[20%]">
                            <RepComponent factures={displayFactures} financier_or_tonnage="financier"/>
                        </div>
                    </div>
                :
                    <div className="flex justify-between bg-white rounded-lg">
                        <div className="w-[100%]">
                            <NewMainFinancialChart factures={displayFactures} entreprise_id={entreprise_id} />
                        </div>
                    </div>
                }

                {/* Tableau + Pie chart */}
                <div className="flex flex-row justify-between gap-2">
                    <div className="bg-white rounded-lg w-[60%]">
                        <NewTableFinancial factures={displayFactures} entreprise_id={entreprise_id} />
                    </div>
                    <div className="bg-white rounded-lg w-[40%]">
                        <div className="p-2">
                            <h2 className="text-xs text-gray-500 font-thin">Répartition par filière</h2>
                        </div>
                        <NewPieFinancialChart factures={displayFactures} entreprise_id={entreprise_id} />
                    </div>
                </div>
            </div>}
        </div>
    );
};

export default NewFinancialSource;