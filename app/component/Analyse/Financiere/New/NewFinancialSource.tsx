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

const NewFinancialSource = () => {
    const session = useSession() as SessionMore;
    const { segmentDates, filieres } = useFilterContext();
    const [entreprise_id, setEntreprise_id] = useState<string | null>(null);
    const [factures, setFactures] = useState<Facture[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [mappingTable, setMappingTable] = useState<{ ced: string, filiere: string }[]>([]);
    
    useEffect(() => {
        if (!session?.entreprise_id) return;
        
        const fetchData = async () => {
            setIsLoading(true);
            try {
                setEntreprise_id(session.entreprise_id);
                
                let allFactures: Facture[] = [];
                let page = 0;
                const pageSize = 1000;
                let hasMore = true;

                while (hasMore) {
                    const { data, error } = await supabase
                        .from('facture')
                        .select('*')
                        .eq('entreprise_id', session.entreprise_id)
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
    }, [session?.entreprise_id]);

    useEffect(() => {
        const fetchMappingTable = async () => {
            if (!session?.entreprise_id) return;
            const mapping = await getMappingTableFiliere(session.entreprise_id);
            setMappingTable(mapping || []);
        };
        fetchMappingTable();
    }, [session?.entreprise_id]);

    // Filtrer les factures valides et par date
    const validFactures = factures.filter(facture => {
        // Vérifier que chaque départ a les informations requises
        return facture.infos_json.departs.every(depart => {
            const header = depart.line_header;
            
            // Vérifier la date
            const date = new Date(header.date_depart);
            const isValidDate = !isNaN(date.getTime());

            // Filtrer par date si les dates sont définies
            if (segmentDates.debut && date < segmentDates.debut) return false;
            if (segmentDates.fin && date > segmentDates.fin) return false;

            // Vérifier le code CED et la filière
            if (!header.code_dechet) return false;
            
            const filiere = getFiliere(header.code_dechet, mappingTable);
            //console.log("filieres", filieres);
            const selectedFilieres = filieres.filter(f => f.checked).map(f => f.name);
            //console.log("selectedFilieres", selectedFilieres);
            // Si aucune filière n'est sélectionnée, on accepte toutes les factures
            if (selectedFilieres.length === 0) return true;
            
            // Sinon, on vérifie que la filière du code CED est dans les filières sélectionnées
            return selectedFilieres.includes(filiere);
        });
    });

    if (isLoading) {
        return <div className="flex justify-center items-center p-4">
            <div className="text-gray-500">Chargement des données...</div>
        </div>;
    }

    return (
        <div>
            {entreprise_id && <div className="space-y-4 p-2">
                <NewBordereauxFinancial factures={validFactures} />
                <div className="bg-white rounded-lg shadow">
                    <NewMainFinancialChart factures={validFactures} entreprise_id={entreprise_id} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white rounded-lg shadow">
                        <NewTableFinancial factures={validFactures} entreprise_id={entreprise_id} />
                    </div>
                    <div className="bg-white rounded-lg shadow">
                        <div className="p-2">
                            <h2 className="text-xs text-gray-500 font-thin">Répartition par filière</h2>
                        </div>
                        <NewPieFinancialChart factures={validFactures} entreprise_id={entreprise_id} />
                    </div>
                </div>
            </div>}
        </div>
    );
};

export default NewFinancialSource;