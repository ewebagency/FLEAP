"use client"
import React, { useEffect, useState, useRef } from "react";
import { useFilterContext } from "../FilterContext";
import { useSession } from "./SessionProvider";
import { supabase } from "../database/supabaseClient";
import BoxIcon from '@/app/component/BoxIconWrapper';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { usePathname } from 'next/navigation';

interface DateSegment {
    label: string;
    debut: Date;
    fin: Date;
}

const FiltreDate = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { setSegmentDates, setServerDateSearch } = useFilterContext();
    const {entreprise_id} = useSession();
    const containerRef = useRef<HTMLDivElement>(null);
    const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
    const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
    const [activeSegment, setActiveSegment] = useState<string>('');
    const pathname = usePathname();
    const isRegisterPage = pathname?.includes('/register');

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const getDateSegments = (): DateSegment[] => {
        const now = new Date();
        const currentYear = now.getFullYear();
        
        // Début et fin de l'année en cours
        const startOfYear = new Date(currentYear, 0, 1);
        const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

        // Année précédente
        const startOfLastYear = new Date(currentYear - 1, 0, 1, 0, 0, 0);
        const endOfLastYear = new Date(currentYear - 1, 11, 31, 23, 59, 59);

        return [
            {
                label: "Année en cours",
                debut: startOfYear,
                fin: endOfYear
            },
            {
                label: "Année précédente",
                debut: startOfLastYear,
                fin: endOfLastYear
            }
        ];
    };

    const getDatesFromEntreprise = async () => {
        if (entreprise_id) {
            // Détecter si on est sur mobile (largeur d'écran < 768px)
            const isMobile = window.innerWidth < 768;

            if (isMobile) {
                // Pour mobile : 5 ans avant, 1 an après
                const minDate = new Date();
                minDate.setFullYear(minDate.getFullYear() - 5);
                minDate.setDate(1); // Premier jour du mois
                minDate.setHours(0, 0, 0, 0);

                const maxDate = new Date();
                maxDate.setFullYear(maxDate.getFullYear() + 1);
                maxDate.setMonth(maxDate.getMonth() + 1); // Mois suivant
                maxDate.setDate(0); // Dernier jour du mois
                maxDate.setHours(23, 59, 59, 999);

                setSegmentDates({ debut: minDate, fin: maxDate });
                setCustomStartDate(minDate);
                setCustomEndDate(maxDate);
                setActiveSegment('custom');
                
                localStorage.setItem('selectedDates', JSON.stringify({ 
                    debut: minDate, 
                    fin: maxDate 
                }));
                localStorage.setItem('activeSegment', 'custom');
                return;
            }

            // Version desktop : comportement existant
            const { data: minData, error: minError } = await supabase
                .from('bsd')
                .select('created_at')
                .eq('entreprise_id', entreprise_id)
                .order('created_at', { ascending: true })
                .limit(1)
                .single();
            
            if (minError) {
                console.error('Error fetching dates:', minError);
                return;
            }

            console.log("minData", minData);

            const maxDate = new Date();
            if (isRegisterPage) {
                maxDate.setFullYear(maxDate.getFullYear() + 1);
            }
            maxDate.setHours(23, 59, 59, 999);

            if (minData) {
                const minDate = new Date(minData.created_at);
                minDate.setDate(1);
                minDate.setHours(0, 0, 0, 0);

                setSegmentDates({ debut: minDate, fin: maxDate });
                setCustomStartDate(minDate);
                setCustomEndDate(maxDate);
                setActiveSegment('custom');
                
                localStorage.setItem('selectedDates', JSON.stringify({ 
                    debut: minDate, 
                    fin: maxDate 
                }));
                localStorage.setItem('activeSegment', 'custom');
            }
        }
    };

    useEffect(() => {
        if (!entreprise_id) return;

        // Sur la page registre, on force toujours le mode "Tout voir" - permet de ne pas avoir de bug de truc mal filtré
        if (isRegisterPage) {
            setServerDateSearch(false);
            getDatesFromEntreprise();
            return;
        }

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entreprise_id, isRegisterPage]);

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

    const handleDateChange = (date: Date | null, isStart: boolean) => {
        if (date) {
            const adjustedDate = new Date(date);
            
            if (isStart) {
                // Premier jour du mois à 00:00:00
                adjustedDate.setDate(1);
                adjustedDate.setHours(0, 0, 0, 0);
                
                setCustomStartDate(adjustedDate);
                if (customEndDate) {
                    setSegmentDates({ debut: adjustedDate, fin: customEndDate });
                    setActiveSegment('custom');
                    localStorage.setItem('selectedDates', JSON.stringify({ 
                        debut: adjustedDate, 
                        fin: customEndDate 
                    }));
                    localStorage.setItem('activeSegment', 'custom');
                }
            } else {
                // Dernier jour du mois à 23:59:59
                adjustedDate.setMonth(adjustedDate.getMonth() + 1);
                adjustedDate.setDate(0);
                adjustedDate.setHours(23, 59, 59, 999);
                
                setCustomEndDate(adjustedDate);
                if (customStartDate) {
                    setSegmentDates({ debut: customStartDate, fin: adjustedDate });
                    setActiveSegment('custom');
                    localStorage.setItem('selectedDates', JSON.stringify({ 
                        debut: customStartDate, 
                        fin: adjustedDate 
                    }));
                    localStorage.setItem('activeSegment', 'custom');
                }
            }
        }
    };

    return (
        <div 
            ref={containerRef}
            className="my-1 relative"
            onClick={(e) => {
                e.stopPropagation();
                setIsOpen(!isOpen);
            }}
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
                    <div className="absolute left-0 w-full h-2 -bottom-2" onClick={(e) => e.stopPropagation()} />
                    <div className="absolute top-full left-0 w-64 mt-0 bg-white rounded-lg border border-gray-200 z-50" onClick={(e) => e.stopPropagation()}>
                        <div className="p-2 border-b border-gray-200">
                            <div className="flex flex-col space-y-2">
                                <div className="flex items-center justify-between space-x-2">
                                    <div>
                                        <DatePicker
                                            selected={customStartDate}
                                            onChange={(date) => handleDateChange(date, true)}
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
                                        onChange={(date) => handleDateChange(date, false)}
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
                                        onClick={() => {
                                            getDatesFromEntreprise();
                                            setServerDateSearch(false);
                                            setIsOpen(false);
                                        }}
                                        className="w-full p-1.5 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                                    >
                                        {isRegisterPage ? "Tout voir" : "Aujourd'hui"}
                                    </button>
                                    <button
                                        onClick={() => {
                                            // Déclencher une recherche côté serveur avec les dates courantes
                                            setServerDateSearch(true);
                                            setIsOpen(false);
                                        }}
                                        className="w-full p-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                                    >
                                        Rechercher
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