interface FooterSectionProps {
    total: number;
    onSkip: () => void;
    onReset: () => void;
    loading: boolean;
}

export const FooterSection = ({ total, onSkip, onReset, loading }: FooterSectionProps) => {
    return (
        <div className="bg-white p-3 rounded shadow">
            <div className="flex justify-between items-center">
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={onSkip}
                        className="px-4 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 hidden"
                        disabled={loading}
                    >
                        Passer
                    </button>
                    <button
                        type="button"
                        onClick={onReset}
                        className="px-4 py-2 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600 hidden"
                        disabled={loading}
                    >
                        Réinitialiser les passés
                    </button>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-sm font-semibold">
                        Total HT: {total.toFixed(2)} €
                    </div>
                    <button
                        type="submit"
                        className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                        disabled={loading}
                    >
                        {loading ? (
                            <div className="flex items-center gap-2">
                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Enregistrement...
                            </div>
                        ) : (
                            'Enregistrer'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}; 