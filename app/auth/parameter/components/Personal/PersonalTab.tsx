"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import { useRouter } from 'next/navigation';
import { SessionMore, useSession } from '@/app/component/SessionProvider';

export default function PersonalTab({ email, currentProfile }: { email: string|null, currentProfile: {first_name?: string, last_name?: string, phone?: string} | null }) {
    const router = useRouter();
    const session = useSession() as SessionMore;
    const [pastPassword, setPastPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        if (currentProfile) {
            setFirstName(currentProfile.first_name || '');
            setLastName(currentProfile.last_name || '');
            setPhone(currentProfile.phone || '');
        }
    }, [currentProfile]);

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
            router.push('/register');
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
                    phone: phone,
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
                    phone: phone,
                });

            if (insertProfileError) {
                setError('Erreur lors de la création du profil.');
            } else {
                setSuccess('Profil créé avec succès.');
            }
        }
    };

    return (
        <div className="flex gap-8 justify-center">
            <div className="bg-white rounded-lg shadow-lg p-6 w-[40%]">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Changer le mot de passe</h2>
                <div className="text-gray-600 mb-4">{email}</div>
                {error && <p className="text-red-500 mb-4">{error}</p>}
                {success && <p className="text-green-500 mb-4">{success}</p>}

                <form onSubmit={handleChangePassword} className="flex flex-col h-[200px] justify-between">
                    <div className="space-y-4">
                        <input
                            type="password"
                            placeholder="Ancien mot de passe"
                            value={pastPassword}
                            onChange={(e) => setPastPassword(e.target.value)}
                            className="border border-gray-300 p-3 w-full rounded"
                        />
                        <input
                            type="password"
                            placeholder="Nouveau mot de passe"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="border border-gray-300 p-3 w-full rounded"
                        />
                    </div>
                    <button 
                        type="submit" 
                        className="w-full p-3 rounded bg-[var(--green-medium)] hover:bg-[var(--green-light)] text-white text-lg mt-auto"
                    >
                        Changer mon mot de passe
                    </button>
                </form>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6 w-[40%]">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Modifier votre profil</h2>
                <div className="text-gray-600 mb-4">
                    {currentProfile?.first_name || 'Non défini'} {currentProfile?.last_name || 'Non défini'}
                    {currentProfile?.phone && <div>Tél: {currentProfile.phone}</div>}
                </div>
                <form onSubmit={handleChangeProfile} className="flex flex-col h-[250px] justify-between">
                    <div className="space-y-4">
                        <input
                            type="text"
                            placeholder="Prénom"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className="border border-gray-300 p-3 w-full rounded"
                        />
                        <input
                            type="text"
                            placeholder="Nom"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className="border border-gray-300 p-3 w-full rounded"
                        />
                        <input
                            type="tel"
                            placeholder="Téléphone"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="border border-gray-300 p-3 w-full rounded"
                        />
                    </div>
                    <button 
                        type="submit" 
                        className="w-full p-3 rounded bg-[var(--green-medium)] hover:bg-[var(--green-light)] text-white text-lg mt-auto"
                    >
                        Mettre à jour mon profil
                    </button>
                </form>
            </div>
        </div>
    );
} 