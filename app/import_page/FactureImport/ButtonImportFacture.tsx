'use client'
import { useState, useRef, useEffect } from "react";
import { useSession } from "../../component/SessionProvider";

import * as XLSX from 'xlsx';
import toast from "react-hot-toast";
import { supabase } from "../../database/supabaseClient";
import BoxIcon from "../../component/BoxIconWrapper";

import { Row } from "../../register/ImportRegisterButton";

function siretFunction(input: string | number): string {
    const inputStr = String(input).replace(/\s+/g, '').trim(); // Suppression des espaces
    const siretRegex = /^[0-9]{14}$/; // Le SIRET est un numéro à 14 chiffres
  
    return siretRegex.test(inputStr) ? inputStr : ""; // Retourne le SIRET valide ou ""
  }

const cofounders_user_id = (user_id:string|null) => {
    if (user_id){
        if (user_id == "a0542794-bbae-4132-9dde-485595bfa2aa" || user_id == "8f05a291-f8b3-429d-839e-6f0b12f1bede" || user_id == "dd9acb15-4678-442f-af72-79331bc43d91"){
            return true;
        }
    }
    return false;
}

const convertToISO = (dateInput: string | number | boolean | undefined): string => {
    // Gérer les cas vides
    if (!dateInput) {
        return '';
    }

    try {
        // Si c'est une chaîne de caractères au format jj/mm/aaaa
        if (typeof dateInput === 'string' && dateInput.includes('/')) {
            const [day, month, year] = dateInput.split('/').map(Number);
            const date = new Date(year, month - 1, day); // month - 1 car les mois sont 0-indexés
            
            if (isNaN(date.getTime())) {
                console.warn(`Date invalide: ${dateInput}`);
                return '';
            }
            
            return date.toISOString();
        }
        
        // Si c'est un nombre (format Excel)
        const excelDate = Number(dateInput);
        if (!isNaN(excelDate)) {
            const date = new Date(Date.UTC(0, 0, excelDate - 1));
            
            if (isNaN(date.getTime())) {
                console.warn(`Date invalide: ${dateInput}`);
                return '';
            }
            
            return date.toISOString();
        }

        console.warn(`Format de date non reconnu: ${dateInput}`);
        return '';

    } catch (error) {
        console.error(`Erreur lors de la conversion de la date: ${dateInput}`, error);
        return '';
    }
};

// Nouvelle interface pour les données financières
interface FactureData {
    created_at: string;
    user_id: string;
    entreprise_id: string;

    /*other_infos: {
        code_ced: string;
        siret_emetteur: string;
        siret_transporteur: string;
        siret_destinataire: string;
        date_collecte: string;
    };*/
    infos_json: FactureJSON; // Vous remplirez cette partie plus tard
    status:string;
}

// Fonction utilitaire pour convertir une chaîne en nombre
const parseNumber = (value: number | string): number => {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    
    // Remplacer la virgule par un point et convertir en nombre
    const numberStr = String(value).replace(',', '.');
    const number = parseFloat(numberStr);
    return isNaN(number) ? 0 : number;
};

interface LineOperation {
    unite: string;
    quantite: number;
    montant_ht: number;
    prix_unitaire: number;
    type_operation: string;
    tva_rachat_pourcentage?: string;
}

interface LineHeader {
    filiere: string;
    site_nom: string;
    bon_pesee: string;
    site_siret: string;
    code_dechet: string;
    date_depart: string;
    num_dossier: string;
    type_dechet: string;
    bon_intention: string;
    site_description: string;
    site_num_affaire: string;
    dechet_description: string;
    tva_couts_pourcentage?: string;
}

interface Depart {
    line_body: LineOperation[];
    line_header: LineHeader;
    linked_to_bsd: boolean;
}

export interface FactureJSON {
    departs: Depart[];
    footer: {
        total_ht: number;
    };
    header: {
        num_facture: string;
        date_facture: string;
        prestataire_nom: string;
        prestataire_siret: string;
        prestataire_num_client: string;
        prestataire_description: string;
    };
}

