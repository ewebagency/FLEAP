"use client"
import React, { useEffect, useState, useRef } from "react";
import { useFilterContext } from "../FilterContext";
import { useSession } from "./SessionProvider";
import { supabase } from "../database/supabaseClient";
import BoxIcon from '@/app/component/BoxIconWrapper';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

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
    const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
    const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
    const [activeSegment, setActiveSegment] = useState<string>('');

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
            // Récupérer la date la plus ancienne
            const { data: minData, error: minError } = await supabase
                .from('bsd')
                .select('created_at')
                .eq('entreprise_id', session.entreprise_id)
                .order('created_at', { ascending: true })
                .limit(1)
                .single();
            
            // Récupérer la date la plus récente
            const { data: maxData, error: maxError } = await supabase
                .from('bsd')
                .select('created_at')
                .eq('entreprise_id', session.entreprise_id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (minError || maxError) {
                console.error('Error fetching dates:', minError || maxError);
                return;
            }

            if (minData && maxData) {
                const minDate = new Date(minData.created_at);
                const maxDate = new Date(maxData.created_at);
                
                // Ajuster au premier et dernier jour du mois
                minDate.setDate(1);
                maxDate.setMonth(maxDate.getMonth() + 1);
                maxDate.setDate(0);

                setSegmentDates({ debut: minDate, fin: maxDate });
                setCustomStartDate(minDate);
                setCustomEndDate(maxDate);
                setActiveSegment('custom');
                
                // Sauvegarder dans le localStorage
                localStorage.setItem('selectedDates', JSON.stringify({ 
                    debut: minDate, 
                    fin: maxDate 
                }));
                localStorage.setItem('activeSegment', 'custom');
            }
        }
    };

    useEffect(() => {
        // Charger les dates sauvegardées au démarrage
        const savedDates = localStorage.getItem('selectedDates');
        const savedSegment = localStorage.getItem('activeSegment');
        
        if (savedDates) {
            const { debut, fin } = JSON.parse(savedDates);
            const debutDate = new Date(debut);
            const finDate = new Date(fin);
            setSegmentDates({ debut: debutDate, fin: finDate });
            setCustomStartDate(debutDate);
            setCustomEndDate(finDate);
            if (savedSegment) {
                setActiveSegment(savedSegment);
            }
        } else {
            // Si pas de dates sauvegardées, charger depuis l'API
            getDatesFromEntreprise();
        }
    }, [session?.entreprise_id]);

    const handleSegmentSelect = (segment: DateSegment) => {
        setSegmentDates({ debut: segment.debut, fin: segment.fin });
        setCustomStartDate(segment.debut);
        setCustomEndDate(segment.fin);
        setActiveSegment(segment.label);
        localStorage.setItem('selectedDates', JSON.stringify({ 
            debut: segment.debut, 
            fin: segment.fin 
        }));
        localStorage.setItem('activeSegment', segment.label);
        setIsOpen(false);
    };

    const handleCustomDateSubmit = () => {
        if (customStartDate && customEndDate) {
            setSegmentDates({ debut: customStartDate, fin: customEndDate });
            setActiveSegment('custom');
            localStorage.setItem('selectedDates', JSON.stringify({ 
                debut: customStartDate, 
                fin: customEndDate 
            }));
            localStorage.setItem('activeSegment', 'custom');
            setIsOpen(false);
        }
    };

    return (
        <div 
            ref={containerRef}
            className="my-1 relative"
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
        >
            <div className="btn flex items-center justify-between px-2 py-1 bg-white rounded-lg hover:bg-gray-50 transition-all duration-200 w-full">
                <div className="flex items-center space-x-2">
                    <BoxIcon name='calendar' type='solid' size="18px" />
                    <h1 className="text-sm font-semibold text-gray-700">
                        {activeSegment === 'custom' 
                            ? `${customStartDate?.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })} - ${customEndDate?.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })}`
                            : activeSegment}
                    </h1>
                </div>
                <span className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                    ▼
                </span>
            </div>

            {isOpen && (
                <>
                    <div className="absolute left-0 w-full h-2 -bottom-2" />
                    <div className="absolute top-full left-0 w-64 mt-0 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                        <div className="p-2 border-b border-gray-200">
                            <div className="flex flex-col space-y-2">
                                <div className="flex items-center justify-between space-x-2">
                                    <div>
                                        <DatePicker
                                            selected={customStartDate}
                                            onChange={(date) => date && setCustomStartDate(date)}
                                            selectsStart
                                            startDate={customStartDate}
                                            endDate={customEndDate}
                                            dateFormat="MMM yy"
                                            showMonthYearPicker
                                            popperPlacement="right-start"
                                            className="w-full p-1 text-sm border rounded bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                    <span className="text-xs text-gray-500">à</span>
                                    <DatePicker
                                        selected={customEndDate}
                                        onChange={(date) => date && setCustomEndDate(date)}
                                        selectsEnd
                                        startDate={customStartDate}
                                        endDate={customEndDate}
                                        dateFormat="MMM yy"
                                        showMonthYearPicker
                                        popperPlacement="right-start"
                                        className="w-full p-1 text-sm border rounded bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={handleCustomDateSubmit}
                                        className="flex-1 p-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                                    >
                                        Appliquer
                                    </button>
                                    <button
                                        onClick={() => {
                                            getDatesFromEntreprise();
                                            setIsOpen(false);
                                        }}
                                        className="flex-2 p-1.5 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                                    >
                                        Auto
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                            {getDateSegments().map((segment) => (
                                <button
                                    key={segment.label}
                                    onClick={() => handleSegmentSelect(segment)}
                                    className={`w-full text-left p-2 text-sm transition-colors duration-150 
                                        ${activeSegment === segment.label 
                                            ? 'bg-blue-50 text-blue-700' 
                                            : 'hover:bg-gray-50'}`}
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