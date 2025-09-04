'use client'
import React, { useMemo, useState } from "react";
import { useAnalysis } from "@/app/analysis/AnalysisProvider";
import { getFiliere } from "@/app/register/RegisterComponents/Modal/FormulaireFull/utils_new";
import { BSD } from '@/app/analysis/AnalysisProvider';

interface WasteDetail {
    code: string;
    description: string;
    quantity: number;
}

const removeAccents = (str: string) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

// Fonction exportée pour calculer le taux de tri
export const calculateTauxTri = (
    bsds: BSD[], 
    mappingTable: Array<{ced?: string, nom?: string, filiere: string, trie?: boolean, multiflux?: boolean, tri?: boolean}>, 
    filieres_ou_prestataires: { nom: 'filiere' | 'filiere_nom' }
) => {
    let totalWeight = 0;
    let nonRecycledWeight = 0;
    let triByPresta = 0
    const wasteDetails: { [key: string]: WasteDetail } = {};

    bsds.forEach((bsd: BSD) => {
        const quantityReceived = bsd.infos_json.formAPI.createFormInput.quantityReceived;
        const quantity = (typeof quantityReceived === 'number' && !isNaN(quantityReceived) && quantityReceived > 0)
            ? quantityReceived
            : (bsd.infos_json.formAPI.createFormInput.wasteDetails.quantity || 0);
        totalWeight += quantity;

        let filiere: string;
        let tri_potentiel = false;

        if (filieres_ou_prestataires.nom === 'filiere_nom') {
            // En mode filiere_nom, utiliser le mapping_nom_filiere
            const wasteName = bsd.infos_json.formAPI.createFormInput.wasteDetails.name;
            const mappingEntry = mappingTable.find(item => item.nom === wasteName);
            filiere = mappingEntry ? mappingEntry.filiere : 'Autres';
            tri_potentiel = mappingEntry ? (mappingEntry.trie || false) : false;
        } else {
            // En mode filiere, utiliser le mapping CED
            filiere = getFiliere(
                bsd.infos_json.formAPI.createFormInput.wasteDetails.code,
                mappingTable as Array<{ced: string, filiere: string}>
            ) || 'Autres';
            
            // Utiliser other_infos.tri pour le mode filiere
            if (bsd.other_infos?.tri) {
                tri_potentiel = bsd.other_infos.tri;
            }

            // Priorité aux flags au niveau CED (multiflux/tri) si présents dans le mapping
            const cedCodeRaw = bsd.infos_json.formAPI.createFormInput.wasteDetails.code || '';
            const cedCode = cedCodeRaw.replace(/[^\d]/g, '');
            const cleanCed = (c?: string) => (c || '').replace(/[^\d]/g, '');
            const mappingEntryCed = (mappingTable as Array<{ced?: string, multiflux?: boolean, tri?: boolean}>).find(item => cleanCed(item.ced) === cedCode);
            const mappingMultiflux: boolean | undefined = mappingEntryCed?.multiflux;
            const mappingTri: boolean | undefined = mappingEntryCed?.tri;

            if (mappingMultiflux === true && mappingTri === true) {
                // Multiflux + trié => tri global (prestataire)
                triByPresta += quantity;
                // Ne pas compter comme non trié, et ignorer la suite
                return;
            }
            if (mappingMultiflux === true && mappingTri === false) {
                // Multiflux + non trié => pas trié
                nonRecycledWeight += quantity;
                // Ajouter au détail des non triés
                const code = bsd.infos_json.formAPI.createFormInput.wasteDetails.code;
                const description = bsd.infos_json.formAPI.createFormInput.wasteDetails.name;
                if (!wasteDetails[description]) {
                    wasteDetails[description] = {
                        code,
                        description,
                        quantity: 0
                    };
                }
                wasteDetails[description].quantity += quantity;
                // Ignorer la suite
                return;
            }
            if (mappingMultiflux === false) {
                // Monoflux => trié sur site: ne rien ajouter à nonRecycledWeight ni triByPresta
                return;
            }
        }

        // Logique différenciée selon le mode
        if (filieres_ou_prestataires.nom === 'filiere_nom') {
            // Mode filiere_nom : évaluer le tri pour TOUS les déchets selon leur mapping individuel
            if (!tri_potentiel) {
                nonRecycledWeight += quantity;
            } else {
                const wasteName = bsd.infos_json.formAPI.createFormInput.wasteDetails.name;
                if(removeAccents(wasteName).toLowerCase().includes('melang')){
                    triByPresta += quantity;
                }
            }
        } else {
            // Mode filiere : évaluer le tri seulement pour les filières DIB, Autres, DAS
            const wasteName = bsd.infos_json.formAPI.createFormInput.wasteDetails.name;
            const isMixedWaste = removeAccents(wasteName).toLowerCase().includes('melang');
            
            if (filiere === 'DIB' || filiere === 'Autres' || filiere === 'DAS') {
                if (!tri_potentiel) {
                    nonRecycledWeight += quantity;
                } else if (isMixedWaste) {
                    triByPresta += quantity;
                }
            } else {
                // Pour les autres filières, tous les déchets mélangés vont au triByPresta
                if (isMixedWaste) {
                    triByPresta += quantity;
                }
            }
        }

        // Ajouter les déchets non triés dans wasteDetails pour le tooltip (même logique que ci-dessus)
        if ((filieres_ou_prestataires.nom === 'filiere_nom' && !tri_potentiel) || 
            (filieres_ou_prestataires.nom === 'filiere' && (filiere === 'DIB' || filiere === 'Autres' || filiere === 'DAS') && !tri_potentiel)) {
            
            const code = bsd.infos_json.formAPI.createFormInput.wasteDetails.code;
            const description = bsd.infos_json.formAPI.createFormInput.wasteDetails.name;

            if (!wasteDetails[description]) {
                wasteDetails[description] = {
                    code,
                    description,
                    quantity: 0
                };
            }
            wasteDetails[description].quantity += quantity;
        }
    });

    // Trier les déchets par quantité décroissante
    const nonRecycledDetails = Object.values(wasteDetails)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5); // Garder les 5 plus importants

    const tauxTri = totalWeight > 0 ? ((totalWeight - nonRecycledWeight) / totalWeight) * 100 : 0;
    const tauxTriSurSite = totalWeight > 0 ? ((totalWeight - nonRecycledWeight - triByPresta) / totalWeight) * 100 : 0;
    return { tauxTri, totalWeight, nonRecycledDetails, tauxTriSurSite, triByPresta };
};

