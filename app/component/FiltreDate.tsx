"use client"
import React, { useEffect, useState, useRef } from "react";
import { useFilterContext } from "../FilterContext";
import { useSession } from "./SessionProvider";
import { supabase } from "../database/supabaseClient";

interface DateSegment {
    label: string;
    debut: Date;
    fin: Date;
}

const FiltreDate = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { segmentDates, setSegmentDates } = useFilterContext();
    const session = useSession();
    const containerRef = useRef<HTMLDivElement>(null);

    const getDateSegments = (dates: Date[]): DateSegment[] => {
        if (dates.length === 0) return [];

        const now = new Date();
        const oneDay = 24 * 60 * 60 * 1000;
        const oneWeek = 7 * oneDay;
        const oneMonth = 30 * oneDay;
        const oneYear = 365 * oneDay;

        return [
            {
                label: "7 derniers jours",
                debut: new Date(now.getTime() - oneWeek),
                fin: now
            },
            {
                label: "dernier mois",
                debut: new Date(now.getTime() - oneMonth),
                fin: now
            },
            {
                label: "6 derniers mois",
                debut: new Date(now.getTime() - (6 * oneMonth)),
                fin: now
            },
            /*{
                label: "Cette année",
                debut: new Date(now.getFullYear(), 0, 1),
                fin: now
            },
            {
                label: "Année précédente",
                debut: new Date(now.getFullYear() - 1, 0, 1),
                fin: new Date(now.getFullYear() - 1, 11, 31)
            }*/
        ];
    };

    const getDatesFromUser = async () => {
        if (session?.user.id) {
            const { data, error } = await supabase
            .from('bsd')
            .select('created_at')
            .eq('user_id', session.user.id)
            .order('created_at');
            
            if (error) {
                console.error('Error fetching dates:', error);
                return;
            }

            if(data && data.length > 0) {
                const dates = data.map(bsd => new Date(bsd.created_at));
                const segments = getDateSegments(dates);
                // Par défaut, sélectionner les 30 derniers jours
                const defaultSegment = segments[1];
                setSegmentDates({ debut: defaultSegment.debut, fin: defaultSegment.fin });
            }
        }
    }

    useEffect(() => {
        getDatesFromUser();
    }, [session]);

    const handleSegmentSelect = (segment: DateSegment) => {
        setSegmentDates({ debut: segment.debut, fin: segment.fin });
        setIsOpen(false);
    };

    return (
        <div 
            ref={containerRef}
            className="m-4 relative"
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
        >
            <div className="btn flex items-center justify-between px-4 py-2 bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200">
                <div className="flex items-center space-x-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                    <h1 className="text-lg font-semibold text-gray-700">Période</h1>
                </div>
                <span className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                    ▼
                </span>
            </div>

            {isOpen && (
                <>
                    {/* Zone invisible pour combler l'espace entre le bouton et le menu */}
                    <div 
                        className="absolute left-0 w-full h-2 -bottom-2"
                        onMouseEnter={() => setIsOpen(true)}
                    />
                    
                    <div 
                        className="absolute top-full left-0 w-80 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 z-50"
                        onMouseEnter={() => setIsOpen(true)}
                        onMouseLeave={() => setIsOpen(false)}
                    >
                        <div className="p-3 border-b border-gray-200">
                            <span className="text-sm font-semibold text-gray-700">
                                Sélectionner une période
                            </span>
                        </div>
                        <div className="max-h-64 overflow-y-auto p-2">
                            {getDateSegments([new Date()]).map((segment, index) => (
                                <button
                                    key={segment.label}
                                    onClick={() => handleSegmentSelect(segment)}
                                    className={`w-full text-left p-2 hover:bg-gray-50 rounded-md transition-colors duration-150 ${
                                        segmentDates.debut?.getTime() === segment.debut.getTime() &&
                                        segmentDates.fin?.getTime() === segment.fin.getTime()
                                            ? 'bg-blue-50 text-blue-600'
                                            : 'text-gray-700'
                                    }`}
                                >
                                    {segment.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default FiltreDate;