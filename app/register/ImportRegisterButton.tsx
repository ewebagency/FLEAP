import { useState, useRef, useEffect } from "react";
import { useSession } from "../component/SessionProvider";
import { useModal } from "../component/context/ModalReloadcontext";
import * as XLSX from 'xlsx';
import toast from "react-hot-toast";
import { supabase } from "../database/supabaseClient";
import { BSDD_TrackDechets, FormInput } from "./interface/BSD_Interface";
import { pushOnTableParametrage } from "./RegisterComponents/Modal/utils_new";

interface Row {
    [key: string]: string | number | boolean;
}

function siretFunction(input: string | number): string {
    const inputStr = String(input).replace(/\s+/g, '').trim(); // Suppression des espaces
    const siretRegex = /^[0-9]{14}$/; // Le SIRET est un numéro à 14 chiffres
  
    return siretRegex.test(inputStr) ? inputStr : ""; // Retourne le SIRET valide ou ""
  }

function tvaFunction(input: string | number): string {
const inputStr = String(input).replace(/\s+/g, '').trim(); // Suppression des espaces
const tvaRegex = /^[A-Z]{2}[0-9A-Z]{2,12}$/; // Format typique : FR + 11 caractères (peut varier selon pays)

return tvaRegex.test(inputStr) ? inputStr : ""; // Retourne le numéro TVA valide ou ""
}

const cofounders_user_id = (user_id:string|null) => {
    if (user_id){
        if (user_id == "a0542794-bbae-4132-9dde-485595bfa2aa" || user_id == "8f05a291-f8b3-429d-839e-6f0b12f1bede" || user_id == "dd9acb15-4678-442f-af72-79331bc43d91"){
            return true;
        }
    }
    return false;
}

