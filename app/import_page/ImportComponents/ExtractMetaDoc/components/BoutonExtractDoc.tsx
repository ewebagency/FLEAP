import { useState } from 'react';
import { runMetaOcrForPdf } from '../utils/extract';
import { toast } from 'react-hot-toast';
import { useSession } from '@/app/component/SessionProvider';
import { MetaOcrResponse } from '../interface/pdf_interface';

interface BoutonExtractDocProps {
    pdfId: number;
    onExtractSuccess?: (pdfId: number, data: MetaOcrResponse) => void;
    onExtractError?: (pdfId: number, error: string) => void;
}

const BoutonExtractDoc: React.FC<BoutonExtractDocProps> = ({ 
    pdfId, 
    onExtractSuccess, 
    onExtractError 
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const { entreprise_id } = useSession();

    const handleExtract = async () => {
        if (!entreprise_id) {
            toast.error('Entreprise non identifiée');
            return;
        }

        setIsLoading(true);
        try {
            const result = await runMetaOcrForPdf(pdfId, Number(entreprise_id));

            if (result.success) {
                toast.success('Extraction réussie !');
                
                // Afficher les détails de l'extraction
                if (result.data) {
                    const { structured_response, confidence, alerte } = result.data;
                    
                    console.log("Données de l'extraction", structured_response)
                    // Afficher les alertes si il y en a
                    if (alerte.stop) {
                        toast.error(`⚠️ ${alerte.message}`, { duration: 5000 });
                    } else if (alerte.message) {
                        toast(`ℹ️ ${alerte.message}`, { duration: 3000 });
                    }

                    // Afficher le niveau de confiance
                    const confidenceLevel = confidence.brute >= 80 && confidence.spec >= 80 
                        ? 'Élevée' 
                        : confidence.brute >= 60 && confidence.spec >= 60 
                            ? 'Moyenne' 
                            : 'Faible';
                    
                    toast.success(`Confiance: ${confidenceLevel} (${confidence.brute}% brute, ${confidence.spec}% spécifique)`, { duration: 4000 });
                }

                // Callback de succès
                if (onExtractSuccess && result.data) {
                    onExtractSuccess(pdfId, result.data);
                }
            } else {
                toast.error(`Erreur: ${result.message}`);
                
                // Callback d'erreur
                if (onExtractError) {
                    onExtractError(pdfId, result.error || result.message);
                }
            }
        } catch (error) {
            console.error('Erreur lors de l\'extraction:', error);
            const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
            toast.error(`Erreur lors de l'extraction: ${errorMessage}`);
            
            // Callback d'erreur
            if (onExtractError) {
                onExtractError(pdfId, errorMessage);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <button
            onClick={handleExtract}
            disabled={isLoading || !entreprise_id}
            className={`px-3 py-1.5 border rounded-md text-xs font-medium transition-colors ${
                isLoading 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                    : 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600'
            }`}
            title="Extraire les métadonnées du document"
        >
            {isLoading ? (
                <span className="flex items-center gap-1">
                    <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Extraction...
                </span>
            ) : (
                'Extraire'
            )}
        </button>
    );
};

export default BoutonExtractDoc;
