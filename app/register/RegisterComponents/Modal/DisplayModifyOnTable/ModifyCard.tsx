import { useState, useEffect } from "react";
import { useModalContextNew } from "../ContextModal";
import { toast } from "react-hot-toast";
import { useSession } from "@/app/component/SessionProvider";
import { supabase } from "@/app/database/supabaseClient";
import { FormInput } from "../../../interface/BSD_Interface";
import Swal from 'sweetalert2';
import { getMappingTableFiliere, getFiliere } from "../FormulaireFull/utils_new";
import { OtherInfos } from "../../../interface/BSD_Interface";
import { useBSDs } from "@/app/register/BSDsProvider";
import { BSD } from "@/app/register/TableBSD";
import Image from "next/image";
import BoxIcon from '@/app/component/BoxIconWrapper';

interface PdfInfo {
    id: number;
    name_pdf: string;
    name_pdf_in_bucket: string;
    created_at: string;
    status: string;
    document_type?: string;
    url?: string;
    file_size?: number;
}

const LabelInput = ({ label, value, onChange, path, readOnly, inputWidth }: { 
    label: string, 
    value?: string | number | null,
    onChange: (path: string, value: string) => void,
    path: string,
    readOnly?: boolean,
    inputWidth?: string
}) => (
    <div className="flex items-center text-sm">
        <span className="font-medium text-gray-700 w-[120px] text-right mr-2">{label}: </span>
        <input 
            type="text"
            value={value?.toString() ?? ''}
            onChange={(e) => onChange(path, e.target.value)}
            className={`text-gray-600 rounded-md px-2 py-[3px] ${inputWidth || 'w-[320px]'}`}
            readOnly={readOnly}
        />
    </div>
);