const mapToBsdFormat = (row: Row): { formAPI: { createFormInput: BSDD_TrackDechets } } => {
    const new_bsdd: {formAPI: {createFormInput: BSDD_TrackDechets}} = {
        formAPI: {
            createFormInput: {
                id: "IMPORTED",
                readableId: row["numeroBsd"]?.toString() || "", //celui sur track
                customId: row["idSecondaire"]?.toString() || "",
                
                status: row["statutBordereauCode"]?.toString() || "",

                //isImportedFromPaper: false,

                // Émetteur
                emitter: {
                    type: "PRODUCER",
                    workSite: {
                        name: row["nomSiteEmetteur"]?.toString() || "",
                        address: row["adresseCollecte"]?.toString() || "",
                        postalCode: row["codePostalCollecte"]?.toString() || "",
                        city: row["communeCollecte"]?.toString() || "",
                        infos: row["infosCollecte"]?.toString() || ""
                    },
                    company: {
                        name: "", //row[""]?.toString() || "", //nomEntrepriseEmettrice
                        orgId: row["siretEmetteur"]?.toString() || "",
                        siret: siretFunction(row["siretEmetteur"]?.toString()) || "",
                        address: `${row["adresseEmetteur"] || ""} ${row["codePostalEmetteur"] || ""} ${row["communeEmetteur"] || ""}`,
                        country: row["paysEmetteur"]?.toString() || "",
                        contact: `${row["prenomContactEmetteur"] || ""} ${row["nomContactEmetteur"] || ""}`,
                        phone: row["telephoneContactEmetteur"]?.toString() || "",
                        mail: row["emailContactEmetteur"]?.toString() || "",
                        vatNumber: tvaFunction(row["siretEmetteur"]?.toString()) || "",
                        //omiNumber: 
                        //extraEuropeanId: 
                    },
                    
                    //isPrivateIndividual:
                    //isForeignShip:
                },

                // Destinataire
                recipient: {
                    company: {
                        name: row["nomInstallationDestination"]?.toString() || "",
                        orgId: row["siretInstallationDestination"]?.toString() || "",
                        siret: siretFunction(row["siretInstallationDestination"]?.toString()) || "", //-------------- ça me va pas installation destinatation
                        address: `${row["adresseInstallationDestination"] || ""} ${row["codePostalInstallationDestination"] || ""} ${row["communeInstallationDestination"] || ""}`,
                        country: row["paysInstallationDestination"]?.toString() || "",
                        contact: `${row["prenomContactInstallationDestination"] || ""} ${row["nomContactInstallationDestination"] || ""}`,
                        phone: row["telephoneContactInstallationDestination"]?.toString() || "",
                        mail: row["emailContactInstallationDestination"]?.toString() || "",
                        vatNumber: tvaFunction(row["siretInstallationDestination"]?.toString()) || "",
                        //omiNumber:
                        //extraEuropeanId:
                    },
                    cap: row["numeroCap"]?.toString() || "",
                    processingOperation: row["codeTraitementPrevuInstallationDestination"]?.toString() || "" //????????????????????????????????????????probleme yen a trop -- faire plus simple une installation destinataire et c'est tout codeTraitementRealiseInstallationDestination
                    //isTempStorage:
                },

                // Transporteur
                transporter: {
                    id: "",
                    company: {
                        name: row["nomTransporteur"]?.toString() || "",
                        orgId: row["siretTransporteur"]?.toString() || "",
                        siret: siretFunction(row["siretTransporteur"]?.toString()) || "",
                        address: `${row["adresseTransporteur"] || ""} ${row["codePostalTransporteur"] || ""} ${row["communeTransporteur"] || ""}`,
                        country: row["paysTransporteur"]?.toString() || "",
                        contact: `${row["prenomContactTransporteur"] || ""} ${row["nomContactTransporteur"] || ""}`,
                        phone: row["telephoneContactTransporteur"]?.toString() || "",
                        mail: row["emailContactTransporteur"]?.toString() || "",
                        vatNumber: tvaFunction(row["siretTransporteur"]?.toString()) || "",
                        //omiNumber:
                        //extraEuropeanId:
                    },
                    isExemptedOfReceipt: false,//row['exemptionRecepisseTransporteur'].toString() || '',
                    receipt: row["recepisseTransporteur"]?.toString() || "",
                    department: row["departementTransporteur"]?.toString() || "",
                    validityLimit: row["limiteValiditeTransporteur"]?.toString() || "",
                    numberPlate: row["immatriculationTransporteur"]?.toString() || "",
                    //customInfo: "",
                    mode: row["modeTransportTransporteur"]?.toString() || "",
                    takenOverAt: row["dateCollecteTransporteur"]?.toString() || "",
                    takenOverBy: row["prenomContactTransporteur"]?.toString() + " " + row["nomContactTransporteur"]?.toString() || ""    
                },

                // Détails du déchet
                wasteDetails: {
                    code: row["codeCed"]?.toString() || "",
                    name: row["descDechet"]?.toString() || "",
                    isSubjectToADR: row["mentionAdr"]?.toString()==='ADR',
                    onuCode: row["codeONU"]?.toString() || "",  
                    nonRoadRegulationMention: row["mentionAdr"]?.toString() || "",
                    packagingInfos: [{
                        type: row["typeContenant"]?.toString() as 'FUT'|'GRV'|'CITERNE'|'BENNE'|'PIPELINE'|'AUTRE',
                        other: row["descContenant"]?.toString() || "",
                        quantity: parseInt(row["nbContenants"]?.toString() || "0")
                    }],
                    quantity: parseFloat(row["quantiteCollecteTransporteur"]?.toString().replace(',', '.') || "0"), //Faire condition si on a installation destination
                    quantityType:  row["quantiteEstimeeReelleTransporteur"]?.toString() as 'REAL'|'ESTIMATED' || 'ESTIMATED',
                    consistence: row["consistance"]?.toString() || "",
                    pop: row["pop"] === "O",
                    isDangerous: row["codeCed"]?.toString()?.includes("*"),
                    parcelNumbers: {
                        city: row["parcelleCommuneEmetteur"]?.toString() || "",
                        postalCode: row["parcelleCodePostalEmetteur"]?.toString() || "",
                        prefix: row["parcellePrefixSectionNumeroEmetteur"]?.toString().split("-")[0] || "",
                        section: row["parcellePrefixSectionNumeroEmetteur"]?.toString().split("-")[1] || "",
                        number: row["parcellePrefixSectionNumeroEmetteur"]?.toString().split("-")[2] || "",
                        x: parseFloat(row["parcelleGPSEmetteur"]?.toString().split("N ")[1].split(" E ")[0] || "0"),
                        y: parseFloat(row["parcelleGPSEmetteur"]?.toString().split("N ")[1].split(" E ")[1] || "0")
                    },
                    analysisReferences: row["refLaboEmetteur"]?.toString() || "",
                    landIdentifiers: row["idTerrainEmetteur"]?.toString() || "",
                    sampleNumber: row["fichesTechniques"]?.toString() || ""
                },

                // Négociant
                trader: {
                    company: {
                        name: row["nomNegotiant"]?.toString() || "",
                        orgId: row["siretNegotiant"]?.toString() || "",
                        siret: siretFunction(row["siretNegotiant"]?.toString()) || "",
                        address: `${row["adresseNegotiant"] || ""} ${row["codePostalNegotiant"] || ""} ${row["communeNegotiant"] || ""}`,
                        country: row["paysNegotiant"]?.toString() || "",
                        contact: `${row["prenomContactNegotiant"] || ""} ${row["nomContactNegotiant"] || ""}`,
                        phone: row["telephoneNegotiant"]?.toString() || "",
                        mail: row["emailNegotiant"]?.toString() || "",
                        vatNumber: tvaFunction(row["siretNegotiant"]?.toString()) || "",
                        //omiNumber:
                        //extraEuropeanId:
                    },
                    receipt: row["recipisseNegotiant"]?.toString() || "",
                    department: row["departementNegotiant"]?.toString() || "",
                    validityLimit: row["validiteNegotiant"]?.toString() || ""
                },

                // Courtier
                broker: {
                    company: {
                        name: row["nomCourtier"]?.toString() || "",
                        orgId: row["siretCourtier"]?.toString() || "",
                        siret: siretFunction(row["siretCourtier"]?.toString()) || "",
                        address: `${row["adresseCourtier"] || ""} ${row["codePostalCourtier"] || ""} ${row["communeCourtier"] || ""}`,
                        country: row["paysCourtier"]?.toString() || "",
                        contact: `${row["prenomContactCourtier"] || ""} ${row["nomContactCourtier"] || ""}`,
                        phone: row["telephoneContactCourtier"]?.toString() || "",
                        mail: row["emailCourtier"]?.toString() || "",
                        vatNumber: tvaFunction(row["siretCourtier"]?.toString()) || "",
                        //omiNumber:
                        //extraEuropeanId:
                    },
                    receipt: row["recipisseCourtier"]?.toString() || "",
                    department: row["departementCourtier"]?.toString() || "",
                    validityLimit: row["validiteCourtier"]?.toString() || ""
                },

                // Éco-organisme
                ecoOrganisme: {
                    name: row["nomEcoOrganisme"]?.toString() || "",
                    siret: siretFunction(row["siretEcoOrganisme"]?.toString()) || ""
                },

                //transporters: [],

                // Dates
                createdAt: row["dateCreationBordereau"]?.toString() || "",
                updatedAt: row["dateModifBordereau"]?.toString() || "",
                
                emittedAt: row["dateCreationBordereau"]?.toString() || "", //normalement c'est la signature du trasnporteur mais bon
                emittedBy: row["prenomContactEmetteur"]?.toString() + " " + row["nomContactEmetteur"]?.toString() || "",
                emittedByEcoOrganisme: row["prenomContactEcoOrganisme"]?.toString() + " " + row["nomContactEcoOrganisme"]?.toString() || "",
                
                takenOverAt: row["dateCollecteTransporteur"]?.toString() || "",
                takenOverBy: row["prenomContactTransporteur"]?.toString() + " " + row["nomContactTransporteur"]?.toString() || "",
                
                wasteAcceptationStatus: row["statutReceptionInstallationDestination"]?.toString(),
                wasteRefusalReason: row["motifRefusInstallationDestination"]?.toString() || "",
                
                hasCiterneBeenWashedOut: row["rincageCiterneInstallationDestination"] === "O", 
                //citerneNotWashedOutReason: row["motifNonLavageCiterne"]?.toString() || "",
                
                receivedBy: row["prenomContactInstallationDestination"]?.toString() + " " + row["nomContactInstallationDestination"]?.toString() || "",
                receivedAt: row["dateReceptionInstallationDestination"]?.toString() || "",

                signedAt: '',//row["dateReceptionInstallationDestination"]?.toString() || "",

                quantityReceived: parseFloat(row["quantiteReceptionneeNetInstallationDestination"]?.toString() || "0"),
                quantityReceivedType: row["quantiteEstimeeReelleReceptionInstallationDestination"]?.toString() as 'REAL'|'ESTIMATED' || 'ESTIMATED',
                quantityAccepted: parseFloat(row["quantiteReceptionneeNetInstallationDestination"]?.toString() || "0") - parseFloat(row["quantiteRefuseeInstallationDestination"]?.toString() || "0"),
                quantityRefused: parseFloat(row["quantiteRefuseeInstallationDestination"]?.toString() || "0"),
                
                processingOperationDone: row["codeTraitementRealiseInstallationDestination"]?.toString() || "",
                processingOperationDescription: row["qualificationTraitementInstallationDestination"]?.toString() || "",
                processedBy: row["prenomContactInstallationDestination"]?.toString() + " " + row["nomContactInstallationDestination"]?.toString() || "",
                processedAt: row["dateTraitementInstallationDestination"]?.toString() || "",
                
                noTraceability: row["ruptureTracabiliteInstallationDestination"] === "O" || row['ruptureTracabiliteInstallationIntermediaire'] === "O" || row['ruptureTracabiliteInstallationDestination2'] === "O", // regarder toute et yen aura qu'une seule théoriqueemnt

                //Informations utiles pendant le transport du bordereau selon moi mais pas avant
                // Destination ultérieure 
                /*nextDestination: {
                    company: {
                        siret: row["siretDestinationUlterieure"]?.toString() || "",
                        name: row["raisonSocialeDestinationUlterieure"]?.toString() || "",
                        address: `${row["adresseDestinationUlterieure"] || ""} ${row["codePostalDestinationUlterieure"] || ""} ${row["communeDestinationUlterieure"] || ""}`,
                        country: row["paysDestinationUlterieure"]?.toString() || "",
                        contact: `${row["prenomContactDestinationUlterieure"] || ""} ${row["nomContactDestinationUlterieure"] || ""}`,
                        phone: row["telephoneContactDestinationUlterieure"]?.toString() || "",
                        mail: row["emailContactDestinationUlterieure"]?.toString() || ""
                    },
                    cap: row["numeroCapDestinationUlterieure"]?.toString() || "",
                    processingOperation: row["operationTraitementPrevueDestinationUlterieure"]?.toString() || ""
                    notificationNumber: row["numeroNotification"]?.toString() || "",
                },*/

                // Regroupement
                //grouping: row["bordereauRegroupement"] ? [row["bordereauRegroupement"]] : [],
                //quantityGrouped: 
                //groupedIn: 
                
                // Entreposage provisoire
                /*temporaryStorageDetail: {
                    destination: {
                        company: {
                            siret: row["siretInstallationIntermediaire"]?.toString() || "",
                            name: row["raisonSocialeInstallationIntermediaire"]?.toString() || "",
                            address: `${row["adresseInstallationIntermediaire"] || ""} ${row["codePostalInstallationIntermediaire"] || ""} ${row["communeInstallationIntermediaire"] || ""}`,
                            contact: `${row["reconditionnementPrenomContact"] || ""} ${row["reconditionnementNomContact"] || ""}`, //?????????????????, pas de contact dans installation intermédiaire
                            phone: row["reconditionnementTelephoneContact"]?.toString() || "",
                            mail: row["reconditionnementEmailContact"]?.toString() || ""
                        },
                        cap: ""  //???????????????????????????????????????????????????????????????????????,
                    },
                    ///////////encore des transporteurs ????
                    transporter: {
                        company: {
                            siret: row["siretTransporteur2"]?.toString() || "",
                            name: row["raisonSocialeTransporteur2"]?.toString() || "",
                            address: `${row["adresseTransporteur2"] || ""} ${row["codePostalTransporteur2"] || ""} ${row["communeTransporteur2"] || ""}`,
                            contact: `${row["prenomContactTransporteur2"] || ""} ${row["nomContactTransporteur2"] || ""}`,
                            phone: row["telephoneContactTransporteur2"]?.toString() || "",
                            mail: row["emailContactTransporteur2"]?.toString() || ""
                        },
                        recepisse: {
                            number: row["numeroRecepisseTransporteur2"]?.toString() || "",
                            department: row["departementRecepisseTransporteur2"]?.toString() || "",
                            validityLimit: row["dateValiditeRecepisseTransporteur2"]?.toString() || ""
                        },
                        numberPlate: row["immatriculationTransporteur2"]?.toString() || ""
                    }
                },*/

                //stateSummary:

                //currentTransporterSiret: row["siretTransporteur"]?.toString() || "",
                //nextTransporterSiret: row["siretTransporteur2"]?.toString() || "",

                // Intermédiaires
                /*intermediaries: row["siretIntermediaire"] ? [{
                    siret: row["siretIntermediaire"]?.toString() || "",
                    name: row["raisonSocialeIntermediaire"]?.toString() || "",
                    address: `${row["adresseIntermediaire"] || ""} ${row["codePostalIntermediaire"] || ""} ${row["communeIntermediaire"] || ""}`,
                    contact: `${row["prenomContactIntermediaire"] || ""} ${row["nomContactIntermediaire"] || ""}`,
                    phone: row["telephoneContactIntermediaire"]?.toString() || "",
                    mail: row["emailContactIntermediaire"]?.toString() || ""
                }] : [],*/

                //metadata:
                //emptyReturnADR: row["retourVideADR"]?.toString() || "" //EMPTY_RETURN_NOT_WASHED, EMPTY_VEHICLE https://developers.trackdechets.beta.gouv.fr/reference/api-reference/bsdd/enums#emptyreturnadr

            }
        }
    };
    return new_bsdd;;
};

