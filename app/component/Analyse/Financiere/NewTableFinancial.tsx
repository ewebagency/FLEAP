/*'use client'
import { Facture } from './types';

interface Props {
    factures: Facture[];
}

const NewTableFinancial = ({ factures }: Props) => {
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
                <thead className="bg-gray-100">
                    <tr>
                        <th className="px-4 py-2">Date</th>
                        <th className="px-4 py-2">Code CED</th>
                        <th className="px-4 py-2">Prestataire</th>
                        <th className="px-4 py-2">Lieu</th>
                        <th className="px-4 py-2">Total HT</th>
                        <th className="px-4 py-2">Détails</th>
                    </tr>
                </thead>
                <tbody>
                    {factures.map((facture, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-2">
                                {new Date(facture.other_infos.date_collecte).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-2">{facture.other_infos.code_ced}</td>
                            <td className="px-4 py-2">{facture.infos_json.header.prestataire_nom}</td>
                            <td className="px-4 py-2">{facture.infos_json.depart.line_header.lieu_collecte}</td>
                            <td className="px-4 py-2">{facture.infos_json.footer.total_ht}€</td>
                            <td className="px-4 py-2">
                                <button 
                                    className="bg-blue-500 text-white px-2 py-1 rounded"
                                    onClick={() => console.log(facture)}
                                >
                                    Voir
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default NewTableFinancial; */