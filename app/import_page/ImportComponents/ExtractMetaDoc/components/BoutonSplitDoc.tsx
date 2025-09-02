'use client';

import { useState } from 'react';
import { splitPdfByPages } from '../utils/split';
import { getPdfInfoById } from '../utils/bdd';

interface BoutonSplitDocProps {
    pdfId: number;
    entrepriseId: number;
    onSplitComplete?: (newPdfIds: string[]) => void;
    className?: string;
}

export default function BoutonSplitDoc({ 
    pdfId, 
    entrepriseId,
    onSplitComplete, 
    className = '' 
}: BoutonSplitDocProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<string>('');

    const handleSplit = async () => {
        setIsLoading(true);
        setMessage('');

        try {
            // Récupérer les informations du PDF
            const { data: pdfInfo, error: pdfError } = await getPdfInfoById(pdfId.toString(), entrepriseId);
            
            if (pdfError || !pdfInfo) {
                setMessage('Erreur: Impossible de récupérer les informations du PDF');
                return;
            }

            const result = await splitPdfByPages(pdfInfo);
            
            if (result.success) {
                setMessage(result.message);
                if (result.newPdfIds && onSplitComplete) {
                    onSplitComplete(result.newPdfIds);
                }
            } else {
                setMessage(`Erreur: ${result.message}`);
            }
        } catch (error) {
            setMessage(`Erreur inattendue: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            <button
                onClick={handleSplit}
                disabled={isLoading}
                className={`
                    px-4 py-2 rounded-lg font-medium transition-all duration-200 text-xs
                    ${isLoading 
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg'
                    }
                `}
            >
                {isLoading ? (
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Division en cours...
                    </div>
                ) : (
                    'Split'
                )}
            </button>
            
            {message && (
                <div className={`
                    p-3 rounded-lg text-sm
                    ${message.includes('Erreur') 
                        ? 'bg-red-100 text-red-700 border border-red-200' 
                        : 'bg-green-100 text-green-700 border border-green-200'
                    }
                `}>
                    {message}
                </div>
            )}
        </div>
    );
}
