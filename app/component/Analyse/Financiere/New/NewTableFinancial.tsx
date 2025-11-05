'use client'
import { Facture } from '../types';
import { useEffect, useState } from 'react';
import { getMappingTableFiliere } from "@/app/register/RegisterComponents/Modal/FormulaireFull/utils_new";
import { useFilterContext } from '@/app/FilterContext';
import { MAIN_OPERATIONS, EXPANDED_OPERATIONS } from '@/app/interface_admin_2/InterfaceAdmin2/constants/formConstants';
import { formatNumber } from '@/app/utils/formatNumber';
import { useAnalysis } from '@/app/analysis/AnalysisProvider';
import { isRevenue } from './NewFinancialSource';

interface Props {
    factures: Facture[];
    entreprise_id: string;
    params_mapping_operation: Record<string, string[]> | null;
}

interface OperationSums {
    [key: string]: number;
    preparation: number;
    transport: number;
    traitement: number;
    gestion_globale: number;
    tgap: number;
    declassement: number;
    penalites: number;
    rachat: number;
    location: number;
    maintenance: number;
    mise_a_disposition: number;
    autres_contenant: number;
    non_expliques: number;
    autres: number;
    total: number;
}

interface FiliereData {
    [filiere: string]: OperationSums;
}

    // Fonction pour normaliser les types d'opérations
    const normalizeOperationType = (type: string): string => {
        // Convertir en minuscules et remplacer les espaces par des underscores
        const normalized = type.toLowerCase().replace(/ /g, '_');
        
        // Gérer les cas spécifiques mentionnés
        if (normalized === 'gestion_global') return 'gestion_globale';
        if (normalized === 'préparation') return 'preparation';
        if (normalized === 'non_expliqués') return 'non_expliques';
        if (normalized.includes('contenant')) return 'autres_contenant';
        
        // Supprimer les accents pour d'autres cas potentiels
        return normalized
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    };

