'use client'
import { supabase } from "@/app/database/supabaseClient";
import { SessionMore, useSession } from "../../../SessionProvider";
import { useEffect, useState } from "react";
import { Facture } from "../types";
import NewMainFinancialChart from "./NewMainFinancialChart";
import NewPieFinancialChart from "./NewPieFinancialChart";
import NewTableFinancial from "./NewTableFinancial";
import NewBordereauxFinancial from "./NewBordereauxFinancial";

const NewFinancialSource = () => {
    const session = useSession() as SessionMore;
    const [entreprise_id, setEntreprise_id] = useState<string | null>(null);
    const [factures, setFactures] = useState<Facture[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
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

    // Filtrer les factures valides
    const validFactures = factures.filter(facture => {
        // Vérifier que chaque départ a les informations requises
        return facture.infos_json.departs.every(depart => {
            const header = depart.line_header;
            
            // Vérifier la date
            const date = new Date(header.date_depart);
            const isValidDate = !isNaN(date.getTime());

            // Vérifier le SIRET du site
            const hasValidSiret = !!header.site_siret && header.site_siret.length > 0;

            // Vérifier le code CED
            const hasValidCed = !!header.code_dechet && header.code_dechet.length > 0;
            
            
            //console.log("hasValidSiret", hasValidSiret)
            //console.log('siret', header.site_siret)
            //return isValidDate && hasValidSiret && hasValidCed;
            //if(!hasValidSiret) console.log(header.site_siret, hasValidSiret);
            return true; //on ne filtre plus sur les sirets valides
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
                        <div className="p-2">
                            <h2 className="text-sm text-gray-600 font-thin">Détail des factures</h2>
                            <div className="text-xs text-gray-500">({validFactures.length} factures)</div>
                        </div>
                        <NewTableFinancial factures={validFactures} entreprise_id={entreprise_id} />
                    </div>
                    <div className="bg-white rounded-lg shadow">
                        <div className="p-2">
                            <h2 className="text-sm text-gray-600 font-thin">Répartition par filière</h2>
                            <div className="text-xs text-gray-500">({validFactures.length} factures)</div>
                        </div>
                        <NewPieFinancialChart factures={validFactures} entreprise_id={entreprise_id} />
                    </div>
                </div>
            </div>}
        </div>
    );
};

export default NewFinancialSource;