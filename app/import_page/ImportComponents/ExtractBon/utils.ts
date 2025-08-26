import { supabase } from '@/app/database/supabaseClient';
import { toast } from 'react-hot-toast';
import { findMeta } from '@/app/auth/parameter/components/ClusterParams/utils';

// Types pour les mappings
interface SiteMapping {
    [metaSiteKey: string]: string[];
}

interface PrestaMapping {
    [metaPrestaKey: string]: string[];
}

interface MetaSite {
    nom: string;
    siret: string;
}

interface MetaPresta {
    nom: string;
    siret: string;
}

// Types pour les données de mise à jour
interface UpdatePdfData {
    status: string;
    date_extracted?: string;
    site_siret_plus?: string[];
    provider?: {
        name: string;
        siret: string;
    };
}

export interface BonCerfa {
    numeroBon: string;
    date: string;
    dechet: {
        nom: string;
        codeCED: string;
        tonnage: number;
        code_traitement?: string;
    };
    site: {
        nom: string;
        siret: string;
        adresse: string;
        contact?: string;
        tel?: string;
        email?: string;
    };
    prestataire: {
        nom: string;
        siret: string;
        adresse: string;
        contact?: string;
        tel?: string;
        email?: string;
    };
    site_raw?: string;
    presta_raw?: string;
}

type AutocompletionPresta = {
    nomBoite?: string;
    siret?: string;
    adresse?: string;
    nomPrenom?: string;
    telephone?: string;
    email?: string;
};

type AutocompletionSite = {
    nom?: string;
    siret?: string;
    contacts?: {
        nom?: string;
        telephone?: string;
        email?: string;
    }[];
    pointsCollecte?: {
        nom?: string;
        adresse?: string;
    }[];
};

type AutocompletionRow = {
    id: number;
    site?: AutocompletionSite;
    transporteur?: AutocompletionPresta;
    destinataire?: AutocompletionPresta;
};

// Fonction pour enrichir les données extraites avec les informations de known_data
export const enrichExtractedData = (
    data: Partial<BonCerfa>, 
    sites: Array<{id: number, nom: string, siret: string, adresse: string, contact?: string, tel?: string, email?: string}>, 
    prestataires: Array<{id: number, nom: string, siret: string, adresse: string, contact?: string, tel?: string, email?: string}>
): Partial<BonCerfa> => {
    // S'assurer que la structure de base est toujours présente
    const enrichedData: Partial<BonCerfa> = {
        numeroBon: data.numeroBon || '',
        date: data.date || '',
        dechet: {
            nom: data.dechet?.nom || '',
            codeCED: data.dechet?.codeCED || '',
            tonnage: data.dechet?.tonnage || 0,
            code_traitement: data.dechet?.code_traitement || ''
        },
        site: {
            nom: data.site?.nom || '',
            siret: data.site?.siret || '',
            adresse: data.site?.adresse || '',
            contact: data.site?.contact || '',
            tel: data.site?.tel || '',
            email: data.site?.email || ''
        },
        prestataire: {
            nom: data.prestataire?.nom || '',
            siret: data.prestataire?.siret || '',
            adresse: data.prestataire?.adresse || '',
            contact: data.prestataire?.contact || '',
            tel: data.prestataire?.tel || '',
            email: data.prestataire?.email || ''
        },
        site_raw: data.site_raw || '',
        presta_raw: data.presta_raw || ''
    };

    // Enrichir les informations du site si possible
    if (enrichedData.site?.nom && sites.length > 0) {
        const matchingSite = sites.find(site => 
            site.nom.toLowerCase() === enrichedData.site!.nom.toLowerCase()
        );
        
        if (matchingSite) {
            // Remplacer complètement les informations du site par celles de la base de données
            enrichedData.site = {
                nom: matchingSite.nom, // Utiliser le nom exact de la base de données
                siret: matchingSite.siret,
                adresse: matchingSite.adresse,
                contact: matchingSite.contact || '',
                tel: matchingSite.tel || '',
                email: matchingSite.email || ''
            };
            console.log('Site enrichi avec données BDD:', matchingSite);
        }
    }

    // Enrichir les informations du prestataire si possible
    if (enrichedData.prestataire?.nom && prestataires.length > 0) {
        const matchingPrestataire = prestataires.find(prestataire => 
            prestataire.nom.toLowerCase() === enrichedData.prestataire!.nom.toLowerCase()
        );
        
        if (matchingPrestataire) {
            // Remplacer complètement les informations du prestataire par celles de la base de données
            enrichedData.prestataire = {
                nom: matchingPrestataire.nom, // Utiliser le nom exact de la base de données
                siret: matchingPrestataire.siret,
                adresse: matchingPrestataire.adresse,
                contact: matchingPrestataire.contact || '',
                tel: matchingPrestataire.tel || '',
                email: matchingPrestataire.email || ''
            };
            console.log('Prestataire enrichi avec données BDD:', matchingPrestataire);
        }
    }

    return enrichedData;
};

