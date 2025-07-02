import { FormInput } from "@/app/register/interface/BSD_Interface";
import { BSDCerfa } from "./ExtractBSD";
import { supabase } from "@/app/database/supabaseClient";
import { useSession } from "@/app/component/SessionProvider";
import Swal from 'sweetalert2';

const handleCreateLineBasedOnBSDPDF = async (bsdPdf: BSDCerfa, pdf_id: number, entreprise_id: string) => {

    // Fonction pour formater les dates
    const formatDate = (dateString: string | undefined): string | null => {
        if (!dateString) return null;
        
        try {
            console.log('Formatage de la date:', dateString);
            
            // Nettoyer la date (enlever les espaces, caractères spéciaux)
            let cleanDate = dateString.replace(/[\s\/\-\.]/g, '');
            
            // Gérer les cas spéciaux comme "11/0/22025" -> "11022025"
            if (dateString.includes('/')) {
                const parts = dateString.split('/');
                if (parts.length === 3) {
                    const day = parts[0].padStart(2, '0');
                    const month = parts[1].padStart(2, '0');
                    let year = parts[2];
                    
                    // Corriger les années malformées comme "22025" -> "2025"
                    if (year.length > 4) {
                        year = year.substring(year.length - 4);
                    }
                    
                    cleanDate = day + month + year;
                }
            }
            
            console.log('Date nettoyée:', cleanDate);
            
            // Patterns de dates possibles
            const patterns = [
                /(\d{2})(\d{2})(\d{4})/, // DDMMYYYY
                /(\d{2})(\d{2})(\d{2})/, // DDMMYY
                /(\d{4})(\d{2})(\d{2})/, // YYYYMMDD
            ];
            
            for (const pattern of patterns) {
                const match = cleanDate.match(pattern);
                if (match) {
                    let day, month, year;
                    
                    if (pattern.source.includes('YYYY')) {
                        // Format YYYYMMDD
                        year = match[1];
                        month = match[2];
                        day = match[3];
                    } else if (pattern.source.includes('YY')) {
                        // Format DDMMYY
                        day = match[1];
                        month = match[2];
                        year = '20' + match[3]; // Supposer 20xx pour les années à 2 chiffres
                    } else {
                        // Format DDMMYYYY
                        day = match[1];
                        month = match[2];
                        year = match[3];
                    }
                    
                    // Validation des valeurs
                    const dayNum = parseInt(day);
                    const monthNum = parseInt(month);
                    const yearNum = parseInt(year);
                    
                    if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 1900 && yearNum <= 2100) {
                        // Créer la date au format ISO
                        const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
                        const result = date.toISOString();
                        console.log('Date formatée avec succès:', result);
                        return result;
                    }
                }
            }
            
            // Si aucun pattern ne correspond, essayer de parser directement
            const parsedDate = new Date(dateString);
            if (!isNaN(parsedDate.getTime())) {
                const result = parsedDate.toISOString();
                console.log('Date parsée directement:', result);
                return result;
            }
            
            console.log('Impossible de formater la date:', dateString);
            return null;
        } catch (error) {
            console.error('Erreur lors du formatage de la date:', dateString, error);
            return null;
        }
    };

    // Fonction pour obtenir la meilleure date selon la priorité
    const getBestDate = (): string | null => {
        const dates = [
            { date: bsdPdf.collecteurTransporteur?.datePriseEnCharge, priority: 1, name: 'Prise en charge' },
            { date: bsdPdf.declarationEmetteur?.date, priority: 2, name: 'Présentation' },
            { date: bsdPdf.realisationOperation?.date, priority: 3, name: 'Traitement' },
            { date: bsdPdf.expedition?.dateEnvoi, priority: 4, name: 'Déclaration' }
        ];
        
        // Trier par priorité et formater les dates
        const formattedDates = dates
            .map(item => ({
                ...item,
                formattedDate: formatDate(item.date)
            }))
            .filter(item => item.formattedDate !== null)
            .sort((a, b) => a.priority - b.priority);
        
        console.log('Dates disponibles:', formattedDates);
        
        return formattedDates.length > 0 ? formattedDates[0].formattedDate : null;
    };

    const bestDate = getBestDate();
    console.log('Date sélectionnée:', bestDate);

    // Récupérer le SIRET du site depuis pdf_infos
    const { data: pdfInfosData, error: pdfInfosError } = await supabase
        .from('pdf_infos')
        .select('site_siret_plus')
        .eq('id', pdf_id)
        .eq('entreprise_id', entreprise_id)
        .single();

    if (pdfInfosError) {
        console.error('Erreur lors de la récupération des infos PDF:', pdfInfosError);
        return null;
    }

    // Récupérer le nom du site depuis table_autocompletion
    let siteName = "";
    let siteSiret = "";
    
    if (pdfInfosData?.site_siret_plus && pdfInfosData.site_siret_plus.length > 0) {
        siteSiret = pdfInfosData.site_siret_plus[0]; // Prendre le premier SIRET
        
        const { data: autocompletionData, error: autocompletionError } = await supabase
            .from('table_autocompletion')
            .select('site')
            .eq('entreprise_id', entreprise_id);

        if (!autocompletionError && autocompletionData) {
            // Chercher le site correspondant au SIRET
            const matchingSite = autocompletionData.find(item => 
                item.site?.siret?.replace(/\s/g, '') === siteSiret.replace(/\s/g, '')
            );
            
            if (matchingSite?.site?.nom) {
                siteName = matchingSite.site.nom;
                console.log('Nom du site trouvé pour le PDF:', siteName);
            }
        }
    }

    const new_bsd_infos_json : {formAPI: {createFormInput: FormInput}} = {
        formAPI: {
            createFormInput: {
                emitter: {
                    type: "PRODUCER",
                    company: {
                        name: siteName || bsdPdf.emetteur?.nom || "",
                        orgId: siteSiret,
                        siret: siteSiret || bsdPdf.emetteur?.siret || "",
                        address: bsdPdf.emetteur?.adresse || "",
                        country: "France",
                        contact: bsdPdf.emetteur?.contact || "",
                        phone: bsdPdf.emetteur?.tel || "",
                        mail: bsdPdf.emetteur?.email || ""
                    },
                    workSite: {
                        name: "",
                        address: "",
                        city: "",
                        postalCode: "",
                        infos: ""
                    }
                },
                recipient: {
                    cap: bsdPdf.installationDestination?.numeroCAP || "",
                    company: {
                        name: bsdPdf.installationDestination?.nom || "",
                        siret: bsdPdf.installationDestination?.siret || "",
                        address: bsdPdf.installationDestination?.adresse || "",
                        country: "France",
                        contact: bsdPdf.installationDestination?.contact || "",
                        phone: bsdPdf.installationDestination?.tel || "",
                        mail: bsdPdf.installationDestination?.email || ""
                    },
                    processingOperation: bsdPdf.installationDestination?.codeOperation || bsdPdf.realisationOperation?.code || ""
                },
                transporter: {  
                    company: {
                        name: bsdPdf.collecteurTransporteur?.nom || "",
                        siret: (bsdPdf.collecteurTransporteur?.siren || "") + "00000", // Ajout de 5 zéros pour convertir SIREN en SIRET
                        address: bsdPdf.collecteurTransporteur?.adresse || "",
                        country: "France",
                        contact: bsdPdf.collecteurTransporteur?.contact || "",
                        phone: bsdPdf.collecteurTransporteur?.tel || "",
                        mail: bsdPdf.collecteurTransporteur?.email || ""
                    },
                    isExemptedOfReceipt: false,
                    receipt: bsdPdf.collecteurTransporteur?.numeroRecepisse || "",
                    numberPlate: "",
                    customInfo: ""
                },
                wasteDetails: {
                    code: bsdPdf.dechet?.code || "",
                    name: bsdPdf.dechet?.denominationUsuelle || "",
                    isSubjectToADR: bsdPdf.dechet?.etiquetageADR !== "Non soumis à l'ADR",
                    onuCode: "",
                    packagingInfos: [{
                        type: "AUTRE",
                        quantity: bsdPdf.dechet?.nombreColis || 0
                    }],
                    quantity: bsdPdf.dechet?.poids || 0,
                    quantityType: bsdPdf.dechet?.reel ? "REAL" : "ESTIMATED",
                    consistence: bsdPdf.dechet?.consistence?.toUpperCase() || "SOLIDE",
                    pop: false,
                    isDangerous: false,
                }
            }
        }
    }

    const other_infos_new = {
        volume: bsdPdf.dechet?.volume?.toString() || "",
        volumeUnit: bsdPdf.dechet?.volumeUnite || "",
        containerDescription: bsdPdf.dechet?.conditionnement || ""
    }

    const numeroBordereau = bsdPdf.numeroBordereau || "";
    
    return {new_bsd_infos_json, other_infos_new, numeroBordereau};
}