const NewTableFinancial = ({ factures, entreprise_id, params_mapping_operation }: Props) => {
    const [mappingTable, setMappingTable] = useState<{ ced: string, filiere: string }[]>([]);
    const [mappingNomFiliere, setMappingNomFiliere] = useState<{ nom: string; filiere: string }[]>([]);
    const { filieres } = useFilterContext();
    const { filieres_ou_prestataires } = useAnalysis();

    useEffect(() => {
        const fetchMappingTable = async () => {
            const mapping = await getMappingTableFiliere(entreprise_id);
            setMappingTable(mapping || []);
        };
        fetchMappingTable();
    }, [entreprise_id]);

    useEffect(() => {
        const fetchMappingNom = async () => {
            try {
                const res = await fetch(`/api/get_mapping_nom_filiere?entreprise_id=${entreprise_id}`);
                if (res.ok) {
                    const data = await res.json();
                    setMappingNomFiliere((data?.data || data) as { nom: string; filiere: string }[]);
                }
            } catch (e) {
                console.error('Error fetching mapping_nom_filiere', e);
            }
        };
        fetchMappingNom();
    }, [entreprise_id]);

    const filiereData = factures.reduce((acc: FiliereData, facture) => {
        facture.infos_json.departs.forEach(depart => {
            let filiere = 'Autres';
            if (filieres_ou_prestataires.nom === 'filiere_nom') {
                const wasteName = depart.line_header?.dechet_description || depart.line_header?.type_dechet;
                if (wasteName) {
                    const mappingEntry = mappingNomFiliere.find((item: { nom?: string; filiere: string }) => item.nom === wasteName);
                    filiere = mappingEntry?.filiere || 'Autres';
                }
            } else {
                const cleanedCed = depart.line_header.code_dechet.replaceAll(' ', '').replace('*', '');
                filiere = mappingTable.find(m => m.ced.replace(' ', '').replace('*', '') === cleanedCed)?.filiere || 'Autres';
            }
            
            if (!acc[filiere]) {
                acc[filiere] = {
                    preparation: 0,
                    transport: 0,
                    traitement: 0,
                    gestion_globale: 0,
                    tgap: 0,
                    declassement: 0,
                    penalites: 0,
                    rachat: 0,
                    location: 0,
                    maintenance: 0,
                    mise_a_disposition: 0,
                    autres_contenant: 0,
                    non_expliques: 0,
                    autres: 0,
                    total: 0
                };
            }

            // Traiter chaque ligne du body individuellement
            depart.line_body.forEach(line => {
                const montant = Math.abs(line.montant_ht);
                
                // Vérifier si c'est un revenu
                if (isRevenue(line, params_mapping_operation)) {
                    acc[filiere].rachat += montant;
                } else {
                    const type = normalizeOperationType(line.type_operation);
                    
                    // Si c'est un type d'opération connu
                    if (type in acc[filiere]) {
                        acc[filiere][type] += montant;
                    } else {
                        //console.log('Type inconnu:', type, 'Original:', line.type_operation);
                        // Si type inconnu, mettre dans "autres"
                        acc[filiere].autres += montant;
                    }
                }
            });

            // Calculer le total pour cette filière
            acc[filiere].total = Object.entries(acc[filiere])
                .filter(([key]) => key !== 'total') // Exclure le total lui-même
                .reduce((sum, [key, value]) => {
                    // Les rachats sont comptés négativement dans le total
                    if (key === 'rachat') {
                        return sum - Math.abs(value);
                    }
                    return sum + value;
                }, 0);
        });

        return acc;
    }, {});

    // Calcul des totaux pour toutes les filières
    const totals = Object.values(filiereData).reduce((acc, data) => {
        return {
            preparation: acc.preparation + data.preparation,
            transport: acc.transport + data.transport,
            traitement: acc.traitement + data.traitement,
            gestion_globale: acc.gestion_globale + data.gestion_globale,
            tgap: acc.tgap + data.tgap,
            declassement: acc.declassement + data.declassement,
            penalites: acc.penalites + data.penalites,
            rachat: acc.rachat + data.rachat,
            location: acc.location + data.location,
            maintenance: acc.maintenance + data.maintenance,
            mise_a_disposition: acc.mise_a_disposition + data.mise_a_disposition,
            autres_contenant: acc.autres_contenant + data.autres_contenant,
            non_expliques: acc.non_expliques + data.non_expliques,
            autres: acc.autres + data.autres,
            total: acc.total + data.total
        };
    }, {
        preparation: 0, transport: 0, traitement: 0, gestion_globale: 0,
        tgap: 0, declassement: 0, penalites: 0, rachat: 0, location: 0,
        maintenance: 0, mise_a_disposition: 0, autres_contenant: 0,
        non_expliques: 0, autres: 0, total: 0
    });

    // Fonction pour déterminer si une colonne doit être affichée
    const shouldShowColumn = (operationKey: string) => {
        return Object.values(filiereData).some(data => data[operationKey] !== 0);
    };

    // Liste des opérations à afficher
    const operationsToShow = [...MAIN_OPERATIONS, ...EXPANDED_OPERATIONS]
        .map(op => normalizeOperationType(op))
        .filter(op => shouldShowColumn(op));

    return (
        <div className="flex-1 p-4 bg-white rounded-lg">
            <div className="text-gray-500 text-xs mb-2">
                Détails financiers par filière
            </div>
            <div className="h-[250px] overflow-auto">
                <table className="min-w-full text-xs">
                    <thead className="sticky top-0 bg-white z-20">
                        <tr className="bg-white border-b border-gray-600">
                            <th className="px-2 py-1 text-left font-bold whitespace-nowrap sticky left-0 top-0 bg-white z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Filière</th>
                            {Object.values(filiereData).some(data => data.preparation > 0) && 
                                <th className="px-2 py-1 text-right font-bold whitespace-nowrap">Préparation</th>}
                            {Object.values(filiereData).some(data => data.transport > 0) && 
                                <th className="px-2 py-1 text-right font-bold whitespace-nowrap">Transport</th>}
                            {Object.values(filiereData).some(data => data.traitement > 0) && 
                                <th className="px-2 py-1 text-right font-bold whitespace-nowrap">Traitement</th>}
                            {Object.values(filiereData).some(data => data.gestion_globale > 0) && <th className="px-2 py-1 text-right font-bold whitespace-nowrap">Gestion Globale</th>}
                            {Object.values(filiereData).some(data => data.tgap > 0) && <th className="px-2 py-1 text-right font-bold whitespace-nowrap">TGAP</th>}
                            {Object.values(filiereData).some(data => data.declassement > 0) && <th className="px-2 py-1 text-right font-bold whitespace-nowrap">Déclassement</th>}
                            {Object.values(filiereData).some(data => data.penalites > 0) && <th className="px-2 py-1 text-right font-bold whitespace-nowrap">Pénalités</th>}
                            {Object.values(filiereData).some(data => data.rachat > 0) && <th className="px-2 py-1 text-right font-bold whitespace-nowrap text-green-600">Rachat</th>}
                            {Object.values(filiereData).some(data => data.location > 0) && <th className="px-2 py-1 text-right font-bold whitespace-nowrap">Location</th>}
                            {Object.values(filiereData).some(data => data.maintenance > 0) && <th className="px-2 py-1 text-right font-bold whitespace-nowrap">Maintenance</th>}
                            {Object.values(filiereData).some(data => data.mise_a_disposition > 0) && <th className="px-2 py-1 text-right font-bold whitespace-nowrap">Mise à disposition</th>}
                            {Object.values(filiereData).some(data => data.autres_contenant > 0) && <th className="px-2 py-1 text-right font-bold whitespace-nowrap">Autres Contenant</th>}
                            {(Object.values(filiereData).some(data => data.non_expliques > 0 || data.autres > 0)) && <th className="px-2 py-1 text-right font-bold whitespace-nowrap">Autres</th>}
                            <th className="px-4 py-1 text-right font-bold whitespace-nowrap">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(filiereData)
                            .sort((a, b) => {
                                if (a[0] === 'Autres') return 1;
                                if (b[0] === 'Autres') return -1;
                                return b[1].total - a[1].total;
                            })
                            .map(([filiere, data], index) => (
                                <tr key={index} className="border-b hover:bg-gray-50 group">
                                    <td className="px-2 py-1 whitespace-nowrap sticky left-0 bg-white group-hover:bg-gray-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{filiere}</td>
                                    {Object.values(filiereData).some(data => data.preparation > 0) && 
                                        <td className="px-2 py-1 text-right whitespace-nowrap">{formatNumber(data.preparation)}€</td>}
                                    {Object.values(filiereData).some(data => data.transport > 0) && 
                                        <td className="px-2 py-1 text-right whitespace-nowrap">{formatNumber(data.transport)}€</td>}
                                    {Object.values(filiereData).some(data => data.traitement > 0) && 
                                        <td className="px-2 py-1 text-right whitespace-nowrap">{formatNumber(data.traitement)}€</td>}
                                    {Object.values(filiereData).some(data => data.gestion_globale > 0) && 
                                        <td className="px-2 py-1 text-right whitespace-nowrap">{formatNumber(data.gestion_globale)}€</td>}
                                    {Object.values(filiereData).some(data => data.tgap > 0) && 
                                        <td className="px-2 py-1 text-right whitespace-nowrap">{formatNumber(data.tgap)}€</td>}
                                    {Object.values(filiereData).some(data => data.declassement > 0) && 
                                        <td className="px-2 py-1 text-right whitespace-nowrap">{formatNumber(data.declassement)}€</td>}
                                    {Object.values(filiereData).some(data => data.penalites > 0) && 
                                        <td className="px-2 py-1 text-right whitespace-nowrap">{formatNumber(data.penalites)}€</td>}
                                    {Object.values(filiereData).some(data => data.rachat > 0) && 
                                        <td className="px-2 py-1 text-right whitespace-nowrap text-green-600">{formatNumber(data.rachat)}€</td>}
                                    {Object.values(filiereData).some(data => data.location > 0) && 
                                        <td className="px-2 py-1 text-right whitespace-nowrap">{formatNumber(data.location)}€</td>}
                                    {Object.values(filiereData).some(data => data.maintenance > 0) && 
                                        <td className="px-2 py-1 text-right whitespace-nowrap">{formatNumber(data.maintenance)}€</td>}
                                    {Object.values(filiereData).some(data => data.mise_a_disposition > 0) && 
                                        <td className="px-2 py-1 text-right whitespace-nowrap">{formatNumber(data.mise_a_disposition)}€</td>}
                                    {Object.values(filiereData).some(data => data.autres_contenant > 0) && 
                                        <td className="px-2 py-1 text-right whitespace-nowrap">{formatNumber(data.autres_contenant)}€</td>}
                                    {(Object.values(filiereData).some(data => data.non_expliques > 0 || data.autres > 0)) && 
                                        <td className="px-2 py-1 text-right whitespace-nowrap">{formatNumber(data.non_expliques + data.autres)}€</td>}
                                    <td className={`px-4 py-1 text-right whitespace-nowrap ${data.total >= 0 ? 'text-gray-700' : 'text-green-600'}`}>
                                        {formatNumber(data.total)}€
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                    <tfoot className="bg-gray-100">
                        <tr className="bg-gray-100 border-t-2 border-gray-700">
                            <td className="px-2 py-1 font-bold whitespace-nowrap sticky left-0 bg-gray-100 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Total</td>    
                            {Object.values(filiereData).some(data => data.preparation > 0) && 
                                <td className="px-2 py-1 text-right font-bold whitespace-nowrap">{formatNumber(totals.preparation)}€</td>}
                            {Object.values(filiereData).some(data => data.transport > 0) && 
                                <td className="px-2 py-1 text-right font-bold whitespace-nowrap">{formatNumber(totals.transport)}€</td>}
                            {Object.values(filiereData).some(data => data.traitement > 0) && 
                                <td className="px-2 py-1 text-right font-bold whitespace-nowrap">{formatNumber(totals.traitement)}€</td>}
                            {Object.values(filiereData).some(data => data.gestion_globale > 0) && 
                                <td className="px-2 py-1 text-right font-bold whitespace-nowrap">{formatNumber(totals.gestion_globale)}€</td>}
                            {Object.values(filiereData).some(data => data.tgap > 0) && 
                                <td className="px-2 py-1 text-right font-bold whitespace-nowrap">{formatNumber(totals.tgap)}€</td>}
                            {Object.values(filiereData).some(data => data.declassement > 0) && 
                                <td className="px-2 py-1 text-right font-bold whitespace-nowrap">{formatNumber(totals.declassement)}€</td>}
                            {Object.values(filiereData).some(data => data.penalites > 0) && 
                                <td className="px-2 py-1 text-right font-bold whitespace-nowrap">{formatNumber(totals.penalites)}€</td>}
                            {Object.values(filiereData).some(data => data.rachat > 0) && 
                                <td className="px-2 py-1 text-right font-bold whitespace-nowrap text-green-600">{formatNumber(totals.rachat)}€</td>}
                            {Object.values(filiereData).some(data => data.location > 0) && 
                                <td className="px-2 py-1 text-right font-bold whitespace-nowrap">{formatNumber(totals.location)}€</td>}
                            {Object.values(filiereData).some(data => data.maintenance > 0) && 
                                <td className="px-2 py-1 text-right font-bold whitespace-nowrap">{formatNumber(totals.maintenance)}€</td>}
                            {Object.values(filiereData).some(data => data.mise_a_disposition > 0) && 
                                <td className="px-2 py-1 text-right font-bold whitespace-nowrap">{formatNumber(totals.mise_a_disposition)}€</td>}
                            {Object.values(filiereData).some(data => data.autres_contenant > 0) && 
                                <td className="px-2 py-1 text-right font-bold whitespace-nowrap">{formatNumber(totals.autres_contenant)}€</td>}
                            {(Object.values(filiereData).some(data => data.non_expliques > 0 || data.autres > 0)) && 
                                <td className="px-2 py-1 text-right font-bold whitespace-nowrap">{formatNumber(totals.non_expliques + totals.autres)}€</td>}
                            <td className={`px-4 py-1 text-right font-bold whitespace-nowrap ${totals.total >= 0 ? 'text-gray-700' : 'text-green-600'}`}>
                                {formatNumber(totals.total)}€
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

export default NewTableFinancial;