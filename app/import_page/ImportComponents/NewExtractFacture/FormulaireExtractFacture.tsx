'use client';

import { useState, useEffect } from 'react';
import { FactureLine } from './type';
import {
    getInitialFormData,
    updateHeader,
    updateDepart,
    addDepart,
    removeDepart,
    addLine,
    removeLine,
    updateLine,
    updateTotal,
    getAutocompletionOptions,
    getSiretByPrestataire,
    getPrestataireBySiret,
    getCodeCedByDechet,
    getDechetByCodeCed,
    getSiretBySite,
    getSiteBySiret,
    getVolumeByContenant,
    getUniteByContenant,
    transformFormDataToTargetStructure,
    saveFactureToDatabase,
    getExistingFactureData,
    transformTargetStructureToFormData
} from './FormulaireExtractFactureFunctionnal';
import { ALL_OPERATIONS, UNITES } from '../../../interface_admin_2/InterfaceAdmin2/constants/formConstants';
import { useSession } from '@/app/component/SessionProvider';
import { toast } from 'react-hot-toast';

// Type pour les options d'autocomplétion
interface AutocompletionOption {
    value: string;
    isSuggested: boolean;
}

interface AutocompletionOptions {
    prestataireOptions: AutocompletionOption[];
    siretOptions: AutocompletionOption[];
    siteSiretOptions: AutocompletionOption[];
    siteOptions: AutocompletionOption[];
    dechetOptions: AutocompletionOption[];
    codeCedOptions: AutocompletionOption[];
    numClientOptions: AutocompletionOption[];
    contenantOptions: AutocompletionOption[];
}

// Type pour les données brutes d'autocomplétion
interface RawAutocompletionData {
    id: number;
    created_at: string;
    entreprise_id: number;
    site: { nom: string; siret: string; adresseSiege: string } | null;
    transporteur: { nomBoite?: string; siret?: string; adresse?: string } | null;
    destinataire: { nomBoite?: string; siret?: string; adresse?: string } | null;
    dechet: { nom: string; codeCED: string; onu: string; adr: string } | null;
    contrat: { nom: string; num_client: string } | null;
    contenant?: { nom: string; volume: string; uniteVolume: string } | null;
}

