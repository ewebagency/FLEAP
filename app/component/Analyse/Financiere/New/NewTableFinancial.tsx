'use client'
import { Facture } from '../types';
import { useEffect, useState } from 'react';
import { getMappingTableFiliere } from "@/app/register/RegisterComponents/Modal/FormulaireFull/utils_new";
import { useFilterContext } from '@/app/FilterContext';
import { MAIN_OPERATIONS, EXPANDED_OPERATIONS } from '@/app/interface_admin_2/InterfaceAdmin2/constants/formConstants';

interface Props {
    factures: Facture[];
    entreprise_id: string;
}

interface OperationSums {
    preparation: number;
    transport: number;
    traitement: number;
    gestion_global: number;
    tgap: number;
    declassement: number;
    rachat: number;
    contenant: number;
    non_explique: number;
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
        facture.infos_json.departs.forEach(depart => {
            const cleanedCed = depart.line_header.code_dechet.replaceAll(' ', '').replace('*', '');
            const filiere = mappingTable.find(m => m.ced.replace(' ', '').replace('*', '') === cleanedCed)?.filiere || 'Autres';
            
            if (!acc[filiere]) {
                acc[filiere] = {
                    preparation: 0,
                    transport: 0,
                    traitement: 0,
                    gestion_global: 0,
                    tgap: 0,
                    declassement: 0,
                    rachat: 0,
                    contenant: 0,
                    non_explique: 0,
                    total: 0
                };
            }

            depart.line_body.forEach(operation => {
                const montant = operation.montant_ht || 0;
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
                    case 'Gestion global':
                        acc[filiere].gestion_global += montant;
                        break;
                    case 'TGAP':
                        acc[filiere].tgap += montant;
                        break;
                    case 'Déclassement':
                        acc[filiere].declassement += montant;
                        break;
                    case 'Rachat':
                        acc[filiere].rachat += montant;
                        break;
                    case 'Contenant':
                        acc[filiere].contenant += montant;
                        break;
                    default:
                        acc[filiere].non_explique += montant;
                }
                acc[filiere].total += montant;
            });
        });

        return acc;
    }, {});

    // Calcul des totaux pour toutes les filières
    const totals = Object.values(filiereData).reduce((acc, data) => {
        return {
            preparation: acc.preparation + data.preparation,
            transport: acc.transport + data.transport,
            traitement: acc.traitement + data.traitement,
            gestion_global: acc.gestion_global + data.gestion_global,
            tgap: acc.tgap + data.tgap,
            declassement: acc.declassement + data.declassement,
            rachat: acc.rachat + data.rachat,
            contenant: acc.contenant + data.contenant,
            non_explique: acc.non_explique + data.non_explique,
            total: acc.total + data.total
        };
    }, {
        preparation: 0, transport: 0, traitement: 0, gestion_global: 0,
        tgap: 0, declassement: 0, rachat: 0, contenant: 0, non_explique: 0, total: 0
    });

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
                            {Object.values(filiereData).some(data => data.gestion_global > 0) && <th className="px-2 py-1 text-right">Gestion Global</th>}
                            {Object.values(filiereData).some(data => data.tgap > 0) && <th className="px-2 py-1 text-right">TGAP</th>}
                            {Object.values(filiereData).some(data => data.declassement > 0) && <th className="px-2 py-1 text-right">Déclassement</th>}
                            {Object.values(filiereData).some(data => data.rachat > 0) && <th className="px-2 py-1 text-right">Rachat</th>}
                            {Object.values(filiereData).some(data => data.contenant > 0) && <th className="px-2 py-1 text-right">Contenant</th>}
                            {Object.values(filiereData).some(data => data.non_explique > 0) && <th className="px-2 py-1 text-right">Non expliqué</th>}
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
                                    {Object.values(filiereData).some(data => data.preparation > 0) && <td className="px-2 py-1 text-right">{data.preparation.toFixed(2)}€</td>}
                                    {Object.values(filiereData).some(data => data.transport > 0) && <td className="px-2 py-1 text-right">{data.transport.toFixed(2)}€</td>}
                                    {Object.values(filiereData).some(data => data.traitement > 0) && <td className="px-2 py-1 text-right">{data.traitement.toFixed(2)}€</td>}
                                    {Object.values(filiereData).some(data => data.gestion_global > 0) && <td className="px-2 py-1 text-right">{data.gestion_global.toFixed(2)}€</td>}
                                    {Object.values(filiereData).some(data => data.tgap > 0) && <td className="px-2 py-1 text-right">{data.tgap.toFixed(2)}€</td>}
                                    {Object.values(filiereData).some(data => data.declassement > 0) && <td className="px-2 py-1 text-right">{data.declassement.toFixed(2)}€</td>}
                                    {Object.values(filiereData).some(data => data.rachat > 0) && <td className="px-2 py-1 text-right">{data.rachat.toFixed(2)}€</td>}
                                    {Object.values(filiereData).some(data => data.contenant > 0) && <td className="px-2 py-1 text-right">{data.contenant.toFixed(2)}€</td>}
                                    {Object.values(filiereData).some(data => data.non_explique > 0) && <td className="px-2 py-1 text-right">{data.non_explique.toFixed(2)}€</td>}
                                    <td className="px-2 py-1 text-right">{data.total.toFixed(2)}€</td>
                                </tr>
                            ))}
                    </tbody>
                    <tfoot className="sticky bottom-0 bg-white">
                        <tr className="bg-gray-50">
                            <td className="px-2 py-1">Total</td>
                            {Object.values(filiereData).some(data => data.preparation > 0) && <td className="px-2 py-1 text-right">{totals.preparation.toFixed(2)}€</td>}
                            {Object.values(filiereData).some(data => data.transport > 0) && <td className="px-2 py-1 text-right">{totals.transport.toFixed(2)}€</td>}
                            {Object.values(filiereData).some(data => data.traitement > 0) && <td className="px-2 py-1 text-right">{totals.traitement.toFixed(2)}€</td>}
                            {Object.values(filiereData).some(data => data.gestion_global > 0) && <td className="px-2 py-1 text-right">{totals.gestion_global.toFixed(2)}€</td>}
                            {Object.values(filiereData).some(data => data.tgap > 0) && <td className="px-2 py-1 text-right">{totals.tgap.toFixed(2)}€</td>}
                            {Object.values(filiereData).some(data => data.declassement > 0) && <td className="px-2 py-1 text-right">{totals.declassement.toFixed(2)}€</td>}
                            {Object.values(filiereData).some(data => data.rachat > 0) && <td className="px-2 py-1 text-right">{totals.rachat.toFixed(2)}€</td>}
                            {Object.values(filiereData).some(data => data.contenant > 0) && <td className="px-2 py-1 text-right">{totals.contenant.toFixed(2)}€</td>}
                            {Object.values(filiereData).some(data => data.non_explique > 0) && <td className="px-2 py-1 text-right">{totals.non_explique.toFixed(2)}€</td>}
                            <td className="px-2 py-1 text-right">{totals.total.toFixed(2)}€</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

export default NewTableFinancial;