/*import { createContext, useContext } from "react";

interface MaterialType {
    valueChain: string;
    selectedMaterials: { id: number; checked: boolean; color: string; label: string; }[];
    serverData: { 
        labels: string[]; 
        datasets: DatasetInterface[];
        totalWeight: number;
        monthlyAverage: number;
        yearlyTrend: number;
    }
}

interface DatasetInterface {
    id: number;
    label: string;
    data: number[];  // Poids mensuels
    backgroundColor: string;
    borderColor: string;
    fill: boolean;
    totalWeight: number;  // Poids total
    monthlyAverage: number;  // Moyenne mensuelle
    trend: number;  // Tendance (pourcentage)
}

export const AnalysisContext = createContext<MaterialType>({ 
    valueChain: '', 
    selectedMaterials: [], 
    serverData: { 
        labels: [], 
        datasets: [],
        totalWeight: 0,
        monthlyAverage: 0,
        yearlyTrend: 0
    }
});

export const useAnalysisContext = () => {
    const context = useContext(AnalysisContext);
    if (!context) {
        throw new Error("useAnalysisContext must be used within an AnalysisProvider");
    }
    return context;
};*/