const mapToNewParametrage = (ligne_BSD: { formAPI: { createFormInput: BSDD_TrackDechets } }) => {
    const data = ligne_BSD.formAPI.createFormInput;
    
    const ligne_new = {
        emitter: {
                type: data.emitter.type,
                company: {
                    mail: data.emitter.company.mail,
                    name: data.emitter.company.name,
                    phone: data.emitter.company.phone,
                    siret: data.emitter.company.siret,
                    address: data.emitter.company.address,
                    contact: data.emitter.company.contact,
                    country: data.emitter.company.country,
                },
                workSite: {
                    city: data.emitter.workSite.city,
                    name: data.emitter.workSite.name,
                    infos: data.emitter.workSite.infos,
                    address: data.emitter.workSite.address,
                    postalCode: data.emitter.workSite.postalCode,
                },
            },
            recipient: {
                cap: data.recipient.cap,
                company: {
                    mail: data.recipient.company.mail,
                    name: data.recipient.company.name,
                    phone: data.recipient.company.phone,
                    siret: data.recipient.company.siret,
                    address: data.recipient.company.address,
                    contact: data.recipient.company.contact,
                    country: data.recipient.company.country,
                },
                isTempStorage: data.recipient.isTempStorage || false,
                processingOperation: data.recipient.processingOperation,
            },
            transporter: {
                company: {
                    mail: data.transporter.company.mail,
                    name: data.transporter.company.name,
                    phone: data.transporter.company.phone,
                    siret: data.transporter.company.siret,
                    address: data.transporter.company.address,
                    contact: data.transporter.company.contact,
                    country: data.transporter.company.country,
                },
                receipt: data.transporter.receipt,
                customInfo: data.transporter.customInfo || "",
                numberPlate: data.transporter.numberPlate || "",
                isExemptedOfReceipt: data.transporter.isExemptedOfReceipt || false,
            },
            wasteDetails: {
                pop: data.wasteDetails.pop || false,
                code: data.wasteDetails.code,
                name: data.wasteDetails.name,
                onuCode: data.wasteDetails.onuCode,
                quantity: data.wasteDetails.quantity,
                consistence: data.wasteDetails.consistence,
                isDangerous: data.wasteDetails.isDangerous || false,
                quantityType: data.wasteDetails.quantityType,
                isSubjectToADR: data.wasteDetails.isSubjectToADR || false,
                packagingInfos: data.wasteDetails.packagingInfos.map(pack => ({
                    type: pack.type,
                    quantity: pack.quantity,
                })),
        },
    };
    
    return ligne_new;
}
  
