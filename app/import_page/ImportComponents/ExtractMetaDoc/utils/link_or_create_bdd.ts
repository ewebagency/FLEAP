import { supabase } from '@/app/database/supabaseClient';
import { getPdfInfoById, getParamsMappingByEntreprise } from './bdd';
import { PdfInfo } from '../interface/pdf_interface';
import Swal from "sweetalert2";
import { toast } from 'react-hot-toast';
import { 
    buildFactureFromNormalized, 
    push_in_facture_bdd,
    normalizePdfData
} from './link';

type BsdLinkedItem = { bsd_id: string; index_dechet: number; status?: 'linked' | 'created' | 'check_by_user' };

// Types pour la fonction determineTonnage
type FactureLigne = { 
    unite?: string; 
    quantite?: string; 
    montant_ht?: string; 
    tva_absolute?: string; 
    prix_unitaire?: string; 
    type_operation?: string 
};

type DechetItemWithFacture = {
    ced?: string;
    d_r?: string;
    nom?: string;
    date?: string;
    tour?: string;
    num_bon?: string;
    num_bsd?: string;
    tonnage?: string;
    contenant?: string;
    volume_m3?: string;
    facture?: { ligne?: FactureLigne[] };
};

type InfosRawWithDechets = {
    dechet?: DechetItemWithFacture[];
    site_raw?: string;
    presta_raw?: string;
    type_doc?: string;
    num_facture?: string;
    conformite?: Record<string, unknown>;
    add_presta_raw?: Record<string, unknown>;
};

export const translateByMapping = (value: string, mapping: Record<string, string[]>): {name: string, siret: string} => {
    if (!value) return {"name": "", "siret": ""};
    const normalized = value.toLowerCase().trim();
    for (const [key, originals] of Object.entries(mapping || {})) {
        const name_translated = (key || '').split('|')[0];
        const siret_translated = (key || '').split('|')[1];
        if (Array.isArray(originals) && originals.some(o => (o || '').toLowerCase().trim() === normalized)) {
            return {"name": name_translated, "siret": siret_translated};
        }
        if (name_translated.toLowerCase().trim() === normalized) {
            return {"name": name_translated, "siret": siret_translated};
        }
    }
    // Rien trouvé: renvoyer la valeur d'origine dans name
    return {"name": value, "siret": ""};
};

const normalizeNumbers = (value: string): string => (value || '').replace(/[\s*]/g, '');

/**
 * Détermine le tonnage pour les factures en analysant les lignes de déchets
 * @param document_type - Type de document (doit être "facture")
 * @param infos_raw - Données brutes du PDF contenant les informations des déchets
 * @returns Les infos_raw mis à jour avec les tonnages calculés
 */
// Pas encore utilisé
export const determineTonnage = (
    document_type: string, 
    infos_raw: InfosRawWithDechets
): InfosRawWithDechets => {
    // Vérifier que c'est une facture
    if (!document_type || document_type.toLowerCase() !== 'facture') {
        return infos_raw;
    }

    // Vérifier que infos_raw contient des déchets
    if (!infos_raw.dechet || !Array.isArray(infos_raw.dechet)) {
        return infos_raw;
    }

    // Créer une copie des infos_raw pour éviter de modifier l'original
    const updatedInfosRaw: InfosRawWithDechets = {
        ...infos_raw,
        dechet: infos_raw.dechet.map(dechet => ({ ...dechet }))
    };

    // Traiter chaque déchet
    if (updatedInfosRaw.dechet) {
        updatedInfosRaw.dechet = updatedInfosRaw.dechet.map(dechet => {
        // Vérifier que le déchet a des lignes de facture
        if (!dechet.facture?.ligne || !Array.isArray(dechet.facture.ligne)) {
            return dechet;
        }

        // Parcourir chaque ligne de facture
        dechet.facture.ligne.forEach(ligne => {
            const unite = ligne.unite?.trim().toUpperCase();
            const typeOperation = ligne.type_operation?.trim();
            const quantite = ligne.quantite;

            // Vérifier les conditions : type_operation = "Traitement" et unite = "T"
            if (typeOperation === 'Traitement' && unite === 'T' && quantite) {
                // Copier la quantité dans le champ tonnage du déchet
                dechet.tonnage = quantite;
            }
        });

        return dechet;
        });
    }

    return updatedInfosRaw;
};