const saveBSDToDatabase = async (bsdData: {formAPI: {createFormInput: FormInput}}, other_infos_new: {volume: string, volumeUnit: string, containerDescription: string}, pdf_id: number, entreprise_id: string, user_id: string, numeroBordereau: string) => {
    try {
        // Fonction pour formater les dates
        const formatDate = (dateString: string | undefined): string | null => {
            if (!dateString) return null;
            
            try {
                console.log('Formatage de la date:', dateString);
                
                // Gérer les cas spéciaux comme "11/0/22025" -> "11022025"
                if (dateString.includes('/')) {
                    const parts = dateString.split('/');
                    if (parts.length === 3) {
                        const day = parts[0].padStart(2, '0');
                        const month = parts[1].padStart(2, '0');
                        let year = parts[2];
                        
                        // Corriger les années malformées comme "22025" -> "2025"
                        if (year.length > 4) {
                            year = year.substring(year.length - 4);
                        }
                        
                        // Validation des valeurs
                        const dayNum = parseInt(day);
                        const monthNum = parseInt(month);
                        const yearNum = parseInt(year);
                        
                        if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 1900 && yearNum <= 2100) {
                            // Créer la date au format ISO
                            const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
                            const result = date.toISOString();
                            console.log('Date formatée avec succès:', result);
                            return result;
                        }
                    }
                }
                
                // Nettoyer la date (enlever les espaces, caractères spéciaux)
                const cleanDate = dateString.replace(/[\s\/\-\.]/g, '');
                
                console.log('Date nettoyée:', cleanDate);
                
                // Patterns de dates possibles
                const patterns = [
                    /(\d{2})(\d{2})(\d{4})/, // DDMMYYYY
                    /(\d{2})(\d{2})(\d{2})/, // DDMMYY
                    /(\d{4})(\d{2})(\d{2})/, // YYYYMMDD
                ];
                
                for (const pattern of patterns) {
                    const match = cleanDate.match(pattern);
                    if (match) {
                        let day, month, year;
                        
                        if (pattern.source.includes('YYYY')) {
                            // Format YYYYMMDD
                            year = match[1];
                            month = match[2];
                            day = match[3];
                        } else if (pattern.source.includes('YY')) {
                            // Format DDMMYY
                            day = match[1];
                            month = match[2];
                            year = '20' + match[3]; // Supposer 20xx pour les années à 2 chiffres
                        } else {
                            // Format DDMMYYYY
                            day = match[1];
                            month = match[2];
                            year = match[3];
                        }
                        
                        // Validation des valeurs
                        const dayNum = parseInt(day);
                        const monthNum = parseInt(month);
                        const yearNum = parseInt(year);
                        
                        if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 1900 && yearNum <= 2100) {
                            // Créer la date au format ISO
                            const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
                            const result = date.toISOString();
                            console.log('Date formatée avec succès:', result);
                            return result;
                        }
                    }
                }
                
                // Si aucun pattern ne correspond, essayer de parser directement
                const parsedDate = new Date(dateString);
                if (!isNaN(parsedDate.getTime())) {
                    const result = parsedDate.toISOString();
                    console.log('Date parsée directement:', result);
                    return result;
                }
                
                console.log('Impossible de formater la date:', dateString);
                return null;
            } catch (error) {
                console.error('Erreur lors du formatage de la date:', dateString, error);
                return null;
            }
        };

        // Fonction pour obtenir la meilleure date selon la priorité
        const getBestDate = (): string | null => {
            // Récupérer les dates depuis les données du BSD PDF (à adapter selon la structure)
            const dates = [
                { date: bsdData.formAPI.createFormInput.takenOverAt, priority: 1, name: 'Prise en charge' },
                // Ajouter d'autres dates si disponibles dans bsdData
            ];
            
            // Trier par priorité et formater les dates
            const formattedDates = dates
                .map(item => ({
                    ...item,
                    formattedDate: formatDate(item.date)
                }))
                .filter(item => item.formattedDate !== null)
                .sort((a, b) => a.priority - b.priority);
            
            return formattedDates.length > 0 ? formattedDates[0].formattedDate : new Date().toISOString();
        };

        const bestDate = getBestDate();

        // Ajouter les informations supplémentaires dans infos_json
        const completeBsdData = {
            ...bsdData,
            formAPI: {
                createFormInput: {
                    ...bsdData.formAPI.createFormInput,
                    takenOverAt: bestDate,
                    transporter: {
                        ...bsdData.formAPI.createFormInput.transporter,
                        takenOverAt: bestDate,
                    }
                }
            }
        };


        // Insérer dans la table bsd
        const { data, error } = await supabase
            .from('bsd')
            .insert({
                user_id: user_id,
                pdf_infos_id: pdf_id.toString(), // Convertir en string
                infos_json: completeBsdData,
                created_at: bestDate,
                created_on_fleap: false,
                facture_treated: false,
                facture_infos: null,
                on_track_dechets: false,
                id_track_dechets: "Ligne de BSD PDF",
                status_track_dechets: "Ligne de BSD PDF",
                readable_id_track_dechets: numeroBordereau,
                entreprise_id: entreprise_id,
                other_infos: other_infos_new,
                photo: null,
                pdf_ids: null,
                bsd_extracted_then_linked_id: null,
                source: "extracted_from_pdf"
            })
            .select()
            .single();

        if (error) {
            console.error('Erreur lors de la sauvegarde du BSD:', error);
            throw new Error('Erreur lors de la sauvegarde du BSD');
        }

        console.log('BSD sauvegardé avec succès:', data);
        
        // Créer les liens dans les tables bsd, bsd_pdf et pdf_infos
        try {
            // 1. Récupérer l'ID du bsd_pdf
            const { data: bsdPdfData, error: bsdPdfError } = await supabase
                .from('bsd_pdf')
                .select('id')
                .eq('pdf_id', pdf_id)
                .eq('entreprise_id', entreprise_id)
                .single();

            if (bsdPdfError) {
                console.error('Erreur lors de la récupération du BS PDF:', bsdPdfError);
                throw bsdPdfError;
            }

            if (!bsdPdfData) {
                console.error('BS PDF non trouvé');
                throw new Error('BS PDF non trouvé');
            }

            // 2. Mettre à jour le bsd_pdf avec le linked_bsd_id
            const { error: updateBsdPdfError } = await supabase
                .from('bsd_pdf')
                .update({
                    linked_bsd_id: data.id
                })
                .eq('id', bsdPdfData.id)
                .eq('entreprise_id', entreprise_id);

            if (updateBsdPdfError) {
                console.error('Erreur lors de la mise à jour du BS PDF:', updateBsdPdfError);
                throw updateBsdPdfError;
            }

            // 3. Récupérer les pdf_ids actuels du BSD
            const { data: ligne_register, error: ligne_register_error } = await supabase
                .from('bsd')
                .select('pdf_ids')
                .eq('id', data.id)
                .eq('entreprise_id', entreprise_id)
                .single();

            if (ligne_register_error) {
                console.error('Erreur lors de la récupération du BSD:', ligne_register_error);
                throw ligne_register_error;
            }

            if (!ligne_register) {
                console.error('BSD non trouvé');
                throw new Error('BSD non trouvé');
            }

            // S'assurer que pdf_ids est un tableau, même s'il est null
            const current_pdf_ids = ligne_register.pdf_ids || [];
            const new_pdf_ids = [...current_pdf_ids, pdf_id.toString()];

            // Mettre à jour le BSD avec bsd_extracted_then_linked_id et pdf_ids
            const { error: updateBsdError } = await supabase
                .from('bsd')
                .update({
                    bsd_extracted_then_linked_id: bsdPdfData.id,
                    pdf_ids: new_pdf_ids
                })
                .eq('id', data.id)
                .eq('entreprise_id', entreprise_id);

            if (updateBsdError) {
                console.error('Erreur lors de la mise à jour du BSD:', updateBsdError);
                throw updateBsdError;
            }

            // 4. Mettre à jour pdf_infos avec le statut "linked"
            const { error: updatePdfError } = await supabase
                .from('pdf_infos')
                .update({ 
                    status: "linked"
                })
                .eq('id', pdf_id)
                .eq('entreprise_id', entreprise_id);

            if (updatePdfError) {
                console.error('Erreur lors de la mise à jour du PDF:', updatePdfError);
                throw updatePdfError;
            }

            console.log('Liens créés avec succès dans toutes les tables');
            return data;

        } catch (linkError) {
            console.error('Erreur lors de la création des liens:', linkError);
            // Ne pas faire échouer la création du BSD si les liens échouent
            console.log('BSD créé mais liens non établis');
            return data;
        }
    } catch (error) {
        console.error('Erreur lors de la sauvegarde du BSD:', error);
        throw error;
    }
}

