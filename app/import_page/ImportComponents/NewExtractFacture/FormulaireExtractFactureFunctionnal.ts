import { supabase } from '@/app/database/supabaseClient';
import { FactureLine, FactureLineHeader, FactureLineBody, FactureLineDepart } from './type';
import { ALL_OPERATIONS, UNITES } from '../../../interface_admin_2/InterfaceAdmin2/constants/formConstants';

// Types pour l'autocomplétion
interface RawAutocompletionData {
    id: number;
    created_at: string;
    entreprise_id: number;
    site: { nom: string; siret: string; adresseSiege: string } | null;
    transporteur: { nomBoite?: string; siret?: string; adresse?: string } | null;
    destinataire: { nomBoite?: string; siret?: string; adresse?: string } | null;
    dechet: { nom: string; codeCED: string; onu: string; adr: string } | null;
    contrat: { nom: string; num_client: string } | null;
    contenant?: { nom: string; volume: string; uniteVolume: string } | null;
}

// Constantes pour les options : depuis les formConstants.ts

// État initial du formulaire
export const getInitialFormData = (): FactureLine => ({
    header: {
        prestataire_nom: '',
        prestataire_description: '',
        prestataire_siret: '',
        prestataire_num_client: '',
        num_facture: '',
        date_facture: new Date().toISOString().split('T')[0]
    },
    departs: [{
        site_nom: '',
        site_siret: '',
        dechet_nom: '',
        code_ced: '',
        date_collecte: new Date().toISOString().split('T')[0],
        contenant_nom: '',
        contenant_volume: '',
        contenant_unite: '',
        body: [{
            type_operation: ALL_OPERATIONS[0],
            unite: UNITES[0],
            quantite: 0,
            prix_unitaire: 0,
            montant_ht: 0
        }]
    }],
    footer: {
        total_ht: 0
    }
});

