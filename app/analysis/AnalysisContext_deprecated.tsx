import { createContext, useContext } from "react";

interface MaterialType {
    valueChain: string;
    selectedMaterials: { id: number; checked: boolean; color: string; label: string; }[];
    serverData : { labels: string[]; datasets: DatasetInterface[] }
}
interface DatasetInterface {
    id: number;
    label: string;
    data: number[];  // Tableau de données numériques
    backgroundColor: string;
    borderColor: string;
    fill: boolean;
    remplissage: number[];  // Tableau de pourcentages ou de valeurs numériques
    declassement: number;   // Valeur numérique
  }

export const AnalysisContext = createContext<MaterialType>({ valueChain: '', selectedMaterials: [], serverData:{ labels: [], datasets: [] }});

export const useAnalysisContext = () => {
    const context = useContext(AnalysisContext);
    if (!context) {
        throw new Error("useAnalysisContext must be used within an AnalysisProvider");
    }
    return context;
};