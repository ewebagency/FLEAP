'use client';
import { FormInput } from "../../interface/BSD_Interface";
import { MailProvider } from "../../MailComponents/MailContext";
import MailComponent from "../../MailComponents/MailComponent";
import { toast } from "react-hot-toast";
import Swal from 'sweetalert2';
import { sendData_to_Cloud } from "./FormulaireFull/utils_new";
import { useState } from "react";
import ModifyCardInFormulaireNew, { SectionForm } from "./FormulaireFull/ModifyCardInFormulaireNew";

interface SendDraftModalProps {
    isOpen: boolean;
    onClose: () => void;
    formData: FormInput;
    userId: string;
    entrepriseId: string;
    bsdId: string;
    onDelete: (id: string, silent: boolean) => Promise<void>;
}

const SendDraftModal = ({ 
    isOpen, 
    onClose, 
    formData: initialFormData, 
    userId, 
    entrepriseId,
    bsdId,
    onDelete
}: SendDraftModalProps) => {
    const [formData, setFormData] = useState<FormInput>(initialFormData);
    const [showParcelFields, setShowParcelFields] = useState(false);
    const [showTrader, setShowTrader] = useState(false);
    const [showBroker, setShowBroker] = useState(false);
    const [showEcoOrganisme, setShowEcoOrganisme] = useState(false);

    if (!isOpen) return null;

    const handleLocalChange = (path: string, value: string) => {
        setFormData(prevData => {
            const newData = { ...prevData };
            const keys = path.split('.');

            // Cas spécial pour packagingInfos
            if (path.includes('packagingInfos[0]')) {
                const [, property] = path.split('packagingInfos[0].');
                if (property === 'type') {
                    newData.wasteDetails.packagingInfos[0].type = value as "FUT" | "GRV" | "CITERNE" | "BENNE" | "PIPELINE" | "AUTRE";
                } else if (property === 'quantity') {
                    newData.wasteDetails.packagingInfos[0].quantity = Number(value);
                }
                return newData;
            }

            // Cas général pour les autres champs
            let current = newData as Record<string, unknown>;
            for (let i = 0; i < keys.length - 1; i++) {
                const key = keys[i];
                if (!(key in current)) {
                    current[key] = {};
                }
                current = current[key] as Record<string, unknown>;
            }
            
            const lastKey = keys[keys.length - 1];
            current[lastKey] = value;
            
            return newData;
        });
    };

    const handleSubmit = async () => {
        try {
            if (formData.wasteDetails.isDangerous) {
                const result = await sendData_to_Cloud(
                    formData,
                    userId,
                    entrepriseId,
                    false
                );
                if (result.success) {
                    await onDelete(bsdId, true);
                    toast.success("BSD envoyé avec succès sur TrackDéchets");
                    onClose();
                } else {
                    toast.error(result.message);
                }
            } else {
                onClose();
            }
        } catch (error) {
            console.error("Erreur lors de l'envoi:", error);
            toast.error("Une erreur est survenue lors de l'envoi");
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <MailProvider>
            <div className="bg-white p-6 rounded-lg max-w-7xl w-[85%] max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-4">
                    {formData.wasteDetails.isDangerous 
                        ? "Envoyer sur TrackDéchets et par mail" 
                        : "Envoyer par mail"}
                </h2>

                <div className="bg-gray-50 p-4 rounded">
                    <MailComponent 
                        params={{
                            wasteCode: formData.wasteDetails.code,
                            responsibleName: formData.emitter.company.contact,
                            containerType: formData.wasteDetails.packagingInfos[0].type,
                            collectionAddress: formData.emitter.workSite.fullAddress,
                            destinataire: formData.transporter.company.mail,
                            emetteur: formData.emitter.company.mail,
                            entrepriseId: entrepriseId,
                            entrepriseName: formData.emitter.company.name,
                            wasteDescription: formData.wasteDetails.name,
                            containerCount: formData.wasteDetails.packagingInfos[0].quantity,
                        }}
                        pastBrouillon={true}
                    />
                </div>
                <div>
                    <ModifyCardInFormulaireNew 
                        dataText={formData}
                        setDataText={setFormData}
                        onClose={()=>onClose()}
                        pastBrouillon={true}
                        otherInfos={{containerDescription:"",volume:"",volumeUnit:"",fillRate:""}}
                    />
                </div>
            </div>
            </MailProvider>
        </div>
    );
};

export default SendDraftModal; 