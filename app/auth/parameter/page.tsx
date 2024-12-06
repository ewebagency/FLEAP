"use client";
import { supabase } from '@/app/database/supabaseClient';
import { useRouter } from 'next/navigation';
import { SessionMore, useSession } from '@/app/component/SessionProvider';
import { Session } from '@supabase/supabase-js';
import { useState } from 'react';

export default function UserSettings() {
    const router = useRouter();
    const session = useSession() as SessionMore;
    const email = session?.user_email;

    const [pastPassword, setPastPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: email as string,
            password: pastPassword,
        });

        if (signInError) {
            setError('Ancien mot de passe incorrect.');
            return;
        }

        const { error: updateError } = await supabase.auth.updateUser({
            password: newPassword,
        });

        if (updateError) {
            setError('Erreur lors du changement de mot de passe.');
        } else {
            setSuccess('Mot de passe mis à jour avec succès.');
            router.push('/analysis');
        }
    };

    const handleChangeProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!session) {
            setError('Utilisateur non connecté.');
            return;
        }

        const { data: existingProfile, error: fetchError } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', session.user_id)
            .maybeSingle();

        if (fetchError && fetchError.code !== 'PGRST100') {
            setError('Erreur lors de la récupération du profil.');
            return;
        }

        if (existingProfile) {
            const { error: updateProfileError } = await supabase
                .from('profiles')
                .update({
                    first_name: firstName,
                    last_name: lastName,
                })
                .eq('user_id', session.user_id);

            if (updateProfileError) {
                setError('Erreur lors de la mise à jour du profil.');
            } else {
                setSuccess('Profil mis à jour avec succès.');
            }
        } else {
            const { error: insertProfileError } = await supabase
                .from('profiles')
                .insert({
                    user_id: session.user_id,
                    first_name: firstName,
                    last_name: lastName,
                });

            if (insertProfileError) {
                setError('Erreur lors de la création du profil.');
            } else {
                setSuccess('Profil créé avec succès.');
            }
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
            <div className="bg-white p-6 rounded shadow-md w-96">
                <h2 className="text-2xl font-bold mb-4">Changer votre mot de passe</h2>
                <div>Votre compte : {email}</div>
                {error && <p className="text-red-500">{error}</p>}
                {success && <p className="text-green-500">{success}</p>}

                <form onSubmit={handleChangePassword} className="mb-4">
                    <input
                        type="password"
                        placeholder="Ancien mot de passe"
                        value={pastPassword}
                        onChange={(e) => setPastPassword(e.target.value)}
                        className="border border-gray-300 p-2 mb-4 w-full rounded"
                    />
                    <input
                        type="password"
                        placeholder="Nouveau mot de passe"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="border border-gray-300 p-2 mb-4 w-full rounded"
                    />
                    <button type="submit" className="bg-blue-500 text-white p-2 rounded w-full">Changer mon mot de passe</button>
                </form>

                <h2 className="text-2xl font-bold mb-4">Changer votre prénom et nom</h2>
                <form onSubmit={handleChangeProfile}>
                    <input
                        type="text"
                        placeholder="Prénom"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="border border-gray-300 p-2 mb-4 w-full rounded"
                    />
                    <input
                        type="text"
                        placeholder="Nom"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="border border-gray-300 p-2 mb-4 w-full rounded"
                    />
                    <button type="submit" className="bg-blue-500 text-white p-2 rounded w-full">Changer mon prénom et nom</button>
                </form>
            </div>
        </div>
    );
}
