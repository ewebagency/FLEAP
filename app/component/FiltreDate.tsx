"use client"
import React, { useEffect, useState, useRef } from "react";
import { useFilterContext } from "../FilterContext";
import { useSession } from "./SessionProvider";
import { supabase } from "../database/supabaseClient";
import BoxIcon from '@/app/component/BoxIconWrapper';

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
    const [customStartDate, setCustomStartDate] = useState<string>('');
    const [customEndDate, setCustomEndDate] = useState<string>('');

    const getDateSegments = (): DateSegment[] => {
        const now = new Date();
        const currentYear = now.getFullYear();
        
        // Début et fin de l'année en cours
        const startOfYear = new Date(currentYear, 0, 1);
        const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

        // 12 derniers mois
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        return [
            {
                label: "Année en cours",
                debut: startOfYear,
                fin: endOfYear
            },
            {
                label: "12 derniers mois",
                debut: twelveMonthsAgo,
                fin: now
            }
        ];
    };

    const getDatesFromEntreprise = async () => {
        if (session?.entreprise_id) {
            const { data: bsdData, error: bsdError } = await supabase
                .from('bsd')
                .select('created_at, taken_over_at')
                .eq('entreprise_id', session.entreprise_id);
            
            if (bsdError) {
                console.error('Error fetching dates:', bsdError);
                return;
            }

            if(bsdData && bsdData.length > 0) {
                const allDates = bsdData.flatMap(bsd => [
                    bsd.created_at ? new Date(bsd.created_at) : null,
                    bsd.taken_over_at ? new Date(bsd.taken_over_at) : null
                ]).filter((date): date is Date => date !== null);

                if (allDates.length > 0) {
                    const defaultSegment = getDateSegments()[0]; // Année en cours par défaut
                    setSegmentDates({ debut: defaultSegment.debut, fin: defaultSegment.fin });
                }
            }
        }
    }

    useEffect(() => {
        const loadDates = async () => {
            if (!session?.user_id || !session?.entreprise_id) return;
            await getDatesFromEntreprise();
        };

        loadDates();
    }, [session?.user_id, session?.entreprise_id]);

    const handleSegmentSelect = (segment: DateSegment) => {
        setSegmentDates({ debut: segment.debut, fin: segment.fin });
        setIsOpen(false);
    };

    const handleCustomDateSubmit = () => {
        if (customStartDate && customEndDate) {
            setSegmentDates({
                debut: new Date(customStartDate),
                fin: new Date(customEndDate)
            });
            setIsOpen(false);
        }
    };

    return (
        <div 
            ref={containerRef}
            className="my-1 relative hidden"
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
        >
            <div className="btn flex items-center justify-between px-2 py-0 bg-white rounded-lg hover:bg-gray-50 transition-all duration-200 w-full">
                <div className="flex items-center space-x-4">
                    <BoxIcon name='calendar' type='solid' size="18px" />
                    <h1 className="text-sm font-semibold text-gray-700">Période</h1>
                </div>
                <span className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                    ▼
                </span>
            </div>

            {isOpen && (
                <>
                    <div className="absolute left-0 w-full h-2 -bottom-2" />
                    
                    <div className="absolute top-full left-0 w-80 mt-0 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                        <div className="p-3 border-b border-gray-200">
                            <span className="text-sm font-semibold text-gray-700">
                                Sélectionner une période
                            </span>
                        </div>
                        <div className="p-3 border-b border-gray-200">
                            <div className="flex flex-col space-y-2">
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="date"
                                        className="flex-1 p-1 border rounded"
                                        value={customStartDate}
                                        onChange={(e) => setCustomStartDate(e.target.value)}
                                    />
                                    <span>à</span>
                                    <input
                                        type="date"
                                        className="flex-1 p-1 border rounded"
                                        value={customEndDate}
                                        onChange={(e) => setCustomEndDate(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={handleCustomDateSubmit}
                                    className="w-full p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                    Appliquer
                                </button>
                            </div>
                        </div>
                        <div className="max-h-64 overflow-y-auto p-2">
                            {getDateSegments().map((segment) => (
                                <button
                                    key={segment.label}
                                    onClick={() => handleSegmentSelect(segment)}
                                    className="w-full text-left p-2 hover:bg-gray-50 rounded-md transition-colors duration-150"
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