const TauxTri = () => {
    const { bsds, mappingTable, filieres_ou_prestataires } = useAnalysis();
    const [showTooltipSurSite, setShowTooltipSurSite] = useState(false);
    const [showTooltipGlobal, setShowTooltipGlobal] = useState(false);

    const { tauxTri, nonRecycledDetails, tauxTriSurSite } = useMemo(() => {
        return calculateTauxTri(bsds, mappingTable, filieres_ou_prestataires);
    }, [bsds, mappingTable, filieres_ou_prestataires]);

    return (
        <div className="grid grid-cols-2 gap-2">
            {/* Taux de tri sur site */}
            <div 
                className="relative bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-2 shadow-sm hover:shadow-md transition-all duration-200"
                onMouseEnter={() => setShowTooltipSurSite(true)}
                onMouseLeave={() => setShowTooltipSurSite(false)}
            >
                <div className="text-sm text-green-600 mb-1">
                    <p>Tri sur site</p>
                </div>
                
                <div className="flex items-center justify-between gap-2 ml-2">
                    <div className="text-lg font-bold text-green-800">
                        {tauxTriSurSite.toFixed(1)}%
                    </div>

                </div>

                {showTooltipSurSite && nonRecycledDetails.length > 0 && (
                    <div className="absolute z-20 bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-900 text-white p-3 rounded-lg shadow-xl text-xs w-56">
                        <div className="font-semibold mb-1">Détails tri sur site</div>
                        <div className="text-gray-300">Principaux déchets non triés:</div>
                        {nonRecycledDetails.slice(0, 3).map((waste, index) => (
                            <div key={index} className="text-gray-300">
                                {waste.code}: {waste.quantity.toFixed(1)}T
                            </div>
                        ))}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                    </div>
                )}
            </div>

            {/* Taux de tri global */}
            <div 
                className="relative bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200 rounded-lg p-2 shadow-sm hover:shadow-md transition-all duration-200"
                onMouseEnter={() => setShowTooltipGlobal(true)}
                onMouseLeave={() => setShowTooltipGlobal(false)}
            >
                <div className="text-sm text-indigo-600 mb-1">
                    <p>Tri global</p>
                </div>
                
                <div className="flex items-center justify-between gap-2 ml-2">
                    <div className="text-lg font-bold text-indigo-800">
                        {tauxTri.toFixed(1)}%
                    </div>
                </div>

                {showTooltipGlobal && nonRecycledDetails.length > 0 && (
                    <div className="absolute z-20 bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-900 text-white p-3 rounded-lg shadow-xl text-xs w-56">
                        <div className="font-semibold mb-1">Détails tri global</div>
                        <div className="text-gray-300">Principaux déchets non triés:</div>
                        {nonRecycledDetails.slice(0, 3).map((waste, index) => (
                            <div key={index} className="text-gray-300">
                                {waste.code}: {waste.quantity.toFixed(1)}T
                            </div>
                        ))}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default TauxTri;
