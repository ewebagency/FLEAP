import { useState, useEffect } from "react";
import { useModalContextNew } from "./ContextModal";
import { toast } from "react-hot-toast";
import { useSession } from "@/app/component/SessionProvider";
import { supabase } from "@/app/database/supabaseClient";
import { BSDD_TrackDechets, DataOnSupabase_infos_json, DataSupplementaireInterface, DataTotalInterface, Form_API_Interface_Short, FormInput } from "../../interface/BSD_Interface";
import Swal from 'sweetalert2';
import { getMappingTableFiliere, getFiliere } from "./utils_new";

const LabelInput = ({ label, value, onChange, path }: { 
    label: string, 
    value?: string | number | null,
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
    const { modalId, modalType, setModalType, dataToogle, setDataToogle, modalReload, setModalReload } = useModalContextNew();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [localData, setLocalData] = useState<FormInput>({
        emitter: {
          type: "PRODUCER",
          workSite: { name: "", address: "", postalCode: "", city: "", infos: "" },
          company: { name: "", siret: "", address: "", country: "", contact: "", phone: "", mail: "" },
          isPrivateIndividual: false,
          isForeignShip: false,
        },
        recipient: {
          company: { name: "", siret: "", address: "", country: "", contact: "", phone: "", mail: "" },
          cap: "",
          processingOperation: "",
          isTempStorage: false,
        },
        transporter: {
          company: { name: "", siret: "", address: "", country: "", contact: "", phone: "", mail: "" },
          isExemptedOfReceipt: false,
          receipt: "",
          numberPlate: "",
          customInfo: "",
        },
        wasteDetails: {
          code: "",
          name: "",
          isSubjectToADR: false,
          onuCode: "",
          packagingInfos: [{ type: "AUTRE", quantity: 0, other: "" }],
          quantity: 0,
          quantityType: "ESTIMATED",
          consistence: "",
          pop: false,
          isDangerous: false,
          parcelNumbers: { city: "", postalCode: "", prefix: "", section: "", number: "" },
          analysisReferences: "",
          landIdentifiers: "",
          sampleNumber: "",
        },
        trader: {
          receipt: "",
          department: "",
          validityLimit: "",
          company: { name: "", siret: "", address: "", country: "", contact: "", phone: "", mail: "" },
        },
        broker: {
          receipt: "",
          department: "",
          validityLimit: "",
          company: { name: "", siret: "", address: "", country: "", contact: "", phone: "", mail: "" },
        },
        //grouping: { form: { id: "" }, quantity: 0 },//Pour l'instant on va dire qu'on ne permet pas de grouper les déchets
        ecoOrganisme: { name: "", siret: "" },
        temporaryStorageDetail: {
          company: { name: "", siret: "", address: "", country: "", contact: "", phone: "", mail: "" },
          cap: "",
          processingOperation: "",
        }, //Si le recipient est un stockage provisoire, on va mettre les infos du destinataire final pour le traitement 
        //intermediaries: [],
      });
    const session = useSession();
    const [filiere, setFiliere] = useState<string>("");
    const [createdAt, setCreatedAt] = useState<string>("");

    const getBSD = async (entrepriseId: string) => {
        const result = await supabase
        .from('bsd')
            .select('*')
            .eq('id', modalId)
            .eq('entreprise_id', entrepriseId)
            .single();

        if (result.data) {
            //setBSDAutresInfos(result.data);
            setLocalData(result.data.infos_json.formAPI.createFormInput);
            console.log('localData', localData);
        }
    }

    useEffect(() => {
        if (session && session.entreprise_id) {
            getBSD(session.entreprise_id);
        }
    }, [modalId, session]);

    useEffect(() => {
        const getFiliereName = async () => {
            if (session?.entreprise_id && localData?.wasteDetails?.code) {
                const mapping = await getMappingTableFiliere(session.entreprise_id);
                const filiereFound = getFiliere(localData.wasteDetails.code, mapping);
                setFiliere(filiereFound);
            }
        };
        getFiliereName();
    }, [localData, session]);

    const handleChange = (path: string, value: string) => {
        setLocalData(prev => {
            if (!prev) return prev;
            const newData = { ...prev };
            
            if (path.includes('packagingInfos')) {
                if (path.includes('type')) {
                    newData.wasteDetails.packagingInfos[0].type = value as "AUTRE" | "FUT" | "GRV" | "CITERNE" | "BENNE" | "PIPELINE";
                } else if (path.includes('quantity')) {
                    newData.wasteDetails.packagingInfos[0].quantity = Number(value);
                } else if(path.includes('other')){
                    newData.wasteDetails.packagingInfos[0].other = value;
                }
                return newData;
            }

            const keys = path.split('.');
            let current: Record<string, unknown> = newData;
            
            for (let i = 0; i < keys.length - 1; i++) {
                const key = keys[i];
                if (!current[key] || typeof current[key] !== 'object') {
                    current[key] = {};
                }
                current = current[key] as Record<string, unknown>;
            }
            
            current[keys[keys.length - 1]] = value;
            return newData;
        });
    };

    const handleSubmit = async () => {
        if (!session?.user_id || !localData) {
            toast.error("Utilisateur non connecté ou données manquantes");
            return;
        }

        const result = await Swal.fire({
            title: 'Êtes-vous sûr ?',
            text: "Vous êtes sur le point de modifier le BSD.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Oui, modifier !',
            cancelButtonText: 'Annuler'
        });

        if (!result.isConfirmed) return;

        setIsSubmitting(true);

        try {
            const dataToSend = { ...localData };
            
            // Conversion des quantités en nombres avant envoi
            if (typeof dataToSend.wasteDetails.quantity === 'string' || typeof dataToSend.wasteDetails.quantity === 'number') {
                dataToSend.wasteDetails.quantity = Number(String(dataToSend.wasteDetails.quantity).replace(',', '.'));
            }
            if (typeof dataToSend.wasteDetails.packagingInfos[0].quantity === 'string' || typeof dataToSend.wasteDetails.packagingInfos[0].quantity === 'number') {
                dataToSend.wasteDetails.packagingInfos[0].quantity = Number(String(dataToSend.wasteDetails.packagingInfos[0].quantity).replace(',', '.'));
            }

            const response = await fetch('/api/demande_collecte/modify_bsd', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: session.user_id,
                    bsd_id: modalId,
                    data: {formAPI:{createFormInput: dataToSend}}
                }),
            });

            const apiResult = await response.json();
            if (apiResult.success) {
                setDataToogle(dataToSend);
                toast.success("BSD modifié avec succès");
                setModalType("");
                setModalReload(!modalReload);
            } else {
                toast.error(apiResult.message || "Erreur lors de la modification");
            }
        } catch (error) {
            toast.error("Erreur lors de la modification");
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!localData || modalType !== "modify") return null;

    console.log('localData', localData);
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-6xl w-[80%] max-h-[90vh] overflow-y-auto">
                <div className="border-b pb-2 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Bordereau de Suivi des Déchets</h2>
                        <div className="mt-2 space-y-1 ml-6">
                            <div className="flex items-center text-sm">
                                <span className="font-medium text-gray-700 w-[120px] text-right mr-2">Site: </span>
                                <span className="text-gray-600">{localData.emitter?.workSite?.name || 'Non renseigné'}</span>
                            </div>
                            <div className="flex items-center text-sm">
                                <span className="font-medium text-gray-700 w-[120px] text-right mr-2">Filière: </span>
                                <span className="text-gray-600">{filiere}</span>
                            </div>
                            <div className="flex items-center text-sm">
                                <span className="font-medium text-gray-700 w-[120px] text-right mr-2">Code déchet: </span>
                                <input 
                                    type="text"
                                    value={localData.wasteDetails.code}
                                    onChange={(e) => handleChange("wasteDetails.code", e.target.value)}
                                    className="text-gray-700 border-b-2 border-gray-300 focus:border-blue-500 focus:outline-none px-2 w-[90px] text-md font-medium"
                                />
                            </div>
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
                        </div>

                        {/* Transporteur */}
                        <div className="bg-yellow-50 p-3 rounded border border-yellow-100">
                            <h3 className="font-semibold text-yellow-800 mb-2">Transporteur</h3>
                            <div className="space-y-2 mr-4">
                                <LabelInput 
                                    label="Nom"
                                    value={localData.transporter?.company?.name || ""}
                                    onChange={handleChange}
                                    path="transporter.company.name"
                                />
                                <LabelInput 
                                    label="Adresse"
                                    value={localData.transporter?.company?.address || ""}
                                    onChange={handleChange}
                                    path="transporter.company.address"
                                />
                                <LabelInput 
                                    label="SIRET"
                                    value={localData.transporter?.company?.siret || ""}
                                    onChange={handleChange}
                                    path="transporter.company.siret"
                                />
                                <LabelInput 
                                    label="Contact"
                                    value={localData.transporter?.company?.contact || ""}
                                    onChange={handleChange}
                                    path="transporter.company.contact"
                                />
                                <LabelInput 
                                    label="Téléphone"
                                    value={localData.transporter?.company?.phone || ""}
                                    onChange={handleChange}
                                    path="transporter.company.phone"
                                />
                                <LabelInput 
                                    label="Email"
                                    value={localData.transporter?.company?.mail || ""}
                                    onChange={handleChange}
                                    path="transporter.company.mail"
                                />
                            </div>
                        </div>

                        {/* Site d'enlèvement */}
                        <div className="bg-green-50 p-3 rounded border border-green-100">
                            <h3 className="font-semibold text-green-800 mb-2">Site d&apos;enlèvement</h3>
                            <div className="space-y-2 mr-4">
                                <LabelInput 
                                    label="Nom usuel"
                                    value={localData.emitter?.workSite?.name || ""}
                                    onChange={handleChange}
                                    path="emitter.workSite.name"
                                />
                                <LabelInput 
                                    label="Adresse"
                                    value={localData.emitter?.workSite?.address || ""}
                                    onChange={handleChange}
                                    path="emitter.workSite.address"
                                />
                                <LabelInput 
                                    label="Code postal"
                                    value={localData.emitter?.workSite?.postalCode || ""}
                                    onChange={handleChange}
                                    path="emitter.workSite.postalCode"
                                />
                                <LabelInput 
                                    label="Ville"
                                    value={localData.emitter?.workSite?.city || ""}
                                    onChange={handleChange}
                                    path="emitter.workSite.city"
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
                                    value={localData.recipient?.company?.name || ""}
                                    onChange={handleChange}
                                    path="recipient.company.name"
                                />
                                <LabelInput 
                                    label="Adresse"
                                    value={localData.recipient?.company?.address || ""}
                                    onChange={handleChange}
                                    path="recipient.company.address"
                                />
                                <LabelInput 
                                    label="SIRET"
                                    value={localData.recipient?.company?.siret || ""}
                                    onChange={handleChange}
                                    path="recipient.company.siret"
                                />
                                <LabelInput 
                                    label="Contact"
                                    value={localData.recipient?.company?.contact || ""}
                                    onChange={handleChange}
                                    path="recipient.company.contact"
                                />
                                <LabelInput 
                                    label="Téléphone"
                                    value={localData.recipient?.company?.phone || ""}
                                    onChange={handleChange}
                                    path="recipient.company.phone"
                                />
                                <LabelInput 
                                    label="Email"
                                    value={localData.recipient?.company?.mail || ""}
                                    onChange={handleChange}
                                    path="recipient.company.mail"
                                />
                                <LabelInput 
                                    label="CAP"
                                    value={localData.recipient?.cap || ""}
                                    onChange={handleChange}
                                    path="recipient.cap"
                                />
                                <LabelInput 
                                    label="Code traitement"
                                    value={localData.recipient?.processingOperation || ""}
                                    onChange={handleChange}
                                    path="recipient.processingOperation"
                                />
                            </div>
                        </div>

                        {/* Détails du déchet */}
                        <div className="bg-red-50 p-3 rounded border border-red-100">
                            <h3 className="font-semibold text-red-800 mb-2">Détails du déchet</h3>
                            <div className="space-y-2 mr-4">
                                <LabelInput 
                                    label="Code CED"
                                    value={localData.wasteDetails?.code || ""}
                                    onChange={handleChange}
                                    path="wasteDetails.code"
                                />
                                <LabelInput 
                                    label="Code ONU"
                                    value={localData.wasteDetails?.onuCode || ""}
                                    onChange={handleChange}
                                    path="wasteDetails.onuCode"
                                />
                                <LabelInput 
                                    label="Consistance"
                                    value={localData.wasteDetails?.consistence || ""}
                                    onChange={handleChange}
                                    path="wasteDetails.consistence"
                                />
                                <LabelInput 
                                    label="Quantité"
                                    value={localData.wasteDetails?.quantity || null}
                                    onChange={handleChange}
                                    path="wasteDetails.quantity"
                                />
                                <LabelInput 
                                    label="Type de quantité"
                                    value={localData.wasteDetails?.quantityType || ""}
                                    onChange={handleChange}
                                    path="wasteDetails.quantityType"
                                />
                                <LabelInput 
                                    label="Type de contenant"
                                    value={localData.wasteDetails?.packagingInfos[0]?.type || ""}
                                    onChange={handleChange}
                                    path="wasteDetails.packagingInfos.type"
                                />
                                {/*<LabelInput 
                                    label="Description du contenant"
                                    value={localData.wasteDetails.packagingInfos[0].other}
                                    onChange={handleChange}
                                    path="wasteDetails.packagingInfos.other" //TODO: à modifiereeeeeee
                                />*/}
                                <LabelInput 
                                    label="Nombre de contenants"
                                    value={localData.wasteDetails?.packagingInfos[0]?.quantity || null}
                                    onChange={handleChange}
                                    path="wasteDetails.packagingInfos.quantity"
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