// Détermine le rôle d'un prestataire (destinataire ou transporteur) via table_autocompletion
const getPrestaRole = async (
    entrepriseId: number,
    prestaName: string
): Promise<'destinataire' | 'transporteur' | null> => {
    try {
        if (!prestaName) return null;
        const nameNorm = prestaName.toLowerCase().trim();
        const { data, error } = await supabase
            .from('table_autocompletion')
            .select('transporteur, destinataire')
            .eq('entreprise_id', entrepriseId);
        if (error || !data) return null;

        const extractNomBoites = (node: unknown): string[] => {
            const results: string[] = [];
            if (!node) return results;
            if (Array.isArray(node)) {
                for (const item of node) {
                    results.push(...extractNomBoites(item));
                }
            } else if (typeof node === 'object') {
                const obj = node as Record<string, unknown>;
                if (typeof obj.nomBoite === 'string') {
                    results.push(obj.nomBoite);
                }
                // Explorer récursivement au cas où
                for (const v of Object.values(obj)) {
                    results.push(...extractNomBoites(v));
                }
            }
            return results;
        };

        let foundRole: 'destinataire' | 'transporteur' | null = null;
        for (const row of data as Array<{ transporteur: unknown; destinataire: unknown }>) {
            const transNames = extractNomBoites(row.transporteur).map(s => s.toLowerCase().trim());
            if (transNames.includes(nameNorm)) {
                foundRole = 'transporteur';
                break;
            }
            const destNames = extractNomBoites(row.destinataire).map(s => s.toLowerCase().trim());
            if (destNames.includes(nameNorm)) {
                foundRole = 'destinataire';
                break;
            }
        }
        return foundRole;
    } catch {
        return null;
    }
};

export const link_in_bdd = async (
    entrepriseId: number,
    bsdId: string,
    pdfId: string,
    indexDechet: number
) => {
    console.log('[link_in_bdd] inputs', { entrepriseId, bsdId, pdfId, indexDechet });
    // Met à jour la ligne BSD: pdf_infos_id, index_dechet_pdf et ajoute pdfId à pdf_ids s'il n'y est pas
    const { data: existingBsd, error: fetchBsdError } = await supabase
        .from('bsd')
        .select('id, pdf_infos_id, pdf_ids, index_dechet_pdf')
        .eq('id', bsdId)
        .eq('entreprise_id', entrepriseId)
        .single();
    if (fetchBsdError) {
        console.error('[link_in_bdd] fetchBsdError', fetchBsdError);
        throw fetchBsdError;
    }

    const nextPdfIds: string[] = Array.isArray(existingBsd?.pdf_ids) ? existingBsd!.pdf_ids : [];
    if (!nextPdfIds.includes(pdfId)) nextPdfIds.push(pdfId);

    const { error: updateBsdError } = await supabase
        .from('bsd')
        .update({
            pdf_infos_id: pdfId,
            pdf_ids: nextPdfIds,
            index_dechet_pdf: indexDechet
        })
        .eq('id', bsdId)
        .eq('entreprise_id', entrepriseId);
    if (updateBsdError) {
        console.error('[link_in_bdd] updateBsdError', updateBsdError);
        throw updateBsdError;
    }

    // Met à jour pdf_infos: ajoute {bsd_id, index_dechet} dans bsd_linked
    // et ne passe status=linked QUE si tous les déchets sont traités
    const { data: pdfRow, error: fetchPdfError } = await supabase
        .from('pdf_infos')
        .select('id, bsd_linked, infos_raw')
        .eq('id', pdfId)
        .eq('entreprise_id', entrepriseId)
        .single();
    if (fetchPdfError) {
        console.error('[link_in_bdd] fetchPdfError', fetchPdfError);
        throw fetchPdfError;
    }

    const nextBsdLinked: BsdLinkedItem[] = Array.isArray(pdfRow?.bsd_linked) ? pdfRow!.bsd_linked : [];
    // Overwrite any existing entry for this index_dechet
    const filteredLinked = nextBsdLinked.filter(it => it.index_dechet !== indexDechet);
    filteredLinked.push({ bsd_id: bsdId, index_dechet: indexDechet, status: 'linked' });

    // Vérifier si tous les déchets du PDF sont couverts par bsd_linked
    const totalDechets: number = Array.isArray((pdfRow as unknown as { infos_raw?: { dechet?: unknown[] } })?.infos_raw?.dechet)
        ? ((pdfRow as unknown as { infos_raw: { dechet: unknown[] } }).infos_raw.dechet.length)
        : 0;
    const uniqueLinkedCount = new Set(filteredLinked.map(it => it.index_dechet)).size;
    const allDone = totalDechets > 0 && uniqueLinkedCount >= totalDechets;

    const updatePayload: Record<string, unknown> = { bsd_linked: filteredLinked };
    if (allDone) {
        updatePayload.status = 'linked';
    }

    const { error: updatePdfError } = await supabase
        .from('pdf_infos')
        .update(updatePayload)
        .eq('id', pdfId)
        .eq('entreprise_id', entrepriseId);
    if (updatePdfError) {
        console.error('[link_in_bdd] updatePdfError', updatePdfError);
        throw updatePdfError;
    }

    // Invalidate BSD cache for this entreprise
    await invalidateCache(entrepriseId);

    // Push facture si le document est une facture
    try {
        const { data: pdfInfo, error: pdfError } = await getPdfInfoById(pdfId, entrepriseId);
        if (!pdfError && pdfInfo && (pdfInfo.document_type || '').toLowerCase() === 'facture') {
            const { data: mappings, error: mappingError } = await getParamsMappingByEntreprise(entrepriseId);
        if (!mappingError && mappings) {
            const normalized = normalizePdfData(
                pdfInfo.infos_raw || {},
                mappings.params_mapping_site || {},
                mappings.params_mapping_presta || {},
                indexDechet,
                true // preserveCase pour les factures
            );
            const factureJson = buildFactureFromNormalized(
                normalized,
                pdfInfo.infos_raw || {},
                indexDechet,
                mappings
            );
            await push_in_facture_bdd(entrepriseId, pdfId, indexDechet, factureJson);
        }
        }
    } catch (error) {
        console.warn('[link_in_bdd] Erreur lors du push facture:', error);
        // Ne pas faire échouer le lien pour une erreur de facture
    }

    return { ok: true };
};

