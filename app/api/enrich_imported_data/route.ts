import { NextResponse } from 'next/server';
import { supabase } from '@/app/database/supabaseClient';
import { Anything, DataOnSupabase_infos_json, DataParametrageInterface } from '@/app/register/interface/BSD_Interface';

interface BSDRow {
    id: string;
    infos_json: DataOnSupabase_infos_json;
}

interface EmitterType {
    company: {
        mail: Anything;
        name: Anything;
        phone: Anything;
        siret: Anything;
        address: Anything;
        contact: Anything;
    };
    workSite: {
        address: Anything;
        postalCode: Anything;
        city: Anything;
    };
}

interface RecipientType {
    company: {
        mail: Anything;
        name: Anything;
        phone: Anything;
        siret: Anything;
        address: Anything;
        contact: Anything;
    };
    cap: Anything;
    processingOperation: Anything;
}

interface TransporterType {
    company: {
        mail: Anything;
        name: Anything;
        phone: Anything;
        siret: Anything;
        address: Anything;
        contact: Anything;
    };
}

interface WasteDetailsType {
    code: Anything;
    name: Anything;
    onuCode: Anything;
    consistence: Anything;
    packagingInfos: {
        type: Anything;
        quantity: Anything;
    }[];
}

interface DataParametrageInterfaceWithJsonRow extends DataParametrageInterface {
    json_row: DataParametrageInterface;
}

const findBestMatch = (bsd: BSDRow, paramData: DataParametrageInterfaceWithJsonRow[]) => {
    const wasteCode = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.code;
    const emitterSiret = bsd.infos_json?.formAPI?.createFormInput?.emitter?.company?.siret;
    const recipientSiret = bsd.infos_json?.formAPI?.createFormInput?.recipient?.company?.siret;

    // Filtrer d'abord par code déchet (critère obligatoire)
    let matches = paramData.filter((param: DataParametrageInterfaceWithJsonRow) => 
        param.json_row.ced === wasteCode
    );

    // Affiner avec d'autres critères si possible
    if (matches.length > 1 && emitterSiret) {
        const emitterMatches = matches.filter(param => 
            param.json_row.site_siret?.toString() === emitterSiret.toString()
        );
        if (emitterMatches.length > 0) matches = emitterMatches;
    }

    if (matches.length > 1 && recipientSiret) {
        const recipientMatches = matches.filter(param => 
            param.json_row.prestataire_final_siret?.toString() === recipientSiret.toString()
        );
        if (recipientMatches.length > 0) matches = recipientMatches;
    }

    return matches[0];
};

const mergeEmitter = (existing: EmitterType, param: DataParametrageInterface) => {
    return {
        ...existing,
        company: {
            ...existing.company,
            mail: existing.company.mail || param.producteur_personne_email,
            name: existing.company.name || param.producteur_nom,
            phone: existing.company.phone || param.producteur_personne_tel,
            siret: existing.company.siret || param.site_siret,
            address: existing.company.address || param.site_adresse,
            contact: existing.company.contact || 
                `${param.producteur_personne_firstname} ${param.producteur_personne_lastname}`.trim()
        },
        workSite: existing.workSite || {
            address: param.site_adresse?.split(/\s\d{5}\s/)[0] || '',
            postalCode: (param.site_adresse?.match(/\d{5}/) || [''])[0],
            city: param.site_adresse?.split(/\d{5}\s/).pop() || ''
        }
    };
};

const mergeRecipient = (existing: RecipientType, param: DataParametrageInterface) => {
    return {
        ...existing,
        company: {
            ...existing.company,
            mail: existing.company.mail || param.prestataire_final_personne_email,
            name: existing.company.name || param.prestataire_final_nom,
            phone: existing.company.phone || param.prestataire_final_personne_tel,
            siret: existing.company.siret || param.prestataire_final_siret,
            address: existing.company.address || param.prestataire_final_adresse,
            contact: existing.company.contact || 
                `${param.prestataire_final_personne_firstname} ${param.prestataire_final_personne_lastname}`.trim()
        },
        cap: existing.cap || param.cap,
        processingOperation: existing.processingOperation || param.prestataire_final_code_traitement
    };
};

