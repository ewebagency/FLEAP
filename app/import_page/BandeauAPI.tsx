'use client';
import React, { useEffect } from "react";
import ConnectedToTrack from "../component/ConnectedToTrack";
import { useSession } from "../component/SessionProvider";
import { useSearchParams } from 'next/navigation';
import Cookies from 'js-cookie';


const BandeauAPI = () => {
    const session = useSession();
    const searchParams = useSearchParams();

    // Premier useEffect pour gérer le refresh
    useEffect(() => {
        if(session && session.user_id){
            if (searchParams.get('token')) {
                const new_token = searchParams.get('token');
                
                if(new_token){
                    //On dirait qu'il faut absolument changer le cookie cote client pour que ça marche..
                    //on le fait aussi cote serveur au cas ou j ene veux pas prendre de risque
                    Cookies.remove('trackdechets_token'); // Supprimer l'ancien cookie 
                    Cookies.set('trackdechets_token', new_token, {
                        expires: 12*30*24*60*60,//12 mois
                        path: '/',
                    });

                    // Vérifier immédiatement si le cookie est bien défini
                    const cookieValue = Cookies.get('trackdechets_token');
                    console.log("Cookie défini:", cookieValue);

                    const stockToken = async (new_token: string) => {
                        try {
                            const result = await fetch(`/api/auth_track_dechet/stock_token?user_id=${session.user_id}&token=${new_token}`);
                            if(result.status === 200){
                                console.log("token stocké !! ");
                            }
                        } catch (error) {
                            console.error("Erreur lors du stockage du token:", error);
                        }
                    }
                    stockToken(new_token);
                }
                
                // Attendre un peu avant de rediriger pour s'assurer que le cookie est bien défini
                setTimeout(() => {
                    const newUrl = window.location.origin + window.location.pathname;
                    window.location.replace(newUrl);
                }, 100);
            }
        }   
    }, [session]);

    let client_id = process.env.NEXT_PUBLIC_TRACK_CLIENT_ID_SANDBOX;
    if (process.env.NEXT_PUBLIC_TRACK_TYPE === "app") {
        client_id = process.env.NEXT_PUBLIC_TRACK_CLIENT_ID_APP;
    }
    const redirect_uri = encodeURIComponent(`${process.env.NEXT_PUBLIC_APP_URL}/api/auth_track_dechet/callback`);

    const handleAPIConnection = () => {
        //Attention remplaceer par app de manière dynamique !
        let url = `https://sandbox.trackdechets.beta.gouv.fr/oauth2/authorize/dialog?response_type=code&redirect_uri=${redirect_uri}&client_id=${client_id}`;
        if(process.env.NEXT_PUBLIC_TRACK_TYPE === "app") {
            url = `https://app.trackdechets.beta.gouv.fr/oauth2/authorize/dialog?response_type=code&redirect_uri=${redirect_uri}&client_id=${client_id}`;
        }
        console.log("url : ", url);
        window.location.href = url;
    }

    useEffect(() => {
        console.log("cookie dans useEffect : ", Cookies.get('trackdechets_token'));
    }, []);
    return (
        <div className="py-0 px-3 my-3 w-full rounded-md border-gray-300 border-[1px]">
            <div className="flex justify-between items-center">
                {/* <div className="text-md">Interfaces clients connectées</div> */}
                <ConnectedToTrack/>
                <button 
                    className="p-2 my-2 flex hover:bg-gray-100 active:bg-gray-200 rounded-xl text-xs font-thin justify-between items-center space-x-2"
                    onClick={handleAPIConnection}
                    title="Vous allez être redirigé vers la page de connexion TrackDéchet">
                    <div className="px-1 text-md text-white bg-green-800 rounded-full">+</div>
                    <div>Se connecter à TrackDéchets</div>
                </button>
            </div>
            {/* <ConnectedToTrack/> */}
        </div>
    );
}

export default BandeauAPI;