// Fonction pour mapper les données Excel vers le format souhaité
export const mapToFactureFormat: (row: Row) => FactureData = (row) => {
    const factureJSON: FactureJSON = {
        departs: [{
            line_body: [
                {
                    unite: row["unitePreparation"]?.toString() || "",
                    quantite: parseNumber(row["quantitePreparation"]) || 0,
                    montant_ht: parseNumber(row["coutsPreparationHT"]) || 0,
                    prix_unitaire: parseNumber(row["PuHTPreparation"]) || 0,
                    type_operation: "Préparation"
                },
                {
                    unite: row["uniteTransport"]?.toString() || "",
                    quantite: parseNumber(row["quantiteTransport"]) || 0,
                    montant_ht: parseNumber(row["coutsTransportHT"]) || 0,
                    prix_unitaire: parseNumber(row["PuHTTransport"]) || 0,
                    type_operation: "Transport"
                },
                {
                    unite: row["uniteTraitement"]?.toString() || "",
                    quantite: parseNumber(row["quantiteTraitement"]) || 0,
                    montant_ht: parseNumber(row["coutsTraitementHT"]) || 0,
                    prix_unitaire: parseNumber(row["PuHTTraitement"]) || 0,
                    type_operation: "Traitement"
                },
                {
                    unite: row["uniteGlobale"]?.toString() || "",
                    quantite: parseNumber(row["quantiteGlobale"]) || 0,
                    montant_ht: parseNumber(row["coutGlobal"]) || 0,
                    prix_unitaire: parseNumber(row["puGlobal"]) || 0,
                    type_operation: "Gestion globale"
                },
                {
                    unite: row["uniteRachat"]?.toString() || "",
                    quantite: parseNumber(row["quantiteRachat"]) || 0,
                    montant_ht: parseNumber(row["rachatTotalHT"]) || 0,
                    prix_unitaire: parseNumber(row["PuHTRachat"]) || 0,
                    type_operation: "Rachat",
                    tva_rachat_pourcentage: row["tvaRachatPourcentage"]?.toString() || "",
                },
                {
                    unite: "",
                    quantite: parseNumber(row["quantiteContenantLocation"]) || 0,
                    montant_ht: parseNumber(row["equivalentCoutsContenantsHT"]) || 0,
                    prix_unitaire: parseNumber(row["puContenant"]) || 0,
                    type_operation: "Location"
                },
                {
                    unite: "",
                    quantite: parseNumber(row["quantiteContenantMiseDispo"]) || 0,
                    montant_ht: parseNumber(row["coutsMiseDispo"]) || 0,
                    prix_unitaire: parseNumber(row["puMiseDispo"]) || 0,
                    type_operation: "Mise à disposition"
                },
                {
                    unite: "",
                    quantite: parseNumber(row["quantiteContenantMaintenance"]) || 0,
                    montant_ht: parseNumber(row["coutsMaintenance"]) || 0,
                    prix_unitaire: parseNumber(row["puMaintenance"]) || 0,
                    type_operation: "Maintenance"
                },
                {
                    unite: "",
                    quantite: 0,
                    montant_ht: parseNumber(row["coutsContenantAutres"]) || 0,
                    prix_unitaire: 0,
                    type_operation: "Autres : Contenant"
                },
                {
                    unite: "",
                    quantite: 0,
                    montant_ht: parseNumber(row["autresCoutsHT"]) || 0,
                    prix_unitaire: 0,
                    type_operation: "Autres"
                },
                {
                    unite: "",
                    quantite: 0,
                    montant_ht: parseNumber(row["coutsNonExpliques"]) || 0,
                    prix_unitaire: 0,
                    type_operation: "Non expliqués"
                },
                {
                    unite: "",
                    quantite: 0,
                    montant_ht: parseNumber(row["coutsPenalites"]) || 0,
                    prix_unitaire: 0,
                    type_operation: "Pénalités"
                },
                {
                    unite: "",
                    quantite: 0,
                    montant_ht: parseNumber(row["coutsDeclassement"]) || 0,
                    prix_unitaire: 0,
                    type_operation: "Déclassement"
                },
                {
                    unite: "",
                    quantite: 0,
                    montant_ht: parseNumber(row["coutsTGAP"]) || 0,
                    prix_unitaire: 0,
                    type_operation: "TGAP"
                }
            ],
            line_header: {
                filiere: "",
                site_nom: row["nomSiteEmetteur"]?.toString() || "",
                bon_pesee: "",
                site_siret: siretFunction(row["siretEmetteur"]?.toString()) || "",
                code_dechet: row["codeCed"]?.toString() || "Inconnu",
                date_depart: convertToISO(row["dateCollecteTransporteur"]) || new Date().toISOString(),
                num_dossier: "",
                type_dechet: row["descDechet"]?.toString() || "Inconnu",
                bon_intention: "",
                site_description: row["nomSiteEmetteur"]?.toString() || "",
                site_num_affaire: "",
                dechet_description: "",
                tva_couts_pourcentage: row["tvaCoutsPourcentage"]?.toString() || "",
            },
            linked_to_bsd: false
        }],
        footer: {
            total_ht: parseNumber(row["coutsTGAP"]) + parseNumber(row["coutsDeclassement"]) + parseNumber(row["coutsPenalites"]) + parseNumber(row["coutsNonExpliques"]) + parseNumber(row["coutsContenantAutres"]) + parseNumber(row["autresCoutsHT"]) + parseNumber(row["coutsMiseDispo"]) + parseNumber(row["coutsMaintenance"]) + parseNumber(row["coutsTransportHT"]) + parseNumber(row["coutGlobal"]) + parseNumber(row["coutsTraitementHT"]) + parseNumber(row["coutsPreparationHT"]) - parseNumber(row["rachatTotalHT"]) + parseNumber(row["equivalentCoutsContenantsHT"])
        },
        header: {
            num_facture: "",
            date_facture: convertToISO(row["dateCollecteTransporteur"]) || "2023-11-30",
            prestataire_nom: row["nomTransporteur"]?.toString() || "",
            prestataire_siret: siretFunction(row["siretTransporteur"]?.toString()) || "",
            prestataire_num_client: "",
            prestataire_description: ""
        }
    };

    return {
        created_at: "",
        user_id: "", // Sera rempli plus tard
        entreprise_id: "", // Sera rempli plus tard
        infos_json: factureJSON,
        status:"IMPORTED"
    };
};

