import { useEffect, useState } from "react";
import { useModalContextNew } from "../ContextModal";
import { Anything, BSDD_TrackDechets, DataTotalInterface, Form_API_Interface_Short } from "../../../interface/BSD_Interface";
import { supabase } from "@/app/database/supabaseClient";
import { useSession } from "@/app/component/SessionProvider";
import { getMappingTableFiliere, getFiliere } from "../FormulaireFull/utils_new";
import { OtherInfos } from "../../../interface/BSD_Interface";
import Image from 'next/image';

const DisplayCard = () => {
    const { modalId, modalType, setModalType, modalReload } = useModalContextNew();
    const [bsd, setBSD] = useState<BSDD_TrackDechets & { photo?: string } | null>(null);
    const [otherInfos, setOtherInfos] = useState<OtherInfos | null>(null);
    const session = useSession();
    const [filiere, setFiliere] = useState<string>("");

    const getBSD = async (entrepriseId: string) => {
        const result = await supabase
            .from('bsd')
            .select('*')
            .eq('id', modalId)
            .eq('entreprise_id', entrepriseId)
            .single();

        if (result.data) {
            console.log("BSD trouvé:", result.data);
            setBSD({
                ...result.data.infos_json.formAPI.createFormInput,
                photo: result.data.photo
            });
            setOtherInfos(result.data.other_infos);
        } else {
            console.error("Pas de BSD trouvé pour l'ID:", modalId);
        }
    }

    useEffect(() => {
        //console.log("modalId:", modalId);
        if (session && session.entreprise_id && modalId) {
            getBSD(session.entreprise_id);
        }
    }, [modalId, modalReload, session]);

    useEffect(() => {
        const getFiliereName = async () => {
            if (session?.entreprise_id && bsd?.wasteDetails?.code) {
                const mapping = await getMappingTableFiliere(session.entreprise_id);
                const filiereFound = getFiliere(bsd.wasteDetails.code, mapping);
                setFiliere(filiereFound);
            }
        };
        getFiliereName();
    }, [bsd, session]);

    const formatDate = (dateString: string | undefined | null) => {
        if (!dateString) return null;
        return new Date(dateString).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const LabelValue = ({ label, value }: { label: string, value: Anything|null }) => {
        if (value === null || value === undefined || value === '') return null;
        return (
            <p className="text-sm">
                <span className="font-medium text-gray-700">{label}: </span>
                <span className="text-gray-600">{value}</span>
            </p>
        );
    };

    return (
    <div>
        {modalType === "display" && bsd && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-lg p-4 mx-4 w-full md:max-w-4xl md:mx-auto max-h-[90vh] overflow-y-auto">
                    <div className="space-y-4">
                        {/* En-tête */}
                        <div className="border-b pb-2 flex justify-between items-start">
                            <div className="pr-8">
                                <h2 className="text-lg md:text-xl font-bold text-gray-800">Bordereau de Suivi des Déchets</h2>
                                <div className="mt-2 space-y-1">
                                    <LabelValue label="Site" value={bsd.emitter?.workSite?.name || ""} />
                                    <LabelValue label="Filière" value={filiere || ""} />
                                    <LabelValue label="Code déchet" value={bsd.wasteDetails?.code || ""} />
                                    {/* <LabelValue label="Date de création" value={formatDate(bsd.createdAt || "")} /> */}
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
                                    <LabelValue label="Nom" value={bsd.emitter?.company?.name || ""} />
                                    <LabelValue label="Adresse" value={bsd.emitter?.company?.address || ""} />
                                    <LabelValue label="SIRET" value={bsd.emitter?.company?.siret || ""} />
                                    <LabelValue label="Contact" value={bsd.emitter?.company?.contact || ""} />
                                    <LabelValue label="Téléphone" value={bsd.emitter?.company?.phone || ""} />
                                    <LabelValue label="Email" value={bsd.emitter?.company?.mail || ""   } />
                                </div>

                                {/* Site d'enlèvement */}
                                <div className="bg-green-50 p-3 rounded border border-green-100">
                                    <h3 className="font-semibold text-green-800 mb-2">Site d&apos;enlèvement</h3>
                                    <LabelValue label="Nom usuel" value={bsd.emitter?.workSite?.name || ""} />
                                    <LabelValue label="Adresse" value={bsd.emitter?.workSite?.address || ""} />
                                    <LabelValue label="Code postal" value={bsd.emitter?.workSite?.postalCode || ""} />
                                    <LabelValue label="Ville" value={bsd.emitter?.workSite?.city || ""} />
                                </div>

                                {/* Transporteur */}
                                <div className="bg-yellow-50 p-3 rounded border border-yellow-100">
                                    <h3 className="font-semibold text-yellow-800 mb-2">Transporteur</h3>
                                    <LabelValue label="Nom" value={bsd.transporter?.company?.name || ""} />
                                    <LabelValue label="Adresse" value={bsd.transporter?.company?.address || ""} />
                                    <LabelValue label="SIRET" value={bsd.transporter?.company?.siret || ""} />
                                    <LabelValue label="Contact" value={bsd.transporter?.company?.contact || ""} />
                                    <LabelValue label="Téléphone" value={bsd.transporter?.company?.phone || ""} />
                                    <LabelValue label="Email" value={bsd.transporter?.company?.mail || ""} />
                                </div>

                                {/* Ajout d'une nouvelle section pour other_infos si elle existe */}
                                {otherInfos?.volume && (
                                    <div className="bg-indigo-50 p-3 rounded border border-indigo-100 mt-4">
                                        <div className="flex justify-start items-center space-x-2">

                                            <h3 className="font-semibold text-indigo-800 mb-2">Informations contenant</h3>
                                            <p className="text-sm text-gray-600 mb-2">- N&apos;est pas sur TrackDéchets</p>
                                        </div>
                                        <LabelValue 
                                            label="Infos supp." 
                                            value={otherInfos.containerDescription} 
                                        />
                                        <LabelValue 
                                            label="Volume" 
                                            value={`${otherInfos.volume} ${otherInfos.volumeUnit}`} 
                                        />

                                    </div>
                                )}

                            </div>

                            {/* Colonne droite */}
                            <div className="space-y-4">
                                {/* Destinataire */}
                                <div className="bg-purple-50 p-3 rounded border border-purple-100">
                                    <h3 className="font-semibold text-purple-800 mb-2">Destinataire</h3>
                                    <LabelValue label="Nom" value={bsd.recipient.company.name} />
                                    <LabelValue label="Adresse" value={bsd.recipient?.company?.address || ""} />
                                    <LabelValue label="SIRET" value={bsd.recipient?.company?.siret || ""} />
                                    <LabelValue label="Contact" value={bsd.recipient?.company?.contact || ""} />
                                    <LabelValue label="Téléphone" value={bsd.recipient?.company?.phone || ""} />
                                    <LabelValue label="Email" value={bsd.recipient?.company?.mail || ""} />
                                    <LabelValue label="CAP" value={bsd.recipient?.cap || ""} />
                                    <LabelValue label="Code traitement" value={bsd.recipient?.processingOperation || ""} />
                                </div>

                                {/* Déchet */}
                                <div className="bg-red-50 p-3 rounded border border-red-100">
                                    <h3 className="font-semibold text-red-800 mb-2">Détails du déchet</h3>
                                    <LabelValue label="Code CED" value={bsd.wasteDetails?.code || ""} />
                                    <LabelValue label="Nom du déchet" value={bsd.wasteDetails?.name || ""} />
                                    <LabelValue label="Code ONU" value={bsd.wasteDetails?.onuCode || ""} />
                                    <LabelValue label="Consistance" value={bsd.wasteDetails?.consistence || ""} />
                                    <LabelValue label="Quantité" value={`${bsd.wasteDetails?.quantity || ""} ${bsd.wasteDetails?.quantityType || ""}`} />
                                    <LabelValue label="Type de contenant" value={bsd.wasteDetails?.packagingInfos[0]?.type || null} />
                                    <LabelValue label="Nombre de contenants" value={bsd.wasteDetails?.packagingInfos[0]?.quantity || null} />
                                    <LabelValue label="Description" value={bsd.wasteDetails?.packagingInfos[0]?.other || null} />
                                </div>

                                {/* Après la section "Détails du déchet" et avant la section "Suivi" */}
                                {bsd?.photo && (
                                    <div className="bg-orange-50 p-3 rounded border border-orange-100">
                                        <h3 className="font-semibold text-orange-800 mb-2">Photo du déchet</h3>
                                        <div className="relative w-full h-48 rounded-lg overflow-hidden">
                                            <Image
                                                src={bsd.photo}
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
                                            href={bsd.photo} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-sm text-blue-600 hover:text-blue-800 mt-2 inline-block"
                                        >
                                            Voir la photo en taille réelle
                                        </a>
                                    </div>
                                )}

                                {/* Suivi */}
                                <div className="bg-gray-50 p-3 rounded border border-gray-100">
                                    <h3 className="font-semibold text-gray-800 mb-2">Suivi</h3>
                                    <LabelValue label="ID" value={bsd?.readableId || ""} />
                                    <LabelValue label="ID Système" value={bsd?.id || null} />
                                    <LabelValue label="Statut" value={bsd?.status || null} />
                                    <LabelValue label="Créé le" value={formatDate(bsd?.createdAt || "")} />
                                    <LabelValue label="Mis à jour le" value={formatDate(bsd.updatedAt)} />
                                    <LabelValue label="Signé le" value={formatDate(bsd.signedAt)} />
                                    <LabelValue label="Émis le" value={formatDate(bsd.emittedAt)} />
                                    <LabelValue label="Émis par" value={bsd.emittedBy} />
                                    <LabelValue label="Pris en charge le" value={formatDate(bsd.takenOverAt)} />
                                    <LabelValue label="Pris en charge par" value={bsd.takenOverBy || null} />
                                    <LabelValue label="Reçu le" value={formatDate(bsd?.receivedAt || "")} />
                                    <LabelValue label="Reçu par" value={bsd?.receivedBy || null  } />
                                    <LabelValue label="Traité le" value={formatDate(bsd?.processedAt || "")} />
                                    <LabelValue label="Traité par" value={bsd?.processedBy || ""} />
                                    <LabelValue label="Quantité acceptée" value={bsd?.quantityAccepted || ""} />
                                    <LabelValue label="Quantité reçue" value={bsd?.quantityReceived || ""} />
                                    <LabelValue label="Type de quantité reçue" value={bsd?.quantityReceivedType || ""} />
                                    <LabelValue label="Quantité refusée" value={bsd?.quantityRefused || ""} />
                                    <LabelValue label="Statut d'acceptation" value={bsd?.wasteAcceptationStatus || ""} />
                                    <LabelValue label="Raison du refus" value={bsd.wasteRefusalReason} />
                                    <LabelValue label="Opération de traitement effectuée" value={bsd?.processingOperationDone || ""} />
                                    <LabelValue label="Description du traitement" value={bsd?.processingOperationDescription || ""} />
                                    <LabelValue label="Importé depuis papier" value={bsd?.isImportedFromPaper ? 'Oui' : 'Non'} />
                                    <LabelValue label="Émis par eco-organisme" value={bsd?.emittedByEcoOrganisme ? 'Oui' : 'Non'} />
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


