'use client';
import React, { useEffect, useState } from "react";


const BandeauAPI = () => {
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        const fetchToken = async () => {
            try {
                const res = await fetch('api/auth_track_dechet/token');
                const result = await res.json();
                setToken(result.data?.value || null);
            } catch (error) {
                console.error("Erreur lors de la récupération du token:", error);
            }
        };
        fetchToken();
    }, []);

    const client_id = process.env.NEXT_PUBLIC_TRACKDECHETS_CLIENT_ID;
    const redirect_uri = encodeURIComponent(`${process.env.NEXT_PUBLIC_APP_URL}/api/auth_track_dechet/callback`);

    const handleAPIConnection = () => {
        console.log("OAuth2 en attente, token en dur dans le code => aller direct à la demande de collecte");
        const url = `https://app.trackdechets.beta.gouv.fr/oauth2/authorize/dialog?response_type=code&redirect_uri=${redirect_uri}&client_id=${client_id}`;
        window.location.href = url;
    }

    return (
        <div className="p-2 my-3 w-full rounded-xl border-gray-800 border-[1px]">
            <div className="flex justify-between items-center">
                <div className="text-md">Interfaces clients connectées</div>
                <button 
                    className="btn flex bg-gray-200 rounded-xl text-xs font-thin justify-between items-center"
                    onClick={handleAPIConnection}
                    title="Vous allez être redirigé vers la page de connexion TrackDéchet">
                    <div className="px-1 text-md text-white bg-green-800 rounded-full">+</div>
                    <div>Ajouter une API</div>
                </button>
            </div>
            {token && <div className="inline-block text-xs text-white py-1 px-2 rounded-lg bg-green-600">Connecté à TrackDéchet</div>}
        </div>
    );
}

export default BandeauAPI;
