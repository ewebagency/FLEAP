'use client';
import React, {useState } from "react";
import OperationalAnalyse from "./Operationelle/OperationalAnalyse";
import FinancialAnalyse from "./Financiere/FinancialAnalyse";
import FactureAnalyse from "./Factures/FacturesAnalyse";
import EnvAnalyse from "./Environnementale/EnvAnalyse";

export interface Material { id: number, checked: boolean, color: string, label: string}
export interface DataMaterialStructured { valueChain:string, materials:Material[]}


const TabBarAnalyses = () => {
    
    const [activeTab, setActiveTab] = useState('tab_finance');
    const handleTabClick = (tab:string) => {
        setActiveTab(tab);
      };

    return (
        <div>
            <div role="tablist" className="tabs tabs-lifted">
                <a role="tab" className={`tab ${activeTab === 'tab_finance' ? 'tab-active' : ''}`} onClick={() => handleTabClick('tab_finance')}>Analyse financière</a>          
                <a role="tab" className={`tab ${activeTab === 'tab_ops' ? 'tab-active' : ''}`} onClick={() => handleTabClick('tab_ops')}>Analyse opérationnelle</a>
                <a role="tab" className={`tab ${activeTab === 'tab_facture' ? 'tab-active' : ''}`} onClick={() => handleTabClick('tab_facture')}>Analyse des factures</a>
                <a role="tab" className={`tab ${activeTab === 'tab_env' ? 'tab-active' : ''}`} onClick={() => handleTabClick('tab_env')}>Analyse environnementale</a>
            </div>

            <FinancialAnalyse active={activeTab == 'tab_finance'}/>
            <OperationalAnalyse active={activeTab == 'tab_ops'}/>
            <FactureAnalyse active={activeTab == 'tab_facture'}/>
            <EnvAnalyse active={activeTab == 'tab_env'}/>
        </div>
    )
}

export default TabBarAnalyses
