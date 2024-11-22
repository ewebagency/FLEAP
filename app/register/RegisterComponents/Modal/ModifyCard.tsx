import { useState, useEffect } from "react";
import { useModalContextNew } from "./ContextModal";
import { toast } from "react-hot-toast";
import { useSession } from "@/app/component/SessionProvider";
import { supabase } from "@/app/database/supabaseClient";

const LabelInput = ({ label, value, onChange, path }: { 
    label: string, 
    value: string | number | undefined,
    onChange: (path: string, value: string) => void,
    path: string
}) => (
    <div className="text-sm flex flex-col mb-2">
        <span className="font-medium text-gray-700">{label}: </span>
        <input 
            type="text"
            value={value || ''}
            onChange={(e) => onChange(path, e.target.value)}
            className="border rounded px-2 py-1 text-gray-600"
        />
    </div>
);

const ModifyCard = () => {
    const { modalId, modalType, setModalType, dataTotal, setDataTotal, modalReload, setModalReload } = useModalContextNew();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [localData, setLocalData] = useState<any>(null);
    const session = useSession();

    const getBSD = async (userId: string) => {
        const result = await supabase
        .from('bsd')
            .select('*')
            .eq('id', modalId)
            .eq('user_id', userId)
            .single();

        if (result.data) {
            //setBSDAutresInfos(result.data);
            setLocalData(result.data.infos_json.formAPI.createFormInput);
        }
    }

    useEffect(() => {
        if (session && session.user.id) {
            getBSD(session.user.id);
        }
    }, [modalId, session]);


    const handleChange = (path: string, value: string) => {
        setLocalData(prev => {
            const newData = { ...prev };
            const keys = path.split('.');
            let current = newData;
            
            for (let i = 0; i < keys.length - 1; i++) {
                if (current[keys[i]] === undefined) {
                    current[keys[i]] = {};
                }
                current = current[keys[i]];
            }
            
            current[keys[keys.length - 1]] = value;
            return newData;
        });
    };

    const handleSubmit = async () => {
        if (!session?.user?.id) {
            toast.error("Utilisateur non connecté");
            return;
        }

        setIsSubmitting(true);
        const dataToSend = {
            formAPI: {
                createFormInput: localData
            }
        }
        try {
            const response = await fetch('/api/demande_collecte/modify_bsd', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: session.user.id,
                    bsd_id: modalId,
                    data: dataToSend
                }),
            });

            const result = await response.json();
            if (result.success) {
                setDataTotal(localData);
                toast.success("BSD modifié avec succès");
                setModalType("");
                setModalReload(!modalReload);
            } else {
                toast.error(result.message || "Erreur lors de la modification");
            }
        } catch (error) {
            toast.error("Erreur lors de la modification");
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!localData || modalType !== "modify") return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl w-[90%] max-h-[90vh] overflow-y-auto">
                <div className="border-b pb-2 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Bordereau de Suivi des Déchets</h2>
                        <LabelInput 
                            label="Code déchet"
                            value={localData.wasteDetails.code}
                            onChange={handleChange}
                            path="wasteDetails.code"
                        />
                    </div>
                    <button 
                        onClick={() => setModalType("")} 
                        className="text-gray-500 hover:text-gray-700"
                    >
                        ✕
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-6 mt-4">
                    {/* Colonne gauche */}
                    <div className="space-y-4">
                        {/* Émetteur */}
                        <div className="bg-blue-50 p-3 rounded border border-blue-100">
                            <h3 className="font-semibold text-blue-800 mb-2">Émetteur</h3>
                            <LabelInput 
                                label="Nom"
                                value={localData.emitter.company.name}
                                onChange={handleChange}
                                path="emitter.company.name"
                            />
                            <LabelInput 
                                label="Adresse"
                                value={localData.emitter.company.address}
                                onChange={handleChange}
                                path="emitter.company.address"
                            />
                            <LabelInput 
                                label="SIRET"
                                value={localData.emitter.company.siret}
                                onChange={handleChange}
                                path="emitter.company.siret"
                            />
                            <LabelInput 
                                label="Contact"
                                value={localData.emitter.company.contact}
                                onChange={handleChange}
                                path="emitter.company.contact"
                            />
                            <LabelInput 
                                label="Téléphone"
                                value={localData.emitter.company.phone}
                                onChange={handleChange}
                                path="emitter.company.phone"
                            />
                            <LabelInput 
                                label="Email"
                                value={localData.emitter.company.mail}
                                onChange={handleChange}
                                path="emitter.company.mail"
                            />
                        </div>

                        {/* Transporteur */}
                        <div className="bg-yellow-50 p-3 rounded border border-yellow-100">
                            <h3 className="font-semibold text-yellow-800 mb-2">Transporteur</h3>
                            <LabelInput 
                                label="Nom"
                                value={localData.transporter.company.name}
                                onChange={handleChange}
                                path="transporter.company.name"
                            />
                            <LabelInput 
                                label="Adresse"
                                value={localData.transporter.company.address}
                                onChange={handleChange}
                                path="transporter.company.address"
                            />
                            <LabelInput 
                                label="SIRET"
                                value={localData.transporter.company.siret}
                                onChange={handleChange}
                                path="transporter.company.siret"
                            />
                            <LabelInput 
                                label="Contact"
                                value={localData.transporter.company.contact}
                                onChange={handleChange}
                                path="transporter.company.contact"
                            />
                            <LabelInput 
                                label="Téléphone"
                                value={localData.transporter.company.phone}
                                onChange={handleChange}
                                path="transporter.company.phone"
                            />
                            <LabelInput 
                                label="Email"
                                value={localData.transporter.company.mail}
                                onChange={handleChange}
                                path="transporter.company.mail"
                            />
                        </div>

                        {/* Site d'enlèvement */}
                        <div className="bg-green-50 p-3 rounded border border-green-100">
                            <h3 className="font-semibold text-green-800 mb-2">Site d'enlèvement</h3>
                            <LabelInput 
                                label="Adresse"
                                value={localData.emitter?.workSite?.address}
                                onChange={handleChange}
                                path="emitter.workSite.address"
                            />
                            <LabelInput 
                                label="Code postal"
                                value={localData.emitter?.workSite?.postalCode}
                                onChange={handleChange}
                                path="emitter.workSite.postalCode"
                            />
                            <LabelInput 
                                label="Ville"
                                value={localData.emitter?.workSite?.city}
                                onChange={handleChange}
                                path="emitter.workSite.city"
                            />
                        </div>
                    </div>

                    {/* Colonne droite */}
                    <div className="space-y-4">
                        {/* Destinataire */}
                        <div className="bg-purple-50 p-3 rounded border border-purple-100">
                            <h3 className="font-semibold text-purple-800 mb-2">Destinataire</h3>
                            <LabelInput 
                                label="Nom"
                                value={localData.recipient.company.name}
                                onChange={handleChange}
                                path="recipient.company.name"
                            />
                            <LabelInput 
                                label="Adresse"
                                value={localData.recipient.company.address}
                                onChange={handleChange}
                                path="recipient.company.address"
                            />
                            <LabelInput 
                                label="SIRET"
                                value={localData.recipient.company.siret}
                                onChange={handleChange}
                                path="recipient.company.siret"
                            />
                            <LabelInput 
                                label="Contact"
                                value={localData.recipient.company.contact}
                                onChange={handleChange}
                                path="recipient.company.contact"
                            />
                            <LabelInput 
                                label="Téléphone"
                                value={localData.recipient.company.phone}
                                onChange={handleChange}
                                path="recipient.company.phone"
                            />
                            <LabelInput 
                                label="Email"
                                value={localData.recipient.company.mail}
                                onChange={handleChange}
                                path="recipient.company.mail"
                            />
                            <LabelInput 
                                label="CAP"
                                value={localData.recipient.cap}
                                onChange={handleChange}
                                path="recipient.cap"
                            />
                            <LabelInput 
                                label="Code traitement"
                                value={localData.recipient.processingOperation}
                                onChange={handleChange}
                                path="recipient.processingOperation"
                            />
                        </div>

                        {/* Détails du déchet */}
                        <div className="bg-red-50 p-3 rounded border border-red-100">
                            <h3 className="font-semibold text-red-800 mb-2">Détails du déchet</h3>
                            <LabelInput 
                                label="Code CED"
                                value={localData.wasteDetails.code}
                                onChange={handleChange}
                                path="wasteDetails.code"
                            />
                            <LabelInput 
                                label="Code ONU"
                                value={localData.wasteDetails.onuCode}
                                onChange={handleChange}
                                path="wasteDetails.onuCode"
                            />
                            <LabelInput 
                                label="Consistance"
                                value={localData.wasteDetails.consistence}
                                onChange={handleChange}
                                path="wasteDetails.consistence"
                            />
                            <LabelInput 
                                label="Quantité"
                                value={localData.wasteDetails.quantity}
                                onChange={handleChange}
                                path="wasteDetails.quantity"
                            />
                            <LabelInput 
                                label="Type de quantité"
                                value={localData.wasteDetails.quantityType}
                                onChange={handleChange}
                                path="wasteDetails.quantityType"
                            />
                            <LabelInput 
                                label="Type de contenant"
                                value={localData.wasteDetails.packagingInfos[0].type}
                                onChange={handleChange}
                                path="wasteDetails.packagingInfos.0.type"
                            />
                            <LabelInput 
                                label="Nombre de contenants"
                                value={localData.wasteDetails.packagingInfos[0].quantity}
                                onChange={handleChange}
                                path="wasteDetails.packagingInfos.0.quantity"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end space-x-2 mt-6">
                    <button
                        onClick={() => setModalType("")}
                        className="px-4 py-2 text-gray-600 border rounded hover:bg-gray-100"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                        {isSubmitting ? "Modification..." : "Modifier"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModifyCard; 