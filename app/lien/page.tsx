'use client';
import { useEffect, useState } from "react";
import { useSession } from "../component/SessionProvider";
import ColonneFactures from "./components/ColonneFactures";
import { FactureLine, FactureLineOnSupabase } from "./interface/facture_line";
import { BSD_on_Supabase } from "./interface/bsd_line";
import ColonneBSDs from "./components/ColonneBSDs";
import { supabase } from "../database/supabaseClient";
import { AccessOtherAccountProvider, useAccessOtherAccount } from "../interface_admin_2/AccessOtherAccounts/AccessOtherAccountContext";

interface SelectedFacture {
    id: string;
}

const LienPage = () => {
    const session = useSession();
    const [factureLines, setFactureLines] = useState<FactureLineOnSupabase[]>([]);
    const [BSDs, setBSDs] = useState<BSD_on_Supabase[]>([]);
    const [selectedFacture, setSelectedFacture] = useState<SelectedFacture | null>(null);
    const [selectedBSD, setSelectedBSD] = useState<string | null>(null);
    const [loading, setLoading] = useState(false); // Loading state
    const { selectedAccounts } = useAccessOtherAccount();

    const fetchDataFactures = async () => {
        const user_ids = selectedAccounts.map(account => account.user_id);
        const response = await fetch(`/api/lien/get_factures_non_treated?user_ids=${user_ids}`);
        const data = await response.json();
        setFactureLines(data.lignes);
    }

    const fetchDataBSDs = async () => {
        const user_ids = selectedAccounts.map(account => account.user_id);
        const getFactureInfos = async (factureId: string) => {
            const { data, error } = await supabase
                .from('facture')
                .select('infos_json')
                .eq('id', factureId)
                .single();
            if (error) return null;
            return data?.infos_json;
        }
        const filterBSDsOnSelectedFacture = async (bsds: BSD_on_Supabase[], selectedFacture: SelectedFacture | null) => {
            //console.log("bsds avant filtrage", bsds);
            //console.log("facture sélectionnée", selectedFacture);
            if (!selectedFacture) return bsds;
            const facture_infos = await getFactureInfos(selectedFacture.id);
            //console.log("facture_infos", facture_infos);
            //console.log("bsds", bsds);
            const bsdsFilteredOnPrestatairesOR = bsds.filter(bsd => (
                (bsd.infos_json.formAPI.createFormInput.transporter.company.name === facture_infos.header.prestataire_nom ||
                bsd.infos_json.formAPI.createFormInput.recipient.company.name === facture_infos.header.prestataire_nom) 
            ));
            const bsdsFilteredOnDechet = bsdsFilteredOnPrestatairesOR.filter(bsd => (
                (bsd.infos_json.formAPI.createFormInput.wasteDetails.name === facture_infos.depart.nom_dechet ||
                bsd.infos_json.formAPI.createFormInput.wasteDetails.code === facture_infos.depart.code_dechet) 
            ));
            if(bsdsFilteredOnPrestatairesOR.length === 0) return bsds;
            else if(bsdsFilteredOnPrestatairesOR.length === 1) return bsdsFilteredOnPrestatairesOR;
            else { // SI bsdsFilteredOnPrestatairesOR.length > 1
                if(bsdsFilteredOnDechet.length === 0) return bsdsFilteredOnPrestatairesOR;
                else return bsdsFilteredOnDechet // SI bsdsFilteredOnDechet.length >= 1
            }
        }

        const response = await fetch(`/api/lien/get_bsds_non_linked?user_ids=${user_ids}`);
        const data = await response.json();
        const bsdsAll = data.bsds;
        const bsdsFiltered = await filterBSDsOnSelectedFacture(bsdsAll, selectedFacture);
        //console.log("bsds après filtrage", bsdsFiltered);
        setBSDs(bsdsFiltered);
    }

    // Route API pour récupérer les lignes de factures non traitées
    useEffect(() => {
        if (selectedAccounts.length > 0) {
            fetchDataFactures();
        }
    }, [selectedAccounts]);

    // Route API pour récupérer les BSDs non linkés
    useEffect(() => {
        if (selectedAccounts.length > 0) {
            fetchDataBSDs();
        }
    }, [selectedAccounts, selectedFacture]);

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
                    factureId: selectedFacture.id,
                    bsdId: selectedBSD,
                }),
            });

            if (response.ok) {
                // Refresh data after successful linking
                if (selectedAccounts.length > 0) {
                    fetchDataFactures();
                    fetchDataBSDs();
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
            <AccessOtherAccountProvider>
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
            </AccessOtherAccountProvider>
        </div>
    );
};

export default LienPage;