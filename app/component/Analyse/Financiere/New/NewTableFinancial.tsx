'use client'
import { Facture } from '../types';
import { useEffect, useState } from 'react';
import { getMappingTableFiliere } from "@/app/register/RegisterComponents/Modal/FormulaireFull/utils_new";
import { useFilterContext } from '@/app/FilterContext';
import { MAIN_OPERATIONS, EXPANDED_OPERATIONS } from '@/app/interface_admin_2/InterfaceAdmin2/constants/formConstants';
import { formatNumber } from '@/app/utils/formatNumber';

interface Props {
    factures: Facture[];
    entreprise_id: string;
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

const NewTableFinancial = ({ factures, entreprise_id }: Props) => {
    const [mappingTable, setMappingTable] = useState<{ ced: string, filiere: string }[]>([]);
    const { filieres } = useFilterContext();

    useEffect(() => {
        const fetchMappingTable = async () => {
            const mapping = await getMappingTableFiliere(entreprise_id);
            setMappingTable(mapping || []);
        };
        fetchMappingTable();
    }, [entreprise_id]);

    const filiereData = factures.reduce((acc: FiliereData, facture) => {
        // Vérification du total pour chaque facture
        let totalPrestations = 0;

        facture.infos_json.departs.forEach(depart => {
            const cleanedCed = depart.line_header.code_dechet.replaceAll(' ', '').replace('*', '');
            const filiere = mappingTable.find(m => m.ced.replace(' ', '').replace('*', '') === cleanedCed)?.filiere || 'Autres';
            
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

            depart.line_body.forEach(operation => {
                const montant = operation.montant_ht || 0;
                totalPrestations += montant;

                switch (operation.type_operation) {
                    case 'Préparation':
                        acc[filiere].preparation += montant;
                        break;
                    case 'Transport':
                        acc[filiere].transport += montant;
                        break;
                    case 'Traitement':
                        acc[filiere].traitement += montant;
                        break;
                    case 'Gestion globale':
                    case 'Gestion global':
                        acc[filiere].gestion_globale += montant;
                        break;
                    case 'TGAP':
                        acc[filiere].tgap += montant;
                        break;
                    case 'Déclassement':
                        acc[filiere].declassement += montant;
                        break;
                    case 'Pénalités':
                        acc[filiere].penalites += montant;
                        break;
                    case 'Rachat':
                        acc[filiere].rachat += montant;
                        break;
                    case 'Location':
                        acc[filiere].location += montant;
                        break;
                    case 'Maintenance':
                        acc[filiere].maintenance += montant;
                        break;
                    case 'Mise à disposition':
                        acc[filiere].mise_a_disposition += montant;
                        break;
                    case 'Autres : Contenant':
                        acc[filiere].autres_contenant += montant;
                        break;
                    case 'Non expliqués':
                        acc[filiere].non_expliques += montant;
                        break;
                    case 'Autres':
                        acc[filiere].autres += montant;
                        break;
                    default:
                        console.warn(`Type d'opération non reconnu: ${operation.type_operation}`);
                        acc[filiere].non_expliques += montant;
                }
                acc[filiere].total += montant;
            });
        });

        // Vérification du total
        const difference = Math.abs(totalPrestations - facture.infos_json.footer.total_ht);
        if (difference > 0.01) { // Tolérance de 0.01€ pour les erreurs d'arrondi
            console.error(
                `Différence détectée dans la facture ${facture.infos_json.header.num_facture}:`,
                `\n- Total des prestations: ${totalPrestations.toFixed(2)}€`,
                `\n- Total HT facture: ${facture.infos_json.footer.total_ht.toFixed(2)}€`,
                `\n- Différence: ${difference.toFixed(2)}€`,
                `\n- Prestations: ${JSON.stringify(facture)}`
            );
        }

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
        .map(op => op.toLowerCase().replace(/ /g, '_'))
        .filter(op => shouldShowColumn(op));

    return (
        <div className="flex-1 p-4 bg-white rounded-lg shadow">
            <div className="text-gray-500 text-xs mb-2">
                Détails financiers par filière
            </div>
            <div className="h-[180px] overflow-auto">
                <table className="min-w-full text-xs">
                    <thead className="sticky top-0 bg-white">
                        <tr className="bg-gray-50">
                            <th className="px-2 py-1 text-left">Filière</th>
                            {Object.values(filiereData).some(data => data.preparation > 0) && <th className="px-2 py-1 text-right">Préparation</th>}
                            {Object.values(filiereData).some(data => data.transport > 0) && <th className="px-2 py-1 text-right">Transport</th>}
                            {Object.values(filiereData).some(data => data.traitement > 0) && <th className="px-2 py-1 text-right">Traitement</th>}
                            {Object.values(filiereData).some(data => data.gestion_globale > 0) && <th className="px-2 py-1 text-right">Gestion Globale</th>}
                            {Object.values(filiereData).some(data => data.tgap > 0) && <th className="px-2 py-1 text-right">TGAP</th>}
                            {Object.values(filiereData).some(data => data.declassement > 0) && <th className="px-2 py-1 text-right">Déclassement</th>}
                            {Object.values(filiereData).some(data => data.penalites > 0) && <th className="px-2 py-1 text-right">Pénalités</th>}
                            {Object.values(filiereData).some(data => data.rachat > 0) && <th className="px-2 py-1 text-right">Rachat</th>}
                            {Object.values(filiereData).some(data => data.location > 0) && <th className="px-2 py-1 text-right">Location</th>}
                            {Object.values(filiereData).some(data => data.maintenance > 0) && <th className="px-2 py-1 text-right">Maintenance</th>}
                            {Object.values(filiereData).some(data => data.mise_a_disposition > 0) && <th className="px-2 py-1 text-right">Mise à disposition</th>}
                            {Object.values(filiereData).some(data => data.autres_contenant > 0) && <th className="px-2 py-1 text-right">Autres Contenant</th>}
                            {(Object.values(filiereData).some(data => data.non_expliques > 0 || data.autres > 0)) && <th className="px-2 py-1 text-right">Autres</th>}
                            <th className="px-2 py-1 text-right">Total</th>
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
                                <tr key={index} className="border-b hover:bg-gray-50">
                                    <td className="px-2 py-1">{filiere}</td>
                                    {Object.values(filiereData).some(data => data.preparation > 0) && 
                                        <td className="px-2 py-1 text-right">{formatNumber(data.preparation)}€</td>}
                                    {Object.values(filiereData).some(data => data.transport > 0) && 
                                        <td className="px-2 py-1 text-right">{formatNumber(data.transport)}€</td>}
                                    {Object.values(filiereData).some(data => data.traitement > 0) && 
                                        <td className="px-2 py-1 text-right">{formatNumber(data.traitement)}€</td>}
                                    {Object.values(filiereData).some(data => data.gestion_globale > 0) && 
                                        <td className="px-2 py-1 text-right">{formatNumber(data.gestion_globale)}€</td>}
                                    {Object.values(filiereData).some(data => data.tgap > 0) && 
                                        <td className="px-2 py-1 text-right">{formatNumber(data.tgap)}€</td>}
                                    {Object.values(filiereData).some(data => data.declassement > 0) && 
                                        <td className="px-2 py-1 text-right">{formatNumber(data.declassement)}€</td>}
                                    {Object.values(filiereData).some(data => data.penalites > 0) && 
                                        <td className="px-2 py-1 text-right">{formatNumber(data.penalites)}€</td>}
                                    {Object.values(filiereData).some(data => data.rachat > 0) && 
                                        <td className="px-2 py-1 text-right">{formatNumber(data.rachat)}€</td>}
                                    {Object.values(filiereData).some(data => data.location > 0) && 
                                        <td className="px-2 py-1 text-right">{formatNumber(data.location)}€</td>}
                                    {Object.values(filiereData).some(data => data.maintenance > 0) && 
                                        <td className="px-2 py-1 text-right">{formatNumber(data.maintenance)}€</td>}
                                    {Object.values(filiereData).some(data => data.mise_a_disposition > 0) && 
                                        <td className="px-2 py-1 text-right">{formatNumber(data.mise_a_disposition)}€</td>}
                                    {Object.values(filiereData).some(data => data.autres_contenant > 0) && 
                                        <td className="px-2 py-1 text-right">{formatNumber(data.autres_contenant)}€</td>}
                                    {(Object.values(filiereData).some(data => data.non_expliques > 0 || data.autres > 0)) && 
                                        <td className="px-2 py-1 text-right">{formatNumber(data.non_expliques + data.autres)}€</td>}
                                    <td className="px-2 py-1 text-right">{formatNumber(data.total)}€</td>
                                </tr>
                            ))}
                    </tbody>
                    <tfoot className="sticky bottom-0 bg-white">
                        <tr className="bg-gray-50">
                            <td className="px-2 py-1">Total</td>
                            {Object.values(filiereData).some(data => data.preparation > 0) && 
                                <td className="px-2 py-1 text-right">{formatNumber(totals.preparation)}€</td>}
                            {Object.values(filiereData).some(data => data.transport > 0) && 
                                <td className="px-2 py-1 text-right">{formatNumber(totals.transport)}€</td>}
                            {Object.values(filiereData).some(data => data.traitement > 0) && 
                                <td className="px-2 py-1 text-right">{formatNumber(totals.traitement)}€</td>}
                            {Object.values(filiereData).some(data => data.gestion_globale > 0) && 
                                <td className="px-2 py-1 text-right">{formatNumber(totals.gestion_globale)}€</td>}
                            {Object.values(filiereData).some(data => data.tgap > 0) && 
                                <td className="px-2 py-1 text-right">{formatNumber(totals.tgap)}€</td>}
                            {Object.values(filiereData).some(data => data.declassement > 0) && 
                                <td className="px-2 py-1 text-right">{formatNumber(totals.declassement)}€</td>}
                            {Object.values(filiereData).some(data => data.penalites > 0) && 
                                <td className="px-2 py-1 text-right">{formatNumber(totals.penalites)}€</td>}
                            {Object.values(filiereData).some(data => data.rachat > 0) && 
                                <td className="px-2 py-1 text-right">{formatNumber(totals.rachat)}€</td>}
                            {Object.values(filiereData).some(data => data.location > 0) && 
                                <td className="px-2 py-1 text-right">{formatNumber(totals.location)}€</td>}
                            {Object.values(filiereData).some(data => data.maintenance > 0) && 
                                <td className="px-2 py-1 text-right">{formatNumber(totals.maintenance)}€</td>}
                            {Object.values(filiereData).some(data => data.mise_a_disposition > 0) && 
                                <td className="px-2 py-1 text-right">{formatNumber(totals.mise_a_disposition)}€</td>}
                            {Object.values(filiereData).some(data => data.autres_contenant > 0) && 
                                <td className="px-2 py-1 text-right">{formatNumber(totals.autres_contenant)}€</td>}
                            {(Object.values(filiereData).some(data => data.non_expliques > 0 || data.autres > 0)) && 
                                <td className="px-2 py-1 text-right">{formatNumber(totals.non_expliques + totals.autres)}€</td>}
                            <td className="px-2 py-1 text-right">{formatNumber(totals.total)}€</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

export default NewTableFinancial;