// Récupérer les données d'autocomplétion depuis Supabase
export const fetchAutocompletionData = async (entrepriseId: string): Promise<RawAutocompletionData[]> => {
    try {

        const { data, error } = await supabase
            .from('table_autocompletion')
            .select('*')
            .eq('entreprise_id', entrepriseId);

        if (error) {
            console.error('Erreur lors de la récupération des données d\'autocomplétion:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Erreur lors de la connexion à Supabase:', error);
        return [];
    }
};

// Extraire les options uniques pour chaque champ
export const extractPrestataireOptions = (data: RawAutocompletionData[]) => {
    const options = new Set<string>();
    data.forEach(item => {
        if (item.transporteur?.nomBoite) options.add(item.transporteur.nomBoite);
        if (item.destinataire?.nomBoite) options.add(item.destinataire.nomBoite);
    });
    return Array.from(options)
        .filter(value => value && value.trim() !== '')
        .map(value => ({ value, isSuggested: false }))
        .sort((a, b) => a.value.localeCompare(b.value));
};

export const extractSiretOptions = (data: RawAutocompletionData[]) => {
    const options = new Set<string>();
    data.forEach(item => {
        if (item.transporteur?.siret) options.add(item.transporteur.siret);
        if (item.destinataire?.siret) options.add(item.destinataire.siret);
    });
    return Array.from(options)
        .filter(value => value && value.trim() !== '')
        .map(value => ({ value, isSuggested: false }))
        .sort((a, b) => a.value.localeCompare(b.value));
};

export const extractSiteSiretOptions = (data: RawAutocompletionData[]) => {
    const options = new Set<string>();
    data.forEach(item => {
        if (item.site?.siret) options.add(item.site.siret);
    });
    return Array.from(options)
        .filter(value => value && value.trim() !== '')
        .map(value => ({ value, isSuggested: false }))
        .sort((a, b) => a.value.localeCompare(b.value));
};

export const extractSiteOptions = (data: RawAutocompletionData[]) => {
    const options = new Set<string>();
    data.forEach(item => {
        if (item.site?.nom) options.add(item.site.nom);
    });
    return Array.from(options)
        .filter(value => value && value.trim() !== '')
        .map(value => ({ value, isSuggested: false }))
        .sort((a, b) => a.value.localeCompare(b.value));
};

export const extractDechetOptions = (data: RawAutocompletionData[]) => {
    const options = new Set<string>();
    data.forEach(item => {
        if (item.dechet?.nom) options.add(item.dechet.nom);
    });
    return Array.from(options)
        .filter(value => value && value.trim() !== '')
        .map(value => ({ value, isSuggested: false }))
        .sort((a, b) => a.value.localeCompare(b.value));
};

export const extractCodeCedOptions = (data: RawAutocompletionData[]) => {
    const options = new Set<string>();
    data.forEach(item => {
        if (item.dechet?.codeCED) options.add(item.dechet.codeCED);
    });
    return Array.from(options)
        .filter(value => value && value.trim() !== '')
        .map(value => ({ value, isSuggested: false }))
        .sort((a, b) => a.value.localeCompare(b.value));
};

export const extractNumClientOptions = (data: RawAutocompletionData[]) => {
    const options = new Set<string>();
    data.forEach(item => {
        if (item.contrat?.num_client) options.add(item.contrat.num_client);
    });
    return Array.from(options)
        .filter(value => value && value.trim() !== '')
        .map(value => ({ value, isSuggested: false }))
        .sort((a, b) => a.value.localeCompare(b.value));
};

export const extractContenantOptions = (data: RawAutocompletionData[]) => {
    const options = new Set<string>();
    data.forEach(item => {
        if (item.contenant?.nom) options.add(item.contenant.nom);
    });
    return Array.from(options)
        .filter(value => value && value.trim() !== '')
        .map(value => ({ value, isSuggested: false }))
        .sort((a, b) => a.value.localeCompare(b.value));
};

// Fonction principale pour obtenir toutes les options
export const getAutocompletionOptions = async (entrepriseId: string) => {
    const data = await fetchAutocompletionData(entrepriseId);
    
    return {
        prestataireOptions: extractPrestataireOptions(data),
        siretOptions: extractSiretOptions(data),
        siteSiretOptions: extractSiteSiretOptions(data),
        siteOptions: extractSiteOptions(data),
        dechetOptions: extractDechetOptions(data),
        codeCedOptions: extractCodeCedOptions(data),
        numClientOptions: extractNumClientOptions(data),
        contenantOptions: extractContenantOptions(data)
    };
};

// Fonctions de liaison pour auto-remplir les champs liés
export const getSiretByPrestataire = (data: RawAutocompletionData[], prestataireName: string) => {
    const item = data.find(item => 
        item.transporteur?.nomBoite === prestataireName || 
        item.destinataire?.nomBoite === prestataireName
    );
    return item?.transporteur?.siret || item?.destinataire?.siret || '';
};

export const getPrestataireBySiret = (data: RawAutocompletionData[], siret: string) => {
    const item = data.find(item => 
        item.transporteur?.siret === siret || 
        item.destinataire?.siret === siret
    );
    return item?.transporteur?.nomBoite || item?.destinataire?.nomBoite || '';
};

export const getCodeCedByDechet = (data: RawAutocompletionData[], dechetName: string) => {
    const item = data.find(item => item.dechet?.nom === dechetName);
    return item?.dechet?.codeCED || '';
};

export const getDechetByCodeCed = (data: RawAutocompletionData[], codeCed: string) => {
    const item = data.find(item => item.dechet?.codeCED === codeCed);
    return item?.dechet?.nom || '';
};

export const getSiretBySite = (data: RawAutocompletionData[], siteName: string) => {
    const item = data.find(item => item.site?.nom === siteName);
    return item?.site?.siret || '';
};

export const getSiteBySiret = (data: RawAutocompletionData[], siret: string) => {
    const item = data.find(item => item.site?.siret === siret);
    return item?.site?.nom || '';
};

export const getVolumeByContenant = (data: RawAutocompletionData[], contenantName: string) => {
    const item = data.find(item => item.contenant?.nom === contenantName);
    return item?.contenant?.volume || '';
};

export const getUniteByContenant = (data: RawAutocompletionData[], contenantName: string) => {
    const item = data.find(item => item.contenant?.nom === contenantName);
    return item?.contenant?.uniteVolume || '';
};

// Mise à jour du header
export const updateHeader = (
    formData: FactureLine,
    field: keyof FactureLineHeader,
    value: string
): FactureLine => {
    return {
        ...formData,
        header: {
            ...formData.header,
            [field]: value
        }
    };
};

// Mise à jour d'un départ
export const updateDepart = (
    formData: FactureLine,
    departIndex: number,
    field: keyof Omit<FactureLineDepart, 'body'>,
    value: string
): FactureLine => {
    const newFormData = { ...formData };
    newFormData.departs[departIndex] = {
        ...newFormData.departs[departIndex],
        [field]: value
    };
    return newFormData;
};

// Ajouter un départ
export const addDepart = (formData: FactureLine): FactureLine => {
    const newDepart: FactureLineDepart = {
        site_nom: '',
        site_siret: '',
        dechet_nom: '',
        code_ced: '',
        date_collecte: new Date().toISOString().split('T')[0],
        contenant_nom: '',
        contenant_volume: '',
        contenant_unite: '',
        body: [{
            type_operation: ALL_OPERATIONS[0],
            unite: UNITES[0],
            quantite: 0,
            prix_unitaire: 0,
            montant_ht: 0
        }]
    };

    return {
        ...formData,
        departs: [...formData.departs, newDepart]
    };
};

// Supprimer un départ
export const removeDepart = (formData: FactureLine, departIndex: number): FactureLine => {
    if (departIndex === 0) return formData; // Ne pas supprimer le premier départ
    const newDeparts = formData.departs.filter((_, index) => index !== departIndex);
    return {
        ...formData,
        departs: newDeparts
    };
};

// Ajouter une ligne au body d'un départ
export const addLine = (formData: FactureLine, departIndex: number): FactureLine => {
    const newLine: FactureLineBody = {
        type_operation: ALL_OPERATIONS[0],
        unite: UNITES[0],
        quantite: 0,
        prix_unitaire: 0,
        montant_ht: 0
    };

    const newFormData = { ...formData };
    newFormData.departs = [...newFormData.departs];
    newFormData.departs[departIndex] = { ...newFormData.departs[departIndex] };
    newFormData.departs[departIndex].body = [...newFormData.departs[departIndex].body, newLine];
    
    return newFormData;
};

// Supprimer une ligne du body d'un départ
export const removeLine = (formData: FactureLine, departIndex: number, lineIndex: number): FactureLine => {
    const newFormData = { ...formData };
    newFormData.departs = [...newFormData.departs];
    newFormData.departs[departIndex] = { ...newFormData.departs[departIndex] };
    newFormData.departs[departIndex].body = newFormData.departs[departIndex].body.filter((_, index) => index !== lineIndex);
    return newFormData;
};

// Mettre à jour une ligne du body d'un départ
export const updateLine = (
    formData: FactureLine,
    departIndex: number,
    lineIndex: number,
    field: keyof FactureLineBody,
    value: string | number
): FactureLine => {
    const newFormData = { ...formData };
    newFormData.departs = [...newFormData.departs];
    newFormData.departs[departIndex] = { ...newFormData.departs[departIndex] };
    newFormData.departs[departIndex].body = [...newFormData.departs[departIndex].body];
    newFormData.departs[departIndex].body[lineIndex] = {
        ...newFormData.departs[departIndex].body[lineIndex],
        [field]: value
    };

    // Recalculer le montant HT si quantité ou prix unitaire change
    if (field === 'quantite' || field === 'prix_unitaire') {
        const quantite = field === 'quantite' ? Number(value) : newFormData.departs[departIndex].body[lineIndex].quantite;
        const prix_unitaire = field === 'prix_unitaire' ? Number(value) : newFormData.departs[departIndex].body[lineIndex].prix_unitaire;
        newFormData.departs[departIndex].body[lineIndex].montant_ht = quantite * prix_unitaire;
    }

    return newFormData;
};

// Calculer le total HT
export const calculateTotal = (formData: FactureLine): number => {
    return formData.departs.reduce((total, depart) => {
        return total + depart.body.reduce((lineTotal, line) => lineTotal + line.montant_ht, 0);
    }, 0);
};

// Mettre à jour le total
export const updateTotal = (formData: FactureLine): FactureLine => {
    const total = calculateTotal(formData);
    return {
        ...formData,
        footer: {
            ...formData.footer,
            total_ht: total
        }
    };
};

// Interface pour la structure cible
interface TargetStructure {
    footer: {
        total_ht: number;
    };
    header: {
        num_facture: string;
        date_facture: string;
        prestataire_nom: string;
        prestataire_siret: string;
        prestataire_num_client: string;
        prestataire_description: string;
    };
    departs: Array<{
        line_body: Array<{
            unite: string;
            quantite: number;
            montant_ht: number;
            prix_unitaire: number;
            type_operation: string;
        }>;
        line_header: {
            filiere: string;
            site_nom: string;
            bon_pesee: string;
            site_siret: string;
            code_dechet: string;
            date_depart: string;
            num_dossier: string;
            type_dechet: string;
            bon_intention: string;
            site_description: string;
            site_num_affaire: string;
            dechet_description: string;
            nom_contenant: string;
            volume_contenant: string;
            unite_contenant: string;
        };
        linked_to_bsd: boolean;
    }>;
}

// Fonction pour transformer les données du formulaire vers la structure cible
export const transformFormDataToTargetStructure = (formData: FactureLine): TargetStructure => {
    return {
        footer: {
            total_ht: formData.footer.total_ht
        },
        header: {
            num_facture: formData.header.num_facture || "",
            date_facture: formData.header.date_facture ? new Date(formData.header.date_facture).toISOString() : new Date().toISOString(),
            prestataire_nom: formData.header.prestataire_nom || "",
            prestataire_siret: formData.header.prestataire_siret || "",
            prestataire_num_client: formData.header.prestataire_num_client || "",
            prestataire_description: formData.header.prestataire_description || ""
        },
        departs: formData.departs.map(depart => ({
            line_body: depart.body.map(line => ({
                unite: line.unite,
                quantite: line.quantite,
                montant_ht: line.montant_ht,
                prix_unitaire: line.prix_unitaire,
                type_operation: line.type_operation
            })),
            line_header: {
                filiere: "", // Champ non disponible dans le formulaire
                site_nom: depart.site_nom || "",
                bon_pesee: "", // Champ non disponible dans le formulaire
                site_siret: depart.site_siret || "",
                code_dechet: depart.code_ced || "",
                date_depart: depart.date_collecte || "",
                num_dossier: "", // Champ non disponible dans le formulaire
                type_dechet: depart.dechet_nom || "",
                bon_intention: "", // Champ non disponible dans le formulaire
                site_description: "", // Champ non disponible dans le formulaire
                site_num_affaire: "", // Champ non disponible dans le formulaire
                dechet_description: "", // Champ non disponible dans le formulaire
                nom_contenant: depart.contenant_nom || "",
                volume_contenant: depart.contenant_volume || "",
                unite_contenant: depart.contenant_unite || "",
            },
            linked_to_bsd: false
        }))
    };
};

// Fonction pour extraire tous les SIRET de sites uniques de la facture
export const extractUniqueSiteSirets = (factureData: TargetStructure): string[] => {
    const siteSirets = new Set<string>();
    factureData.departs.forEach(depart => {
        if (depart.line_header.site_siret && depart.line_header.site_siret.trim() !== '') {
            siteSirets.add(depart.line_header.site_siret);
        }
    });
    return Array.from(siteSirets);
};

// Fonction pour récupérer les données existantes d'une facture
export const getExistingFactureData = async (pdfId: number): Promise<TargetStructure | null> => {
    try {
        const { data: facture, error } = await supabase
            .from('facture')
            .select('infos_json')
            .eq('pdf_infos_id', pdfId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') { // No rows returned
                console.log('📭 Aucune facture existante trouvée pour ce PDF');
                return null;
            }
            console.error('❌ Erreur lors de la récupération de la facture existante:', error);
            return null;
        }

        console.log('📋 Facture existante trouvée:', facture.infos_json);
        return facture.infos_json as TargetStructure;
    } catch (error) {
        console.error('❌ Erreur lors de la récupération:', error);
        return null;
    }
};

