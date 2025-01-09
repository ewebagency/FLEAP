import { useState, useEffect } from "react";
import { RecurrencePattern } from "./RecurrenceFunctionnal";

const Recurrence = ({ onRecurrenceChange }: { 
    onRecurrenceChange: (data: RecurrencePattern | null) => void,
}) => {
    const [isScheduled, setIsScheduled] = useState(false);
    const [frequency, setFrequency] = useState('days');
    const [frequencyNumber, setFrequencyNumber] = useState(1);
    const [selectedDays, setSelectedDays] = useState<string[]>([]);
    const [endType, setEndType] = useState('never');
    const [endDate, setEndDate] = useState('');
    const [occurrences, setOccurrences] = useState(1);
    const [name, setName] = useState('');
    const [enableRecurrence, setEnableRecurrence] = useState(false);

    const daysOfWeek = [
        { id: 'L', label: 'Lundi' },
        { id: 'M', label: 'Mardi' },
        { id: 'Me', label: 'Mercredi' },
        { id: 'J', label: 'Jeudi' },
        { id: 'V', label: 'Vendredi' },
        { id: 'S', label: 'Samedi' },
        { id: 'D', label: 'Dimanche' }
    ];

    const handleDayToggle = (day: string) => {
        setSelectedDays(prev => 
            prev.includes(day) 
                ? prev.filter(d => d !== day)
                : [...prev, day]
        );
    };


    // Modifier updateRecurrenceData pour ne pas créer la récurrence
    const updateRecurrenceData = () => {
        if (!enableRecurrence) {
            onRecurrenceChange(null);
            return;
        }

        const recurrencePattern: RecurrencePattern = {
            name,
            isScheduled,
            frequency: frequency as 'days' | 'weeks' | 'months' | 'years',
            frequencyNumber,
            selectedDays,
            endType: endType as 'never' | 'date' | 'occurrences',
            endDate: endType === 'date' ? endDate : undefined,
            occurrences: endType === 'occurrences' ? occurrences : undefined
        };
        
        onRecurrenceChange(recurrencePattern);
    };

    useEffect(() => {
        updateRecurrenceData();
    }, [name, isScheduled, frequency, frequencyNumber, selectedDays, endType, endDate, occurrences, enableRecurrence]);

    return (
        <div className="p-2 max-w-[400px] bg-white rounded-lg shadow-md float-left mr-4">
            <div className="mb-4">
                <label className="flex items-center text-sm font-medium text-gray-700">
                    <input
                        type="checkbox"
                        checked={enableRecurrence}
                        onChange={(e) => setEnableRecurrence(e.target.checked)}
                        className="mr-2"
                    />
                    Activer la récurrence
                </label>
            </div>

            {enableRecurrence && (
                <form className="space-y-3">
                    {/* Nom de la récurrence */}
                    <div className="flex items-center gap-4">
                        <label className="w-1/4 text-sm font-medium text-gray-700">
                            Nom
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="flex-1 p-1.5 text-sm border rounded-md focus:ring-2 focus:ring-blue-500"
                            placeholder="Nom de la récurrence"
                        />
                    </div>

                    {/* Fréquence */}
                    <div className="flex items-center gap-4">
                        <label className="w-1/4 text-sm font-medium text-gray-700">
                            Répéter tous les
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                min="1"
                                value={frequencyNumber}
                                onChange={(e) => setFrequencyNumber(parseInt(e.target.value))}
                                className="w-16 p-1.5 text-sm border rounded-md"
                            />
                            <select
                                value={frequency}
                                onChange={(e) => setFrequency(e.target.value)}
                                className="p-1.5 text-sm border rounded-md"
                            >
                                <option value="seconds">Secondes</option>
                                <option value="days">Jours</option>
                                <option value="weeks">Semaines</option>
                                <option value="months">Mois</option>
                                <option value="years">Années</option>
                            </select>
                        </div>
                    </div>

                    {/* Jours de la semaine - uniquement si frequency est "weeks" */}
                    {frequency === 'weeks' && (
                        <div className="flex items-center gap-4">
                            <label className="w-1/4 text-sm font-medium text-gray-700">
                                Jours
                            </label>
                            <div className="flex gap-1">
                                {daysOfWeek.map(day => (
                                    <button
                                        key={day.id}
                                        type="button"
                                        onClick={() => handleDayToggle(day.id)}
                                        className={`w-8 h-8 text-sm rounded-full flex items-center justify-center
                                            ${selectedDays.includes(day.id)
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-gray-100 text-gray-700'
                                            } hover:opacity-80 transition-colors`}
                                    >
                                        {day.id}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Fin de la récurrence */}
                    <div className="flex items-start gap-4">
                        <label className="w-1/4 text-sm font-medium text-gray-700 pt-1">
                            Se termine
                        </label>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    id="never"
                                    value="never"
                                    checked={endType === 'never'}
                                    onChange={(e) => setEndType(e.target.value)}
                                    className="form-radio"
                                />
                                <label htmlFor="never" className="text-sm">Jamais</label>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    id="date"
                                    value="date"
                                    checked={endType === 'date'}
                                    onChange={(e) => setEndType(e.target.value)}
                                    className="form-radio"
                                />
                                <label htmlFor="date" className="text-sm">Le</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    disabled={endType !== 'date'}
                                    className="p-1.5 text-sm border rounded-md"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    id="occurrences"
                                    value="occurrences"
                                    checked={endType === 'occurrences'}
                                    onChange={(e) => setEndType(e.target.value)}
                                    className="form-radio"
                                />
                                <label htmlFor="occurrences" className="text-sm">Après</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={occurrences}
                                    onChange={(e) => setOccurrences(parseInt(e.target.value))}
                                    disabled={endType !== 'occurrences'}
                                    className="w-16 p-1.5 text-sm border rounded-md"
                                />
                                <span className="text-sm">occurrences</span>
                            </div>
                        </div>
                    </div>
                </form>
            )}
        </div>
    );
};

export default Recurrence;