const sendToSupabase = async (ligne_BSD: { formAPI: { createFormInput: BSDD_TrackDechets } }, user_id: string, tableType: string) => {
    //UserId --> EntrepriseId
    const { data: entreprise_infos, error } = await supabase
        .from('profiles')
        .select('entreprise_id')
        .eq('user_id', user_id)
        .single();

    if(error){
        toast.error('Erreur lors de l\'import de la table de paramétrage');
    } else {
        const entreprise_id = entreprise_infos.entreprise_id;
        //SI Table Paramétrage : Insertion du registre mappé dans table_parametrage
        if(tableType == "table_parametrage"){
            const ligne_new = {formAPI: {createFormInput: mapToNewParametrage(ligne_BSD)}};
            const pass_on_table_parametrage = await pushOnTableParametrage(user_id, entreprise_id, ligne_new);
            if(pass_on_table_parametrage){
                if(pass_on_table_parametrage.success){
                    if(pass_on_table_parametrage.message.includes('mise à jour')){
                        toast.success(pass_on_table_parametrage.message);
                    } else {
                        toast.error(pass_on_table_parametrage.message);
                    }
                } else {
                    toast.error(pass_on_table_parametrage.message);
                }
            }
        } 
        //SI Registre Historique : Insertion du registre mappé dans bsd
        else if(tableType == "registre_historique"){
            const { data, error } = await supabase
                .from('bsd')
                .insert(
                    {
                        user_id: user_id,
                        entreprise_id: entreprise_id,
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
                firstSheetName = workbook.SheetNames[0];//Maintenant on base la table de paramétrage sur le registre des déchets
            } else {
                firstSheetName = workbook.SheetNames[0];    
            }
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Convertir en JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet) as Row[];
            jsonData.forEach((row: Row|BSDD_TrackDechets) => {
                if(tableType == "table_parametrage"){
                    if(!userId){
                        const ligne_BSD = mapToBsdFormat(row as Row);
                        if(session?.user_id) sendToSupabase(ligne_BSD, session.user_id, tableType);
                    } else {
                        const ligne_BSD = mapToBsdFormat(row as Row);
                        sendToSupabase(ligne_BSD, userId, tableType);
                    }
                } else if (tableType == "registre_historique"){
                    const ligne_BSD = mapToBsdFormat(row as Row);
                    if(!userId){
                        if(session.user_id)sendToSupabase(ligne_BSD, session.user_id, tableType);
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
        {display && (
            <button 
                onClick={handleButtonClick}
                className="flex justify-between items-center bg-gray-300 rounded-xl px-2 mx-1 cursor-pointer active:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading}
            >
                <div className="text-white bg-green-600 mr-2 my-[3px] rounded-full px-2 font-thin">
                    {isLoading ? (
                        <span className="inline-block animate-spin">↻</span>
                    ) : (
                        "▼"
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