import { NextResponse } from 'next/server';
import { supabase } from '@/app/database/supabaseClient';
import { classifyTreatmentCode } from '@/app/component/Analyse/Environnementale/codeTraitement';

type TypeParam = 'bsd' | 'facture' | 'pdf';

interface MappingCedFiliere { ced: string; filiere: string }
interface MappingNomFiliere { nom: string; filiere: string; trie?: boolean }

interface FlatBsdRow {
    emitterSiret: string | null;
    emitterName: string | null;
    recipientSiret: string | null;
    recipientName: string | null;
    processingOperation: string | null;
    transporterSiret: string | null;
    transporterName: string | null;
    wasteName: string | null;
    wasteCode: string | null;
    takenOverAt: string | null;
    created_at: string;
    containerDescription: string | null;
    quantityReceived: string | number | null;
    fillRate?: string | number | null;
    sentToRep?: string | boolean | null;
    triFlag?: string | boolean | null;
    statusTrackDechets?: string | null;
    onTrackDechets?: boolean | null;
    createdOnFleap?: boolean | null;
}

interface Denominators {
    unique_site: Array<{ siret: string; name: string }>;
    unique_exutoire: Array<{ siret: string; name: string }>;
    unique_transport: Array<{ siret: string; name: string }>;
    unique_filiere: string[];
    unique_mois_annee: string[];
    unique_contenant: string[];
    unique_code_dr: string[];
    unique_valorisation?: string[];
    unique_tri?: string[];
    unique_rep?: string[];
    unique_source?: string[];
}

interface GroupedDataItem {
    site: string;
    exutoire: string;
    transport: string;
    filiere: string;
    tonnage: number;
    nbr_ligne: number;
    mois_annee: string;
    contenant: string;
    code_dr: string;
    valorisation: string;
    tri: string;
    rep: string;
    remplissage: number;
    source: string;
}

function normalizeCed(code: string): string {
    return code.replace(/\s+/g, '').replace('*', '').trim();
}

function getFiliereFromMappings(
    wasteName: string | null,
    wasteCode: string | null,
    mappingCed: MappingCedFiliere[],
    mappingNom: MappingNomFiliere[]
): string {
    // Try name mapping first
    if (wasteName) {
        const byName = mappingNom.find(m => m.nom === wasteName);
        if (byName) return byName.filiere;
    }
    // Fallback to CED mapping
    if (wasteCode) {
        const cleaned = normalizeCed(wasteCode);
        const byCed = mappingCed.find(m => normalizeCed(m.ced) === cleaned);
        if (byCed) return byCed.filiere;
    }
    return 'Autres';
}

function toYearMonth(dateStr: string): string {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getUTCFullYear();
    const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    return `${y}-${m}`;
}

