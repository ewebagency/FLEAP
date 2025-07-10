import { useState, useRef, useEffect } from "react";
import { useSession } from "../component/SessionProvider";
import { useModal } from "../component/context/ModalReloadcontext";
import * as XLSX from 'xlsx';
import toast from "react-hot-toast";
import { supabase } from "../database/supabaseClient";
import { BSDD_TrackDechets, FormInput, Company } from "./interface/BSD_Interface";
import { pushOnTableParametrage } from "./RegisterComponents/Modal/FormulaireFull/utils_new";
import BoxIcon from "../component/BoxIconWrapper";
import { OtherInfos } from "./interface/BSD_Interface";
import { mapToFactureFormat } from "../import_page/FactureImport/ButtonImportFacture";
import { FactureJSON } from "../import_page/FactureImport/ButtonImportFacture";

// Types pour les transporteurs et destinataires supplémentaires
type AdditionalTransporter = {
    company: Company;
    receipt: string;
    department: string;
    validityLimit: string;
    numberPlate: string;
    isExemptedOfReceipt: boolean;
    takenOverAt: string;
};

type AdditionalRecipient = {
    company: Company;
    cap: string;
    processingOperation: string;
    valoParts: { code_valo: string; tonnage: number; }[];
};

export interface Row {
    [key: string]: string | number;
}

