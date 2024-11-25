'use client';
import { useEffect, useState } from "react";
import { useSession } from "../component/SessionProvider";
import ColonneFactures from "./components/ColonneFactures";
import FactureLine from "./interface/facture_line";
import { BSD_on_Supabase } from "./interface/bsd_line";
import ColonneBSDs from "./components/ColonneBSDs";

interface SelectedFacture {
    factureId: string;
    lineNumber: number;
}

const LienPage = () => {
    const session = useSession();
    const [factureLines, setFactureLines] = useState<FactureLine[]>([]);
    const [BSDs, setBSDs] = useState<BSD_on_Supabase[]>([]);
    const [selectedFacture, setSelectedFacture] = useState<SelectedFacture | null>(null);
    const [selectedBSD, setSelectedBSD] = useState<string | null>(null);
    const [loading, setLoading] = useState(false); // Loading state

    const fetchDataFactures = async (user_id: string) => {
        const response = await fetch(`/api/lien/get_factures_non_treated?user_id=${user_id}`);
        const data = await response.json();
        setFactureLines(data.lignes);
    }

    const fetchDataBSDs = async (user_id: string) => {
        const response = await fetch(`/api/lien/get_bsds_non_linked?user_id=${user_id}`);
        const data = await response.json();
        setBSDs(data.bsds);
        console.log('dataaaaa', data);
    }

    // Route API pour récupérer les lignes de factures non traitées
    useEffect(() => {
        if (session && session.user && session.user.id) {
            fetchDataFactures(session.user.id);
        }
    }, [session]);

    // Route API pour récupérer les BSDs non linkés
    useEffect(() => {
        if (session && session.user && session.user.id) {
            fetchDataBSDs(session.user.id);
        }
    }, [session]);

    const handleLink = async () => {
        if (!selectedFacture || !selectedBSD) {
            alert("Veuillez sélectionner une facture et un BSD");
            return;
        }

        setLoading(true); // Set loading to true

        try {
            const response = await fetch('/api/lien/link_facture_bsd', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    factureId: selectedFacture.factureId,
                    lineNumber: selectedFacture.lineNumber,
                    bsdId: selectedBSD,
                }),
            });

            if (response.ok) {
                // Refresh data after successful linking
                if (session && session.user && session.user.id) {
                    fetchDataFactures(session.user.id);
                    fetchDataBSDs(session.user.id);
                }
                setSelectedFacture(null);
                setSelectedBSD(null);
            }
        } catch (error) {
            console.error('Error linking documents:', error);
        } finally {
            setLoading(false); // Set loading to false after the process
        }
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold mb-6 text-center">Liaison Factures - BSDs</h1>
            <div className="flex justify-center items-start space-x-8">
                <div className="w-1/3">
                    <h2 className="text-xl font-semibold mb-4 text-center">Factures</h2>
                    <div className="bg-white rounded-lg shadow-lg p-4 max-h-[70vh] overflow-y-auto">
                        <ColonneFactures 
                            factureLines={factureLines} 
                            selectedFacture={selectedFacture}
                            setSelectedFacture={setSelectedFacture}
                        />
                    </div>
                </div>

                <div className="flex flex-col justify-center items-center w-1/6">
                    <button 
                        onClick={handleLink}
                        disabled={!selectedFacture || !selectedBSD || loading} // Disable button while loading
                        className={`px-6 py-3 rounded-lg shadow-md text-white font-semibold
                            ${(!selectedFacture || !selectedBSD || loading) 
                                ? 'bg-gray-400 cursor-not-allowed' 
                                : 'bg-blue-500 hover:bg-blue-600'}`}
                    >
                        {loading ? (
                            <span className="flex items-center">
                                <svg className="animate-spin h-5 w-5 mr-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                                </svg>
                                Chargement...
                            </span>
                        ) : (
                            "Lier →"
                        )}
                    </button>
                </div>

                <div className="w-1/3">
                    <h2 className="text-xl font-semibold mb-4 text-center">BSDs</h2>
                    <div className="bg-white rounded-lg shadow-lg p-4 max-h-[70vh] overflow-y-auto">
                        <ColonneBSDs 
                            BSDs={BSDs} 
                            selectedBSD={selectedBSD}
                            setSelectedBSD={setSelectedBSD}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LienPage;