const showBSDPreview = (bsdData: {formAPI: {createFormInput: FormInput}}, siteName: string, siteSiret: string) => {
    const emitter = bsdData.formAPI.createFormInput.emitter.company;
    const recipient = bsdData.formAPI.createFormInput.recipient.company;
    const transporter = bsdData.formAPI.createFormInput.transporter.company;
    const waste = bsdData.formAPI.createFormInput.wasteDetails;
    const workSite = bsdData.formAPI.createFormInput.emitter.workSite;

    // Fonction pour formater les dates pour l'affichage
    const formatDateForDisplay = (dateString: string | null | undefined): string => {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateString;
        }
    };

    const htmlContent = `
        <div style="text-align: left; font-size: 14px; max-height: 70vh; overflow-y: auto;">
            <div style="margin-bottom: 20px;">
                <h3 style="color: #2563eb; margin-bottom: 10px;">📋 ÉMETTEUR</h3>
                <p><strong>Nom:</strong> ${emitter.name}</p>
                <p><strong>SIRET:</strong> ${emitter.siret}</p>
                <p><strong>orgId:</strong> ${emitter.orgId || ''}</p>
                <p><strong>Adresse:</strong> ${emitter.address}</p>
                <p><strong>Pays:</strong> ${emitter.country}</p>
                <p><strong>Contact:</strong> ${emitter.contact || ''}</p>
                <p><strong>Téléphone:</strong> ${emitter.phone || ''}</p>
                <p><strong>Email:</strong> ${emitter.mail || ''}</p>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h3 style="color: #059669; margin-bottom: 10px;">🏭 DESTINATAIRE</h3>
                <p><strong>Nom:</strong> ${recipient.name}</p>
                <p><strong>SIRET:</strong> ${recipient.siret}</p>
                <p><strong>Adresse:</strong> ${recipient.address}</p>
                <p><strong>Pays:</strong> ${recipient.country}</p>
                <p><strong>Contact:</strong> ${recipient.contact || ''}</p>
                <p><strong>Téléphone:</strong> ${recipient.phone || ''}</p>
                <p><strong>Email:</strong> ${recipient.mail || ''}</p>
                <p><strong>CAP:</strong> ${bsdData.formAPI.createFormInput.recipient.cap || ''}</p>
                <p><strong>Opération:</strong> ${bsdData.formAPI.createFormInput.recipient.processingOperation}</p>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h3 style="color: #dc2626; margin-bottom: 10px;">🚛 TRANSPORTEUR</h3>
                <p><strong>Nom:</strong> ${transporter.name}</p>
                <p><strong>SIRET:</strong> ${transporter.siret}</p>
                <p><strong>Adresse:</strong> ${transporter.address}</p>
                <p><strong>Pays:</strong> ${transporter.country}</p>
                <p><strong>Contact:</strong> ${transporter.contact || ''}</p>
                <p><strong>Téléphone:</strong> ${transporter.phone || ''}</p>
                <p><strong>Email:</strong> ${transporter.mail || ''}</p>
                <p><strong>Récépissé:</strong> ${bsdData.formAPI.createFormInput.transporter.receipt || ''}</p>
                <p><strong>Exempté de récépissé:</strong> ${bsdData.formAPI.createFormInput.transporter.isExemptedOfReceipt ? 'Oui' : 'Non'}</p>
                <p><strong>Plaque d'immatriculation:</strong> ${bsdData.formAPI.createFormInput.transporter.numberPlate || ''}</p>
                <p><strong>Informations personnalisées:</strong> ${bsdData.formAPI.createFormInput.transporter.customInfo || ''}</p>
                <p><strong>Date de prise en charge:</strong> ${formatDateForDisplay(bsdData.formAPI.createFormInput.takenOverAt)}</p>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h3 style="color: #7c3aed; margin-bottom: 10px;">🗑️ DÉCHET</h3>
                <p><strong>Code:</strong> ${waste.code}</p>
                <p><strong>Nom:</strong> ${waste.name}</p>
                <p><strong>Quantité:</strong> ${waste.quantity} tonnes</p>
                <p><strong>Type de quantité:</strong> ${waste.quantityType}</p>
                <p><strong>Consistance:</strong> ${waste.consistence}</p>
                <p><strong>Soumis à ADR:</strong> ${waste.isSubjectToADR ? 'Oui' : 'Non'}</p>
                <p><strong>Code ONU:</strong> ${waste.onuCode || ''}</p>
                <p><strong>Mention réglementation non-routier:</strong> ${waste.nonRoadRegulationMention || ''}</p>
                <p><strong>POP:</strong> ${waste.pop ? 'Oui' : 'Non'}</p>
                <p><strong>Dangereux:</strong> ${waste.isDangerous ? 'Oui' : 'Non'}</p>

                <p><strong>Emballage:</strong> ${waste.packagingInfos[0]?.type || ''} (${waste.packagingInfos[0]?.quantity || 0} unités)</p>
                <p><strong>Références d'analyse:</strong> ${waste.analysisReferences || ''}</p>
                <p><strong>Identifiants de terrain:</strong> ${waste.landIdentifiers || ''}</p>
                <p><strong>Numéro d'échantillon:</strong> ${waste.sampleNumber || ''}</p>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h3 style="color: #0891b2; margin-bottom: 10px;">🏗️ SITE DE TRAVAIL</h3>
                <p><strong>Nom:</strong> ${workSite.name || ''}</p>
                <p><strong>Adresse:</strong> ${workSite.address || ''}</p>
                <p><strong>Ville:</strong> ${workSite.city || ''}</p>
                <p><strong>Code postal:</strong> ${workSite.postalCode || ''}</p>
                <p><strong>Informations:</strong> ${workSite.infos || ''}</p>
            </div>
            
            ${siteName ? `
            <div style="margin-bottom: 20px;">
                <h3 style="color: #ea580c; margin-bottom: 10px;">📍 SITE SÉLECTIONNÉ</h3>
                <p><strong>Nom:</strong> ${siteName}</p>
                <p><strong>SIRET:</strong> ${siteSiret}</p>
            </div>
            ` : ''}
            
            <div style="margin-bottom: 20px;">
                <h3 style="color: #059669; margin-bottom: 10px;">📊 INFORMATIONS SUPPLÉMENTAIRES</h3>
                <p><strong>Type d'émetteur:</strong> ${bsdData.formAPI.createFormInput.emitter.type}</p>
                <p><strong>Entreposage provisoire:</strong> ${bsdData.formAPI.createFormInput.recipient.isTempStorage ? 'Oui' : 'Non'}</p>
                <p><strong>Date de prise en charge (niveau supérieur):</strong> ${formatDateForDisplay(bsdData.formAPI.createFormInput.takenOverAt)}</p>
            </div>
        </div>
    `;

    return Swal.fire({
        title: '📄 Aperçu du BSD à créer',
        html: htmlContent,
        width: '800px',
        showCancelButton: true,
        confirmButtonText: '✅ Créer le BSD',
        cancelButtonText: '❌ Annuler',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#6b7280',
        customClass: {
            popup: 'swal-wide',
            confirmButton: 'swal-confirm',
            cancelButton: 'swal-cancel'
        }
    });
}