export const create_in_bdd = async (
    entrepriseId: number,
    pdfId: string,
    indexDechet: number,
    options?: { previewOnly?: boolean; user_id?: string }
) => {
    console.log('[create_in_bdd] inputs', { entrepriseId, pdfId, indexDechet, previewOnly: options?.previewOnly, user_id: options?.user_id });
    if (!options?.user_id) {
        console.warn('[create_in_bdd] user_id manquant');
    }
    // Récupère le PDF et les mappings
    const { data: pdfInfo, error: pdfError } = await getPdfInfoById(pdfId, entrepriseId);
    if (pdfError || !pdfInfo) {
        console.error('[create_in_bdd] getPdfInfoById error', pdfError);
        throw pdfError || new Error('PDF introuvable');
    }
    const { data: mappings, error: mappingError } = await getParamsMappingByEntreprise(entrepriseId);
    if (mappingError || !mappings) {
        console.error('[create_in_bdd] getParamsMappingByEntreprise error', mappingError);
        throw mappingError || new Error('Mappings introuvables');
    }

    // Typage de infos_raw
    type FactureLigne = { unite?: string; quantite?: string; montant_ht?: string; tva_absolute?: string; prix_unitaire?: string; type_operation?: string };
    type DechetItem = {
        ced?: string;
        d_r?: string;
        nom?: string;
        date?: string;
        tour?: string;
        num_bon?: string;
        num_bsd?: string;
        tonnage?: string;
        contenant?: string;
        volume_m3?: string;
        facture?: { ligne?: FactureLigne[] };
    };
    type AddPrestaRaw = { fax?: string; tel?: string; mail?: string; type?: string; adresse?: string; infos_transporteur?: { routier?: string; recepisse?: string; departement?: string; limite_validite?: string } };
    type PdfInfosRaw = { dechet?: DechetItem[]; site_raw?: string; presta_raw?: string; type_doc?: string; num_facture?: string; conformite?: Record<string, unknown>; add_presta_raw?: AddPrestaRaw };

    const infos = (pdfInfo as PdfInfo).infos_raw as unknown as PdfInfosRaw;
    if (!infos || !Array.isArray(infos.dechet) || infos.dechet.length <= indexDechet) {
        throw new Error('Index de déchet invalide');
    }

    const dechet = infos.dechet[indexDechet] as DechetItem;
    const tonnage = parseFloat(String(dechet.tonnage?.replace(',', '.'))) || 0;
    const rawSite: string = infos.site_raw || '';
    const rawPresta: string = infos.presta_raw || '';

    // Traductions
    const siteTranslated = translateByMapping(rawSite, mappings.params_mapping_site || {});
    const prestaTranslated = translateByMapping(rawPresta, mappings.params_mapping_presta || {});

    // Déterminer le rôle du prestataire (destinataire/transporteur) si possible
    const prestaRole = await getPrestaRole(entrepriseId, prestaTranslated.name);

    // Champs normalisés
    const takenOverAt = (dechet.date || '') as string;
    const wasteCode = normalizeNumbers((dechet.ced || '') as string);
    const wasteName = (dechet.nom || '') as string;
    const processingOperationDR = (dechet.d_r || '').toUpperCase();

    const pdf_type_mapping = {"bon":"Bon", "bsd":"BSD", "facture":"Facture"};
    const pdf_type = (infos.type_doc?.toLowerCase().trim() || "bon") as keyof typeof pdf_type_mapping;
    const num_bsd = dechet.num_bsd || "";
    const num_bon = dechet.num_bon || "";
    const line_type = `Ligne de ${pdf_type_mapping[pdf_type]} PDF`;

    // Enrichissements spécifiques PDF BSD calculés en amont
    const capVal = (infos.conformite && typeof (infos.conformite as Record<string, unknown>).CAP === 'string')
        ? (infos.conformite as Record<string, string>).CAP
        : '';
    const add = infos.add_presta_raw;
    const transporterPhone = add?.tel || '';
    const transporterMail = add?.mail || '';
    const transporterAddress = add?.adresse || '';
    const receiptVal = add?.infos_transporteur?.recepisse || '';
    const deptVal = add?.infos_transporteur?.departement || '';
    const validityVal = add?.infos_transporteur?.limite_validite || '';
    const transporterCustomInfo = [
        deptVal ? `dep:${deptVal}` : '',
        validityVal ? `valid:${validityVal}` : ''
    ].filter(Boolean).join(' | ');

    // Construction du payload minimal BSD
    const infos_json = {
        formAPI: {
            createFormInput: {
                emitter: { company: { name: siteTranslated.name, siret: siteTranslated.siret } },
                recipient: { company: { name: prestaRole === 'destinataire' || !prestaRole ? prestaTranslated.name : '', siret: prestaRole === 'destinataire' || !prestaRole ? prestaTranslated.siret : '' }, processingOperation: processingOperationDR, cap: pdf_type === 'bsd' ? capVal : '' },
                transporter: { company: { name: prestaRole === 'transporteur' ? prestaTranslated.name : '', siret: prestaRole === 'transporteur' ? prestaTranslated.siret : '', address: transporterAddress, phone: transporterPhone, mail: transporterMail }, isExemptedOfReceipt: false, receipt: pdf_type === 'bsd' ? receiptVal : '', customInfo: transporterCustomInfo },
                wasteDetails: { code: wasteCode, name: wasteName, quantity: tonnage, quantityType: 'REAL', consistence: 'SOLIDE', 
                    isSubjectToADR: false, onuCode: capVal, packagingInfos: [{ type: 'AUTRE', quantity: 1, other: dechet.contenant || '' }], pop: false, isDangerous: wasteCode.includes('*') },
                takenOverAt: takenOverAt
            }
        }
    };

    // pdf_type/num_bsd/num_bon/line_type déjà définis ci-dessus

    // Helpers (réservé évolutions)

    // other_infos conforme à OtherInfos
    const other_infos: {
        volume: string;
        volumeUnit: string;
        containerDescription: string;
        fillRate: string;
        numeroBon?: string;
        numeroFacture?: string;
        filiere?: string;
        mentionAdr?: string;
        comments?: string;
    } = {
        numeroBon: num_bon || "",
        numeroFacture: infos.num_facture || "",
        volume: dechet.volume_m3 || '',
        volumeUnit: dechet.volume_m3 ? 'm3' : '',
        containerDescription: dechet.contenant || '',
        fillRate: "100",
        mentionAdr: (pdf_type === 'bsd' && typeof (infos.conformite as Record<string, unknown> | undefined)?.ADR === 'string')
            ? (infos.conformite as Record<string, string>).ADR
            : "",
    };

    // Suppression de la logique d'ajout des lignes de facture en commentaire

    // Enrichissements spécifiques PDF BSD gérés dans la construction ci-dessus
    // Création de la ligne BSD
    const insertPayload = {
        entreprise_id: entrepriseId,
        user_id: options?.user_id ?? null,
        created_at: takenOverAt,
        on_track_dechets: false,
        id_track_dechets: line_type,
        status_track_dechets: line_type,
        readable_id_track_dechets: num_bsd || line_type,
        infos_json,
        pdf_infos_id: pdfId,
        pdf_ids: [pdfId],
        index_dechet_pdf: indexDechet,
        other_infos

    };

    // Preview mode: return without writing
    if (options?.previewOnly) {
        console.log('[create_in_bdd] preview payload', insertPayload);
        return { ok: true, preview: insertPayload };
    }

    console.log('[create_in_bdd] inserting payload', { ...insertPayload, infos_json: '[omitted]' });
    const { data: createdBsd, error: insertError } = await supabase
        .from('bsd')
        .insert(insertPayload)
        .select('id')
        .single();
    if (insertError) {
        console.error('[create_in_bdd] insertError', insertError);
        throw insertError;
    }

    const newBsdId: string = createdBsd.id;

    // Mettre à jour le PDF: bsd_linked += {bsd_id, index_dechet}
    // et ne passe status=linked QUE si tous les déchets sont traités
    const { data: existingPdf, error: getPdfErr } = await supabase
        .from('pdf_infos')
        .select('bsd_linked, infos_raw')
        .eq('id', pdfId)
        .eq('entreprise_id', entrepriseId)
        .single();
    if (getPdfErr) throw getPdfErr;

    const nextBsdLinked: BsdLinkedItem[] = Array.isArray(existingPdf?.bsd_linked) ? existingPdf!.bsd_linked : [];
    const filteredLinked = nextBsdLinked.filter(it => it.index_dechet !== indexDechet);
    filteredLinked.push({ bsd_id: newBsdId, index_dechet: indexDechet, status: 'created' });

    const totalDechets: number = Array.isArray((existingPdf as unknown as { infos_raw?: { dechet?: unknown[] } })?.infos_raw?.dechet)
        ? ((existingPdf as unknown as { infos_raw: { dechet: unknown[] } }).infos_raw.dechet.length)
        : 0;
    const uniqueLinkedCount = new Set(filteredLinked.map(it => it.index_dechet)).size;
    const allDone = totalDechets > 0 && uniqueLinkedCount >= totalDechets;

    const updatePayload: Record<string, unknown> = { bsd_linked: filteredLinked };
    if (allDone) {
        updatePayload.status = 'linked';
    }

    const { error: updatePdfError } = await supabase
        .from('pdf_infos')
        .update(updatePayload)
        .eq('id', pdfId)
        .eq('entreprise_id', entrepriseId);
    if (updatePdfError) throw updatePdfError;

    // Invalidate BSD cache for this entreprise
    await invalidateCache(entrepriseId, options?.user_id);

    // Push facture si le document est une facture
    try {
        if ((infos.type_doc || '').toLowerCase() === 'facture') {
            const normalized = normalizePdfData(
                infos,
                mappings.params_mapping_site || {},
                mappings.params_mapping_presta || {},
                indexDechet,
                true // preserveCase pour les factures
            );
            const factureJson = buildFactureFromNormalized(
                normalized,
                infos,
                indexDechet,
                mappings
            );
            await push_in_facture_bdd(entrepriseId, pdfId, indexDechet, factureJson, options?.user_id);
        }
    } catch (error) {
        console.warn('[create_in_bdd] Erreur lors du push facture:', error);
        // Ne pas faire échouer la création pour une erreur de facture
    }

    return { ok: true, bsd_id: newBsdId };
};

