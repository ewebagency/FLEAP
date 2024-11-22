import { useEffect, useState } from "react";
import { useModalContextNew } from "./ContextModal";
import { Anything, DataTotalInterface, Form_API_Interface_Short } from "../../interface/BSD_Interface";
import { supabase } from "@/app/database/supabaseClient";
import { useSession } from "@/app/component/SessionProvider";

const DisplayCard = () => {
    const { modalId, modalType, setModalType, modalReload } = useModalContextNew();
    const [bsdAutresInfos, setBSDAutresInfos] = useState<DataTotalInterface | null>(null);
    const [bsd, setBSD] = useState<Form_API_Interface_Short | null>(null); //infos_json.formAPI.createFormInput pour alléger l'html après
    const session = useSession();

    const getBSD = async (userId: string) => {
        const result = await supabase
        .from('bsd')
            .select('*')
            .eq('id', modalId)
            .eq('user_id', userId)
            .single();

        if (result.data) {
            setBSDAutresInfos(result.data);
            setBSD(result.data.infos_json.formAPI.createFormInput);
        }
    }

    useEffect(() => {
        if (session && session.user.id) {
            getBSD(session.user.id);
        }
    }, [modalId, modalReload, session]);

    const LabelValue = ({ label, value }: { label: string, value: Anything|null }) => (
        <p className="text-sm">
            <span className="font-medium text-gray-700">{label}: </span>
            <span className="text-gray-600">{value ?? ''}</span>
        </p>
    );

    return (
    <div>
        {modalType === "display" && bsd && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-lg p-4 max-w-2xl mx-auto max-h-[90vh] overflow-y-auto">
                    <div className="space-y-4">
                        {/* En-tête */}
                        <div className="border-b pb-2 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">Bordereau de Suivi des Déchets</h2>
                                <LabelValue label="Code déchet" value={bsd.wasteDetails.code} />
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
                                    <LabelValue label="Nom" value={bsd.emitter.company.name} />
                                    <LabelValue label="Adresse" value={bsd.emitter.company.address} />
                                    <LabelValue label="SIRET" value={bsd.emitter.company.siret} />
                                    <LabelValue label="Contact" value={bsd.emitter.company.contact} />
                                    <LabelValue label="Téléphone" value={bsd.emitter.company.phone} />
                                    <LabelValue label="Email" value={bsd.emitter.company.mail} />
                                </div>

                                {/* Site d'enlèvement */}
                                <div className="bg-green-50 p-3 rounded border border-green-100">
                                    <h3 className="font-semibold text-green-800 mb-2">Site d&apos;enlèvement</h3>
                                    <LabelValue label="Adresse" value={bsd.emitter.workSite?.address} />
                                    <LabelValue label="Code postal" value={bsd.emitter.workSite?.postalCode} />
                                    <LabelValue label="Ville" value={bsd.emitter.workSite?.city} />
                                </div>

                                {/* Transporteur */}
                                <div className="bg-yellow-50 p-3 rounded border border-yellow-100">
                                    <h3 className="font-semibold text-yellow-800 mb-2">Transporteur</h3>
                                    <LabelValue label="Nom" value={bsd.transporter.company.name} />
                                    <LabelValue label="Adresse" value={bsd.transporter.company.address} />
                                    <LabelValue label="SIRET" value={bsd.transporter.company.siret} />
                                    <LabelValue label="Contact" value={bsd.transporter.company.contact} />
                                    <LabelValue label="Téléphone" value={bsd.transporter.company.phone} />
                                    <LabelValue label="Email" value={bsd.transporter.company.mail} />
                                </div>
                            </div>

                            {/* Colonne droite */}
                            <div className="space-y-4">
                                {/* Destinataire */}
                                <div className="bg-purple-50 p-3 rounded border border-purple-100">
                                    <h3 className="font-semibold text-purple-800 mb-2">Destinataire</h3>
                                    <LabelValue label="Nom" value={bsd.recipient.company.name} />
                                    <LabelValue label="Adresse" value={bsd.recipient.company.address} />
                                    <LabelValue label="SIRET" value={bsd.recipient.company.siret} />
                                    <LabelValue label="Contact" value={bsd.recipient.company.contact} />
                                    <LabelValue label="Téléphone" value={bsd.recipient.company.phone} />
                                    <LabelValue label="Email" value={bsd.recipient.company.mail} />
                                    <LabelValue label="CAP" value={bsd.recipient.cap} />
                                    <LabelValue label="Code traitement" value={bsd.recipient.processingOperation} />
                                </div>

                                {/* Déchet */}
                                <div className="bg-red-50 p-3 rounded border border-red-100">
                                    <h3 className="font-semibold text-red-800 mb-2">Détails du déchet</h3>
                                    <LabelValue label="Code ONU" value={bsd.wasteDetails.onuCode} />
                                    <LabelValue label="Consistance" value={bsd.wasteDetails.consistence} />
                                    <LabelValue label="Quantité" value={`${bsd.wasteDetails.quantity} ${bsd.wasteDetails.quantityType}`} />
                                    <LabelValue label="Type de contenant" value={bsd.wasteDetails.packagingInfos[0].type} />
                                    <LabelValue label="Nombre de contenants" value={bsd.wasteDetails.packagingInfos[0].quantity} />
                                </div>
                            </div>
                        </div>
                    </div>    
                </div>
            </div>
        )}
    </div>
    );
}

export default DisplayCard;


