import { useState, useEffect } from "react";
import { useModalContextNew } from "./ContextModal";
import { toast } from "react-hot-toast";
import { useSession } from "@/app/component/SessionProvider";
import { supabase } from "@/app/database/supabaseClient";
import { DataOnSupabase_infos_json, DataSupplementaireInterface, DataTotalInterface, Form_API_Interface_Short } from "../../interface/BSD_Interface";

const LabelInput = ({ label, value, onChange, path }: { 
    label: string, 
    value?: string,
    onChange: (path: string, value: string) => void,
    path: string
}) => (
    <div className="flex items-center text-sm">
        <span className="font-medium text-gray-700 w-[120px] text-right mr-2">{label}: </span>
        <input 
            type="text"
            value={value ?? ''}
            onChange={(e) => onChange(path, e.target.value)}
            className="text-gray-600 rounded-md px-2 py-[3px] w-[320px]"
        />
    </div>
);

const ModifyCard = () => {
    const { modalId, modalType, setModalType, dataTotal, setDataTotal, modalReload, setModalReload } = useModalContextNew();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [localData, setLocalData] = useState<DataOnSupabase_infos_json | null>(null);
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
            setLocalData(result.data.infos_json);
        }
    }

    useEffect(() => {
        if (session && session.user.id) {
            getBSD(session.user.id);
        }
    }, [modalId, session]);


    const handleChange = (path: string, value: string) => {
        setLocalData(prev => {
            if (!prev) return prev;
            const newData = { ...prev };
            const keys = path.split('.');
            let current: Record<string, unknown> = newData as Record<string, unknown>;
            
            for (let i = 0; i < keys.length - 1; i++) {
                if (typeof current[keys[i]] !== 'object') {
                    current[keys[i]] = {};
                }
                current = current[keys[i]] as Record<string, unknown>;
            }
            
            current[keys[keys.length - 1]] = value;
            return newData;
        });
    };

    const handleSubmit = async () => {
        if (!session?.user?.id || !localData) {
            toast.error("Utilisateur non connecté ou données manquantes");
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await fetch('/api/demande_collecte/modify_bsd', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: session.user.id,
                    bsd_id: modalId,
                    data: localData
                }),
            });

            const result = await response.json();
            if (result.success) {
                // Mise à jour correcte du dataTotal
                const data_form_api_here: Form_API_Interface_Short = localData.formAPI.createFormInput;
                const data_supplementaire_here: DataSupplementaireInterface = localData.dataSupplementaire;
                const local_data_here: DataTotalInterface = {dataFormAPI: { formAPI: { createFormInput: data_form_api_here } }, dataSupplementaire: data_supplementaire_here};
                console.log('local_data_here', local_data_here);
                console.log('dataTotal', dataTotal);
                setDataTotal(local_data_here);
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
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-6xl w-[80%] max-h-[90vh] overflow-y-auto">
                <div className="border-b pb-2 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Bordereau de Suivi des Déchets</h2>
                        <div className="flex items-center text-md mt-2 ml-6">
                            <span className="font-medium text-gray-700 mr-3">Code déchet: </span>
                            <input 
                                type="text"
                                value={localData.formAPI.createFormInput.wasteDetails.code.toString()}
                                onChange={(e) => handleChange("formAPI.createFormInput.wasteDetails.code", e.target.value)}
                                className="text-gray-700 border-b-2 border-gray-300 focus:border-blue-500 focus:outline-none px-2 w-[90px] text-md font-medium"
                            />
                        </div>
                    </div>
                    <button 
                        onClick={() => setModalType("")} 
                        className="text-gray-500 hover:text-gray-700"
                    >
                        ✕
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {/* Colonne gauche */}
                    <div className="space-y-4">
                        {/* Émetteur */}
                        <div className="bg-blue-50 p-3 rounded border border-blue-100">
                            <h3 className="font-semibold text-blue-800 mb-2">Émetteur</h3>
                            <div className="space-y-2 mr-4">
                                <LabelInput 
                                    label="Nom"
                                    value={localData.formAPI.createFormInput.emitter.company.name.toString()}
                                    onChange={handleChange}
                                    path="formAPI.createFormInput.emitter.company.name"
                                />
                                <LabelInput 
                                    label="Adresse"
                                    value={localData.formAPI.createFormInput.emitter.company.address.toString()}
                                    onChange={handleChange}
                                    path="formAPI.createFormInput.emitter.company.address"
                                />
                                <LabelInput 
                                    label="SIRET"
                                    value={localData.formAPI.createFormInput.emitter.company.siret.toString()}
                                    onChange={handleChange}
                                    path="formAPI.createFormInput.emitter.company.siret"
                                />
                                <LabelInput 
                                    label="Contact"
                                    value={localData.formAPI.createFormInput.emitter.company.contact.toString()}
                                    onChange={handleChange}
                                    path="formAPI.createFormInput.emitter.company.contact"
                                />
                                <LabelInput 
                                    label="Téléphone"
                                    value={localData.formAPI.createFormInput.emitter.company.phone.toString()}
                                    onChange={handleChange}
                                    path="formAPI.createFormInput.emitter.company.phone"
                                />
                                <LabelInput 
                                    label="Email"
                                    value={localData.formAPI.createFormInput.emitter.company.mail.toString()}
                                    onChange={handleChange}
                                    path="formAPI.createFormInput.emitter.company.mail"
                                />
                            </div>
                        </div>

                        {/* Transporteur */}
                        <div className="bg-yellow-50 p-3 rounded border border-yellow-100">
                            <h3 className="font-semibold text-yellow-800 mb-2">Transporteur</h3>
                            <div className="space-y-2 mr-4">
                                <LabelInput 
                                    label="Nom"
                                    value={localData.formAPI.createFormInput.transporter.company.name.toString()}
                                    onChange={handleChange}
                                    path="formAPI.createFormInput.transporter.company.name"
                                />
                                <LabelInput 
                                    label="Adresse"
                                    value={localData.formAPI.createFormInput.transporter.company.address.toString()}
                                    onChange={handleChange}
                                    path="formAPI.createFormInput.transporter.company.address"
                                />
                                <LabelInput 
                                    label="SIRET"
                                    value={localData.formAPI.createFormInput.transporter.company.siret.toString()}
                                    onChange={handleChange}
                                    path="formAPI.createFormInput.transporter.company.siret"
                                />
                                <LabelInput 
                                    label="Contact"
                                    value={localData.formAPI.createFormInput.transporter.company.contact.toString()}
                                    onChange={handleChange}
                                    path="formAPI.createFormInput.transporter.company.contact"
                                />
                                <LabelInput 
                                    label="Téléphone"
                                    value={localData.formAPI.createFormInput.transporter.company.phone.toString()}
                                    onChange={handleChange}
                                    path="formAPI.createFormInput.transporter.company.phone"
                                />
                                <LabelInput 
                                    label="Email"
                                    value={localData.formAPI.createFormInput.transporter.company.mail.toString()}
                                    onChange={handleChange}
                                    path="formAPI.createFormInput.transporter.company.mail"
                                />
                            </div>
                        </div>

                        {/* Site d'enlèvement */}
                        <div className="bg-green-50 p-3 rounded border border-green-100">
                            <h3 className="font-semibold text-green-800 mb-2">Site d&apos;enlèvement</h3>
                            <div className="space-y-2 mr-4">
                                <LabelInput 
                                    label="Adresse"
                                    value={localData.formAPI.createFormInput.emitter.workSite.address.toString()}
                                    onChange={handleChange}
                                    path="formAPI.createFormInput.emitter.workSite.address"
                                />
                                <LabelInput 
                                    label="Code postal"
                                    value={localData.formAPI.createFormInput.emitter.workSite.postalCode.toString()}
                                    onChange={handleChange}
                                    path="formAPI.createFormInput.emitter.workSite.postalCode"
                                />
                                <LabelInput 
                                    label="Ville"
                                    value={localData.formAPI.createFormInput.emitter.workSite.city.toString()}
                                    onChange={handleChange}
                                    path="formAPI.createFormInput.emitter.workSite.city"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Colonne droite */}
                    <div className="space-y-4">
                        {/* Destinataire */}
                        <div className="bg-purple-50 p-3 rounded border border-purple-100">
                            <h3 className="font-semibold text-purple-800 mb-2">Destinataire</h3>
                            <div className="space-y-2 mr-4">
                                <LabelInput 
                                    label="Nom"
                                    value={localData.formAPI.createFormInput.recipient.company.name.toString()}
                                    onChange={handleChange}
                                    path="formAPI.createFormInput.recipient.company.name"
                                />
                                <LabelInput 
                                    label="Adresse"
                                    value={localData.formAPI.createFormInput.recipient.company.address.toString()}
                                    onChange={handleChange}
                                    path="formAPI.createFormInput.recipient.company.address"
                                />
                                <LabelInput 
                                    label="SIRET"
                                    value={localData.formAPI.createFormInput.recipient.company.siret.toString()}
                                    onChange={handleChange}
                                    path="formAPI.createFormInput.recipient.company.siret"
                                />
                                <LabelInput 
                                    label="Contact"
                                    value={localData.formAPI.createFormInput.recipient.company.contact.toString()}
                                    onChange={handleChange}
                                    path="formAPI.createFormInput.recipient.company.contact"
                                />
                                <LabelInput 
                                    label="Téléphone"
                                    value={localData.formAPI.createFormInput.recipient.company.phone.toString()}
                                    onChange={handleChange}
                                    path="formAPI.createFormInput.recipient.company.phone"
                                />
                                <LabelInput 
                                    label="Email"
                                    value={localData.formAPI.createFormInput.recipient.company.mail.toString()}
                                    onChange={handleChange}
                                    path="formAPI.createFormInput.recipient.company.mail"
                                />
                                <LabelInput 
                                    label="CAP"
                                    value={localData.formAPI.createFormInput.recipient.cap.toString()}
                                    onChange={handleChange}
                                    path="formAPI.createFormInput.recipient.cap"
                                />
                                <LabelInput 
                                    label="Code traitement"
                                    value={localData.formAPI.createFormInput.recipient.processingOperation.toString()}
                                    onChange={handleChange}
                                    path="formAPI.createFormInput.recipient.processingOperation"
                                />
                            </div>
                        </div>

                        {/* Détails du déchet */}
                        <div className="bg-red-50 p-3 rounded border border-red-100">
                            <h3 className="font-semibold text-red-800 mb-2">Détails du déchet</h3>
                            <div className="space-y-2 mr-4">
                                <LabelInput 
                                    label="Code CED"
                                    value={localData.formAPI.createFormInput.wasteDetails.code.toString()}
                                    onChange={handleChange}
                                    path="formAPI.createFormInput.wasteDetails.code"
                                />
                                <LabelInput 
                                    label="Code ONU"
                                    value={localData.formAPI.createFormInput.wasteDetails.onuCode.toString()}
                                    onChange={handleChange}
                                    path="formAPI.createFormInput.wasteDetails.onuCode"
                                />
                                <LabelInput 
                                    label="Consistance"
                                    value={localData.formAPI.createFormInput.wasteDetails.consistence.toString()}
                                    onChange={handleChange}
                                    path="formAPI.createFormInput.wasteDetails.consistence"
                                />
                                <LabelInput 
                                    label="Quantité"
                                    value={localData.formAPI.createFormInput.wasteDetails.quantity.toString()}
                                    onChange={handleChange}
                                    path="formAPI.createFormInput.wasteDetails.quantity"
                                />
                                <LabelInput 
                                    label="Type de quantité"
                                    value={localData.formAPI.createFormInput.wasteDetails.quantityType.toString()}
                                    onChange={handleChange}
                                    path="formAPI.createFormInput.wasteDetails.quantityType"
                                />
                                <LabelInput 
                                    label="Type de contenant"
                                    value={localData.formAPI.createFormInput.wasteDetails.packagingInfos[0].type.toString()}
                                    onChange={handleChange}
                                    path="formAPI.createFormInput.wasteDetails.packagingInfos.0.type"
                                />
                                <LabelInput 
                                    label="Nombre de contenants"
                                    value={localData.formAPI.createFormInput.wasteDetails.packagingInfos[0].quantity.toString()}
                                    onChange={handleChange}
                                    path="formAPI.createFormInput.wasteDetails.packagingInfos.0.quantity"
                                />
                            </div>
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