/*'use client'
import { supabase } from "@/app/database/supabaseClient";
import { SessionMore, useSession } from "../../SessionProvider";
import { useEffect, useState } from "react";
import { Facture } from "./types";
import NewMainFinancialChart from "./NewMainFinancialChart";
import NewPieFinancialChart from "./NewPieFinancialChart";
import NewTableFinancial from "./NewTableFinancial";

const NewFinancialSource = () => {
    const session = useSession() as SessionMore;
    const entreprise_id = session.entreprise_id;
    const [factures, setFactures] = useState<Facture[]>([]);
    
    useEffect(() => {
        const fetchFactures = async () => {
            const { data, error } = await supabase
                .from('facture')
                .select('*')
                .eq('entreprise_id', entreprise_id);
            
            if (error) {
                console.error('Error fetching factures:', error);
            } else {
                setFactures(data);
            }
        };
        
        fetchFactures();
    }, [entreprise_id]);

    return (
        <div className="space-y-8 p-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-lg shadow">
                    <h2 className="text-lg font-semibold p-4">Évolution des montants</h2>
                    <NewMainFinancialChart factures={factures} />
                </div>
                <div className="bg-white rounded-lg shadow">
                    <h2 className="text-lg font-semibold p-4">Répartition par type d'opération</h2>
                    <NewPieFinancialChart factures={factures} />
                </div>
            </div>
            <div className="bg-white rounded-lg shadow">
                <h2 className="text-lg font-semibold p-4">Détail des factures</h2>
                <NewTableFinancial factures={factures} />
            </div>
        </div>
    );
};

export default NewFinancialSource; */