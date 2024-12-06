import React, { useEffect, useState } from "react";
import { SessionMore, useSession } from "../../SessionProvider";
import { supabase } from "@/app/database/supabaseClient";
import { Session } from "@supabase/supabase-js";

type JsonDataType = { [key: string]: string | number | boolean | JsonDataType | JsonDataType[] };

type Facture = {
    infos_json: {
        facture_form: {
            header: {
                personne_de_reference: {
                    prenom_nom: string;
                }
            },
            departs: Array<{
                infos_pour_filtrer: {
                    description_adresse_site: string;
                    description_dechet: string;
                    code_ced: string;
                    date_collecte: string;
                },
                ligne_compta_contenant: { montant_ht: number },
                ligne_compta_preparation: { montant_ht: number },
                ligne_compta_transport: { montant_ht: number },
                ligne_compta_traitement: { montant_ht: number },
                ligne_compta_tgap: { montant_ht: number },
                ligne_compta_rachat_matiere: { montant_ht: number }
            }>
        }
    }
}

const FacturesAnalyse = ({ active }: { active: boolean }) => {
    const session = useSession() as SessionMore;
    const [factures, setFactures] = useState<Facture[]>([]);

    /*useEffect(() => {
        const fetchFactures = async () => {
            if (session && session.user.id) {
                try {
                    const { data, error } = await supabase
                        .from('factures')
                        .select('*')
                        .eq('user_id', session.user.id);

                    if (error) throw error;
                    if (data) setFactures(data);
                } catch (error) {
                    console.error('Erreur lors de la récupération des factures:', error);
                }
            }
        };

        fetchFactures();
    }, [session]);*/

    if (!active) return null;

    return (
        <div className="overflow-x-auto p-5">
            <h1 className="text-2xl font-bold mb-4">Formulaire JSON</h1>
            <table className="min-w-full divide-y divide-gray-200 rounded-lg shadow-lg overflow-hidden">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Personne Référente</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Adresse Site</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description Déchet</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code CED</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date Collecte</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contenant HT</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Préparation HT</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transport HT</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Traitement HT</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">TGAP HT</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rachat HT</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {factures.flatMap((facture, factureIndex) => 
                        facture.infos_json.facture_form.departs.map((depart, departIndex) => (
                            <tr key={`${factureIndex}-${departIndex}`} className="hover:bg-gray-50 transition duration-200">
                                <td className="px-4 py-3 text-sm text-gray-900">
                                    {facture.infos_json.facture_form.header.personne_de_reference.prenom_nom}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                    {depart.infos_pour_filtrer.description_adresse_site}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                    {depart.infos_pour_filtrer.description_dechet}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                    {depart.infos_pour_filtrer.code_ced}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                    {depart.infos_pour_filtrer.date_collecte}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                    {depart.ligne_compta_contenant.montant_ht}€
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                    {depart.ligne_compta_preparation.montant_ht}€
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                    {depart.ligne_compta_transport.montant_ht}€
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                    {depart.ligne_compta_traitement.montant_ht}€
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                    {depart.ligne_compta_tgap.montant_ht}€
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                    {depart.ligne_compta_rachat_matiere.montant_ht}€
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default FacturesAnalyse;
