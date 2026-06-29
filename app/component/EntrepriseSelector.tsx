"use client";

import { useEffect, useRef, useState } from 'react';
import { useSession } from './SessionProvider';
import BoxIcon from '@/app/component/BoxIconWrapper';

/**
 * Sélecteur d'entreprise réservé aux super-admins.
 * Même style que les autres filtres de la sidebar (carte blanche + icône + chevron).
 * Permet de basculer l'entreprise active : tout le reste de l'app
 * (les ~89 requêtes filtrées par entreprise_id) suit automatiquement.
 */
const EntrepriseSelector = () => {
    const { is_super_admin, entreprises, entreprise_id, entreprise_name, selectEntreprise } = useSession();
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!is_super_admin || entreprises.length === 0) return null;

    return (
        <div ref={containerRef} className="my-1 relative">
            <span className="block text-xs font-semibold text-gray-400 mb-0.5 ml-1">
                Entreprise (admin)
            </span>
            <div
                className="btn flex items-center justify-between px-2 py-1 bg-white rounded-lg hover:bg-gray-50 transition-all duration-200 w-full cursor-pointer"
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
            >
                <div className="flex items-center space-x-2">
                    <BoxIcon name='building' type='solid' size="18px" />
                    <h1 className="text-sm font-semibold text-gray-700 truncate">
                        {entreprise_name || 'Entreprise'}
                    </h1>
                </div>
                <span className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                    ▼
                </span>
            </div>

            {isOpen && (
                <>
                    <div className="absolute left-0 w-full h-2 -bottom-2" onClick={(e) => e.stopPropagation()} />
                    <div
                        className="absolute top-full left-0 w-full mt-0 bg-white rounded-lg border border-gray-200 z-50 max-h-60 overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {entreprises.map((ent) => (
                            <button
                                key={ent.id}
                                onClick={() => {
                                    setIsOpen(false);
                                    if (String(ent.id) !== String(entreprise_id)) selectEntreprise(ent.id);
                                }}
                                className={`w-full text-left p-2 text-sm transition-colors duration-150
                                    ${String(ent.id) === String(entreprise_id)
                                        ? 'bg-gray-100 text-[var(--green-medium)] font-semibold'
                                        : 'hover:bg-gray-50 text-gray-700'}`}
                            >
                                {ent.name}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default EntrepriseSelector;
