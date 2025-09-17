import { BSD } from "@/app/register/TableBSD";
import { Filiere, Site, PointCollecte, SegmentDates as FilterContextSegmentDates } from "../FilterContext";
import { BSDD_TrackDechets, OtherInfos } from "./interface/BSD_Interface";
import { FactureJSON } from "../import_page/FactureImport/ButtonImportFacture";
import { ListStatusEnAttente } from "./RegisterComponents/BordereauxRegister";

// Interface commune pour les BSDs
export interface CommonBSD {
    id: string;
    created_at: string;
    infos_json: {
        formAPI: {
            createFormInput: BSDD_TrackDechets
        }
    };
    other_infos: OtherInfos;
    status_track_dechets: string;
    on_track_dechets: boolean;
    created_on_fleap: boolean;
    readable_id_track_dechets: string;
    facture_treated: boolean;
    facture_infos: FactureJSON;
    id_track_dechets: string;
    [key: string]: unknown;  // Ajout de l'index signature
}

interface SegmentDates {
    debut: Date | string | null;
    fin: Date | string | null;
}

const cleanCED = (ced: string): string => {
    //if(ced === '10 12 01') console.log(ced, "10 12 01");
    return ced.replace(/[^\d]/g,'');
};

const formatCEDs = (ceds: string[]) => {
    return ceds.flatMap(ced => {
        const base = ced.replace('*', '');
        const spaced = base.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
        return [
            base,
            base + '*',
            spaced,
            spaced + '*'
        ];
    });
};

export const filterBSDs = (
    bsds: CommonBSD[],
    filieres: Filiere[],
    sites: Site[],
    points_collecte: PointCollecte[],
    segmentDates: FilterContextSegmentDates,
    mappingTable: { ced?: string, nom?: string, filiere: string }[],
    filterFunctions: ((bsds: CommonBSD[]) => CommonBSD[])[] = [],
    filterPendingBSDs: boolean = false,
    mode: 'ced' | 'nom' = 'ced',
    skipSiteFilter: boolean = false
): CommonBSD[] => {
    let filtered = [...bsds];
    console.log("1. BSDs entrants:", filtered.length);

    // 1. Filtre des dates (uniquement created_at)
    if ((segmentDates.debut || segmentDates.fin) && !filterPendingBSDs) {
        const startDate = segmentDates.debut ? 
            (segmentDates.debut instanceof Date ? 
                segmentDates.debut.setHours(0, 0, 0, 0) : 
                new Date(segmentDates.debut).setHours(0, 0, 0, 0)
            ) : null;
        
        const endDate = segmentDates.fin ? 
            (segmentDates.fin instanceof Date ? 
                segmentDates.fin.setHours(23, 59, 59, 999) : 
                new Date(segmentDates.fin).setHours(23, 59, 59, 999)
            ) : null;

        filtered = filtered.filter(bsd => {
            const createdDate = new Date(bsd.created_at?.replace(' ', 'T') || '').getTime();
            if (startDate && createdDate < startDate) return false;
            if (endDate && createdDate > endDate) return false;
            return true;
        });
        console.log("2. Après filtre dates:", filtered.length);
    }

    // 2. Filtre des filières
    const checkedFilieres = filieres.filter(f => f.checked).map(f => f.name);
    //console.log("Filières cochées:", checkedFilieres);

    if (checkedFilieres.length >= 0) {
        if (mode === 'ced') {
            // Liste de tous les CEDs de toutes les filières
            const allMappedCEDs = new Set(
                formatCEDs(mappingTable.map(m => cleanCED(m.ced || '')))
            );
            // Liste des CEDs des filières sélectionnées
            const selectedFiliereCEDs = new Set(
                formatCEDs(
                    mappingTable
                        .filter(m => checkedFilieres.filter(f => f !== 'Autres').includes(m.filiere))
                        .map(m => cleanCED(m.ced || ''))
                )
            );
            const hasAutres = checkedFilieres.includes('Autres');
            filtered = filtered.filter(bsd => {
                const wasteCode = bsd.infos_json.formAPI.createFormInput.wasteDetails.code;
                const cleanedWasteCode = cleanCED(wasteCode);
                const formattedWasteCodes = formatCEDs([cleanedWasteCode]);
                if (hasAutres && checkedFilieres.length === 1) {
                    return !formattedWasteCodes.some(code => allMappedCEDs.has(code));
                } else if (hasAutres) {
                    return formattedWasteCodes.some(code => selectedFiliereCEDs.has(code)) || 
                           !formattedWasteCodes.some(code => allMappedCEDs.has(code));
                } else {
                    return formattedWasteCodes.some(code => selectedFiliereCEDs.has(code));
                }
            });
        } else if (mode === 'nom') {
            // Liste de tous les noms de toutes les filières
            const allMappedNames = new Set(
                mappingTable.map(m => (m.nom || '').trim())
            );
            // Liste des noms des filières sélectionnées
            const selectedFiliereNames = new Set(
                mappingTable
                    .filter(m => checkedFilieres.filter(f => f !== 'Autres').includes(m.filiere))
                    .map(m => (m.nom || '').trim())
            );
            const hasAutres = checkedFilieres.includes('Autres');
            filtered = filtered.filter(bsd => {
                const wasteName = (bsd.infos_json.formAPI.createFormInput.wasteDetails.name || '').trim();
                // Si uniquement "Autres" est sélectionné
                if (hasAutres && checkedFilieres.length === 1) {
                    return !allMappedNames.has(wasteName);
                } else if (hasAutres) {
                    return selectedFiliereNames.has(wasteName) || !allMappedNames.has(wasteName);
                } else {
                    return selectedFiliereNames.has(wasteName);
                }
            });
        }
        console.log("3. Après filtre filières:", filtered.length);
    }

    // 3. Filtre des sites (optionnel si skipSiteFilter)
    if (!skipSiteFilter) {
        const checkedSites = sites.filter(site => site.checked).map(site => site.orgId);
        //console.log("Sites cochés:", checkedSites);
        if (checkedSites.length === 0) {
            // Si aucun site n'est coché, considérer que tous les sites sont sélectionnés par défaut
            return filtered;
        }
        if (checkedSites.length >= 0) {
            filtered = filtered.filter(bsd => {
                const emitterSiret = bsd.infos_json.formAPI.createFormInput.emitter?.company?.siret;
                if (checkedSites.includes('----')) {
                    return !emitterSiret || emitterSiret === '' || checkedSites.includes(emitterSiret);
                }
                return checkedSites.includes(emitterSiret);
            });
            console.log("4. Après filtre sites:", filtered.length);
        }
    }

    // 5. Appliquer les filtres personnalisés
    for (const filterFunction of filterFunctions) {
        filtered = filterFunction(filtered);
    }
    console.log("5. Après filtres personnalisés - commenté pour l'instant:", filtered.length);

    // 6. Filtrer les BSDs en attente si nécessaire
    if (filterPendingBSDs) {
        filtered = filtered.filter(bsd => {
            return ListStatusEnAttente.includes(bsd.status_track_dechets);
        });
        //console.log("6. Après filtre BSDs en attente:", filtered.length);
    }

    // Maintenir l'ordre par created_at décroissant
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return filtered;
};