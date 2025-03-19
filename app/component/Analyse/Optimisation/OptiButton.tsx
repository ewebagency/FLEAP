import { useState } from "react";
import { Facture } from "../../Analyse/Financiere/types";

// Flag pour activer/désactiver le bouton d'optimisation
const ENABLE_OPTIMIZATION_BUTTON = false;

interface OptiButtonProps {
    validFactures: Facture[];
    onOptiChange: (optiActivated: boolean, optiFactures: Facture[]) => void;
}

interface SavingsSummary {
    [key: string]: {
        original: number;
        optimized: number;
        saving: number;
        percentage: number;
    };
}

const OptiButton = ({ validFactures, onOptiChange }: OptiButtonProps) => {
    const [isLoading, setIsLoading] = useState(false);
    const [optiActivated, setOptiActivated] = useState(false);
    const [optiFactures, setOptiFactures] = useState<Facture[]>([]);
    const [showDetails, setShowDetails] = useState(false);
    const [savingsSummary, setSavingsSummary] = useState<SavingsSummary>({});

    // Si le bouton est désactivé, on ne rend rien
    if (!ENABLE_OPTIMIZATION_BUTTON) return null;

    const calculateSavings = (original: Facture[], optimized: Facture[]) => {
        const summary: SavingsSummary = {};
        
        // Initialiser les totaux par type d'opération
        original.forEach(facture => {
            facture.infos_json.departs.forEach(depart => {
                depart.line_body.forEach(line => {
                    if (!summary[line.type_operation]) {
                        summary[line.type_operation] = {
                            original: 0,
                            optimized: 0,
                            saving: 0,
                            percentage: 0
                        };
                    }
                    if (line.type_operation === "Rachat") {
                        summary[line.type_operation].original += line.montant_ht;
                    } else {
                        summary[line.type_operation].original += Math.abs(line.montant_ht);
                    }
                });
            });
        });

        // Calculer les montants optimisés
        optimized.forEach(facture => {
            facture.infos_json.departs.forEach(depart => {
                depart.line_body.forEach(line => {
                    if (line.type_operation === "Rachat") {
                        summary[line.type_operation].optimized += line.montant_ht;
                    } else {
                        summary[line.type_operation].optimized += Math.abs(line.montant_ht);
                    }
                });
            });
        });

        // Calculer les économies et pourcentages
        Object.keys(summary).forEach(type => {
            const s = summary[type];
            if (type === "Rachat") {
                s.saving = s.optimized - s.original; // Pour les rachats, l'augmentation est positive
                s.percentage = ((s.optimized / s.original) - 1) * 100;
            } else {
                s.saving = s.original - s.optimized;
                s.percentage = (s.saving / s.original) * 100;
            }
        });

        // Ajouter le total
        const total = {
            original: Object.values(summary).reduce((sum, s) => sum + (s.original || 0), 0),
            optimized: Object.values(summary).reduce((sum, s) => sum + (s.optimized || 0), 0),
            saving: 0,
            percentage: 0
        };
        total.saving = total.original - total.optimized;
        total.percentage = (total.saving / total.original) * 100;
        summary["TOTAL"] = total;

        return summary;
    };

    const optimizeFactures = () => {
        setIsLoading(true);
        console.log("Début optimisation des factures:", validFactures.length);
        
        // Simuler un temps de traitement
        setTimeout(() => {
            const optimized = validFactures.map(facture => {
                const optimizedFacture = { ...facture };
                
                // Deep clone to avoid reference issues
                optimizedFacture.infos_json = JSON.parse(JSON.stringify(facture.infos_json));
                
                // Optimize each depart in the facture
                optimizedFacture.infos_json.departs = facture.infos_json.departs.map(depart => {
                    const optimizedDepart = { ...depart };
                    optimizedDepart.line_body = [...depart.line_body];
                    
                    // Optimize each line in the depart
                    optimizedDepart.line_body = depart.line_body.map(line => {
                        const optimizedLine = { ...line };
                        
                        // Apply optimization rules based on conditions
                        switch (line.type_operation) {
                            case "Collecte":
                                // Réduction de 25% sur les coûts de collecte
                                optimizedLine.montant_ht = line.montant_ht * 0.75;
                                break;
                            case "Transport":
                                // Réduction de 30% sur les coûts de transport
                                optimizedLine.montant_ht = line.montant_ht * 0.70;
                                break;
                            case "Traitement":
                                // Réduction de 35% sur les coûts de traitement
                                optimizedLine.montant_ht = line.montant_ht * 0.65;
                                break;
                            case "Gestion globale":
                                // Réduction de 20% sur les coûts de gestion globale
                                optimizedLine.montant_ht = line.montant_ht * 0.80;
                                break;
                            case "Location":
                                // Réduction de 40% sur les coûts de location
                                optimizedLine.montant_ht = line.montant_ht * 0.60;
                                break;
                            case "Mise à disposition":
                                // Réduction de 25% sur les coûts de mise à disposition
                                optimizedLine.montant_ht = line.montant_ht * 0.75;
                                break;
                            case "Maintenance":
                                // Réduction de 30% sur les coûts de maintenance
                                optimizedLine.montant_ht = line.montant_ht * 0.70;
                                break;
                            case "Autres : Contenant":
                                // Réduction de 25% sur les coûts des contenants
                                optimizedLine.montant_ht = line.montant_ht * 0.75;
                                break;
                            case "Autres":
                                // Réduction de 20% sur les autres coûts
                                optimizedLine.montant_ht = line.montant_ht * 0.80;
                                break;
                            case "Non expliqués":
                                // Réduction de 50% sur les coûts non expliqués
                                optimizedLine.montant_ht = line.montant_ht * 0.50;
                                break;
                            case "Pénalités":
                                // Réduction de 100% sur les pénalités (objectif d'éviter les pénalités)
                                optimizedLine.montant_ht = 0;
                                break;
                            case "Déclassement":
                                // Réduction de 100% sur les déclassements (objectif d'éviter les déclassements)
                                optimizedLine.montant_ht = 0;
                                break;
                            case "TGAP":
                                // Réduction de 100% sur la TGAP (objectif d'éviter la TGAP)
                                optimizedLine.montant_ht = 0;
                                break;
                            case "Rachat":
                                // Augmentation de 15% sur les rachats (amélioration des revenus)
                                optimizedLine.montant_ht = line.montant_ht * 1.15;
                                break;
                        }
                        
                        return optimizedLine;
                    });
                    
                    return optimizedDepart;
                });

                // Recalculer le total HT de la facture
                const totalHT = optimizedFacture.infos_json.departs.reduce((sum, depart) => 
                    sum + depart.line_body.reduce((departSum, line) => {
                        // Pour les rachats, on soustrait le montant (car c'est un revenu)
                        if (line.type_operation === "Rachat") {
                            return departSum - line.montant_ht;
                        }
                        // Pour les autres opérations, on ajoute le montant (car ce sont des coûts)
                        return departSum + line.montant_ht;
                    }, 0), 0);
                optimizedFacture.infos_json.footer.total_ht = totalHT;
                
                return optimizedFacture;
            });

            const summary = calculateSavings(validFactures, optimized);
            setSavingsSummary(summary);
            
            console.log('Fin optimisation, nombre de factures optimisées:', optimized.length);
            setOptiFactures(optimized);
            setOptiActivated(true);
            onOptiChange(true, optimized);
            setTimeout(() => {
                setShowDetails(true); // Afficher automatiquement les détails
            }, 3000);
            setIsLoading(false);
        }, 2000); // Délai de 2 secondes
    };

    const toggleOptimization = () => {
        if (optiActivated) {
            console.log("Désactivation de l'optimisation");
            console.log("Factures valides à restaurer:", validFactures.length);
            setOptiActivated(false);
            setOptiFactures([]);
            setSavingsSummary({});
            setShowDetails(false);
            onOptiChange(false, validFactures);
        } else {
            console.log("Activation de l'optimisation");
            optimizeFactures();
        }
    };

    return (
        <div className="flex flex-col items-center gap-2 relative">
            <div className="flex flex-col items-center gap-2">
                {!isLoading ? (
                    <button 
                        onClick={toggleOptimization}
                        className={`px-4 py-2 rounded-md ${
                            optiActivated 
                                ? 'bg-green-500 hover:bg-green-600' 
                                : 'bg-blue-500 hover:bg-blue-600'
                        } text-white transition-colors`}
                    >
                        {optiActivated ? 'Désactiver' : 'Optimiser'}
                    </button>
                ) : (
                    <div className="px-4 py-2 rounded-md bg-blue-500 text-white flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Optimisation en cours...</span>
                    </div>
                )}
                {optiActivated && !isLoading && (
                    <div className="flex items-center gap-2">
                        <div className="px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm">
                            Optimisation
                        </div>
                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            className="px-2 py-1 text-sm text-blue-600 hover:text-blue-800"
                        >
                            {showDetails ? 'Masquer' : 'Détails'}
                        </button>
                    </div>
                )}
            </div>
            
            {optiActivated && showDetails && Object.keys(savingsSummary).length > 0 && (
                <div className="absolute top-full left-1/2 transform -translate-x-3/4 mt-2 w-[400px] bg-white rounded-lg shadow-lg p-4 z-50 transition-all duration-500 ease-out animate-fade-in-up">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-2">Type de prestation</th>
                                <th className="text-right py-2 hidden">Montant initial</th>
                                <th className="text-right py-2 hidden">Montant optimisé</th>
                                <th className="text-right py-2">Économie (€)</th>
                                <th className="text-right py-2">Économie (%)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(savingsSummary)
                                .filter(([type]) => type !== "TOTAL" && savingsSummary[type].original > 0)
                                .sort((a, b) => Math.abs(b[1].saving) - Math.abs(a[1].saving))
                                .map(([type, data]) => (
                                    <tr key={type} className="border-b border-gray-100">
                                        <td className="py-2">{type}</td>
                                        <td className="text-right hidden">{Math.abs(data.original).toLocaleString('fr-FR')} €</td>
                                        <td className="text-right hidden">{Math.abs(data.optimized).toLocaleString('fr-FR')} €</td>
                                        <td className={`text-right font-medium ${type === "Rachat" ? 'text-green-600' : 'text-blue-600'}`}>
                                            {type === "Rachat" ? '+' : '-'}{Math.abs(Math.round(data.saving)).toLocaleString('fr-FR')} €
                                        </td>
                                        <td className={`text-right font-medium ${type === "Rachat" ? 'text-green-600' : 'text-blue-600'}`}>
                                            {type === "Rachat" ? '+' : '-'}{Math.abs(data.percentage).toFixed(1)}%
                                        </td>
                                    </tr>
                                ))}
                            <tr className="font-semibold bg-gray-50">
                                <td className="py-2">TOTAL</td>
                                <td className="text-right hidden">{Math.abs(savingsSummary["TOTAL"].original).toLocaleString('fr-FR')} €</td>
                                <td className="text-right hidden">{Math.abs(savingsSummary["TOTAL"].optimized).toLocaleString('fr-FR')} €</td>
                                <td className="text-right text-blue-600">-{Math.abs(Math.round(savingsSummary["TOTAL"].saving)).toLocaleString('fr-FR')} €</td>
                                <td className="text-right text-blue-600">-{Math.abs(savingsSummary["TOTAL"].percentage).toFixed(1)}%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default OptiButton;
