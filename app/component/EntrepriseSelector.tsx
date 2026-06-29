"use client";

import { useSession } from './SessionProvider';

/**
 * Sélecteur d'entreprise réservé aux super-admins.
 * Permet de basculer l'entreprise active : tout le reste de l'app
 * (les ~89 requêtes filtrées par entreprise_id) suit automatiquement.
 */
const EntrepriseSelector = () => {
    const { is_super_admin, entreprises, entreprise_id, selectEntreprise } = useSession();

    if (!is_super_admin || entreprises.length === 0) return null;

    return (
        <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-500 mb-1">
                Entreprise (admin)
            </label>
            <select
                value={entreprise_id ?? ''}
                onChange={(e) => {
                    const id = Number(e.target.value);
                    if (id) selectEntreprise(id);
                }}
                className="w-full text-sm border border-gray-300 rounded-md p-1.5 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-[var(--green-medium)]"
            >
                {entreprises.map((ent) => (
                    <option key={ent.id} value={ent.id}>
                        {ent.name}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default EntrepriseSelector;