const mergeTransporter = (existing: TransporterType, param: DataParametrageInterface) => {
    return {
        ...existing,
        company: {
            ...existing.company,
            mail: existing.company.mail || param.transporteur_personne_email,
            name: existing.company.name || param.transporteur_nom,
            phone: existing.company.phone || param.transporteur_personne_tel,
            siret: existing.company.siret || param.transporteur_siret,
            address: existing.company.address || param.transporteur_adresse,
            contact: existing.company.contact || 
                `${param.transporteur_personne_firstname} ${param.transporteur_personne_lastname}`.trim()
        }
    };
};

const mergeWasteDetails = (existing: WasteDetailsType, param: DataParametrageInterface) => {
    return {
        ...existing,
        code: existing.code || param.ced,
        name: existing.name || param.description_ced,
        onuCode: existing.onuCode || (param.onu ? `UN ${param.onu}` : undefined),
        consistence: existing.consistence || param.consistance,
        packagingInfos: existing.packagingInfos?.[0]?.type ? existing.packagingInfos : [{
            type: param.contenant_code,
            quantity: param.contenant_nombre_indicatif
        }]
    };
};

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const user_id = searchParams.get('user_id');

        if (!user_id) {
            return NextResponse.json({ 
                success: false, 
                message: "user_id manquant" 
            });
        }

        const { data: bsdData, error: bsdError } = await supabase
            .from('bsd')
            .select('*')
            .eq('user_id', user_id);

        if (bsdError) throw new Error("Erreur lors de la récupération des BSDs");

        const { data: paramData, error: paramError } = await supabase
            .from('table_parametrage')
            .select('*')
            .eq('user_id', user_id);

        if (paramError) throw new Error("Erreur lors de la récupération des données de paramétrage");

        const enrichedBSDs = bsdData.map((bsd: BSDRow) => {
            const matchingParam: {json_row: DataParametrageInterface} = findBestMatch(bsd, paramData);
            if (!matchingParam) return bsd;

            const enrichedBSD = {
                ...bsd,
                infos_json: {
                    formAPI: {
                        createFormInput: {
                            ...bsd.infos_json.formAPI.createFormInput,
                            emitter: mergeEmitter(
                                bsd.infos_json.formAPI.createFormInput.emitter,
                                matchingParam.json_row
                            ),
                            recipient: mergeRecipient(
                                bsd.infos_json.formAPI.createFormInput.recipient,
                                matchingParam.json_row
                            ),
                            transporter: mergeTransporter(
                                bsd.infos_json.formAPI.createFormInput.transporter,
                                matchingParam.json_row
                            ),
                            wasteDetails: mergeWasteDetails(
                                bsd.infos_json.formAPI.createFormInput.wasteDetails,
                                matchingParam.json_row
                            )
                        }
                    },
                    dataSupplementaire: {
                        ...bsd.infos_json.dataSupplementaire,
                        site: bsd.infos_json.dataSupplementaire?.site || matchingParam.json_row.site_nom,
                        filiere: bsd.infos_json.dataSupplementaire?.filiere || matchingParam.json_row.filiere_nom,
                        description: bsd.infos_json.dataSupplementaire?.description || matchingParam.json_row.contenant_description,
                        unitVolume: bsd.infos_json.dataSupplementaire?.unitVolume || matchingParam.json_row.contenant_volume_unitaire
                    }
                }
            };

            return enrichedBSD;
        });

        // Mettre à jour les BSDs enrichis
        for (const bsd of enrichedBSDs) {
            const { error: updateError } = await supabase
                .from('bsd')
                .update({ infos_json: bsd.infos_json })
                .eq('id', bsd.id);

            if (updateError) {
                console.error(`Erreur lors de la mise à jour du BSD ${bsd.id}:`, updateError);
            }
        }

        return NextResponse.json({ 
            success: true, 
            message: "BSDs enrichis avec succès",
            data: enrichedBSDs
        });

    } catch (error) {
        console.error("Erreur lors de l'enrichissement des données:", error);
        return NextResponse.json({ 
            success: false, 
            message: "Erreur lors de l'enrichissement des données",
            error: error instanceof Error ? error.message : 'Une erreur inconnue est survenue'
        });
    }
}
