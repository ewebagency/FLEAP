'use client';
import React from "react";

const BandeauAPI = () => {
    //Pour l'instant on oublie la double authentification
    //const client_id = encodeURIComponent("cm2d40bgh0a14zc6j9vovaypb");
    //const redirect_uri = encodeURIComponent("http://localhost:3000/import_page/callback"); 

    const handleAPIConnection = () => {
        console.log("OAuth2 en attente, token en dur dans le code => aller direct à la demande de collecte");
        //const url = `/api/auth_track_dechets?redirect_uri=${redirect_uri}&client_id=${client_id}`;
        //window.location.href = url;
    }
    

    return (
        <div className="p-2 flex my-3 w-full rounded-xl border-gray-800 border-[1px] justify-between items-center">
            <div className="text-md">Interfaces clients connectées</div>
            <button 
                className="btn flex bg-gray-200 rounded-xl text-xs font-thin justify-between items-center"
                onClick={handleAPIConnection}
                title="Vous allez être redirigé vers la page de connexion TrackDéchet"
            >
                <div className="px-1 text-md text-white bg-green-800 rounded-full">+</div>
                <div>Ajouter une API</div>
            </button>
        </div>
    )
}

export default BandeauAPI;