// Fonction pour transformer les données de la structure cible vers le formulaire
export const transformTargetStructureToFormData = (targetData: TargetStructure): FactureLine => {
    return {
        header: {
            prestataire_nom: targetData.header.prestataire_nom || '',
            prestataire_description: targetData.header.prestataire_description || '',
            prestataire_siret: targetData.header.prestataire_siret || '',
            prestataire_num_client: targetData.header.prestataire_num_client || '',
            num_facture: targetData.header.num_facture || '',
            date_facture: targetData.header.date_facture ? new Date(targetData.header.date_facture).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
        },
        departs: targetData.departs.map(depart => ({
            site_nom: depart.line_header.site_nom || '',
            site_siret: depart.line_header.site_siret || '',
            dechet_nom: depart.line_header.type_dechet || '',
            code_ced: depart.line_header.code_dechet || '',
            date_collecte: depart.line_header.date_depart || new Date().toISOString().split('T')[0],
            contenant_nom: depart.line_header.nom_contenant || '',
            contenant_volume: depart.line_header.volume_contenant || '',
            contenant_unite: depart.line_header.unite_contenant || '',
            body: depart.line_body.map(line => ({
                type_operation: line.type_operation || ALL_OPERATIONS[0],
                unite: line.unite || UNITES[0],
                quantite: line.quantite || 0,
                prix_unitaire: line.prix_unitaire || 0,
                montant_ht: line.montant_ht || 0
            }))
        })),
        footer: {
            total_ht: targetData.footer.total_ht || 0
        }
    };
};

