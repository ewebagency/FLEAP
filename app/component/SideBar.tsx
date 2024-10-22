"use client";
import React, { useEffect, useState } from 'react';
import { useSession } from './SessionProvider';
import { supabase } from '../database/supabaseClient';
import { useRouter } from 'next/navigation';
import { Session } from '@supabase/supabase-js';
import DetailsSideBar from './DetailsSideBar';


interface SideBarProps {
    className_props: string;
}

const SideBar = (props:SideBarProps) => {
    const session = useSession() as Session | null;
    const router = useRouter();
    const [userNames, setUserNames] = useState({first_name:'', last_name:''});

    useEffect(()=>{
        async function fetchUserNames(){
            if (session?.user?.id){
                const {data, error} = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('user_id', session.user.id)
                .single();

                if(data){
                    setUserNames({first_name:data.first_name, last_name:data.last_name});
                } else if (error) {
                    console.error('Error fetching user profile:', error);
                }
            }
        }
        fetchUserNames();
    })


    const handleLogout = async () => {
        router.push('/auth/signin');
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Error logging out:', error.message);
        } else {
            router.push('/auth/signin'); // Redirige vers la page de connexion après la déconnexion
        }
        console.log("Fin de la fonction handleLogout");
    };

      const handleParameterPage = () => {
        router.push('/auth/parameter');
      }

    return (
        <div className={`menu h-screen bg-base-200 w-60 p-4 flex flex-col ${props.className_props}`}>
            <div className="flex-grow">
                <h1 className="font-bold text-xl mb-4">Menu</h1>
                <ul className="space-y-2">
                    <li><a href="/analysis" className="menu-item">Analyses</a></li>
                    <li><a href="/register" className="menu-item">Registre</a></li>
                    <li><a href="/import_page" className="menu-item">Importer</a></li>
                    <li><a href="/interface_admin" className="menu-item">Vérification de factures</a></li>
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
