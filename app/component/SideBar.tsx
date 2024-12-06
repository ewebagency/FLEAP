"use client";
import React, { useEffect, useState } from 'react';
import { SessionMore, useSession } from './SessionProvider';
import { supabase } from '../database/supabaseClient';
import { useRouter } from 'next/navigation';
import { Session } from '@supabase/supabase-js';
import DetailsSideBar from './DetailsSideBar';
import FiltreSite from './FiltreSite';
import FiltreDate from './FiltreDate';


interface SideBarProps {
    className_props: string;
}

const cofounders_user_id = (user_id:string|null) => {
    if (user_id){
        if (user_id == "a0542794-bbae-4132-9dde-485595bfa2aa" || user_id == "8f05a291-f8b3-429d-839e-6f0b12f1bede" || user_id == "dd9acb15-4678-442f-af72-79331bc43d91"){
            return true;
        }
    }
    return false;
}

const SideBar = (props:SideBarProps) => {
    const session = useSession() as SessionMore;
    const router = useRouter();
    const [userNames, setUserNames] = useState({first_name:'', last_name:''});
    const [cofounderPermission, setCofounderPermission] = useState(false);
    const [entreprise_name, setEntrepriseName] = useState('Chargement...');

    useEffect(()=>{
        if (session?.user_id && cofounders_user_id(session.user_id)){
            setCofounderPermission(true);
        }
    }, [session]);


    useEffect(()=>{
        async function fetchUserNames(){
            if (session?.user?.id){
                const {data, error} = await supabase
                .from('profiles')
                .select('first_name, last_name, entreprise_id')
                .eq('user_id', session.user.id)
                .single();

                if(data){
                    setUserNames({first_name:data.first_name, last_name:data.last_name});
                    if (data.entreprise_id){
                        const {data:entreprise, error:error_entreprise} = await supabase
                        .from('entreprise')
                        .select('name')
                        .eq('id', data.entreprise_id)
                        .single();
                        if (entreprise){
                            setEntrepriseName(entreprise.name);
                        }
                    }
                } else if (error) {
                    console.error('Error fetching user profile:', error);
                }
            }
        }
        fetchUserNames();
    }, [session?.user?.id])


    const handleLogout = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) {
                console.error('Error logging out:', error.message);
            } else {
                console.log("Déconnexion réussie, redirection en cours...");
                router.push('/auth/signin');
            }
        } catch (err) {
            console.error("Erreur inattendue lors de la déconnexion :", err);
        }
        console.log("Fin de la fonction handleLogout");
    };

      const handleParameterPage = () => {
        router.push('/auth/parameter');
      }

    return (
        <div className={`menu h-screen bg-base-200 w-60 p-4 flex flex-col ${props.className_props}`}>
            <div className="flex-grow">
                <h1 className="font-bold text-xl mb-4 ml-4">{entreprise_name}</h1>
                <FiltreSite/>
                {/*<FiltreDate/>*/}
                <ul className="space-y-2">
                    {cofounderPermission && <li><a href="/analysis" className="menu-item">Analyses</a></li>}
                    <li><a href="/register" className="menu-item">Registre</a></li>
                    <li><a href="/import_page" className="menu-item">Importer</a></li>
                    {cofounderPermission && <li><a href="/interface_admin_2" className="menu-item">Vérification de factures</a></li>}
                    {cofounderPermission && <li><a href="/lien" className="menu-item">Lien entre Factures et BSDs</a></li>}
                </ul>
            </div>
            <DetailsSideBar 
                session={!!session} // Convert session to boolean
                userNames={userNames} 
                handleParameterPage={handleParameterPage} 
                handleLogout={handleLogout}
            />
        </div>
    )
}

export default SideBar