const sendToSupabase = async (factureData: FactureData) => {
    const { error } = await supabase
        .from('facture')
        .insert(factureData);

    if (error) {
        toast.error('Erreur lors de l\'import de la facture');
        console.error('Erreur Supabase:', error);
    } else {
        toast.success('Facture importée avec succès');
    }
};

const ButtonImportFacture = () => {
    const session = useSession();
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState<'success' | 'error'>('success');
    const [display, setDisplay] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [userId, setUserId] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isTestMode, setIsTestMode] = useState(false);
    
    useEffect(() => {
        if(session && session?.user_id){
            if (cofounders_user_id(session?.user_id)) {
                setDisplay(true);
            }
        }
    }, [session]);

    const handleButtonClick = (e: React.MouseEvent) => {
        e.preventDefault();
        setShowModal(true);
    };

    const handleSubmitForm = () => {
        setShowModal(false);
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        
        setIsLoading(true);
        try {
            if (!session) {
                throw new Error("Session non trouvée");
            }

            // Récupérer l'entreprise_id
            const { data: entreprise_infos, error } = await supabase
                .from('profiles')
                .select('entreprise_id')
                .eq('user_id', userId || session.user_id)
                .single();

            if (error) throw error;

            // Lire le fichier Excel
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            let jsonData = XLSX.utils.sheet_to_json(worksheet) as Row[];

            // Mode test
            if (isTestMode) {
                jsonData = jsonData
                    .sort(() => 0.5 - Math.random())
                    .slice(0, 3);
            }

            // Traiter les données
            for (const row of jsonData) {
                const factureData = mapToFactureFormat(row);
                if(userId){
                    factureData.user_id = userId;
                }else if (session.user_id){
                    factureData.user_id = session.user_id;
                }else{
                    throw new Error("User ID non trouvé");
                }
                factureData.entreprise_id = entreprise_infos.entreprise_id;
                factureData.created_at = factureData.infos_json.header.date_facture;
                await sendToSupabase(factureData);
            }
            
            setMessage('Import réussi !');
            setMessageType('success');
            
        } catch (error) {
            console.error('Erreur lors de l\'import:', error);
            setMessage('Erreur lors de l\'import');
            setMessageType('error');
        } finally {
            setIsLoading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    return (
        <div className="relative">
            {display && (
                <button 
                    onClick={handleButtonClick}
                    className="h-[30px] flex justify-between items-center gap-2 bg-gray-100 rounded-md px-2 cursor-pointer active:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isLoading}
                >
                    <div className="text-[var(--green-light)] rounded-full py-1 mt-1 font-thin">
                        {isLoading ? (
                            <span className="inline-block animate-spin">↻</span>
                        ) : (
                            <BoxIcon name='import' type='solid' color='green' size="18px" />
                        )}
                    </div>
                    <div className="text-black font-thin text-xs">
                        {isLoading ? 'Import en cours...' : 'Importer'}
                    </div>
                </button>
            )}
            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImport}
                className="hidden"
                disabled={isLoading}
            />
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-lg">
                        <h3 className="text-lg font-semibold mb-4">Configuration de l&apos;import</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">User ID (optionnel)</label>
                                <input
                                    type="text"
                                    value={userId}
                                    onChange={(e) => setUserId(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    placeholder="Laisser vide pour utiliser l'ID de session"
                                />
                            </div>
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="testMode"
                                    checked={isTestMode}
                                    onChange={(e) => setIsTestMode(e.target.checked)}
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <label htmlFor="testMode" className="text-sm text-gray-700">
                                    Mode test (3 lignes aléatoires)
                                </label>
                            </div>
                            <div className="flex justify-end space-x-3 mt-4">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={handleSubmitForm}
                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                                >
                                    Confirmer
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {message && (
                <div className={`absolute top-[-20px] left-0 w-full text-center text-xs ${
                    messageType === 'success' ? 'text-green-500' : 'text-red-500'
                }`}>
                    {message}
                </div>
            )}
        </div>
    );
};

export default ButtonImportFacture;