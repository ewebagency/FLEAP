'use client';

import { createContext, useContext, useState, ReactNode, Dispatch, SetStateAction } from 'react';
import { BSD } from './TableBSD';

interface BSDsContextType {
    allBSDs: BSD[];
    setAllBSDs: Dispatch<SetStateAction<BSD[]>>;
    allFilteredBSDs: BSD[];
    setAllFilteredBSDs: Dispatch<SetStateAction<BSD[]>>;
    displayedBSDs: BSD[];
    setDisplayedBSDs: Dispatch<SetStateAction<BSD[]>>;
}

const BSDsContext = createContext<BSDsContextType | undefined>(undefined);

interface BSDsProviderProps {
    children: ReactNode;
}

export function BSDsProvider({ children }: BSDsProviderProps) {
    const [allBSDs, setAllBSDs] = useState<BSD[]>([]);
    const [allFilteredBSDs, setAllFilteredBSDs] = useState<BSD[]>([]);
    const [displayedBSDs, setDisplayedBSDs] = useState<BSD[]>([]);

    const value = {
        allBSDs,
        setAllBSDs,
        allFilteredBSDs,
        setAllFilteredBSDs,
        displayedBSDs,
        setDisplayedBSDs,
    };

    return (
        <BSDsContext.Provider value={value}>
            {children}
        </BSDsContext.Provider>
    );
}

export function useBSDs() {
    const context = useContext(BSDsContext);
    if (context === undefined) {
        throw new Error('useBSDs must be used within a BSDsProvider');
    }
    return context;
} 