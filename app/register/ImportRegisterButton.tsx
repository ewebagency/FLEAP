import { useState, useRef, useEffect } from "react";
import { useSession } from "../component/SessionProvider";
import { useModal } from "../component/context/ModalReloadcontext";
import * as XLSX from 'xlsx';
import toast from "react-hot-toast";
import { supabase } from "../database/supabaseClient";
import { Form_API_Interface_New } from "./interface/BSD_Interface";

interface Row {
    [key: string]: string | number | boolean;
}

const cofounders_user_id = (user_id:string|null) => {
    if (user_id){
        if (user_id == "a0542794-bbae-4132-9dde-485595bfa2aa" || user_id == "8f05a291-f8b3-429d-839e-6f0b12f1bede" || user_id == "dd9acb15-4678-442f-af72-79331bc43d91"){
            return true;
        }
    }
    return false;
}

const mapToBsdFormat = (row: Row): Form_API_Interface_New => {
    return {
      formAPI: {
        createFormInput: {
          emitter: {
            company: {
              siret: row["siretEmetteur"] || "",
              name: row["raisonSocialeEmetteur"] || "",
              address: `${row["adresseCollecte"] || ""} ${row["codePostalCollecte"] || ""} ${row["communeCollecte"] || ""}`,
              contact: `${row["prenomContact"] || ""} ${row["nomContact"] || ""}`,
              phone: row["telephoneContact"] || "",
              mail: row["emailContact"] || ""
            },
            workSite: row["siteEmetteur"] ? {
              address: row["adresseCollecte"] || "",
              postalCode: row["codePostalCollecte"] || "",
              city: row["communeCollecte"] || "",
            } : null
          },
          recipient: {
            cap: row["numeroCap"] || "",
            company: {
              siret: row["siretInstallationDestination1"] || "",
              name: row["nomInstallationDestination1"] || "",
              address: `${row["adresseInstallationDestination1"] || ""} ${row["codePostalInstallationDestination1"] || ""} ${row["communeInstallationDestination1"] || ""}`,
              contact: `${row["prenomContact"] || ""} ${row["nomContact"] || ""}`,
              phone: row["telephoneContact"] || "",
              mail: row["emailContact"] || ""
            },
            processingOperation: row["codeTraitementPrevuInstallationDestination1"] || "D1"
          },
          transporter: {
            company: {
              siret: row["siretTransporteur"] || "",
              name: row["raisonSocialeTransporteur"] || "",
              address: `${row["adresseTransporteur"] || ""} ${row["codePostalTransporteur"] || ""} ${row["communeTransporteur"] || ""}`,
              contact: `${row["prenomContact1Transporteur"] || ""} ${row["nomContact1Transporteur"] || ""}`,
              phone: row["telephoneContact1Transporteur"] || "",
              mail: row["emailContact1Transporteur"] || ""
            }
          },
          wasteDetails: {
            code: row["codeCed"] || "",
            name: row["descDechet"] || "",
            onuCode: row["codeOnu"] || "",
            quantity: row["quantiteEmetteur"] || 0,
            quantityType: row["quantiteEstimeeOuReelle"] ? "REAL" : "ESTIMATED",
            consistence: row["consistance"] || "",
            packagingInfos: [
              {
                type: row["typeContenant"] || "FUT",
                quantity: row["nbContenants"] || 0
              }
            ]
          }
        }
      }
    };
  };
  
const sendToSupabase = async (ligne_BSD: Form_API_Interface_New | Row, user_id: string, tableType: string) => {
    if(tableType == "table_parametrage"){
        const { data, error } = await supabase
            .from('table_parametrage')
            .insert({
                user_id: user_id,
                json_row: ligne_BSD,
            })
        if (error) {
            toast.error('Erreur lors de l\'import de la table de paramétrage');
        } else {
            console.log('Données importées avec succès', data);
            toast.success('Paramètres importés avec succès');
        }
    } 
    else if(tableType == "registre_historique"){
        const { data, error } = await supabase
            .from('bsd')
            .insert(
                {
                    user_id: user_id,
                    infos_json: ligne_BSD,
                    created_on_fleap: false,
                    status_track_dechets: "IMPORTED"
                }
            )
        if (error) {
            toast.error('Erreur lors de l\'import du registre historique');
        } else {
            console.log('Données importées avec succès', data);
            toast.success('Registre historique importé avec succès');
        }
    }
}

const ImportRegisterButton = () => {
    const session = useSession();
    const { modalReload, setModalReload } = useModal();
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState<'success' | 'error'>('success');
    const [display, setDisplay] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [userId, setUserId] = useState('');
    const [tableType, setTableType] = useState('table_parametrage');
    const fileInputRef = useRef<HTMLInputElement>(null);
    //const [selectedConfig, setSelectedConfig] = useState<{userId: string, tableType: string} | null>(null);
    
    useEffect(() => {
        if(session && session?.user.id){
            if (cofounders_user_id(session?.user.id)) {
                setDisplay(true);
            }
        }
    }, [session]);

    const handleButtonClick = (e: React.MouseEvent) => {
        e.preventDefault();
        setShowModal(true);
    };

    const handleSubmitForm = () => {
        /*if (!userId) {
            toast.error('Veuillez saisir un User ID');
            return;
        }*/
        //setSelectedConfig({ userId, tableType });
        setShowModal(false);
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        /*if (!tableType) {
            toast.error('Configuration manquante');
            return;
        }*/
        
        const file = event.target.files?.[0];
        if (!file) return;
        
        setIsLoading(true);
        try {
            if (!session) {
                throw new Error("Session non trouvée");
            }
            // Lire le fichier Excel
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            
            // Récupérer la première feuille ⚠
            let firstSheetName;
            if(tableType == "table_parametrage"){
                firstSheetName = 'template_code';
            } else {
                firstSheetName = workbook.SheetNames[0];    
            }
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Convertir en JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet) as Row[];
            jsonData.forEach((row: Row) => {
                if(tableType == "table_parametrage"){
                    if(!userId){
                        sendToSupabase(row, session.user.id, tableType);
                    } else {
                        sendToSupabase(row, userId, tableType);
                    }
                } else if (tableType == "registre_historique"){
                    const ligne_BSD = mapToBsdFormat(row);
                    if(!userId){
                        sendToSupabase(ligne_BSD, session.user.id, tableType);
                    } else {
                        sendToSupabase(ligne_BSD, userId, tableType);
                    }
                }
            });
            
            setMessage('Import réussi !');
            setMessageType('success');
            
            // Déclencher le rechargement de la page après 1 seconde
            setTimeout(() => {
                setModalReload(!modalReload);
            }, 3*1000);
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
            <button 
                onClick={handleButtonClick}
                className="flex justify-between items-center bg-gray-300 rounded-xl px-2 mx-1 cursor-pointer active:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading}
            >
                <div className="text-white bg-green-600 mr-2 my-[3px] rounded-full px-2 font-thin">
                    {isLoading ? (
                        <span className="inline-block animate-spin">↻</span>
                    ) : (
                        "✉"
                    )}
                </div>
                <div className="text-black font-thin text-xs">
                    {isLoading ? 'Import en cours...' : 'Importer'}
                </div>
            </button>

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
                                <label className="block text-sm font-medium text-gray-700">User ID</label>
                                <input
                                    type="text"
                                    value={userId}
                                    onChange={(e) => setUserId(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Type de table</label>
                                <select
                                    value={tableType}
                                    onChange={(e) => setTableType(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                >
                                    <option value="table_parametrage">Table Paramétrage</option>
                                    <option value="registre_historique">Registre Historique</option>
                                </select>
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

export default ImportRegisterButton;