const CreateLineBasedOnBSDPDF = ({ bsdPdf, pdf_id }: { bsdPdf: BSDCerfa, pdf_id: number }) => {
    const { entreprise_id, user_id } = useSession();
    
    return (
        <div>
            <button 
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={async () => {
                if (entreprise_id) {
                    const result = await handleCreateLineBasedOnBSDPDF(bsdPdf, pdf_id, entreprise_id);
                    if (result) {
                        // Récupérer les informations du site pour l'aperçu
                        const { data: pdfInfosData } = await supabase
                            .from('pdf_infos')
                            .select('site_siret_plus')
                            .eq('id', pdf_id)
                            .eq('entreprise_id', entreprise_id)
                            .single();

                        let siteName = "";
                        let siteSiret = "";
                        
                        if (pdfInfosData?.site_siret_plus && pdfInfosData.site_siret_plus.length > 0) {
                            siteSiret = pdfInfosData.site_siret_plus[0];
                            
                            const { data: autocompletionData } = await supabase
                                .from('table_autocompletion')
                                .select('site')
                                .eq('entreprise_id', entreprise_id);

                            if (autocompletionData) {
                                const matchingSite = autocompletionData.find(item => 
                                    item.site?.siret?.replace(/\s/g, '') === siteSiret.replace(/\s/g, '')
                                );
                                
                                if (matchingSite?.site?.nom) {
                                    siteName = matchingSite.site.nom;
                                }
                            }
                        }

                        // Afficher l'aperçu et demander confirmation
                        const { isConfirmed } = await showBSDPreview(result.new_bsd_infos_json, siteName, siteSiret);
                        
                        if (isConfirmed) {
                            try {
                                // Sauvegarder le BSD dans la base de données
                                const savedBSD = await saveBSDToDatabase(result.new_bsd_infos_json, result.other_infos_new, pdf_id, entreprise_id, user_id || "", result.numeroBordereau || "");
                                console.log('BSD sauvegardé avec succès:', savedBSD);
                                
                                Swal.fire({
                                    title: '✅ BSD créé !',
                                    text: 'Le bordereau a été créé et sauvegardé avec succès.',
                                    icon: 'success',
                                    confirmButtonColor: '#2563eb'
                                });
                            } catch (error) {
                                console.error('Erreur lors de la sauvegarde:', error);
                                Swal.fire({
                                    title: '❌ Erreur',
                                    text: 'Erreur lors de la sauvegarde du BSD.',
                                    icon: 'error',
                                    confirmButtonColor: '#dc2626'
                                });
                            }
                        }
                    }
                }
            }}
            >Créer une ligne à partir du PDF</button>
        </div>
    )
}

export default CreateLineBasedOnBSDPDF;