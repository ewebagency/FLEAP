/*"use client";

import { useEffect, useState } from "react";
import { supabase } from '@/app/database/supabaseClient';
import { useSession } from "@/app/component/SessionProvider";
import { FiEdit2, FiTrash2, FiMail, FiEye, FiUpload, FiDownload, FiSettings } from 'react-icons/fi';
import { createClient } from "@supabase/supabase-js";

interface Profile {
    first_name: string;
    last_name: string;
    email?: string;
    user_id: string;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!;

// Client admin pour accéder aux tables système
const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

export default function PermissionsTab() {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const session = useSession();

    useEffect(() => {
        async function fetchProfiles() {
            try {
                if (!session?.entreprise_id) {
                    console.log("Pas de session ou d'entreprise_id");
                    return;
                }

                setIsLoading(true);
                setError(null);

                // Récupérer les profils avec supabase normal (schéma public)
                const { data: profilesData, error: profilesError } = await supabase
                    .from('profiles')
                    .select('first_name, last_name, user_id')
                    .eq('entreprise_id', session.entreprise_id);

                if (profilesError) {
                    console.error('Erreur profiles:', profilesError);
                    throw profilesError;
                }

                console.log('Profiles récupérés:', profilesData);

                if (!profilesData || profilesData.length === 0) {
                    console.log('Aucun profil trouvé');
                    setProfiles([]);
                    return;
                }

                // Utiliser adminSupabase pour la table auth.users
                const { data: usersData, error: usersError } = await adminSupabase
                    .auth
                    .admin
                    .listUsers();

                if (usersError) {
                    console.error('Erreur users:', usersError);
                    throw usersError;
                }

                console.log('Users récupérés:', usersData);

                const combinedData = profilesData.map(profile => ({
                    ...profile,
                    email: usersData?.users?.find(user => user.id === profile.user_id)?.email
                }));

                console.log('Données combinées:', combinedData);
                setProfiles(combinedData);

            } catch (error) {
                console.error('Erreur lors de la récupération des données:', error);
                setError(error instanceof Error ? error.message : 'Une erreur est survenue');
            } finally {
                setIsLoading(false);
            }
        }

        fetchProfiles();
    }, [session]);

    const IconSeparator = () => (
        <div className="w-px h-4 bg-gray-300 mx-2"></div>
    );

    if (error) {
        return (
            <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="text-red-500">
                    Erreur: {error}
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex justify-center items-center h-40">
                    <div className="text-gray-500">Chargement...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Gestion des permissions</h2>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500">Nombre d&apos;utilisateurs : {profiles.length}</span>
                    <button className="hidden bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md flex items-center gap-2">
                        <span>+</span> Ajouter un utilisateur
                    </button>
                </div>
            </div>

            <div className="mb-4">
                <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-gray-50 rounded-t-lg text-sm font-medium text-gray-600">
                    <div className="col-span-1"></div>
                    <div className="col-span-3">Nom</div>
                    <div className="col-span-3">Sites accessibles</div>
                    <div className="col-span-3">Permissions</div>
                    <div className="col-span-2 hidden">Actions</div>
                </div>

                {profiles.map((profile, index) => (
                    <div key={index} className="grid grid-cols-12 gap-4 px-4 py-3 border-b hover:bg-gray-50 items-center">
                        <div className="col-span-1">
                            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                                {profile.first_name[0]}{profile.last_name[0]}
                            </div>
                        </div>
                        <div className="col-span-3">
                            <div className="font-medium">{profile.first_name} {profile.last_name}</div>
                            <div className="text-sm text-gray-500 flex items-center gap-1">
                                <FiMail className="w-3 h-3" />
                                {profile.email || 'email@demo.fr'}
                            </div>
                        </div>
                        <div className="col-span-3">
                            <div className="text-sm text-gray-600">Tous</div>
                        </div>
                        <div className="col-span-3">
                            <div className="flex items-center mb-2 text-gray-600 gap-3 ml-3">
                                <FiEye className="w-4 h-4" />
                                <IconSeparator />
                                <FiUpload className="w-4 h-4" />
                                <IconSeparator />
                                <FiDownload className="w-4 h-4" />
                                <IconSeparator />
                                <FiSettings className="w-4 h-4" />
                            </div>
                            <div className="w-[95%] bg-gray-200 rounded-full h-2">
                                <div className="bg-green-500 h-2 rounded-full w-full"></div>
                            </div>
                        </div>
                        <div className="col-span-2 flex gap-2 hidden">
                            <button className="p-2 hover:bg-gray-100 rounded-md">
                                <FiEdit2 className="w-4 h-4 text-gray-600" />
                            </button>
                            <button className="p-2 hover:bg-gray-100 rounded-md">
                                <FiTrash2 className="w-4 h-4 text-red-500" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
} */