function siretFunction(input: string | number): string {
    const inputStr = String(input).replace(/\s+/g, '').trim(); // Suppression des espaces
    const siretRegex = /^[0-9]{14}$/; // Le SIRET est un numéro à 14 chiffres
  
    //return siretRegex.test(inputStr) ? inputStr : ""; // Retourne le SIRET valide ou ""
    if(inputStr!==undefined && inputStr!==""){
        return inputStr;
    }
    return "";
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

// Nouvelle fonction pour récupérer tous les readable_id_track_dechets existants
const getExistingReadableIds = async (entreprise_id: string): Promise<string[]> => {
    const existingIds: string[] = [];
    let from = 0;
    const limit = 1000;
    
    while (true) {
        const { data, error } = await supabase
            .from('bsd')
            .select('readable_id_track_dechets')
            .eq('entreprise_id', entreprise_id)
            .range(from, from + limit - 1);
            
        if (error) throw error;
        if (!data || data.length === 0) break;
        
        // Filtrer les IDs non-null côté client
        data.forEach(row => {
            if (row.readable_id_track_dechets && row.readable_id_track_dechets.trim() !== '') {
                existingIds.push(row.readable_id_track_dechets);
            }
        });
        
        // Si on a moins de 1000 résultats, on a fini
        if (data.length < limit) break;
        from += limit;
    }
    
    return existingIds;
};

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

const mapToBsdFormat = (row: Row): { formAPI: { createFormInput: BSDD_TrackDechets } } => {

    const valoPartsArray = takeValoPartsArray(row);

    const new_bsdd: {formAPI: {createFormInput: BSDD_TrackDechets}} = {
        formAPI: {
            createFormInput: {
                id: "IMPORTED",
                readableId: row["numeroBsd"]?.toString() || "", //celui sur track
                customId: row["idSecondaire"]?.toString() || "",
                
                status: row["statutBordereauCode"]?.toString() || "",

                //isImportedFromPaper: false,

                //------------IMPORTANT Site(lié au siret emetteur):nomSiteEmetteur, Point de collecte : nomPointCollecte


                // Émetteur
                emitter: {
                    type: "PRODUCER",
                    workSite: {
                        name: row["nomPointCollecte"]?.toString() || "",
                        address: row["adresseCollecte"]?.toString() || "",
                        postalCode: row["codePostalCollecte"]?.toString() || "",
                        city: row["communeCollecte"]?.toString() || "",
                        infos: row["infosCollecte"]?.toString() || ""
                    },
                    company: {
                        name: row["nomSiteEmetteur"]?.toString() || "", //nomEntrepriseEmettrice > nomSiteEmetteur (je pense que c'est SIREN>SIRET)
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
                    processingOperation: row["codeTraitementPrevuInstallationDestination"]?.toString() || "", //????????????????????????????????????????probleme yen a trop -- faire plus simple une installation destinataire et c'est tout codeTraitementRealiseInstallationDestination
                    //isTempStorage:
                    valoParts: valoPartsArray[0] || [],
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
                    isExemptedOfReceipt: row['exemptionRecepisseTransporteur']?.toString() === 'true',
                    receipt: row["recepisseTransporteur"]?.toString() || "",
                    department: row["departementTransporteur"]?.toString() || "",
                    validityLimit: row["limiteValiditeTransporteur"]?.toString() || "",
                    numberPlate: row["immatriculationTransporteur"]?.toString() || "",
                    //customInfo: "",
                    //mode: row["modeTransportTransporteur"]?.toString() || "",
                    takenOverAt: convertToISO(row["dateCollecteTransporteur"]),
                    takenOverBy: (row["prenomContactTransporteur"]?.toString() || "") + " " + (row["nomContactTransporteur"]?.toString() || "")    
                },

                // Détails du déchet
                wasteDetails: {
                    code: row["codeCed"]?.toString() || "",
                    name: row["descDechet"]?.toString() || "",
                    isSubjectToADR: row["mentionAdr"]?.toString()!=='',
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







                //transporters: [],

                // Dates
                createdAt: convertToISO(row["dateCreationBordereau"]),
                updatedAt: convertToISO(row["dateModifBordereau"]),
                
                emittedAt: convertToISO(row["dateCreationBordereau"]), //normalement c'est la signature du trasnporteur mais bon
                emittedBy: (row["prenomContactEmetteur"]?.toString() || "") + " " + (row["nomContactEmetteur"]?.toString() || ""),
                emittedByEcoOrganisme: (row["prenomContactEcoOrganisme"]?.toString() || "") + " " + (row["nomContactEcoOrganisme"]?.toString() || ""),
                
                takenOverAt: convertToISO(row["dateCollecteTransporteur"]),
                takenOverBy: (row["prenomContactTransporteur"]?.toString() || "") + " " + (row["nomContactTransporteur"]?.toString() || ""),
                
                wasteAcceptationStatus: row["statutReceptionInstallationDestination"]?.toString() || "",
                wasteRefusalReason: row["motifRefusInstallationDestination"]?.toString() || "",
                
                hasCiterneBeenWashedOut: row["rincageCiterneInstallationDestination"] === "O", 
                //citerneNotWashedOutReason: row["motifNonLavageCiterne"]?.toString() || "",
                
                receivedBy: (row["prenomContactInstallationDestination"]?.toString() || "") + " " + (row["nomContactInstallationDestination"]?.toString() || ""),
                receivedAt: convertToISO(row["dateReceptionInstallationDestination"]),

                signedAt: '',//row["dateReceptionInstallationDestination"]?.toString() || "",

                //quantityReceived: parseFloat(row["quantiteReceptionneeNetInstallationDestination"]?.toString().replace(',', '.') || "0"),
                //quantityReceivedType: row["quantiteEstimeeReelleReceptionInstallationDestination"]?.toString() as 'REAL'|'ESTIMATED' || 'ESTIMATED',
                quantityRefused: parseFloat(row["quantiteRefuseeInstallationDestination"]?.toString().replace(',', '.') || "0"),
                
                processingOperationDone: row["codeTraitementRealiseInstallationDestination"]?.toString() || "",
                processingOperationDescription: row["qualificationTraitementInstallationDestination"]?.toString() || "",
                processedBy: (row["prenomContactInstallationDestination"]?.toString() || "") + " " + (row["nomContactInstallationDestination"]?.toString() || ""),
                processedAt: convertToISO(row["dateTraitementInstallationDestination"]),
                
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
    if(row["quantiteEstimeeReelleReceptionInstallationDestination"]?.toString() && row["quantiteEstimeeReelleReceptionInstallationDestination"]?.toString() !== '')new_bsdd.formAPI.createFormInput.quantityReceived = parseFloat(row["quantiteEstimeeReelleReceptionInstallationDestination"]?.toString().replace(',', '.') || "0");
    if(row["quantiteEstimeeReelleTransporteur"]?.toString() && row["quantiteEstimeeReelleTransporteur"]?.toString() !== '')new_bsdd.formAPI.createFormInput.quantityReceivedType = row["quantiteEstimeeReelleTransporteur"]?.toString() as 'REAL'|'ESTIMATED' || 'ESTIMATED';
    
    //Ajout trader s'il existe
    if(row["nomNegotiant"]?.toString() && row["nomNegotiant"]?.toString() !== ''){
        new_bsdd.formAPI.createFormInput.trader = {
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
        }
    }

    //Ajout broker s'il existe
    if(row["nomCourtier"]?.toString() && row["nomCourtier"]?.toString() !== ''){
        new_bsdd.formAPI.createFormInput.broker = {
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
        }
    }
    
    
    
    
    return new_bsdd;
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
                    orgId: data.recipient.company.orgId,
                    vatNumber: data.recipient.company.vatNumber,
                },
                isTempStorage: data.recipient.isTempStorage || false,
                processingOperation: data.recipient.processingOperation,
                valoParts: data.recipient.valoParts,
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
  
const sendToSupabase = async (
    ligne_BSD: { formAPI: { createFormInput: BSDD_TrackDechets } }, 
    ligne_autres_infos: OtherInfos | null,
    ligne_facture: { infos_json: FactureJSON } | null,
    user_id: string, 
    entreprise_id: string | null,
    tableType: string,
    source: string,
    existingReadableIds?: Set<string> // Nouveau paramètre optionnel
) => {


    if(!entreprise_id){
        toast.error('Entreprise non trouvée');
        return;
    } else {
        
        const facture_treated:boolean = (ligne_facture?.infos_json.footer.total_ht!==0);
        //SI Table Paramétrage : Insertion du registre mappé dans table_parametrage
        if(tableType == "table_parametrage"){
            const ligne_new = {formAPI: {createFormInput: mapToNewParametrage(ligne_BSD)}};
            if(ligne_autres_infos===null){
                ligne_autres_infos = {
                    volume: "",
                    fillRate: "",
                    volumeUnit: "",
                    containerDescription: ""
                } as OtherInfos;
            }
            const pass_on_table_parametrage = await pushOnTableParametrage(user_id, entreprise_id, ligne_new, ligne_autres_infos);

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
            // Vérification du doublon si on a la liste des IDs existants
            if (existingReadableIds) {
                const readableId = ligne_BSD.formAPI.createFormInput.readableId;
                if (readableId && existingReadableIds.has(readableId)) {
                    toast.error(`Doublon détecté pour ${readableId}, ignoré`);
                    return { skipped: true, reason: 'duplicate' };
                }
            }
            
            const { data, error } = await supabase
                .from('bsd')
                .insert(
                    {
                        user_id: user_id,
                        entreprise_id: entreprise_id,
                        infos_json: ligne_BSD,
                        ...(ligne_autres_infos && { other_infos: ligne_autres_infos }),
                        ...(ligne_facture && { facture_infos: ligne_facture.infos_json }),
                        facture_treated : facture_treated,
                        created_on_fleap: false,
                        status_track_dechets: "IMPORTED",
                        created_at: ligne_BSD.formAPI.createFormInput.takenOverAt || new Date().toISOString(),
                        readable_id_track_dechets: ligne_BSD.formAPI.createFormInput.readableId || null,
                        source: source,
                    }
                )
            if (error) {
                toast.error('Erreur lors de l\'import du registre historique');
                return { error: true };
            } else {
                //console.log('Données importées avec succès', data);
                toast.success('Registre historique importé avec succès');
                return { success: true };
            }
        }
    }
}

const ImportRegisterButton = () => {
    const {entreprise_id, user_id} = useSession();
    const { modalReload, setModalReload } = useModal();
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState<'success' | 'error'>('success');
    const [display, setDisplay] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [userId, setUserId] = useState('');
    const [tableType, setTableType] = useState('registre_historique');
    const [source, setSource] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isTestMode, setIsTestMode] = useState(false);
    //const [selectedConfig, setSelectedConfig] = useState<{userId: string, tableType: string} | null>(null);
    
    useEffect(() => {
        if(user_id){
            if (cofounders_user_id(user_id)) {
                setDisplay(true);
            }
        }
    }, [user_id]);

    const handleButtonClick = (e: React.MouseEvent) => {
        e.preventDefault();
        setShowModal(true);
    };

    const handleSubmitForm = () => {
        if (!source.trim()) {
            toast.error('Veuillez saisir une source');
            return;
        }
        //setSelectedConfig({ userId, tableType });
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
            if (!user_id) {
                throw new Error("Session non trouvée");
            }
            // Lire le fichier Excel
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            
            let firstSheetName;
            if(tableType == "table_parametrage"){
                firstSheetName = workbook.SheetNames[0];
            } else {
                firstSheetName = workbook.SheetNames[0];    
            }
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Convertir en JSON
            let jsonData = XLSX.utils.sheet_to_json(worksheet) as Row[];

            // Si mode test, sélectionner 3 lignes aléatoires
            if (isTestMode) {
                jsonData = jsonData
                    .sort(() => 0.5 - Math.random()) // Mélanger le tableau
                    .slice(0, 20); // Prendre les 3 premières lignes
            }

            // Récupérer tous les IDs existants une seule fois pour registre_historique
            let existingIdsSet: Set<string> | undefined;
            if (tableType === "registre_historique" && entreprise_id) {
                const existingIds = await getExistingReadableIds(entreprise_id);
                existingIdsSet = new Set(existingIds);
            }
            
            let importedCount = 0;
            let skippedCount = 0;
            
            // Traiter les données
            for (const row of jsonData) {
                if(tableType == "table_parametrage"){
                    const ligne_BSD = mapToBsdFormat(row);
                    const ligne_autres_infos = mapToAutresInfosFormat(row);
                    if(user_id) sendToSupabase(ligne_BSD, ligne_autres_infos, null, user_id, entreprise_id, tableType, source);
                } else if (tableType == "registre_historique"){
                    const ligne_BSD = mapToBsdFormat(row);
                    const ligne_autres_infos = mapToAutresInfosFormat(row);
                    const ligne_facture = mapToFactureFormat(row);
                    
                    const result = await sendToSupabase(
                        ligne_BSD, ligne_autres_infos, ligne_facture, 
                        userId || user_id || '', entreprise_id, tableType, source, existingIdsSet
                    );
                    
                    if (result?.skipped) {
                        skippedCount++;
                    } else if (result?.success) {
                        importedCount++;
                    }
                }
            }
            
            setMessage(`Import terminé : ${importedCount} importés, ${skippedCount} doublons ignorés`);
            setMessageType('success');
            
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
                                    {/*<option value="table_parametrage">Table Paramétrage</option>*/}
                                    <option value="registre_historique">Registre Historique</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Source <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={source}
                                    onChange={(e) => setSource(e.target.value)}
                                    placeholder="Ex: Import Excel, API Trackdéchets, etc."
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    required
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
                                    Mode test (20 lignes aléatoires)
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
                <div className={`absolute top-[-20px] left-[-100px] z-50 w-[250px] text-center text-md bg-white rounded-md p-2 border-2 font-bold ${
                    messageType === 'success' ? 'text-green-700 border-2 border-green-500' : 'text-red-700 border-2 border-red-500'
                }`}>
                    {message}
                </div>
            )}
        </div>
    );
};

export default ImportRegisterButton;



const mapToAutresInfosFormat = (row: Row) => {
    const other_infos:OtherInfos = {
        containerDescription: row["descContenant"]?.toString() || "",
        volume: row["volumeUnitaire"]?.toString() || "",
        volumeUnit: row["uniteMesureVolume"]?.toString() || "",
        fillRate: "",
    }
    if(row["mentionAdr"]?.toString() && row["mentionAdr"]?.toString() !== '')other_infos.mentionAdr = row["mentionAdr"]?.toString();
    if(row["codeBale"]?.toString() && row["codeBale"]?.toString() !== '')other_infos.codeBale = row["codeBale"]?.toString();
    if(row["numeroBon"]?.toString() && row["numeroBon"]?.toString() !== '')other_infos.numeroBon = row["numeroBon"]?.toString();
    if(row["numeroFacture"]?.toString() && row["numeroFacture"]?.toString() !== '')other_infos.numeroFacture = row["numeroFacture"]?.toString();
    if(row["autreNumeroID"]?.toString() && row["autreNumeroID"]?.toString() !== '')other_infos.autreNumeroID = row["autreNumeroID"]?.toString();
    if(row["nomEcoOrganisme"]?.toString() && row["nomEcoOrganisme"]?.toString() !== '')other_infos.ecoorganisme = {
        name: row["nomEcoOrganisme"]?.toString() || "",
        siret: siretFunction(row["siretEcoOrganisme"]?.toString()) || ""
    };
    if(row["nomTravauxAmiante"]?.toString() && row["nomTravauxAmiante"]?.toString() !== '') {
        other_infos.travauxAmiante = {
            nom: row["nomTravauxAmiante"]?.toString(),
            siret: row["siretTravauxAmiante"]?.toString(),
        }
    }
    if(row["envoyeRep"]?.toString() && row["envoyeRep"]?.toString() !== '') {
        other_infos.rep = {
            sent_to_rep: row["envoyeRep"]?.toString() === 'true',
            montant_rep: parseFloat(row["montantRep"]?.toString().replace(',', '.') || "0"),
        }
    }

    if(row["estDeclasse"]?.toString() && row["estDeclasse"]?.toString() !== '') {
        other_infos.declassement = {
            declassement_boolean: row["estDeclasse"]?.toString() === 'true',
            pourcentage_masse_declassee: row["pourcentageMasseDeclassee"]?.toString() || "",
            montant_declasse: row["coutsDeclassement"]?.toString() || "",
            justificatif_declassement: row["justificatifDeclassement"]?.toString() || "",
        }
    }    

    if(row["tri"]?.toString() && row["tri"]?.toString() !== '')other_infos.tri = row["tri"]?.toString()==='true';

    // Détecter dynamiquement tous les transporteurs supplémentaires
    const additionalTransporters: AdditionalTransporter[] = [];
    
    // Chercher tous les transporteurs supplémentaires (nomTransporteur2, nomTransporteur3, etc.)
    let transporterIndex = 2;
    while (true) {
        const nomKey = `nomTransporteur${transporterIndex}`;
        const siretKey = `siretTransporteur${transporterIndex}`;
        const emailKey = `emailContactTransporteur${transporterIndex}`;
        const telephoneKey = `telephoneContactTransporteur${transporterIndex}`;
        const adresseKey = `adresseTransporteur${transporterIndex}`;
        const prenomContactKey = `prenomContactTransporteur${transporterIndex}`;
        const nomContactKey = `nomContactTransporteur${transporterIndex}`;
        const paysKey = `paysTransporteur${transporterIndex}`;
        const recepisseKey = `recepisseTransporteur${transporterIndex}`;
        const validiteKey = `limiteValiditeTransporteur${transporterIndex}`;
        const departementKey = `departementTransporteur${transporterIndex}`;
        const immatriculationKey = `immatriculationTransporteur${transporterIndex}`;
        const exemptionKey = `exemptionRecepisseTransporteur${transporterIndex}`;
        const dateKey = `dateCollecteTransporteur${transporterIndex}`;
        
        // Vérifier si ce transporteur existe dans les données
        if (row[nomKey]?.toString() && row[nomKey]?.toString() !== '') {
            const transporter = {
                company: {
                    mail: row[emailKey]?.toString() || "",
                    name: row[nomKey]?.toString() || "",
                    phone: row[telephoneKey]?.toString() || "",
                    orgId: row[siretKey]?.toString() || "",
                    siret: siretFunction(row[siretKey]?.toString()) || "",
                    address: row[adresseKey]?.toString() || "",
                    contact: `${row[prenomContactKey]?.toString() || ""} ${row[nomContactKey]?.toString() || ""}`,
                    country: row[paysKey]?.toString() || "",
                },
                receipt: row[recepisseKey]?.toString() || "",
                department: row[departementKey]?.toString() || "",
                validityLimit: row[validiteKey]?.toString() || "",
                numberPlate: row[immatriculationKey]?.toString() || "",
                isExemptedOfReceipt: row[exemptionKey]?.toString() === 'true',
                takenOverAt: row[dateKey]?.toString() || "",
            };
            additionalTransporters.push(transporter);
        } else {
            // Si on ne trouve plus de transporteur, on arrête la boucle
            break;
        }
        
        transporterIndex++;
    }
    
    // Ajouter les transporteurs supplémentaires s'il y en a
    if (additionalTransporters.length > 0) {
        other_infos.other_transporters = additionalTransporters;
    }

    // Détecter dynamiquement tous les destinataires supplémentaires
    const additionalRecipients: AdditionalRecipient[] = [];
    const valoPartsArray = takeValoPartsArray(row);

    // Chercher tous les destinataires supplémentaires (nomInstallationDestination2, nomInstallationDestination3, etc.)
    let recipientIndex = 2;
    while (true) {
        const nomKey = `nomInstallationDestination${recipientIndex}`;
        const siretKey = `siretInstallationDestination${recipientIndex}`;
        const adresseKey = `adresseInstallationDestination${recipientIndex}`;
        const codePostalKey = `codePostalInstallationDestination${recipientIndex}`;
        const communeKey = `communeInstallationDestination${recipientIndex}`;
        const paysKey = `paysInstallationDestination${recipientIndex}`;
        const prenomContactKey = `prenomContactInstallationDestination${recipientIndex}`;
        const nomContactKey = `nomContactInstallationDestination${recipientIndex}`;
        const telephoneKey = `telephoneContactInstallationDestination${recipientIndex}`;
        const emailKey = `emailContactInstallationDestination${recipientIndex}`;
        const capKey = `numeroCap${recipientIndex}`;
        const processingOperationKey = `codeTraitementPrevuInstallationDestination${recipientIndex}`;
        
        // Vérifier si ce destinataire existe dans les données
        if (row[nomKey]?.toString() && row[nomKey]?.toString() !== '') {
            const recipient = {
                company: {
                    name: row[nomKey]?.toString() || "",
                    orgId: row[siretKey]?.toString() || "",
                    siret: siretFunction(row[siretKey]?.toString()) || "",
                    address: `${row[adresseKey] || ""} ${row[codePostalKey] || ""} ${row[communeKey] || ""}`,
                    country: row[paysKey]?.toString() || "",
                    contact: `${row[prenomContactKey]?.toString() || ""} ${row[nomContactKey]?.toString() || ""}`,
                    phone: row[telephoneKey]?.toString() || "",
                    mail: row[emailKey]?.toString() || "",
                    vatNumber: tvaFunction(row[siretKey]?.toString()) || "",
                },
                cap: row[capKey]?.toString() || "",
                processingOperation: row[processingOperationKey]?.toString() || "",
                valoParts: valoPartsArray[recipientIndex - 2] || [],
            };
            additionalRecipients.push(recipient);
        } else {
            // Si on ne trouve plus de destinataire, on arrête la boucle
            break;
        }
        
        recipientIndex++;
    }
    
    // Ajouter les destinataires supplémentaires s'il y en a
    if (additionalRecipients.length > 0) {
        other_infos.other_recipients = additionalRecipients;
    }

    return other_infos;
}

const takeValoPartsArray = (row: Row) => {
    // créer 
    const valoPartsArray: { code_valo: string; tonnage: number; }[][] = [];
    
    // Fonction pour créer un tableau de valorisations pour un destinataire donné
    const createValoArray = (destIndex: number) => {
        const valoArray: { code_valo: string; tonnage: number; }[] = [];
        let valoIndex = 1;
        
        while (true) {
            const valoKey = destIndex === 1 ? `valo${valoIndex}_dest` : `valo${valoIndex}_dest${destIndex}`;
            const tonnageKey = destIndex === 1 ? `tonnage${valoIndex}_dest` : `tonnage${valoIndex}_dest${destIndex}`;
            
            // Vérifier si cette valorisation existe dans les données
            if (row[valoKey]?.toString() && row[valoKey]?.toString() !== '') {
                const codeValo = row[valoKey]?.toString() || "";
                const tonnage = parseFloat(row[tonnageKey]?.toString().replace(',', '.') || "0");
                
                valoArray.push({
                    code_valo: codeValo,
                    tonnage: tonnage
                });
            } else {
                // Si on ne trouve plus de valorisation, on arrête la boucle
                break;
            }
            
            valoIndex++;
        }
        
        return valoArray;
    };
    
    // Créer le tableau pour le premier destinataire (dest)
    const firstDestValo = createValoArray(1);
    if (firstDestValo.length > 0) {
        valoPartsArray.push(firstDestValo);
    }
    
    // Créer les tableaux pour les destinataires suivants (dest2, dest3, etc.)
    let destIndex = 2;
    while (true) {
        const valoArray = createValoArray(destIndex);
        
        // Si on trouve au moins une valorisation pour ce destinataire
        if (valoArray.length > 0) {
            valoPartsArray.push(valoArray);
        } else {
            // Si on ne trouve plus de destinataire avec des valorisations, on arrête
            break;
        }
        
        destIndex++;
    }
    
    return valoPartsArray;
}

