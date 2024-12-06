import React, { useEffect, useState } from 'react';
import { SessionMore, useSession } from '../component/SessionProvider'; // Assurez-vous d'importer le hook de session

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
interface InfosJson {
    dossierNumber?: string;
    quantite_plus?: number;
    total_ht_plus?: number;
    prix_unitaire_plus?: number;
    quantite_minus?: number;
    total_ht_minus?: number;
    prix_unitaire_minus?: number;
    tva_minus?: number;
}

interface FactureInterface {
    id: bigint;
    created_at: string;
    user_id: string | null;
    pdf_infos_id: string | null;
    infos_json: InfosJson | null;
}

const TableRegistre = () => {
    const [factures, setFactures] = useState<FactureInterface[]>([]); // État pour stocker les factures
    const [loading, setLoading] = useState(true); // État pour gérer le chargement
    const [error, setError] = useState<string | null>(null); // État pour gérer les erreurs
    const session = useSession() as SessionMore; // Récupérer la session utilisateur
    const userId = session?.user_id; // Récupérer l'ID de l'utilisateur

    useEffect(() => {
        const fetchFactures = async () => {
            if (!userId) return; // Ne pas faire la requête si l'ID de l'utilisateur n'est pas disponible

            try {
                const response = await fetch('/api/get-infos-facture', {
                    method: 'POST', // Changer à POST
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ user_id: userId }), // Passer l'ID de l'utilisateur dans le corps de la requête
                });

                if (!response.ok) {
                    throw new Error('Erreur lors de la récupération des données');
                }

                const data = await response.json();
                setFactures(data); // Mettre à jour l'état avec les données récupérées
            } catch (err) {
                setError((err as Error).message); // Gérer les erreurs
            } finally {
                setLoading(false); // Arrêter le chargement
            }
        };

        fetchFactures(); // Appeler la fonction pour récupérer les factures
    }, [userId]); // Dépendre de userId

    if (loading) {
        return <p>Chargement des factures...</p>; // Message de chargement
    }

    if (error) {
        return <p>Erreur: {error}</p>; // Afficher l'erreur
    }

    return (
        <div className="container mx-auto p-4">
            <h2 className="text-2xl font-bold mb-4">Registre des Factures</h2>
            <table className="min-w-full bg-white border border-gray-300">
                <thead>
                    <tr className="bg-gray-200 text-gray-600 uppercase text-sm leading-normal">
                        <th className="py-3 px-6 text-left">Facture ID</th>
                        <th className="py-3 px-6 text-left">User ID</th>
                        <th className="py-3 px-6 text-left">PDF ID</th>
                        <th className="py-3 px-6 text-left">Dossier Number</th>
                        <th className="py-3 px-6 text-left">Quantité (Plus)</th>
                        <th className="py-3 px-6 text-left">Total HT (Plus)</th>
                        <th className="py-3 px-6 text-left">Prix Unitaire (Plus)</th>
                        <th className="py-3 px-6 text-left">Quantité (Minus)</th>
                        <th className="py-3 px-6 text-left">Total HT (Minus)</th>
                        <th className="py-3 px-6 text-left">Prix Unitaire (Minus)</th>
                        <th className="py-3 px-6 text-left">TVA</th>
                    </tr>
                </thead>
                <tbody className="text-gray-600 text-sm font-light">
                    {factures.map((facture) => (
                        <tr key={facture.id} className="border-b border-gray-200 hover:bg-gray-100">
                            <td className="py-3 px-6">{facture.id}</td>
                            <td className="py-3 px-6">{facture.user_id}</td>
                            <td className="py-3 px-6">{facture.pdf_infos_id}</td>
                            <td className="py-3 px-6">{facture.infos_json?.dossierNumber}</td>
                            <td className="py-3 px-6">{facture.infos_json?.quantite_plus}</td>
                            <td className="py-3 px-6">{facture.infos_json?.total_ht_plus} €</td>
                            <td className="py-3 px-6">{facture.infos_json?.prix_unitaire_plus} €</td>
                            <td className="py-3 px-6">{facture.infos_json?.quantite_minus}</td>
                            <td className="py-3 px-6">{facture.infos_json?.total_ht_minus} €</td>
                            <td className="py-3 px-6">{facture.infos_json?.prix_unitaire_minus} €</td>
                            <td className="py-3 px-6">{facture.infos_json?.tva_minus}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default TableRegistre;
