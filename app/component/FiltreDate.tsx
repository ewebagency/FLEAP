import { useState } from "react";

const FiltreDate = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [dateDebutForm, setDateDebutForm] = useState('');
    const [dateFinForm, setDateFinForm] = useState('');
    const [selectedOption, setSelectedOption] = useState('');

    const handleDateDebutFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDateDebutForm(e.target.value);
    };

    const handleDateFinFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDateFinForm(e.target.value);
    };

    const handleOptionChange = (option: string) => {
        setSelectedOption(option);
    };

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
    };

    return (
        <div className="m-4 relative">
            <div className="btn flex justify-between mb-1" onClick={toggleDropdown}>
                <h1 className="text-lg font-semibold">Dates</h1>
                <button className="text-lg">{isOpen ? '▲' : '▼'}</button>
            </div>
            {isOpen && (
                <div className="absolute top-full left-0 z-10 mt-1 border border-gray-300 rounded-md p-4 bg-white shadow-md">
                    <label className="flex items-center mb-3 cursor-pointer">
                        <input
                            type="radio"
                            checked={selectedOption === 'dates'}
                            onChange={() => handleOptionChange('dates')}
                            className="h-5 w-5 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-gray-700">Dates</span>
                    </label>
                    {selectedOption === 'dates' && (
                        <div className="ml-4 mb-2">
                            <label className="flex items-center mb-2">
                                <span className="mr-2 text-gray-700">Début</span>
                                <input
                                    type="date"
                                    value={dateDebutForm}
                                    onChange={handleDateDebutFormChange}
                                    className="border border-gray-300 rounded p-1"
                                />
                            </label>
                            <label className="flex items-center">
                                <span className="mr-2 text-gray-700">Fin</span>
                                <input
                                    type="date"
                                    value={dateFinForm}
                                    onChange={handleDateFinFormChange}
                                    className="border border-gray-300 rounded p-1"
                                />
                            </label>
                        </div>
                    )}
                    <label className="flex items-center mb-2 cursor-pointer">
                        <input
                            type="radio"
                            checked={selectedOption === 'annees'}
                            onChange={() => handleOptionChange('annees')}
                            className="h-5 w-5 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-gray-700">Année actuelle</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                        <input
                            type="radio"
                            checked={selectedOption === 'sixMois'}
                            onChange={() => handleOptionChange('sixMois')}
                            className="h-5 w-5 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-gray-700">6 derniers mois</span>
                    </label>
                </div>
            )}
        </div>
    );
}

export default FiltreDate;