function parseTonnage(qty: string | number | null): number {
    if (!qty) return 0;
    const n = typeof qty === 'number' ? qty : Number(String(qty).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const entreprise_id = searchParams.get('entreprise_id');
    const sitesParam = searchParams.get('sites'); // Paramètre pour plusieurs sites (séparés par des virgules)
    const type = (searchParams.get('type') as TypeParam | null) || 'bsd';

    if (!entreprise_id) {
        return NextResponse.json({ error: 'entreprise_id is required' }, { status: 400 });
    }

    if (type !== 'bsd') {
        return NextResponse.json({ error: 'Type not implemented yet' }, { status: 501 });
    }

    // Parser les sites (séparés par des virgules)
    const sites = sitesParam ? sitesParam.split(',').map(s => s.trim()).filter(Boolean) : [];

    try {
        // Load mappings for filière resolution
        const { data: mappingRow, error: mappingError } = await supabase
            .from('entreprise')
            .select('mapping_ced_filiere, mapping_nom_filiere')
            .eq('id', entreprise_id)
            .single();

        if (mappingError) throw mappingError;

        const mappingCed: MappingCedFiliere[] = (mappingRow?.mapping_ced_filiere || []) as MappingCedFiliere[];
        const mappingNom: MappingNomFiliere[] = (mappingRow?.mapping_nom_filiere || []) as MappingNomFiliere[];

        type SelectedRow = {
            created_at: string;
            status_track_dechets?: string;
            on_track_dechets?: boolean;
            created_on_fleap?: boolean;
            emitter?: { company?: { siret?: string; name?: string } };
            recipient?: { processingOperation?: string; company?: { siret?: string; name?: string } };
            transporter?: { company?: { siret?: string; name?: string } };
            wasteDetails?: { name?: string; code?: string; quantity?: string | number };
            takenOverAt?: string;
            quantityReceived?: string | number;
            containerDescription?: string;
            fillRate?: string | number;
            sent_to_rep?: string | boolean;
            tri?: string | boolean;
            [key: string]: unknown;
        };

        // Fetch BSDs with pagination and site filtering
        const pageSize = 1000;
        let allData: unknown[] = [];
        let hasMore = true;
        let page = 0;

        while (hasMore) {
            let query = supabase
                .from('bsd')
                .select(`
                    created_at,
                    status_track_dechets,
                    on_track_dechets,
                    created_on_fleap,
                    infos_json->formAPI->createFormInput->emitter,
                    infos_json->formAPI->createFormInput->recipient,
                    infos_json->formAPI->createFormInput->transporter,
                    infos_json->formAPI->createFormInput->wasteDetails,
                    infos_json->formAPI->createFormInput->>takenOverAt,
                    infos_json->formAPI->createFormInput->>quantityReceived,
                    other_infos->>containerDescription,
                    other_infos->>fillRate,
                    other_infos->rep->>sent_to_rep,
                    other_infos->>tri
                `, { count: 'exact' })
                .eq('entreprise_id', entreprise_id)
                .range(page * pageSize, (page + 1) * pageSize - 1);

            // Ajouter le filtre par sites si fournis
            if (sites.length > 0) {
                query = query.in('infos_json->formAPI->createFormInput->emitter->company->siret', sites);
            }

            const { data, error, count } = await query;

            if (error) throw error;

            if (data && data.length > 0) {
                allData = [...allData, ...data];
                hasMore = count ? allData.length < count : false;
                page++;
            } else {
                hasMore = false;
            }
        }

        const data = allData;

        // Build arrays and maps for majority names
        const siteNameCounts: Record<string, Record<string, number>> = {};
        const exutoireNameCounts: Record<string, Record<string, number>> = {};
        const transportNameCounts: Record<string, Record<string, number>> = {};


        const rows: FlatBsdRow[] = (data as unknown as SelectedRow[]).map((row) => {
            const emitterCompany = row.emitter?.company || {};
            const recipientCompany = row.recipient?.company || {};
            const transporterCompany = row.transporter?.company || {};
            const waste = row.wasteDetails || {};

            const r: FlatBsdRow = {
                emitterSiret: emitterCompany.siret ?? null,
                emitterName: emitterCompany.name ?? null,
                recipientSiret: recipientCompany.siret ?? null,
                recipientName: recipientCompany.name ?? null,
                processingOperation: row.recipient?.processingOperation ?? null,
                transporterSiret: transporterCompany.siret ?? null,
                transporterName: transporterCompany.name ?? null,
                wasteName: waste.name ?? null,
                wasteCode: waste.code ?? null,
                takenOverAt: (row as unknown as Record<string, unknown>)["infos_json->formAPI->createFormInput->>takenOverAt"] as string | undefined ?? row.takenOverAt ?? null,
                created_at: row.created_at,
                containerDescription: (row as unknown as Record<string, unknown>)["other_infos->>containerDescription"] as string | undefined ?? row.containerDescription ?? null,
                quantityReceived:
                    (row as unknown as Record<string, unknown>)["infos_json->formAPI->createFormInput->>quantityReceived"] as string | number | undefined
                    ?? row.quantityReceived
                    ?? (waste.quantity as string | number | undefined)
                    ?? null,
                fillRate: (row as unknown as Record<string, unknown>)["other_infos->>fillRate"] as string | number | undefined ?? row.fillRate ?? null,
                sentToRep: (row as unknown as Record<string, unknown>)["other_infos->rep->>sent_to_rep"] as string | boolean | undefined ?? row.sent_to_rep ?? null,
                triFlag: (row as unknown as Record<string, unknown>)["other_infos->>tri"] as string | boolean | undefined ?? row.tri ?? null,
                statusTrackDechets: (row as unknown as Record<string, unknown>)["status_track_dechets"] as string | undefined ?? row.status_track_dechets ?? null,
                onTrackDechets: (row as unknown as Record<string, unknown>)["on_track_dechets"] as boolean | undefined ?? row.on_track_dechets ?? null,
                createdOnFleap: (row as unknown as Record<string, unknown>)["created_on_fleap"] as boolean | undefined ?? row.created_on_fleap ?? null,
            };

            // Count names per siret for majority title computation
            if (r.emitterSiret) {
                siteNameCounts[r.emitterSiret] ||= {};
                const key = r.emitterName || '';
                siteNameCounts[r.emitterSiret][key] = (siteNameCounts[r.emitterSiret][key] || 0) + 1;
            }
            if (r.recipientSiret) {
                exutoireNameCounts[r.recipientSiret] ||= {};
                const key = r.recipientName || '';
                exutoireNameCounts[r.recipientSiret][key] = (exutoireNameCounts[r.recipientSiret][key] || 0) + 1;
            }
            if (r.transporterSiret) {
                transportNameCounts[r.transporterSiret] ||= {};
                const key = r.transporterName || '';
                transportNameCounts[r.transporterSiret][key] = (transportNameCounts[r.transporterSiret][key] || 0) + 1;
            }

            return r;
        });

        const pickMajorName = (counts: Record<string, Record<string, number>>, siret: string): string => {
            const nameCounts = counts[siret] || {};
            let bestName = '';
            let bestCount = -1;
            Object.entries(nameCounts).forEach(([name, count]) => {
                if (count > bestCount && name.trim().length > 0) {
                    bestCount = count;
                    bestName = name;
                }
            });
            return bestName || '';
        };

        // Group rows by denominators
        const groupMap: Record<string, { tonnage: number; count: number; sample: FlatBsdRow; filiere: string; mois_annee: string; contenant: string; code_dr: string; valorisation: string; tri: string; rep: string; sumFill: number; numFill: number; source: string }> = {};
        const uniqueFiliereSet = new Set<string>();
        const uniqueMoisSet = new Set<string>();
        const uniqueContenantSet = new Set<string>();
        const uniqueCodeDrSet = new Set<string>();
        const uniqueSiteSet = new Set<string>();
        const uniqueExutoireSet = new Set<string>();
        const uniqueTransportSet = new Set<string>();
        const uniqueValorisationSet = new Set<string>();
        const uniqueTriSet = new Set<string>();
        const uniqueRepSet = new Set<string>();
        const uniqueSourceSet = new Set<string>();

        for (const r of rows) {
            const mois = r.takenOverAt ? toYearMonth(r.takenOverAt) : toYearMonth(r.created_at);
            const filiere = getFiliereFromMappings(r.wasteName, r.wasteCode, mappingCed, mappingNom);
            const contenant = r.containerDescription ? r.containerDescription : '';
            const codeDr = r.processingOperation ? r.processingOperation : '';
            const valorisationCatKey = classifyTreatmentCode(codeDr || '')
                .replace('energetique','Valorisation énergétique')
                .replace('matiere','Valorisation matière')
                .replace('reemploi','Réemploi')
                .replace('reutilisation','Réutilisation')
                .replace('elimination','Élimination')
                .replace('autre','Autre');

            type MappingCedFiliereExtra = MappingCedFiliere & { multiflux?: boolean; tri?: boolean };
            const codeClean = r.wasteCode ? normalizeCed(r.wasteCode) : '';
            const cedEntry = (mappingCed as MappingCedFiliereExtra[]).find(m => normalizeCed(m.ced) === codeClean);
            const mappingMultiflux = cedEntry?.multiflux;
            const mappingTri = cedEntry?.tri;
            const isMixed = (r.wasteName ? r.wasteName : '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes('melang');
            const triLabel = ((): string => {
                if (mappingMultiflux === false) return 'Tri';
                if (mappingTri === true) return 'Tri';
                if (typeof r.triFlag === 'boolean') return r.triFlag ? 'Tri' : 'Non tri';
                if (typeof r.triFlag === 'string') return r.triFlag.toLowerCase() === 'true' ? 'Tri' : 'Non tri';
                if (isMixed) return 'Tri';
                return 'Non tri';
            })();

            const repLabel = ((): string => {
                const raw = r.sentToRep;
                if (typeof raw === 'boolean') return raw ? 'Oui' : 'Non';
                if (typeof raw === 'string') return raw.toLowerCase() === 'true' ? 'Oui' : 'Non';
                return 'Non';
            })();

            const sourceLabel = ((): string => {
                const status = r.statusTrackDechets ?? null;
                const onTrack = r.onTrackDechets ?? null;
                const onFleap = r.createdOnFleap ?? null;
                if (status === 'IMPORTED') return 'Importés';
                if (status && status.startsWith('Ligne de') && status.includes('PDF')) return 'PDF';
                if (onTrack === true) return 'TrackDéchets';
                if (onFleap === true) return 'Demande de collecte FLEAP';
                return 'Autre';
            })();

            const key = [r.emitterSiret || '', r.transporterSiret || '', r.recipientSiret || '', filiere, mois, contenant, codeDr, valorisationCatKey, triLabel, repLabel, sourceLabel].join('|');

            if (!groupMap[key]) {
                groupMap[key] = {
                    tonnage: 0,
                    count: 0,
                    sample: r,
                    filiere,
                    mois_annee: mois,
                    contenant,
                    code_dr: codeDr,
                    valorisation: valorisationCatKey,
                    tri: triLabel,
                    rep: repLabel,
                    sumFill: 0,
                    numFill: 0,
                    source: sourceLabel,
                };
            }

            groupMap[key].tonnage += parseTonnage(r.quantityReceived);
            groupMap[key].count += 1;
            if (r.fillRate !== undefined && r.fillRate !== null) {
                const parsed = typeof r.fillRate === 'number' ? r.fillRate : Number(String(r.fillRate).replace('%','').replace(',', '.'));
                if (Number.isFinite(parsed)) {
                    // Normalize to 0-100
                    const val = parsed <= 1 ? parsed * 100 : parsed;
                    groupMap[key].sumFill += Math.max(0, Math.min(100, val));
                    groupMap[key].numFill += 1;
                }
            }

            uniqueFiliereSet.add(filiere);
            if (mois) uniqueMoisSet.add(mois);
            if (contenant) uniqueContenantSet.add(contenant);
            if (codeDr) uniqueCodeDrSet.add(codeDr);
            if (r.emitterSiret) uniqueSiteSet.add(r.emitterSiret);
            if (r.recipientSiret) uniqueExutoireSet.add(r.recipientSiret);
            if (r.transporterSiret) uniqueTransportSet.add(r.transporterSiret);
            uniqueValorisationSet.add(valorisationCatKey);
            uniqueTriSet.add(triLabel);
            uniqueRepSet.add(repLabel);
            uniqueSourceSet.add(sourceLabel);
        }

        const dataOut: GroupedDataItem[] = Object.values(groupMap).map((g) => {
            const siretSite = g.sample.emitterSiret || '';
            const siretExutoire = g.sample.recipientSiret || '';
            const siretTransport = g.sample.transporterSiret || '';
            return {
                site: pickMajorName(siteNameCounts, siretSite) || siretSite,
                exutoire: pickMajorName(exutoireNameCounts, siretExutoire) || siretExutoire,
                transport: pickMajorName(transportNameCounts, siretTransport) || siretTransport,
                filiere: g.filiere,
                tonnage: Number(g.tonnage.toFixed(3)),
                nbr_ligne: g.count,
                mois_annee: g.mois_annee,
                contenant: g.contenant,
                code_dr: g.code_dr,
                valorisation: g.valorisation,
                tri: g.tri,
                rep: g.rep,
                remplissage: g.numFill > 0 ? Number((g.sumFill / g.numFill).toFixed(1)) : 0,
                source: g.source,
            };
        });

        const denominators: Denominators = {
            unique_site: Array.from(uniqueSiteSet).map((siret) => ({ siret, name: pickMajorName(siteNameCounts, siret) })),
            unique_exutoire: Array.from(uniqueExutoireSet).map((siret) => ({ siret, name: pickMajorName(exutoireNameCounts, siret) })),
            unique_transport: Array.from(uniqueTransportSet).map((siret) => ({ siret, name: pickMajorName(transportNameCounts, siret) })),
            unique_filiere: Array.from(uniqueFiliereSet),
            unique_mois_annee: Array.from(uniqueMoisSet).sort(),
            unique_contenant: Array.from(uniqueContenantSet),
            unique_code_dr: Array.from(uniqueCodeDrSet),
            unique_valorisation: Array.from(uniqueValorisationSet),
            unique_tri: Array.from(uniqueTriSet),
            unique_rep: Array.from(uniqueRepSet),
            unique_source: Array.from(uniqueSourceSet),
        };

        return NextResponse.json({ denominateur: denominators, data: dataOut });
    } catch (e) {
        console.error('Error get_data_for_analysis:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