const ModifyCard = () => {
    const { modalId, modalType, setModalType, setDataToogle, modalReload, setModalReload } = useModalContextNew();
    const {setAllBSDs, setAllFilteredBSDs, setDisplayedBSDs} = useBSDs();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [readableId, setReadableId] = useState<string>("");
    const [pdfInfos, setPdfInfos] = useState<PdfInfo[]>([]);
    const [loadingUrls, setLoadingUrls] = useState<Record<number, boolean>>({});
    const [pdfUrls, setPdfUrls] = useState<Record<number, string>>({});
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
        ecoOrganisme: { name: "", siret: "" },
        temporaryStorageDetail: {
          company: { name: "", siret: "", address: "", country: "", contact: "", phone: "", mail: "" },
          cap: "",
          processingOperation: "",
        },
      });
    const [otherInfos, setOtherInfos] = useState<OtherInfos>({
        containerDescription: "",
        volume: "",
        volumeUnit: "",
        fillRate: "",
        comments: "",
    });
    const [createdAt, setCreatedAt] = useState<string>("");
    const [photo, setPhoto] = useState<string>("");

    const {entreprise_id, user_id} = useSession();
    const [filiere, setFiliere] = useState<string>("");
    const [masseVolumique, setMasseVolumique] = useState<string>("");
    
    // États pour les toggles
    const [showOtherTransporters, setShowOtherTransporters] = useState(false);
    const [showOtherRecipients, setShowOtherRecipients] = useState(false);

    const invalidateCache = async () => {
        if (!entreprise_id || !user_id) return;
        
        try {
            const response = await fetch('/api/invalidate_bsd_cache', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    entreprise_id,
                    user_id,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to invalidate cache');
            }

            console.log('Cache invalidated successfully');
        } catch (error) {
            console.error('Error invalidating cache:', error);
        }
    };    

    const handleOpenPdf = async (pdf: PdfInfo) => {
        if (pdfUrls[pdf.id]) {
            window.open(pdfUrls[pdf.id], '_blank');
            return;
        }

        try {
            setLoadingUrls(prev => ({ ...prev, [pdf.id]: true }));
            
            const { data: urlData } = await supabase
                .storage
                .from('pdfs_bucket')
                .createSignedUrl(pdf.name_pdf_in_bucket, 3600);

            if (!urlData?.signedUrl) {
                throw new Error('URL non générée');
            }

            setPdfUrls(prev => ({ ...prev, [pdf.id]: urlData.signedUrl }));
            window.open(urlData.signedUrl, '_blank');
        } catch (error) {
            console.error("Erreur lors de la récupération de l'URL:", error);
        } finally {
            setLoadingUrls(prev => ({ ...prev, [pdf.id]: false }));
        }
    };

    const getBSD = async (entrepriseId: string) => {
        const result = await supabase
            .from('bsd')
            .select('*')
            .eq('id', modalId)
            .eq('entreprise_id', entrepriseId)
            .single();

        if (result.data) {
            setLocalData(result.data.infos_json.formAPI.createFormInput);
            setReadableId(result.data.readable_id_track_dechets);
            setCreatedAt(result.data.created_at);
            setPhoto(result.data.photo || "");
            setOtherInfos(result.data.other_infos || {
                containerDescription: "",
                volume: "",
                volumeUnit: "",
                fillRate: "",
                comments: "",
            });

            // Récupérer les PDFs liés
            if (result.data.pdf_ids && result.data.pdf_ids.length > 0) {
                const { data: pdfsData, error: pdfsError } = await supabase
                    .from('pdf_infos')
                    .select('*')
                    .in('id', result.data.pdf_ids);

                if (pdfsError) {
                    console.error("Erreur lors de la récupération des PDFs:", pdfsError);
                } else if (pdfsData) {
                    setPdfInfos(pdfsData);
                }
            }

            // Récupérer la masse volumique
            if (result.data.infos_json.formAPI.createFormInput.wasteDetails?.code) {
                const { data: autocompletionData } = await supabase
                    .from('table_autocompletion')
                    .select('dechet')
                    .eq('entreprise_id', entrepriseId)
                    .eq('dechet->>codeCED', result.data.infos_json.formAPI.createFormInput.wasteDetails.code)
                    .single();

                if (autocompletionData?.dechet?.masseVolumique) {
                    setMasseVolumique(autocompletionData.dechet.masseVolumique);
                }
            }
        }
    }

    useEffect(() => {
        if (entreprise_id && user_id && modalId) {
            getBSD(entreprise_id);
        }
    }, [modalId, entreprise_id, user_id, modalType]);

    useEffect(() => {
        const getFiliereName = async () => {
            if (entreprise_id && localData?.wasteDetails?.code) {
                const mapping = await getMappingTableFiliere(entreprise_id);
                const filiereFound = getFiliere(localData.wasteDetails.code, mapping);
                setFiliere(filiereFound);
            }
        };
        getFiliereName();
    }, [localData, entreprise_id]);

    const handleChange = (path: string, value: string) => {
        console.log("localData", localData);
        setLocalData(prev => {
            if (!prev) return prev;
            const newData = { ...prev };
            
            if (path.includes('packagingInfos')) {
                if(newData.wasteDetails.packagingInfos.length === 0){
                    newData.wasteDetails.packagingInfos.push({ type: "AUTRE", quantity: 0, other: "" });
                } else {
                    if (path.includes('type')) {
                        newData.wasteDetails.packagingInfos[0].type = value as "AUTRE" | "FUT" | "GRV" | "CITERNE" | "BENNE" | "PIPELINE";
                    } else if (path.includes('quantity')) {
                        newData.wasteDetails.packagingInfos[0].quantity = Number(value);
                    } else if(path.includes('other')){
                        newData.wasteDetails.packagingInfos[0].other = value;
                    }
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
        if (!user_id || !localData) {
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
            // Créer une copie profonde de localData
            const dataToSend = JSON.parse(JSON.stringify(localData));
            
            // Conversion des quantités en nombres
            if (dataToSend.wasteDetails?.quantity) {
                dataToSend.wasteDetails.quantity = Number(String(dataToSend.wasteDetails.quantity).replace(',', '.'));
            }
            
            if (dataToSend.wasteDetails?.packagingInfos?.[0]?.quantity) {
                dataToSend.wasteDetails.packagingInfos[0].quantity = Number(String(dataToSend.wasteDetails.packagingInfos[0].quantity).replace(',', '.'));
            }

            console.log("dataToSend.wasteDetails.quantity : ", dataToSend.wasteDetails.quantity);
            console.log("dataToSend.recipient.company.name before submit", dataToSend.recipient);

            const dataToSendJSON = {
                user_id: user_id,
                bsd_id: modalId,
                infos_json: {
                    formAPI: { createFormInput: dataToSend }
                },
                created_at: createdAt,
                other_infos: otherInfos,
                readable_id_track_dechets: readableId
            };

            const response = await fetch('/api/demande_collecte/modify_bsd', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dataToSendJSON),
            });

            const apiResult = await response.json();
            if (apiResult.success) {
                setDataToogle(dataToSend);
                toast.success(apiResult.message);
                setModalType("");

                setTimeout(async () => {
                    setAllBSDs(prev => prev.map(bsd => bsd.id === modalId ? {...bsd, infos_json: dataToSendJSON.infos_json, created_at: dataToSendJSON.created_at} as unknown as BSD : bsd));
                    setAllFilteredBSDs(prev => prev.map(bsd => bsd.id === modalId ? {...bsd, infos_json: dataToSendJSON.infos_json, created_at: dataToSendJSON.created_at} as unknown as BSD : bsd));
                    setDisplayedBSDs(prev => prev.map(bsd => bsd.id === modalId ? {...bsd, infos_json: dataToSendJSON.infos_json, created_at: dataToSendJSON.created_at} as unknown as BSD : bsd));
                    await invalidateCache();
                }, 100);

                setModalReload(!modalReload);

            } else {
                console.log('dataToSend', dataToSend);
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

    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-4 mx-4 w-full md:max-w-6xl md:mx-auto max-h-[90vh] overflow-y-auto">
                <div className="border-b pb-2 flex justify-between items-start">
                    <div className="pr-8">
                        <h2 className="text-lg md:text-xl font-bold text-gray-800">Bordereau de Suivi des Déchets</h2>
                        <div className="mt-2 grid grid-cols-2 gap-4 ml-2 md:ml-6">
                            <div className="space-y-1">
                                <LabelInput 
                                    label="ID TrackDéchets"
                                    value={readableId}
                                    onChange={(_, value) => setReadableId(value)}
                                    path="readable_id_track_dechets"
                                />
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
                            <div className="space-y-1">
                                <div className="flex items-center text-sm">
                                    <span className="font-medium text-gray-700 w-[120px] text-right mr-2">Site: </span>
                                    <span className="text-gray-600">{localData.emitter?.workSite?.name || 'Non renseigné'}</span>
                                </div>
                                <div className="flex items-center text-sm">
                                    <span className="font-medium text-gray-700 w-[120px] text-right mr-2">Créer le: </span>
                                    <input 
                                        type="date"
                                        value={createdAt ? new Date(createdAt).toISOString().split('T')[0] : ''}
                                        onChange={(e) => setCreatedAt(e.target.value)}
                                        className="text-gray-700 border-b-2 border-gray-300 focus:border-blue-500 focus:outline-none px-2 text-md font-medium"
                                    />
                                </div>
                                <div className="flex items-center text-sm">
                                    <span className="font-medium text-gray-700 w-[120px] text-right mr-2">Collecté le: </span>
                                    <input 
                                        type="date"
                                        value={localData.takenOverAt ? new Date(localData.takenOverAt).toISOString().split('T')[0] : ''}
                                        onChange={(e) => handleChange("takenOverAt", e.target.value)}
                                        className="text-gray-700 border-b-2 border-gray-300 focus:border-blue-500 focus:outline-none px-2 text-md font-medium"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <button 
                        onClick={() => setModalType("")} 
                        className="text-gray-500 hover:text-gray-700 p-2"
                    >
                        ✕
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                <LabelInput 
                                    label="Récépissé"
                                    value={localData.transporter?.receipt || ""}
                                    onChange={handleChange}
                                    path="transporter.receipt"
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

                        {/* Négociant */}
                        <div className="bg-pink-50 p-3 rounded border border-pink-100">
                            <h3 className="font-semibold text-pink-800 mb-2">Négociant</h3>
                            <div className="space-y-2 mr-4">
                                <LabelInput 
                                    label="Nom"
                                    value={localData.trader?.company?.name || ""}
                                    onChange={handleChange}
                                    path="trader.company.name"
                                />
                                <LabelInput 
                                    label="Adresse"
                                    value={localData.trader?.company?.address || ""}
                                    onChange={handleChange}
                                    path="trader.company.address"
                                />
                                <LabelInput 
                                    label="SIRET"
                                    value={localData.trader?.company?.siret || ""}
                                    onChange={handleChange}
                                    path="trader.company.siret"
                                />
                                <LabelInput 
                                    label="Téléphone"
                                    value={localData.trader?.company?.phone || ""}
                                    onChange={handleChange}
                                    path="trader.company.phone"
                                />
                                <LabelInput 
                                    label="Email"
                                    value={localData.trader?.company?.mail || ""}
                                    onChange={handleChange}
                                    path="trader.company.mail"
                                />
                                <LabelInput 
                                    label="Récépissé"
                                    value={localData.trader?.receipt || ""}
                                    onChange={handleChange}
                                    path="trader.receipt"
                                />
                            </div>
                        </div>

                        {/* Courtier */}
                        <div className="bg-cyan-50 p-3 rounded border border-cyan-100">
                            <h3 className="font-semibold text-cyan-800 mb-2">Courtier</h3>
                            <div className="space-y-2 mr-4">
                                <LabelInput 
                                    label="Nom"
                                    value={localData.broker?.company?.name || ""}
                                    onChange={handleChange}
                                    path="broker.company.name"
                                />
                                <LabelInput 
                                    label="Adresse"
                                    value={localData.broker?.company?.address || ""}
                                    onChange={handleChange}
                                    path="broker.company.address"
                                />
                                <LabelInput 
                                    label="SIRET"
                                    value={localData.broker?.company?.siret || ""}
                                    onChange={handleChange}
                                    path="broker.company.siret"
                                />
                                <LabelInput 
                                    label="Téléphone"
                                    value={localData.broker?.company?.phone || ""}
                                    onChange={handleChange}
                                    path="broker.company.phone"
                                />
                                <LabelInput 
                                    label="Email"
                                    value={localData.broker?.company?.mail || ""}
                                    onChange={handleChange}
                                    path="broker.company.mail"
                                />
                                <LabelInput 
                                    label="Récépissé"
                                    value={localData.broker?.receipt || ""}
                                    onChange={handleChange}
                                    path="broker.receipt"
                                />
                            </div>
                        </div>

                        {/* Éco-organisme */}
                        <div className="bg-lime-50 p-3 rounded border border-lime-100">
                            <h3 className="font-semibold text-lime-800 mb-2">Éco-organisme</h3>
                            <div className="space-y-2 mr-4">
                                <LabelInput 
                                    label="Nom"
                                    value={localData.ecoOrganisme?.name || ""}
                                    onChange={handleChange}
                                    path="ecoOrganisme.name"
                                />
                                <LabelInput 
                                    label="SIRET"
                                    value={localData.ecoOrganisme?.siret || ""}
                                    onChange={handleChange}
                                    path="ecoOrganisme.siret"
                                />
                                <LabelInput 
                                    label="Téléphone"
                                    value={localData.ecoOrganisme?.phone || ""}
                                    onChange={handleChange}
                                    path="ecoOrganisme.phone"
                                />
                                <LabelInput 
                                    label="Email"
                                    value={localData.ecoOrganisme?.mail || ""}
                                    onChange={handleChange}
                                    path="ecoOrganisme.mail"
                                />
                            </div>
                        </div>

                        {/* Section Transporteurs supplémentaires */}
                        <div className="bg-violet-50 p-3 rounded border border-violet-100">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-semibold text-violet-800">Transporteurs supplémentaires</h3>
                                <button
                                    onClick={() => setShowOtherTransporters(!showOtherTransporters)}
                                    className="text-violet-600 hover:text-violet-800 text-sm"
                                >
                                    {showOtherTransporters ? 'Masquer' : 'Afficher'}
                                </button>
                            </div>
                            {showOtherTransporters && (
                                <div className="space-y-4">
                                    {otherInfos.other_transporters && otherInfos.other_transporters.length > 0 ? (
                                        otherInfos.other_transporters.map((transporter, index) => (
                                            <div key={index} className="p-3 bg-gray-50 rounded border border-violet-200">
                                                <div className="flex justify-between items-center mb-2">
                                                    <h4 className="font-medium text-violet-700">Transporteur {index + 2}</h4>
                                                    <button
                                                        onClick={() => {
                                                            setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                                                ...prev,
                                                                other_transporters: prev.other_transporters?.filter((_, i) => i !== index) || []
                                                            }));
                                                        }}
                                                        className="text-red-600 hover:text-red-800 p-1"
                                                        title="Supprimer ce transporteur"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                                <div className="space-y-2">
                                                    <LabelInput 
                                                        label="Nom"
                                                        value={transporter.company?.name || ""}
                                                        onChange={(_, value) => {
                                                            setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                                                ...prev,
                                                                other_transporters: prev.other_transporters?.map((t, i) => 
                                                                    i === index 
                                                                        ? { ...t, company: { ...t.company, name: value } }
                                                                        : t
                                                                ) || []
                                                            }));
                                                        }}
                                                        path={`other_transporters.${index}.company.name`}
                                                    />
                                                    <LabelInput 
                                                        label="SIRET"
                                                        value={transporter.company?.siret || ""}
                                                        onChange={(_, value) => {
                                                            setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                                                ...prev,
                                                                other_transporters: prev.other_transporters?.map((t, i) => 
                                                                    i === index 
                                                                        ? { ...t, company: { ...t.company, siret: value } }
                                                                        : t
                                                                ) || []
                                                            }));
                                                        }}
                                                        path={`other_transporters.${index}.company.siret`}
                                                    />
                                                    <LabelInput 
                                                        label="Adresse"
                                                        value={transporter.company?.address || ""}
                                                        onChange={(_, value) => {
                                                            setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                                                ...prev,
                                                                other_transporters: prev.other_transporters?.map((t, i) => 
                                                                    i === index 
                                                                        ? { ...t, company: { ...t.company, address: value } }
                                                                        : t
                                                                ) || []
                                                            }));
                                                        }}
                                                        path={`other_transporters.${index}.company.address`}
                                                    />
                                                    <LabelInput 
                                                        label="Contact"
                                                        value={transporter.company?.contact || ""}
                                                        onChange={(_, value) => {
                                                            setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                                                ...prev,
                                                                other_transporters: prev.other_transporters?.map((t, i) => 
                                                                    i === index 
                                                                        ? { ...t, company: { ...t.company, contact: value } }
                                                                        : t
                                                                ) || []
                                                            }));
                                                        }}
                                                        path={`other_transporters.${index}.company.contact`}
                                                    />
                                                    <LabelInput 
                                                        label="Téléphone"
                                                        value={transporter.company?.phone || ""}
                                                        onChange={(_, value) => {
                                                            setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                                                ...prev,
                                                                other_transporters: prev.other_transporters?.map((t, i) => 
                                                                    i === index 
                                                                        ? { ...t, company: { ...t.company, phone: value } }
                                                                        : t
                                                                ) || []
                                                            }));
                                                        }}
                                                        path={`other_transporters.${index}.company.phone`}
                                                    />
                                                    <LabelInput 
                                                        label="Email"
                                                        value={transporter.company?.mail || ""}
                                                        onChange={(_, value) => {
                                                            setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                                                ...prev,
                                                                other_transporters: prev.other_transporters?.map((t, i) => 
                                                                    i === index 
                                                                        ? { ...t, company: { ...t.company, mail: value } }
                                                                        : t
                                                                ) || []
                                                            }));
                                                        }}
                                                        path={`other_transporters.${index}.company.mail`}
                                                    />
                                                    <LabelInput 
                                                        label="Récépissé"
                                                        value={transporter.receipt || ""}
                                                        onChange={(_, value) => {
                                                            setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                                                ...prev,
                                                                other_transporters: prev.other_transporters?.map((t, i) => 
                                                                    i === index 
                                                                        ? { ...t, receipt: value }
                                                                        : t
                                                                ) || []
                                                            }));
                                                        }}
                                                        path={`other_transporters.${index}.receipt`}
                                                    />
                                                    <LabelInput 
                                                        label="Plaque d'immatriculation"
                                                        value={transporter.numberPlate || ""}
                                                        onChange={(_, value) => {
                                                            setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                                                ...prev,
                                                                other_transporters: prev.other_transporters?.map((t, i) => 
                                                                    i === index 
                                                                        ? { ...t, numberPlate: value }
                                                                        : t
                                                                ) || []
                                                            }));
                                                        }}
                                                        path={`other_transporters.${index}.numberPlate`}
                                                    />
                                                    <LabelInput 
                                                        label="Date de prise en charge"
                                                        value={transporter.takenOverAt || ""}
                                                        onChange={(_, value) => {
                                                            setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                                                ...prev,
                                                                other_transporters: prev.other_transporters?.map((t, i) => 
                                                                    i === index 
                                                                        ? { ...t, takenOverAt: value }
                                                                        : t
                                                                ) || []
                                                            }));
                                                        }}
                                                        path={`other_transporters.${index}.takenOverAt`}
                                                    />
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-gray-500 text-sm">Aucun transporteur supplémentaire</p>
                                    )}
                                    <button
                                        onClick={() => {
                                            setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                                ...prev,
                                                other_transporters: [
                                                    ...(prev.other_transporters || []),
                                                    {
                                                        company: {
                                                            name: "",
                                                            siret: "",
                                                            address: "",
                                                            country: "",
                                                            contact: "",
                                                            phone: "",
                                                            mail: ""
                                                        },
                                                        receipt: "",
                                                        numberPlate: "",
                                                        takenOverAt: "",
                                                        isExemptedOfReceipt: false
                                                    }
                                                ]
                                            }));
                                        }}
                                        className="text-sm text-violet-600 hover:text-violet-800"
                                    >
                                        + Ajouter un transporteur supplémentaire
                                    </button>
                                </div>
                            )}
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
                                
                                {/* Section ValoParts */}
                                {localData.recipient?.valoParts && localData.recipient.valoParts.length > 0 && (
                                    <div className="mt-3 p-2 bg-gray-50 rounded border">
                                        <h4 className="font-medium text-gray-700 mb-2">Valorisation éclatée</h4>
                                        <div className="space-y-2">
                                            {localData.recipient.valoParts.map((part: { code_valo: string; tonnage: number }, partIndex: number) => (
                                                <div key={partIndex} className="flex justify-start space-x-2">
                                                    <div className="flex-2">
                                                        <LabelInput 
                                                            label="Code D/R"
                                                            value={part.code_valo}
                                                            onChange={(_, value) => {
                                                                setLocalData(prev => {
                                                                    if (!prev?.recipient?.valoParts) return prev;
                                                                    const newData = { ...prev };
                                                                    if (newData.recipient.valoParts) {
                                                                        newData.recipient.valoParts[partIndex].code_valo = value;
                                                                    }
                                                                    return newData;
                                                                });
                                                            }}
                                                            path={`valoParts.${partIndex}.code_valo`}
                                                            inputWidth="w-[60px]"
                                                        />
                                                    </div>
                                                    <div className="flex-2">
                                                        <LabelInput 
                                                            label="Tonnage"
                                                            value={part.tonnage?.toString() || ""}
                                                            onChange={(_, value) => {
                                                                setLocalData(prev => {
                                                                    if (!prev?.recipient?.valoParts) return prev;
                                                                    const newData = { ...prev };
                                                                    if (newData.recipient.valoParts) {
                                                                        const numValue = value === "" ? 0 : parseFloat(value) || 0;
                                                                        newData.recipient.valoParts[partIndex].tonnage = numValue;
                                                                    }
                                                                    return newData;
                                                                });
                                                            }}
                                                            path={`valoParts.${partIndex}.tonnage`}
                                                            inputWidth="w-[60px]"
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            setLocalData(prev => {
                                                                if (!prev?.recipient?.valoParts) return prev;
                                                                const newData = { ...prev };
                                                                if (newData.recipient.valoParts) {
                                                                    newData.recipient.valoParts = newData.recipient.valoParts.filter((_: any, pi: number) => pi !== partIndex);
                                                                }
                                                                return newData;
                                                            });
                                                        }}
                                                        className="text-red-600 hover:text-red-800 p-1"
                                                        title="Supprimer cette partie"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            onClick={() => {
                                                setLocalData(prev => {
                                                    if (!prev?.recipient) return prev;
                                                    const newData = { ...prev };
                                                    if (!newData.recipient.valoParts) {
                                                        newData.recipient.valoParts = [];
                                                    }
                                                    newData.recipient.valoParts.push({
                                                        code_valo: "",
                                                        tonnage: 0
                                                    });
                                                    return newData;
                                                });
                                            }}
                                            className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                                        >
                                            + Ajouter une partie de valorisation
                                        </button>
                                    </div>
                                )}

                                {/* Bouton pour ajouter des valoParts si elles n'existent pas */}
                                {(!localData.recipient?.valoParts || localData.recipient.valoParts.length === 0) && (
                                    <button
                                        onClick={() => {
                                            setLocalData(prev => {
                                                if (!prev?.recipient) return prev;
                                                const newData = { ...prev };
                                                newData.recipient.valoParts = [{
                                                    code_valo: "",
                                                    tonnage: 0
                                                }];
                                                return newData;
                                            });
                                        }}
                                        className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                                    >
                                        + Ajouter des parties de valorisation
                                    </button>
                                )}
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
                                    label="Nom du déchet"
                                    value={localData.wasteDetails?.name || ""}
                                    onChange={handleChange}
                                    path="wasteDetails.name"
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
                                <div className="flex items-center text-sm">
                                    <span className="font-medium text-gray-700 w-[120px] text-right mr-2">Trié: </span>
                                    <input
                                        type="checkbox"
                                        checked={otherInfos.tri || false}
                                        onChange={(e) => {
                                            setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                                ...prev,
                                                tri: e.target.checked
                                            }));
                                        }}
                                        className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                                    />
                                </div>
                                <div className="flex items-center text-sm">
                                    <span className="font-medium text-gray-700 w-[120px] text-right mr-2">Rupture de traçabilité: </span>
                                    <input
                                        type="checkbox"
                                        checked={localData.noTraceability || false}
                                        onChange={(e) => {
                                            setLocalData(prev => {
                                                if (!prev) return prev;
                                                return { ...prev, noTraceability: e.target.checked };
                                            });
                                        }}
                                        className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section photo du déchet */}
                        {photo && (
                            <div className="bg-orange-50 p-3 rounded border border-orange-100">
                                <h3 className="font-semibold text-orange-800 mb-2">Photo du déchet</h3>
                                <div className="relative w-full h-48 rounded-lg overflow-hidden">
                                    <Image
                                        src={photo}
                                        alt="Photo du déchet"
                                        fill
                                        className="object-contain"
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.src = "/placeholder-image.jpg";
                                            console.error("Erreur de chargement de l'image");
                                        }}
                                    />
                                </div>
                                <a 
                                    href={photo} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-sm text-blue-600 hover:text-blue-800 mt-2 inline-block"
                                >
                                    Voir la photo en taille réelle
                                </a>
                            </div>
                        )}

                        {/* Ajout de la section other_infos */}
                        <div className="bg-indigo-50 p-3 rounded border border-indigo-100 mt-4">
                            <div className="flex justify-start items-center space-x-2">
                                <h3 className="font-semibold text-indigo-800 mb-2">Informations contenant</h3>
                                <p className="text-sm text-gray-600 mb-2 hidden">- Cette partie n&apos;est pas sur TrackDéchets</p>
                            </div>
                            <div className="space-y-2 mr-4">
                                <LabelInput 
                                    label="Infos supp."
                                    value={otherInfos.containerDescription}
                                    onChange={(_, value) => {
                                        setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                            ...prev,
                                            containerDescription: value
                                        }));
                                    }}
                                    path="containerDescription"
                                />
                                <LabelInput 
                                    label="Volume"
                                    value={otherInfos.volume}
                                    onChange={(_, value) => {
                                        setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                            ...prev,
                                            volume: value
                                        }));
                                    }}
                                    path="volume"
                                />
                                <LabelInput 
                                    label="Unité"
                                    value={otherInfos.volumeUnit}
                                    onChange={(_, value) => {
                                        setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                            ...prev,
                                            volumeUnit: value
                                        }));
                                    }}
                                    path="volumeUnit"
                                />
                                <LabelInput 
                                    label="Taux de remplissage (%)"
                                    value={otherInfos.fillRate}
                                    onChange={(_, value) => {
                                        setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                            ...prev,
                                            fillRate: value
                                        }));
                                    }}
                                    path="fillRate"
                                />
                                <div className="flex items-center text-sm">
                                    <span className="font-medium text-gray-700 w-[120px] text-right mr-2">Masse volumique: </span>
                                    <span className="text-gray-600">{masseVolumique || "Non renseignée"}</span>
                                </div>
                            </div>
                        </div>

                        {/* Section déclassement */}
                        <div className="bg-indigo-50 p-3 rounded border border-indigo-100 mt-4">
                            <h3 className="font-semibold text-indigo-800 mb-2">Déclassement</h3>
                            <div className="space-y-2 mr-4">
                                <div className="flex items-center text-sm">
                                    <span className="font-medium text-gray-700 w-[200px] text-right mr-2">Déclassement: </span>
                                    <input
                                        type="checkbox"
                                        checked={otherInfos.declassement?.declassement_boolean || false}
                                        onChange={(e) => {
                                            setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                                ...prev,
                                                declassement: {
                                                    ...prev.declassement,
                                                    declassement_boolean: e.target.checked,
                                                    pourcentage_masse_declassee: prev.declassement?.pourcentage_masse_declassee || "",
                                                    montant_declasse: prev.declassement?.montant_declasse || ""
                                                }
                                            }));
                                        }}
                                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                    />
                                </div>
                                <div className="flex items-center text-sm">
                                    <span className="font-medium text-gray-700 w-[200px] text-right mr-2">Pourcentage masse déclassée: </span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="1"
                                        value={otherInfos.declassement?.pourcentage_masse_declassee || ""}
                                        onChange={(e) => {
                                            setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                                ...prev,
                                                declassement: {
                                                    ...prev.declassement,
                                                    declassement_boolean: prev.declassement?.declassement_boolean || false,
                                                    pourcentage_masse_declassee: e.target.value,
                                                    montant_declasse: prev.declassement?.montant_declasse || ""
                                                }
                                            }));
                                        }}
                                        placeholder="0-100%"
                                        className="text-gray-600 rounded-md px-2 py-[3px] w-[320px]"
                                    />
                                </div>
                                <div className="flex items-center text-sm">
                                    <span className="font-medium text-gray-700 w-[200px] text-right mr-2">Montant déclassé: </span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={otherInfos.declassement?.montant_declasse || ""}
                                        onChange={(e) => {
                                            setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                                ...prev,
                                                declassement: {
                                                    ...prev.declassement,
                                                    declassement_boolean: prev.declassement?.declassement_boolean || false,
                                                    pourcentage_masse_declassee: prev.declassement?.pourcentage_masse_declassee || "",
                                                    montant_declasse: e.target.value
                                                }
                                            }));
                                        }}
                                        placeholder="Montant en euros"
                                        className="text-gray-600 rounded-md px-2 py-[3px] w-[320px]"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section des commentaires */}
                        <div className="bg-teal-50 p-3 rounded border border-teal-100 mt-4">
                            <div className="flex justify-start items-center space-x-2">
                                <h3 className="font-semibold text-teal-800 mb-2">Commentaires</h3>
                                <p className="text-sm text-gray-600 mb-2 hidden">- Cette partie n&apos;est pas sur TrackDéchets</p>
                            </div>
                            <div className="space-y-2 mr-4">
                                <LabelInput 
                                    label="Commentaires"
                                    value={otherInfos.comments || ""}
                                    onChange={(_, value) => {
                                        setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                            ...prev,
                                            comments: value
                                        }));
                                    }}
                                    path="comments"
                                />
                            </div>
                        </div>

                        {/* Section REP */}
                        <div className="bg-amber-50 p-3 rounded border border-amber-100 mt-4">
                            <h3 className="font-semibold text-amber-800 mb-2">REP</h3>
                            <div className="space-y-2 mr-4">
                                <div className="flex items-center text-sm">
                                    <span className="font-medium text-gray-700 w-[200px] text-right mr-2">Envoyé en REP: </span>
                                    <input
                                        type="checkbox"
                                        checked={otherInfos.rep?.sent_to_rep || false}
                                        onChange={(e) => {
                                            setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                                ...prev,
                                                rep: {
                                                    ...prev.rep,
                                                    sent_to_rep: e.target.checked
                                                }
                                            }));
                                        }}
                                        className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded"
                                    />
                                </div>
                                <div className="flex items-center text-sm">
                                    <span className="font-medium text-gray-700 w-[200px] text-right mr-2">Montant du rachat: </span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="10"
                                        value={otherInfos.rep?.montant_rep || 0}
                                        onChange={(e) => {
                                            setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                                ...prev,
                                                rep: {
                                                    ...prev.rep,
                                                    montant_rep: Number(e.target.value)
                                                }
                                            }));
                                        }}
                                        placeholder="Montant en euros"
                                        className="text-gray-600 rounded-md px-2 py-[3px] w-[320px]"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section Destinataires supplémentaires */}
                        <div className="bg-emerald-50 p-3 rounded border border-emerald-100 mt-4">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-semibold text-emerald-800">Destinataires supplémentaires</h3>
                                <button
                                    onClick={() => setShowOtherRecipients(!showOtherRecipients)}
                                    className="text-emerald-600 hover:text-emerald-800 text-sm"
                                >
                                    {showOtherRecipients ? 'Masquer' : 'Afficher'}
                                </button>
                            </div>
                            {showOtherRecipients && (
                                <div className="space-y-4">
                                    {otherInfos.other_recipients && otherInfos.other_recipients.length > 0 ? (
                                        otherInfos.other_recipients.map((recipient, index) => (
                                            <div key={index} className="p-3 bg-gray-50 rounded border border-emerald-200">
                                                <div className="flex justify-between items-center mb-2">
                                                    <h4 className="font-medium text-emerald-700">Destinataire {index + 2}</h4>
                                                    <button
                                                        onClick={() => {
                                                            setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                                                ...prev,
                                                                other_recipients: prev.other_recipients?.filter((_, i) => i !== index) || []
                                                            }));
                                                        }}
                                                        className="text-red-600 hover:text-red-800 p-1"
                                                        title="Supprimer ce destinataire"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                                <div className="space-y-2">
                                                    <LabelInput 
                                                        label="Nom"
                                                        value={recipient.company?.name || ""}
                                                        onChange={(_, value) => {
                                                            setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                                                ...prev,
                                                                other_recipients: prev.other_recipients?.map((r, i) => 
                                                                    i === index 
                                                                        ? { ...r, company: { ...r.company, name: value } }
                                                                        : r
                                                                ) || []
                                                            }));
                                                        }}
                                                        path={`other_recipients.${index}.company.name`}
                                                    />
                                                    <LabelInput 
                                                        label="SIRET"
                                                        value={recipient.company?.siret || ""}
                                                        onChange={(_, value) => {
                                                            setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                                                ...prev,
                                                                other_recipients: prev.other_recipients?.map((r, i) => 
                                                                    i === index 
                                                                        ? { ...r, company: { ...r.company, siret: value } }
                                                                        : r
                                                                ) || []
                                                            }));
                                                        }}
                                                        path={`other_recipients.${index}.company.siret`}
                                                    />
                                                    <LabelInput 
                                                        label="Adresse"
                                                        value={recipient.company?.address || ""}
                                                        onChange={(_, value) => {
                                                            setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                                                ...prev,
                                                                other_recipients: prev.other_recipients?.map((r, i) => 
                                                                    i === index 
                                                                        ? { ...r, company: { ...r.company, address: value } }
                                                                        : r
                                                                ) || []
                                                            }));
                                                        }}
                                                        path={`other_recipients.${index}.company.address`}
                                                    />
                                                    <LabelInput 
                                                        label="Contact"
                                                        value={recipient.company?.contact || ""}
                                                        onChange={(_, value) => {
                                                            setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                                                ...prev,
                                                                other_recipients: prev.other_recipients?.map((r, i) => 
                                                                    i === index 
                                                                        ? { ...r, company: { ...r.company, contact: value } }
                                                                        : r
                                                                ) || []
                                                            }));
                                                        }}
                                                        path={`other_recipients.${index}.company.contact`}
                                                    />
                                                    <LabelInput 
                                                        label="Téléphone"
                                                        value={recipient.company?.phone || ""}
                                                        onChange={(_, value) => {
                                                            setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                                                ...prev,
                                                                other_recipients: prev.other_recipients?.map((r, i) => 
                                                                    i === index 
                                                                        ? { ...r, company: { ...r.company, phone: value } }
                                                                        : r
                                                                ) || []
                                                            }));
                                                        }}
                                                        path={`other_recipients.${index}.company.phone`}
                                                    />
                                                    <LabelInput 
                                                        label="Email"
                                                        value={recipient.company?.mail || ""}
                                                        onChange={(_, value) => {
                                                            setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                                                ...prev,
                                                                other_recipients: prev.other_recipients?.map((r, i) => 
                                                                    i === index 
                                                                        ? { ...r, company: { ...r.company, mail: value } }
                                                                        : r
                                                                ) || []
                                                            }));
                                                        }}
                                                        path={`other_recipients.${index}.company.mail`}
                                                    />
                                                    <LabelInput 
                                                        label="CAP"
                                                        value={recipient.cap || ""}
                                                        onChange={(_, value) => {
                                                            setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                                                ...prev,
                                                                other_recipients: prev.other_recipients?.map((r, i) => 
                                                                    i === index 
                                                                        ? { ...r, cap: value }
                                                                        : r
                                                                ) || []
                                                            }));
                                                        }}
                                                        path={`other_recipients.${index}.cap`}
                                                    />
                                                    <LabelInput 
                                                        label="Code de traitement"
                                                        value={recipient.processingOperation || ""}
                                                        onChange={(_, value) => {
                                                            setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                                                ...prev,
                                                                other_recipients: prev.other_recipients?.map((r, i) => 
                                                                    i === index 
                                                                        ? { ...r, processingOperation: value }
                                                                        : r
                                                                ) || []
                                                            }));
                                                        }}
                                                        path={`other_recipients.${index}.processingOperation`}
                                                    />
                                                    
                                                    {/* Section ValoParts pour les destinataires supplémentaires */}
                                                    {recipient.valoParts && recipient.valoParts.length > 0 && (
                                                        <div className="mt-3 p-2 bg-gray-50 rounded border">
                                                            <h5 className="font-medium text-gray-700 mb-2">Valorisation éclatée</h5>
                                                            <div className="space-y-2">
                                                                {recipient.valoParts.map((part: { code_valo: string; tonnage: number }, partIndex: number) => (
                                                                    <div key={partIndex} className="flex justify-start space-x-2">
                                                                        <div className="flex-2">
                                                                            <LabelInput 
                                                                                label="Code D/R"
                                                                                value={part.code_valo}
                                                                                onChange={(_, value) => {
                                                                                    setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                                                                        ...prev,
                                                                                        other_recipients: prev.other_recipients?.map((r, i) => 
                                                                                            i === index 
                                                                                                ? { 
                                                                                                    ...r, 
                                                                                                    valoParts: r.valoParts?.map((p: { code_valo: string; tonnage: number }, pi: number) => 
                                                                                                        pi === partIndex 
                                                                                                            ? { ...p, code_valo: value }
                                                                                                            : p
                                                                                                    ) || []
                                                                                                }
                                                                                                : r
                                                                                        ) || []
                                                                                    }));
                                                                                }}
                                                                                path={`other_recipients.${index}.valoParts.${partIndex}.code_valo`}
                                                                                inputWidth="w-[60px]"
                                                                            />
                                                                        </div>
                                                                        <div className="flex-2">
                                                                            <LabelInput 
                                                                                label="Tonnage"
                                                                                value={part.tonnage?.toString() || ""}
                                                                                onChange={(_, value) => {
                                                                                    setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                                                                        ...prev,
                                                                                        other_recipients: prev.other_recipients?.map((r, i) => 
                                                                                            i === index 
                                                                                                ? { 
                                                                                                    ...r, 
                                                                                                    valoParts: r.valoParts?.map((p: { code_valo: string; tonnage: number }, pi: number) => 
                                                                                                        pi === partIndex 
                                                                                                            ? { ...p, tonnage: Number(value) || 0 }
                                                                                                            : p
                                                                                                    ) || []
                                                                                                }
                                                                                                : r
                                                                                        ) || []
                                                                                    }));
                                                                                }}
                                                                                path={`other_recipients.${index}.valoParts.${partIndex}.tonnage`}
                                                                                inputWidth="w-[60px]"
                                                                            />
                                                                        </div>
                                                                        <button
                                                                            onClick={() => {
                                                                                setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                                                                    ...prev,
                                                                                    other_recipients: prev.other_recipients?.map((r, i) => 
                                                                                        i === index 
                                                                                            ? { 
                                                                                                ...r, 
                                                                                                valoParts: r.valoParts?.filter((_: any, pi: number) => pi !== partIndex) || []
                                                                                            }
                                                                                            : r
                                                                                    ) || []
                                                                                }));
                                                                            }}
                                                                            className="text-red-600 hover:text-red-800 p-1"
                                                                            title="Supprimer cette partie"
                                                                        >
                                                                            ✕
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                                                        ...prev,
                                                                        other_recipients: prev.other_recipients?.map((r, i) => 
                                                                            i === index 
                                                                                ? { 
                                                                                    ...r, 
                                                                                    valoParts: [
                                                                                        ...(r.valoParts || []),
                                                                                        { code_valo: "", tonnage: 0 }
                                                                                    ]
                                                                                }
                                                                                : r
                                                                        ) || []
                                                                    }));
                                                                }}
                                                                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                                                            >
                                                                + Ajouter une partie de valorisation
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Bouton pour ajouter des valoParts si elles n'existent pas */}
                                                    {(!recipient.valoParts || recipient.valoParts.length === 0) && (
                                                        <button
                                                            onClick={() => {
                                                                setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                                                    ...prev,
                                                                    other_recipients: prev.other_recipients?.map((r, i) => 
                                                                        i === index 
                                                                            ? { 
                                                                                ...r, 
                                                                                valoParts: [{ code_valo: "", tonnage: 0 }]
                                                                            }
                                                                            : r
                                                                    ) || []
                                                                }));
                                                            }}
                                                            className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                                                        >
                                                            + Ajouter des parties de valorisation
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-gray-500 text-sm">Aucun destinataire supplémentaire</p>
                                    )}
                                    <button
                                        onClick={() => {
                                            setOtherInfos((prev: OtherInfos): OtherInfos => ({
                                                ...prev,
                                                other_recipients: [
                                                    ...(prev.other_recipients || []),
                                                    {
                                                        company: {
                                                            name: "",
                                                            siret: "",
                                                            address: "",
                                                            country: "",
                                                            contact: "",
                                                            phone: "",
                                                            mail: ""
                                                        },
                                                        cap: "",
                                                        processingOperation: "",
                                                        valoParts: []
                                                    }
                                                ]
                                            }));
                                        }}
                                        className="text-sm text-emerald-600 hover:text-emerald-800"
                                    >
                                        + Ajouter un destinataire supplémentaire
                                    </button>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
                <style jsx global>{`
                    @media (max-width: 768px) {
                        .text-sm input {
                            width: 100%;
                            max-width: none;
                        }
                    }
                `}</style>

                {/* Ajouter la section PDFs avant le bouton de fermeture */}
                {pdfInfos.length > 0 && (
                    <div className="bg-pink-50 p-3 rounded border border-pink-100 mt-4">
                        <h3 className="font-semibold text-pink-800 mb-2">PDFs liés</h3>
                        <div className="space-y-2">
                            {pdfInfos.map((pdf) => (
                                <div key={pdf.id} className="flex items-center justify-between p-2 bg-white rounded hover:bg-pink-50 transition-colors">
                                    <div className="flex items-center space-x-2">
                                        <BoxIcon name='file-pdf' color='red' type='solid' />
                                        <span className="text-sm text-gray-700">{pdf.name_pdf}</span>
                                    </div>
                                    <button
                                        onClick={() => handleOpenPdf(pdf)}
                                        disabled={loadingUrls[pdf.id]}
                                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                    >
                                        {loadingUrls[pdf.id] ? 'Chargement...' : 'Ouvrir'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex justify-end space-x-2 mt-6">
                    <button
                        onClick={() => {
                            setModalType("");
                            setPdfInfos([]);
                            setPdfUrls({});
                            setLoadingUrls({});
                        }}
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
}

export default ModifyCard;