export const create_in_bdd_preview = async (
    entrepriseId: number,
    pdfId: string,
    indexDechet: number,
    user_id?: string
) => {
    return await create_in_bdd(entrepriseId, pdfId, indexDechet, { previewOnly: true, user_id });
};


export const handleDeleteLinkMetaDoc = async (pdfId: number, bsdId: string, index_dechet: number, entrepriseId: string|null) => {
    console.log('[handleDeleteLinkMetaDoc] inputs', { pdfId, bsdId, index_dechet, entrepriseId });
    
    //Message pour demander confirmation de suppression
    const confirm = await Swal.fire({
        title: "Supprimer le lien Meta Doc-BSD",
        text: "Voulez-vous vraiment supprimer le lien entre le Meta Doc et le BSD ?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Oui, supprimer !',
        cancelButtonText: 'Annuler'
    });

    if (!confirm.isConfirmed) return;
    
    // Validation entrepriseId et normalisation des types
    const entrepriseIdNum = Number(entrepriseId);
    if (!entrepriseId || Number.isNaN(entrepriseIdNum)) {
        await Swal.fire({
            title: "Entreprise manquante",
            text: "Impossible de supprimer le lien sans identifiant d'entreprise.",
            icon: 'error'
        });
        return;
    }
    
    const pdfIdStr = String(pdfId);
    
    try {
        // 1. Récupérer les données de la table bsd
        const { data: existingBsd, error: fetchBsdError } = await supabase
            .from('bsd')
            .select('id, pdf_infos_id, pdf_ids, index_dechet_pdf')
            .eq('id', bsdId)
            .eq('entreprise_id', entrepriseIdNum)
            .maybeSingle();
            
        if (fetchBsdError) {
            console.error('[handleDeleteLinkMetaDoc] fetchBsdError', fetchBsdError);
            throw fetchBsdError;
        }

        if (!existingBsd) {
            await Swal.fire({
                title: "BSD introuvable",
                text: "Aucune ligne BSD correspondante n'a été trouvée.",
                icon: 'error'
            });
            return;
        }

        // Préparer les mises à jour pour la table bsd
        const updateBsdPayload: Record<string, unknown> = {};
        
        // Si pdf_infos_id == pdfId, supprimer le pdf_infos_id
        if (existingBsd.pdf_infos_id != null && String(existingBsd.pdf_infos_id) === pdfIdStr) {
            updateBsdPayload.pdf_infos_id = null;
        }
        
        // Si pdfId est dans pdf_ids, l'enlever de l'array
        if (Array.isArray(existingBsd.pdf_ids)) {
            const currentPdfIds = (existingBsd.pdf_ids as unknown[]).map(id => String(id));
            if (currentPdfIds.includes(pdfIdStr)) {
                const nextPdfIds = currentPdfIds.filter(id => id !== pdfIdStr);
                updateBsdPayload.pdf_ids = nextPdfIds;
            }
        }
        
        // Si index_dechet == index_dechet_pdf, supprimer l'index_dechet_pdf
        if (existingBsd.index_dechet_pdf === index_dechet) {
            updateBsdPayload.index_dechet_pdf = null;
        }

        // Mettre à jour la table bsd si nécessaire
        if (Object.keys(updateBsdPayload).length > 0) {
            const { error: updateBsdError } = await supabase
                .from('bsd')
                .update(updateBsdPayload)
                .eq('id', bsdId)
                .eq('entreprise_id', entrepriseIdNum);
                
            if (updateBsdError) {
                console.error('[handleDeleteLinkMetaDoc] updateBsdError', updateBsdError);
                throw updateBsdError;
            }
        }

        // 2. Mettre à jour la table pdf_infos
        const { data: existingPdf, error: fetchPdfError } = await supabase
            .from('pdf_infos')
            .select('id, bsd_linked')
            .eq('id', pdfIdStr)
            .eq('entreprise_id', entrepriseIdNum)
            .maybeSingle();
            
        if (fetchPdfError) {
            console.error('[handleDeleteLinkMetaDoc] fetchPdfError', fetchPdfError);
            throw fetchPdfError;
        }

        if (!existingPdf) {
            await Swal.fire({
                title: "PDF introuvable",
                text: "Aucun PDF correspondant n'a été trouvé.",
                icon: 'error'
            });
            return;
        }

        // Filtrer l'item à supprimer de bsd_linked
        const nextBsdLinked: BsdLinkedItem[] = Array.isArray(existingPdf.bsd_linked) 
            ? existingPdf.bsd_linked.filter(item => 
                !(item.bsd_id === bsdId && item.index_dechet === index_dechet)
            )
            : [];

        // Mettre à jour pdf_infos : supprimer l'item de bsd_linked et passer status à 'read'
        const { error: updatePdfError } = await supabase
            .from('pdf_infos')
            .update({
                bsd_linked: nextBsdLinked,
                status: 'read'
            })
            .eq('id', pdfIdStr)
            .eq('entreprise_id', entrepriseIdNum);
            
        if (updatePdfError) {
            console.error('[handleDeleteLinkMetaDoc] updatePdfError', updatePdfError);
            throw updatePdfError;
        }

        console.log('[handleDeleteLinkMetaDoc] success');
        toast.success('Lien Meta Doc-BSD supprimé avec succès');
        return { ok: true };
        
    } catch (error) {
        console.error('[handleDeleteLinkMetaDoc] error', error);
        throw error;
    }
};

const invalidateCache = async (entrepriseId: number, userId?: string): Promise<void> => {
    try {
        const res = await fetch('/api/invalidate_bsd_cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entreprise_id: String(entrepriseId), user_id: userId || '' })
        });
        if (!res.ok) {
            console.warn('[invalidateCache] failed with status', res.status);
        }
    } catch (e) {
        console.warn('[invalidateCache] error', e);
    }
};