const FormulaireExtractFacture = ({ pdf_id, onSuccess }: { pdf_id: number; onSuccess?: () => void }) => {
    const {entreprise_id, user_id} = useSession();
    const [formData, setFormData] = useState<FactureLine>(getInitialFormData());
    const [autocompletionOptions, setAutocompletionOptions] = useState<AutocompletionOptions>({
        prestataireOptions: [],
        siretOptions: [],
        siteSiretOptions: [],
        siteOptions: [],
        dechetOptions: [],
        codeCedOptions: [],
        numClientOptions: [],
        contenantOptions: []
    });
    const [loading, setLoading] = useState(true);
    const [rawAutocompletionData, setRawAutocompletionData] = useState<RawAutocompletionData[]>([]);

    // Charger les options d'autocomplétion au montage du composant
    useEffect(() => {
        const loadAutocompletionOptions = async () => {
            try {
                const options = await getAutocompletionOptions(entreprise_id || '');
                setAutocompletionOptions(options);
                
                // Récupérer aussi les données brutes pour les liens
                const { fetchAutocompletionData } = await import('./FormulaireExtractFactureFunctionnal');
                const rawData = await fetchAutocompletionData(entreprise_id || '');
                setRawAutocompletionData(rawData);
            } catch (error) {
                console.error('Erreur lors du chargement des options d\'autocomplétion:', error);
            } finally {
                setLoading(false);
            }
        };

        loadAutocompletionOptions();
    }, [entreprise_id]);

    // Charger les données existantes si elles existent
    useEffect(() => {
        const loadExistingData = async () => {
            try {
                console.log('🔍 Recherche de données existantes pour PDF:', pdf_id);
                const existingData = await getExistingFactureData(pdf_id);
                
                if (existingData) {
                    console.log('📋 Données existantes trouvées, préremplissage du formulaire');
                    const formDataFromExisting = transformTargetStructureToFormData(existingData);
                    setFormData(formDataFromExisting);
                } else {
                    console.log('📭 Aucune donnée existante, formulaire vide');
                }
            } catch (error) {
                console.error('❌ Erreur lors du chargement des données existantes:', error);
            }
        };

        if (pdf_id) {
            loadExistingData();
        }
    }, [pdf_id]);

    // Mettre à jour le total quand les départs changent
    useEffect(() => {
        setFormData(prev => updateTotal(prev));
    }, [formData.departs]);

    const handleHeaderChange = (field: keyof FactureLine['header'], value: string) => {
        setFormData(prev => {
            let newFormData = updateHeader(prev, field, value);
            
            // Liens entre les champs du header
            if (field === 'prestataire_nom' && value) {
                // Prestataire → SIRET
                const siret = getSiretByPrestataire(rawAutocompletionData, value);
                if (siret) {
                    newFormData = updateHeader(newFormData, 'prestataire_siret', siret);
                }
            } else if (field === 'prestataire_siret' && value) {
                // SIRET → Prestataire
                const prestataire = getPrestataireBySiret(rawAutocompletionData, value);
                if (prestataire) {
                    newFormData = updateHeader(newFormData, 'prestataire_nom', prestataire);
                }
            }
            
            return newFormData;
        });
    };

    const handleDepartChange = (departIndex: number, field: 'site_nom' | 'site_siret' | 'dechet_nom' | 'code_ced' | 'date_collecte' | 'contenant_nom' | 'contenant_volume' | 'contenant_unite', value: string) => {
        setFormData(prev => {
            let newFormData = updateDepart(prev, departIndex, field, value);
            
            // Liens bidirectionnels entre les champs du départ
            if (field === 'dechet_nom' && value) {
                // Déchet → Code CED
                const codeCed = getCodeCedByDechet(rawAutocompletionData, value);
                if (codeCed) {
                    newFormData = updateDepart(newFormData, departIndex, 'code_ced', codeCed);
                }
            } else if (field === 'code_ced' && value) {
                // Code CED → Déchet
                const dechet = getDechetByCodeCed(rawAutocompletionData, value);
                if (dechet) {
                    newFormData = updateDepart(newFormData, departIndex, 'dechet_nom', dechet);
                }
            } else if (field === 'site_nom' && value) {
                // Site → SIRET du site
                const siteSiret = getSiretBySite(rawAutocompletionData, value);
                if (siteSiret) {
                    newFormData = updateDepart(newFormData, departIndex, 'site_siret', siteSiret);
                }
            } else if (field === 'site_siret' && value) {
                // SIRET du site → Site
                const siteName = getSiteBySiret(rawAutocompletionData, value);
                if (siteName) {
                    newFormData = updateDepart(newFormData, departIndex, 'site_nom', siteName);
                }
            } else if (field === 'contenant_nom' && value) {
                // Contenant → Volume et Unité
                const volume = getVolumeByContenant(rawAutocompletionData, value);
                const unite = getUniteByContenant(rawAutocompletionData, value);
                if (volume) {
                    newFormData = updateDepart(newFormData, departIndex, 'contenant_volume', volume);
                }
                if (unite) {
                    newFormData = updateDepart(newFormData, departIndex, 'contenant_unite', unite);
                }
            }
            
            return newFormData;
        });
    };

    const handleAddDepart = () => {
        setFormData(prev => addDepart(prev));
    };

    const handleRemoveDepart = (departIndex: number) => {
        setFormData(prev => removeDepart(prev, departIndex));
    };

    const handleAddLine = (departIndex: number) => {
        setFormData(prev => addLine(prev, departIndex));
    };

    const handleRemoveLine = (departIndex: number, lineIndex: number) => {
        setFormData(prev => removeLine(prev, departIndex, lineIndex));
    };

    const handleLineChange = (departIndex: number, lineIndex: number, field: keyof FactureLine['departs'][0]['body'][0], value: string | number) => {
        setFormData(prev => updateLine(prev, departIndex, lineIndex, field, value));
    };

    const handleReset = () => {
        setFormData(getInitialFormData());
    };

    const handleSubmit = async () => {
        try {
            console.log('🎯 Début handleSubmit');
            console.log('📊 Données de session:', { user_id, entreprise_id, pdf_id });
            
            // Transformer les données du formulaire vers la structure cible
            const transformedData = transformFormDataToTargetStructure(formData);
            
            console.log('🔄 Données transformées:', transformedData);
            
            // Sauvegarder les données dans la BDD
            await saveFactureToDatabase(
                user_id || '',
                entreprise_id || '',
                pdf_id,
                transformedData
            );
            
            console.log('🎉 Sauvegarde terminée avec succès');
            toast.success('Facture extraite avec succès');
            
            if (onSuccess) {
                onSuccess();
            }
        } catch (error) {
            console.error('💥 Erreur lors de la soumission:', error);
            toast.error('Erreur lors de la soumission');
        }
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-500">Chargement des options...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-gray-50 rounded-lg overflow-hidden">
            {/* Header Section */}
            <div className="bg-white p-3 rounded shadow mb-2">
                <div className="flex justify-between items-center">
                    <h3 className="font-semibold mb-3">En-tête</h3>
                    <button
                        onClick={handleReset}
                        className="px-4 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 mb-2"
                    >
                        Reset
                    </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <select
                        value={formData.header.prestataire_nom}
                        onChange={(e) => handleHeaderChange('prestataire_nom', e.target.value)}
                        className="w-full p-1 text-xs border rounded"
                    >
                        <option value="">Prestataire</option>
                        {autocompletionOptions.prestataireOptions.map((option, index) => (
                            <option key={index} value={option.value}>{option.value}</option>
                        ))}
                    </select>
                    <select
                        value={formData.header.prestataire_siret}
                        onChange={(e) => handleHeaderChange('prestataire_siret', e.target.value)}
                        className="w-full p-1 text-xs border rounded"
                    >
                        <option value="">SIRET Prestataire</option>
                        {autocompletionOptions.siretOptions.map((option, index) => (
                            <option key={index} value={option.value}>{option.value}</option>
                        ))}
                    </select>
                    <input
                        type="text"
                        placeholder="Description prestataire"
                        value={formData.header.prestataire_description}
                        onChange={(e) => handleHeaderChange('prestataire_description', e.target.value)}
                        className="w-full p-1 text-xs border rounded"
                    />
                    <select
                        value={formData.header.prestataire_num_client}
                        onChange={(e) => handleHeaderChange('prestataire_num_client', e.target.value)}
                        className="w-full p-1 text-xs border rounded"
                    >
                        <option value="">N° client</option>
                        {autocompletionOptions.numClientOptions.map((option, index) => (
                            <option key={index} value={option.value}>{option.value}</option>
                        ))}
                    </select>
                    <input
                        type="text"
                        placeholder="N° facture"
                        value={formData.header.num_facture}
                        onChange={(e) => handleHeaderChange('num_facture', e.target.value)}
                        className="w-full p-1 text-xs border rounded"
                    />
                    <input
                        type="date"
                        value={formData.header.date_facture}
                        onChange={(e) => handleHeaderChange('date_facture', e.target.value)}
                        className="w-full p-1 text-xs border rounded"
                    />
                </div>
            </div>

            {/* Body Section - Départs */}
            <div className="flex-1 bg-white p-3 rounded shadow mb-2 overflow-y-auto">
                <div className="space-y-4">
                    {formData.departs.map((depart, departIndex) => (
                        <div key={departIndex} className="bg-white p-3 rounded shadow relative border">
                            {/* Bouton de suppression du départ */}
                            {departIndex > 0 && (
                                <button
                                    type="button"
                                    onClick={() => handleRemoveDepart(departIndex)}
                                    className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                            
                            <h4 className="font-semibold mb-3">Départ {departIndex + 1}</h4>
                            
                            {/* Section Informations du départ - 2 + 4 colonnes */}
                            <div className="grid grid-cols-2 gap-2 mb-4">
                                <select
                                    value={depart.site_nom}
                                    onChange={(e) => handleDepartChange(departIndex, 'site_nom', e.target.value)}
                                    className="w-full p-1 text-xs border rounded"
                                >
                                    <option value="">Site</option>
                                    {autocompletionOptions.siteOptions.map((option, index) => (
                                        <option key={index} value={option.value}>{option.value}</option>
                                    ))}
                                </select>
                                <select
                                    value={depart.site_siret}
                                    onChange={(e) => handleDepartChange(departIndex, 'site_siret', e.target.value)}
                                    className="w-full p-1 text-xs border rounded"
                                >
                                    <option value="">SIRET Site</option>
                                    {autocompletionOptions.siteSiretOptions.map((option, index) => (
                                        <option key={index} value={option.value}>{option.value}</option>
                                    ))}
                                </select>                                
                            </div>
                            
                            <div className="grid grid-cols-4 gap-2 mb-4">
                                <select
                                    value={depart.dechet_nom}
                                    onChange={(e) => handleDepartChange(departIndex, 'dechet_nom', e.target.value)}
                                    className="w-full p-1 text-xs border rounded"
                                >
                                    <option value="">Déchet</option>
                                    {autocompletionOptions.dechetOptions.map((option, index) => (
                                        <option key={index} value={option.value}>{option.value}</option>
                                    ))}
                                </select>
                                <select
                                    value={depart.code_ced}
                                    onChange={(e) => handleDepartChange(departIndex, 'code_ced', e.target.value)}
                                    className="w-full p-1 text-xs border rounded"
                                >
                                    <option value="">Code CED</option>
                                    {autocompletionOptions.codeCedOptions.map((option, index) => (
                                        <option key={index} value={option.value}>{option.value}</option>
                                    ))}
                                </select>
                                <select
                                    value={depart.contenant_nom}
                                    onChange={(e) => handleDepartChange(departIndex, 'contenant_nom', e.target.value)}
                                    className="w-full p-1 text-xs border rounded"
                                >
                                    <option value="">Contenant</option>
                                    {autocompletionOptions.contenantOptions.map((option, index) => (
                                        <option key={index} value={option.value}>{option.value}</option>
                                    ))}
                                </select>
                                <input
                                    type="date"
                                    placeholder="Date de collecte"
                                    value={depart.date_collecte}
                                    onChange={(e) => handleDepartChange(departIndex, 'date_collecte', e.target.value)}
                                    className="w-full p-1 text-xs border rounded"
                                />
                            </div>
                            
                            {/* Section Volume et Unité du contenant */}
                            <div className="grid grid-cols-2 gap-2 mb-4 hidden">
                                <input
                                    type="text"
                                    placeholder="Volume du contenant"
                                    value={depart.contenant_volume}
                                    onChange={(e) => handleDepartChange(departIndex, 'contenant_volume', e.target.value)}
                                    className="w-full p-1 text-xs border rounded"
                                    readOnly
                                />
                                <input
                                    type="text"
                                    placeholder="Unité du contenant"
                                    value={depart.contenant_unite}
                                    onChange={(e) => handleDepartChange(departIndex, 'contenant_unite', e.target.value)}
                                    className="w-full p-1 text-xs border rounded"
                                    readOnly
                                />
                            </div>

                            {/* Section Lignes de prestations */}
                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between items-center">
                                    <h5 className="font-medium text-sm">Lignes de prestations</h5>
                                    <button
                                        onClick={() => handleAddLine(departIndex)}
                                        className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                                    >
                                        + Ajouter ligne
                                    </button>
                                </div>

                                {depart.body.map((line, lineIndex) => (
                                    <div key={lineIndex} className="grid grid-cols-6 gap-2 items-center">
                                        <select
                                            value={line.type_operation}
                                            onChange={(e) => handleLineChange(departIndex, lineIndex, 'type_operation', e.target.value)}
                                            className="w-full p-1 text-xs border rounded mt-6"
                                        >
                                            {ALL_OPERATIONS.map(op => (
                                                <option key={op} value={op}>{op}</option>
                                            ))}
                                        </select>

                                        <select
                                            value={line.unite}
                                            onChange={(e) => handleLineChange(departIndex, lineIndex, 'unite', e.target.value)}
                                            className="w-full p-1 text-xs border rounded mt-6"
                                        >
                                            {UNITES.map(unite => (
                                                <option key={unite} value={unite}>{unite}</option>
                                            ))}
                                        </select>

                                        <div>
                                            <label className="text-xs text-gray-500 font-thin">Quantité</label>
                                            <input
                                                type="number"
                                                placeholder="Quantité"
                                                value={line.quantite}
                                                onChange={(e) => handleLineChange(departIndex, lineIndex, 'quantite', Number(e.target.value))}
                                                className="w-full p-1 text-xs border rounded"
                                                step="1"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs text-gray-500 font-thin">Prix unitaire</label>
                                            <input
                                                type="number"
                                                step="1"
                                                placeholder="Prix unitaire"
                                                value={line.prix_unitaire}
                                                onChange={(e) => handleLineChange(departIndex, lineIndex, 'prix_unitaire', Number(e.target.value))}
                                                className="w-full p-1 text-xs border rounded"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs text-gray-500 font-thin">Montant HT</label>
                                            <input
                                                type="number"
                                                step="1"
                                                placeholder="Montant HT"
                                                value={line.montant_ht}
                                                onChange={(e) => handleLineChange(departIndex, lineIndex, 'montant_ht', Number(e.target.value))}
                                                className="w-full p-1 text-xs border rounded"
                                            />
                                        </div>
                                        
                                        <div className="flex items-center justify-center mt-6">
                                            {lineIndex > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveLine(departIndex, lineIndex)}
                                                    className="h-[30px] px-2 bg-red-500 text-white rounded hover:bg-red-600 text-xs"
                                                >
                                                    -
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Bouton pour ajouter un nouveau départ */}
                    <button
                        type="button"
                        onClick={handleAddDepart}
                        className="w-full p-2 bg-green-500 text-white rounded hover:bg-green-600"
                    >
                        + Ajouter un départ
                    </button>
                </div>
            </div>

            {/* Footer Section */}
            <div className="bg-white p-3 rounded shadow">
                <div className="flex justify-end items-center">
                    <div className="flex items-center gap-4">
                        <div>
                            <div className="text-sm font-bold">
                                HT : {formData.footer.total_ht.toFixed(2)} €
                            </div>
                            <div className="text-sm font-bold">
                                TTC : {(formData.footer.total_ht * 1.2).toFixed(2)} €
                            </div>
                        </div>

                        <button
                            onClick={handleSubmit}
                            className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                            Enregistrer
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FormulaireExtractFacture;
