'use client';
import React, {useEffect, useState } from "react";
import OperationalAnalyse from "./Operationelle/OperationalAnalyse";
import FinancialAnalyse from "./Financiere/FinancialAnalyse";
import FactureAnalyse from "./Factures/FacturesAnalyse";
import EnvAnalyse from "./Environnementale/EnvAnalyse";
import { SessionMore } from "../SessionProvider";
import { useSession } from "../SessionProvider";
import { supabase } from "@/app/database/supabaseClient";
import { useEntrepriseId } from "@/app/interface_admin_2/InterfaceAdmin2/hooks/useEntrepriseId";

export interface Material { id: number, checked: boolean, color: string, label: string}
export interface DataMaterialStructured { valueChain:string, materials:Material[]}


const TabBarAnalyses = () => {
    
    const [activeTab, setActiveTab] = useState('tab_ops');
    const session = useSession();
    const [hasFinanceData, setHasFinanceData] = useState(false);
    const [entrepriseId, setEntrepriseId] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const handleTabClick = (tab:string) => {
        setActiveTab(tab);
      };

    useEffect(() => {
        if (session?.entreprise_id) {
            setEntrepriseId(session.entreprise_id);
            setUserId(session.user_id);
        }
    }, [session]);

    useEffect(() => {
        const checkFinanceData = async () => {
            if (session?.entreprise_id) {
                const hasData = await has_finance_data(session.entreprise_id);
                setHasFinanceData(hasData);
            }
        };
        checkFinanceData();
    }, [session?.entreprise_id]);

      const cofounders_user_id = (user_id: string | null) => {
        if (user_id) {
            return ["a0542794-bbae-4132-9dde-485595bfa2aa", 
                    "8f05a291-f8b3-429d-839e-6f0b12f1bede", 
                    "dd9acb15-4678-442f-af72-79331bc43d91"].includes(user_id);
        }
        return false;
    }

    const has_finance_data = async (entreprise_id: string | null) => {
        if (entreprise_id) {
            const { data, error } = await supabase
                .from('facture')
                .select('*')
                .eq('entreprise_id', entreprise_id)
                //.not('other_infos', 'is', null);

            console.log("facture data", data);

            if (error) {
                console.error(error);
                return false;
            }
            return data.length > 0;
        }
        return false;
    }

    return (
        <div>
            <div role="tablist" className="tabs border-b border-gray-200">
                <a role="tab" 
                   className={`tab border-0 ${activeTab === 'tab_finance' ? 'border-b-4 border-green-500' : ''} ${hasFinanceData ? '' : 'hidden'}`} 
                   onClick={() => handleTabClick('tab_finance')}>
                   Analyse financière
                </a>          
                <a role="tab" 
                   className={`tab border-0 ${activeTab === 'tab_ops' ? 'border-b-4 border-green-500' : ''}`} 
                   onClick={() => handleTabClick('tab_ops')}>
                   Analyse opérationnelle
                </a>
                <a role="tab" 
                   className={`tab border-0 ${activeTab === 'tab_facture' ? 'border-b-4 border-green-500' : ''}`} 
                   onClick={() => handleTabClick('tab_facture')}>
                   Analyse des factures
                </a>
                <a role="tab" 
                   className={`tab border-0 ${activeTab === 'tab_env' ? 'border-b-4 border-green-500' : ''}`} 
                   onClick={() => handleTabClick('tab_env')}>
                   Analyse environnementale
                </a>
            </div>

            {hasFinanceData ? <FinancialAnalyse active={activeTab == 'tab_finance'}/> : null}
            <OperationalAnalyse active={activeTab == 'tab_ops'}/>
            <FactureAnalyse active={activeTab == 'tab_facture'}/>
            <EnvAnalyse active={activeTab == 'tab_env'}/>
        </div>
    )
}

export default TabBarAnalyses
