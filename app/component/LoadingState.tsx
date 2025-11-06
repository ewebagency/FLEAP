import React, { useState, useEffect } from 'react';

interface LoadingStateProps {
    isLoading: boolean;
    isEmpty: boolean;
    error?: string | null;
    loadingMessage?: string;
    emptyMessage?: string;
    children: React.ReactNode;
    height?: string;
}

/**
 * Composant réutilisable pour gérer les états de chargement
 * - Affiche un loader pendant le chargement
 * - Affiche un message d'erreur si erreur
 * - Affiche un message "vide" si les données sont chargées mais vides
 * - Affiche les enfants si les données sont prêtes
 */
const LoadingState: React.FC<LoadingStateProps> = ({
    isLoading,
    isEmpty,
    error,
    loadingMessage = "Chargement des données...",
    emptyMessage = "Aucune donnée disponible",
    children,
    height = "300px"
}) => {
    // État anti-flash : attendre un peu avant d'afficher "vide"
    const [showEmpty, setShowEmpty] = useState(false);
    
    useEffect(() => {
        if (isEmpty && !isLoading) {
            // Attendre 300ms avant d'afficher l'état vide (évite le flash)
            const timer = setTimeout(() => {
                setShowEmpty(true);
            }, 300);
            return () => clearTimeout(timer);
        } else {
            setShowEmpty(false);
        }
    }, [isEmpty, isLoading]);
    
    // 1. État d'erreur
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-8" style={{ height }}>
                <div className="text-red-500 mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <p className="text-red-600 text-sm font-medium">{error}</p>
            </div>
        );
    }

    // 2. État de chargement
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-8" style={{ height }}>
                <div className="relative">
                    {/* Spinner animé */}
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--green-medium)]"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-8 w-8 rounded-full bg-white"></div>
                    </div>
                </div>
                <p className="text-gray-600 text-sm mt-4 animate-pulse">{loadingMessage}</p>
            </div>
        );
    }

    // 3. État vide (données chargées mais aucune donnée) - avec délai anti-flash
    if (showEmpty) {
        return (
            <div className="flex flex-col items-center justify-center p-8" style={{ height }}>
                <div className="text-gray-400 mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                </div>
                <p className="text-gray-500 text-sm">{emptyMessage}</p>
                <p className="text-gray-400 text-xs mt-1">Essayez de modifier vos filtres</p>
            </div>
        );
    }

    // 4. Données prêtes, afficher le contenu
    return <>{children}</>;
};

export default LoadingState;