// Fonction pour charger les données d'autocomplétion
export const fetchAutocompletionData = async (entreprise_id: string) => {
    try {
        const { data, error } = await supabase
            .from('table_autocompletion')
            .select('*')
            .eq('entreprise_id', entreprise_id);

        if (error) throw error;

        if (data) {
            const sitesData: Array<{id: number, nom: string, siret: string, adresse: string, contact?: string, tel?: string, email?: string}> = [];
            const prestatairesData: Array<{id: number, nom: string, siret: string, adresse: string, contact?: string, tel?: string, email?: string}> = [];

            data.forEach((item: AutocompletionRow) => {
                if (item.site) {
                    sitesData.push({
                        id: item.id,
                        nom: item.site.nom || '',
                        siret: item.site.siret || '',
                        adresse: item.site.pointsCollecte?.[0]?.adresse || '',
                        contact: item.site.contacts?.[0]?.nom || '',
                        tel: item.site.contacts?.[0]?.telephone || '',
                        email: item.site.contacts?.[0]?.email || ''
                    });
                }
                if (item.transporteur) {
                    prestatairesData.push({
                        id: item.id,
                        nom: item.transporteur.nomBoite || '',
                        siret: item.transporteur.siret || '',
                        adresse: item.transporteur.adresse || '',
                        contact: item.transporteur.nomPrenom || '',
                        tel: item.transporteur.telephone || '',
                        email: item.transporteur.email || ''
                    });
                }
                if (item.destinataire) {
                    prestatairesData.push({
                        id: item.id,
                        nom: item.destinataire.nomBoite || '',
                        siret: item.destinataire.siret || '',
                        adresse: item.destinataire.adresse || '',
                        contact: item.destinataire.nomPrenom || '',
                        tel: item.destinataire.telephone || '',
                        email: item.destinataire.email || ''
                    });
                }
            });

            return { sites: sitesData, prestataires: prestatairesData };
        }

        return { sites: [], prestataires: [] };
    } catch (error) {
        console.error('Erreur lors du chargement des données d\'autocomplétion:', error);
        return { sites: [], prestataires: [] };
    }
};

// Fonction pour sauvegarder les données dans la table bon_pdf
export const saveBonData = async (
    pdf_id: number,
    entreprise_id: string,
    user_id: string,
    formData: Partial<BonCerfa>,
    perfect_extract?: boolean,
    pdf_status?: string
): Promise<{ success: boolean; error?: string }> => {
    try {
        let finalFormData = { ...formData };

        // Si le statut est 'splitted' ou 'splitted_extracted', récupérer les données existantes et les préserver
        if (pdf_status === 'splitted' || pdf_status === 'splitted_extracted') {
            console.log(`🔍 PDF avec statut "${pdf_status}" détecté - Préservation des données existantes`);
            
            const { data: existingData, error: fetchError } = await supabase
                .from('bon_pdf')
                .select('infos')
                .eq('pdf_id', pdf_id)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') {
                console.warn('Erreur lors de la récupération des données existantes:', fetchError);
            } else if (existingData?.infos) {
                const existing = existingData.infos as Partial<BonCerfa>;
                console.log('📋 Données existantes trouvées:', {
                    site: existing.site,
                    prestataire: existing.prestataire,
                    site_raw: existing.site_raw,
                    presta_raw: existing.presta_raw
                });
                
                // Préserver les données existantes du site et prestataire (priorité aux données existantes)
                finalFormData = {
                    ...finalFormData,
                    site: {
                        nom: existing.site?.nom || finalFormData.site?.nom || '',
                        siret: existing.site?.siret || finalFormData.site?.siret || '',
                        adresse: existing.site?.adresse || finalFormData.site?.adresse || '',
                        contact: existing.site?.contact || finalFormData.site?.contact || '',
                        tel: existing.site?.tel || finalFormData.site?.tel || '',
                        email: existing.site?.email || finalFormData.site?.email || ''
                    },
                    prestataire: {
                        nom: existing.prestataire?.nom || finalFormData.prestataire?.nom || '',
                        siret: existing.prestataire?.siret || finalFormData.prestataire?.siret || '',
                        adresse: existing.prestataire?.adresse || finalFormData.prestataire?.adresse || '',
                        contact: existing.prestataire?.contact || finalFormData.prestataire?.contact || '',
                        tel: existing.prestataire?.tel || finalFormData.prestataire?.tel || '',
                        email: existing.prestataire?.email || finalFormData.prestataire?.email || ''
                    },
                    site_raw: existing.site_raw || finalFormData.site_raw,
                    presta_raw: existing.presta_raw || finalFormData.presta_raw
                };
                
                console.log(`✅ Données préservées pour PDF ${pdf_status} - Site et prestataire conservés`);
                console.log('📋 Données finales après fusion:', {
                    site: finalFormData.site,
                    prestataire: finalFormData.prestataire,
                    site_raw: finalFormData.site_raw,
                    presta_raw: finalFormData.presta_raw
                });
            } else {
                console.log('ℹ️ Aucune donnée existante trouvée pour ce PDF');
            }
        } else {
            console.log('📝 PDF avec statut normal - Sauvegarde standard des données');
        }

        // Inclure perfect_extract dans le JSON infos
        const infosWithPerfectExtract = {
            ...finalFormData,
            perfect_extract: perfect_extract || false
        };

        const { error } = await supabase
            .from('bon_pdf')
            .upsert({
                pdf_id: pdf_id,
                entreprise_id: entreprise_id,
                user_id: user_id,
                infos: infosWithPerfectExtract,
                created_at: new Date().toISOString()
            }, {
                onConflict: 'pdf_id'
            });

        if (error) {
            throw error;
        }

        return { success: true };
    } catch (error) {
        console.error('Error saving bon data:', error);
        return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Erreur inconnue lors de la sauvegarde' 
        };
    }
};