// Fonction pour sauvegarder la facture dans la BDD
export const saveFactureToDatabase = async (
    userId: string,
    entrepriseId: string,
    pdfId: number,
    factureData: TargetStructure
) => {
    try {
        console.log('🚀 Début saveFactureToDatabase:', { userId, entrepriseId, pdfId });
        
        // 1. Vérifier si une facture existe déjà pour ce pdf_infos_id
        const { data: existingFacture, error: checkError } = await supabase
            .from('facture')
            .select('id')
            .eq('pdf_infos_id', pdfId)
            .single();

        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error('❌ Erreur lors de la vérification:', checkError);
            throw new Error('Erreur lors de la vérification de la facture existante');
        }

        let factureResult;
        
        if (existingFacture) {
            // 2a. Update si la facture existe déjà
            console.log('📝 Mise à jour de la facture existante');
            const { data: updateData, error: updateError } = await supabase
                .from('facture')
                .update({
                    user_id: userId,
                    entreprise_id: entrepriseId,
                    infos_json: factureData,
                    created_at: new Date().toISOString()
                })
                .eq('pdf_infos_id', pdfId)
                .select()
                .single();

            if (updateError) {
                console.error('❌ Erreur lors de l\'update de la facture:', updateError);
                throw new Error('Erreur lors de la mise à jour de la facture');
            }
            factureResult = updateData;
        } else {
            // 2b. Insert si la facture n'existe pas
            console.log('➕ Création d\'une nouvelle facture');
            const { data: insertData, error: insertError } = await supabase
                .from('facture')
                .insert({
                    user_id: userId,
                    entreprise_id: entrepriseId,
                    pdf_infos_id: pdfId,
                    infos_json: factureData
                })
                .select()
                .single();

            if (insertError) {
                console.error('❌ Erreur lors de l\'insert de la facture:', insertError);
                throw new Error('Erreur lors de l\'enregistrement de la facture');
            }
            factureResult = insertData;
        }

        console.log('✅ Facture sauvegardée:', factureResult);

        // 3. Extraire tous les SIRET de sites uniques
        const siteSirets = extractUniqueSiteSirets(factureData);
        //const firstSiteSiret = siteSirets.length > 0 ? siteSirets[0] : null;
        //const otherSiteSirets = siteSirets.slice(1);

        //console.log('📍 SIRET extraits:', { firstSiteSiret, otherSiteSirets });

        // 4. Mettre à jour la table pdf_infos
        const { error: pdfUpdateError } = await supabase
            .from('pdf_infos')
            .update({
                status: 'read',
                //site_siret: firstSiteSiret, //en fait on utilise que site_siret_plus
                site_siret_plus: siteSirets.length > 0 ? siteSirets : null
            })
            .eq('id', pdfId);

        if (pdfUpdateError) {
            console.error('❌ Erreur lors de la mise à jour de pdf_infos:', pdfUpdateError);
            throw new Error('Erreur lors de la mise à jour du statut PDF');
        }

        console.log('✅ PDF mis à jour avec succès');
        return factureResult;
    } catch (error) {
        console.error('❌ Erreur lors de la sauvegarde:', error);
        throw error;
    }
};
