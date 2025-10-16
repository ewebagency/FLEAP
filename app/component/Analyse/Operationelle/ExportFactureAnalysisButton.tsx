'use client';

import { useState } from "react";
import { useSession } from "@/app/component/SessionProvider";
import { cofounders_user_id } from "@/app/component/SideBar";
import BoxIcon from '@/app/component/BoxIconWrapper';

const ExportFactureAnalysisButton = () => {
    const { entreprise_id, user_id } = useSession();
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [messageType, setMessageType] = useState<'success' | 'error' | null>(null);

    // Vérifier si l'utilisateur est cofounder
    const isCofounder = cofounders_user_id(user_id);

    const handleExport = async () => {
        if (entreprise_id) {
            setIsLoading(true);
            try {
                const response = await fetch(`/api/analysis/export_facture_analysis?entreprise_id=${entreprise_id}`);
                
                if (response.ok) {
                    const filename = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'analyse_factures_prix_unitaires.xlsx';
                    const blob = await response.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    URL.revokeObjectURL(url);
                    document.body.removeChild(a);

                    setMessage('Export réussi');
                    setMessageType('success');
                    
                    setTimeout(() => {
                        setMessage('');
                        setMessageType(null);
                    }, 3000);
                } else {
                    const errorData = await response.json();
                    setMessage(errorData.message || 'Erreur lors de l\'export');
                    setMessageType('error');
                }
            } catch (error) {
                console.error('Erreur lors de l\'export:', error);
                setMessage('Erreur lors de l\'export');
                setMessageType('error');
            } finally {
                setIsLoading(false);
            }
        }
    };

    // Ne pas afficher le bouton si l'utilisateur n'est pas cofounder
    if (!isCofounder) {
        return null;
    }

    return (
        <div className="flex items-center space-x-2">
            <button
                onClick={handleExport}
                disabled={isLoading}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                    isLoading
                        ? 'bg-gray-300 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
            >
                {isLoading ? (
                    <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                        <span className="text-sm">Export en cours...</span>
                    </>
                ) : (
                    <>
                        <BoxIcon name="file-export" type="solid" size="sm" />
                        <span className="text-sm">Analyse Prix Unitaires Factures</span>
                    </>
                )}
            </button>
            
            {message && (
                <div className={`text-sm ${messageType === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                    {message}
                </div>
            )}
        </div>
    );
};

export default ExportFactureAnalysisButton;