// Fonction pour mettre à jour le statut du PDF
export const updatePdfStatus = async (
    pdf_id: number,
    newStatus: string,
    formData?: Partial<BonCerfa>,
    entreprise_id?: string
): Promise<{ success: boolean; error?: string }> => {
    try {
        // Préparer les données à mettre à jour
        const updateData: UpdatePdfData = { status: newStatus };

        // Mettre à jour date_extracted si elle n'est pas déjà remplie
        const { data: currentPdfData, error: fetchError } = await supabase
            .from('pdf_infos')
            .select('date_extracted, site_siret_plus, provider')
            .eq('id', pdf_id)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            console.warn('Erreur lors de la récupération des données PDF existantes:', fetchError);
        }

        // Mettre à jour date_extracted seulement si elle est null
        if (!currentPdfData?.date_extracted) {
            updateData.date_extracted = new Date().toISOString();
        }

        // Si on a des données de formulaire et un entreprise_id, traiter site_siret_plus et provider
        if (formData && entreprise_id) {
            // Récupérer les mappings de l'entreprise
            const { data: entrepriseData, error: entrepriseError } = await supabase
                .from('entreprise')
                .select('params_mapping_site, params_mapping_presta')
                .eq('id', entreprise_id)
                .single();

            if (entrepriseError) {
                console.warn('Erreur lors de la récupération des mappings entreprise:', entrepriseError);
            } else if (entrepriseData) {
                const siteMapping = entrepriseData.params_mapping_site || {};
                const prestaMapping = entrepriseData.params_mapping_presta || {};

                // Traiter site_siret_plus
                if (!currentPdfData?.site_siret_plus || currentPdfData.site_siret_plus.length === 0) {
                    let siteSiretToAdd: string | null = null;

                    // Si on a un site sélectionné dans la liste déroulante
                    if (formData.site?.siret && formData.site.siret.trim() !== '') {
                        console.log('🔍 Site sélectionné dans la liste déroulante:', formData.site.siret.trim());
                        siteSiretToAdd = formData.site.siret.trim();
                    }
                    // Sinon, essayer de trouver avec findMeta
                    else if (formData.site_raw && formData.site_raw.trim() !== '') {
                        console.log('🔍 Site raw:', formData.site_raw.trim());
                        const metaSite = findMeta(formData.site_raw.trim(), siteMapping, 'site');
                        if (metaSite && metaSite.siret) {
                            siteSiretToAdd = metaSite.siret;
                        }
                    }

                    if (siteSiretToAdd) {
                        updateData.site_siret_plus = [siteSiretToAdd];
                    }
                }

                // Traiter provider
                if (!currentPdfData?.provider || !currentPdfData.provider.siret) {
                    let providerData: { name: string; siret: string } | null = null;

                    // Si on a un prestataire sélectionné dans la liste déroulante
                    if (formData.prestataire?.siret && formData.prestataire.siret.trim() !== '') {
                        providerData = {
                            name: formData.prestataire.nom || '',
                            siret: formData.prestataire.siret.trim()
                        };
                    }
                    // Sinon, essayer de trouver avec findMeta
                    else if (formData.presta_raw && formData.presta_raw.trim() !== '') {
                        const metaPresta = findMeta(formData.presta_raw.trim(), prestaMapping, 'presta');
                        if (metaPresta && metaPresta.siret) {
                            providerData = {
                                name: metaPresta.nom || '',
                                siret: metaPresta.siret
                            };
                        }
                    }

                    if (providerData) {
                        updateData.provider = providerData;
                    }
                }
            }
        }

        // Effectuer la mise à jour
        const { error } = await supabase
            .from('pdf_infos')
            .update(updateData)
            .eq('id', pdf_id)
            .eq('entreprise_id', entreprise_id);

        if (error) {
            throw error;
        }

        return { success: true };
    } catch (error) {
        console.error('Error updating PDF status:', error);
        return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Erreur inconnue lors de la mise à jour du statut' 
        };
    }
};
