"use client";
import React, { useEffect, useState } from 'react';
import { SessionMore, useSession } from './SessionProvider';
import { supabase } from '../database/supabaseClient';
import { useRouter, usePathname } from 'next/navigation';
import DetailsSideBar from './DetailsSideBar';
import FiltrePointCollecte from './FiltrePointCollecte';
import FiltreSiteEtablissement from '../import_page/FiltreSiteEtablissement';
import dynamic from 'next/dynamic';
import FiltreDate from './FiltreDate';
import CreationFiltrePerso from './FiltresPerso/CreationFiltrePerso';
import { FiltresPersoProvider } from './FiltresPerso/FiltresPersoProvider';

// Chargement dynamique de boxicons sans SSR
const BoxIcon = dynamic(
  () => import('boxicons').then((mod) => {
    // Importer boxicons globalement une fois chargé
    import('boxicons');
    // Retourner un composant wrapper
    return function BoxIconWrapper({ name, size, type, color }: {name?:string, size?:string, type?:string, color?:string}) {
      return <box-icon name={name} size={size} color={color}></box-icon>;
    };
  }),
  { ssr: false } // Désactiver le SSR pour ce composant
);

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
    const [isCollapsed, setIsCollapsed] = useState(false);
    const session = useSession() as SessionMore;
    const router = useRouter();
    const pathname = usePathname();
    const [userNames, setUserNames] = useState({first_name:'', last_name:''});
    const [cofounderPermission, setCofounderPermission] = useState(false);
    const [entreprise_name, setEntrepriseName] = useState('Chargement...');
    const [connected, setConnected] = useState(true);

    useEffect(()=>{
        if (session?.user_id){
            setConnected(true);
        }
    }, [session]);

    useEffect(()=>{
        if (session?.user_id && cofounders_user_id(session.user_id)){
            setCofounderPermission(true);
        }
    }, [session]);


    useEffect(()=>{
        async function fetchUserNames(){
            if (session?.user_id){
                const {data, error} = await supabase
                .from('profiles')
                .select('first_name, last_name, entreprise_id')
                .eq('user_id', session.user_id)
                .single();

                if(data){
                    setUserNames({first_name:data.first_name, last_name:data.last_name});
                    if (data.entreprise_id){
                        const {data:entreprise} = await supabase
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
    }, [session?.user_id])


    const handleLogout = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) {
                console.error('Error logging out:', error.message);
            } else {
                console.log("Déconnexion réussie, redirection en cours...");
                router.push('/auth/signin');
                setConnected(false);
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
        <div>
            {connected && 
                <div className={`menu h-screen bg-gray-100 ${isCollapsed ? 'w-16' : 'w-47'} p-4 flex flex-col transition-all duration-300 hidden md:flex ${props.className_props}`}>
                    <div className="flex-grow">
                        <div className="flex justify-between items-center mb-4">
                            {!isCollapsed && <h1 className="font-bold text-xl ml-4">{entreprise_name}</h1>}
                            <button 
                                onClick={() => setIsCollapsed(!isCollapsed)}
                                className="hover:bg-gray-300 p-2 rounded-full"
                            >
                                <BoxIcon 
                                    name={isCollapsed ? 'chevron-right' : 'chevron-left'} 
                                    size="sm"
                                />
                            </button>
                        </div>
                        
                        {!isCollapsed && (
                            <>
                                <FiltreSiteEtablissement/>
                                <FiltrePointCollecte/>
                                <FiltreDate/> 
                                <CreationFiltrePerso/>
                            </>
                        )}
                        <div className="h-[20px]"></div>
                        <ul className="space-y-1">
                            {(cofounderPermission || true) && (
                                <li>
                                    <a 
                                        href="/analysis" 
                                        className={`menu-item flex items-center px-2 py-1 rounded-lg text-gray-700 hover:bg-gray-300 active:bg-gray-400 ${
                                            pathname === '/analysis' ? 'bg-gray-200 text-[var(--green-medium)]' : ''
                                        } ${isCollapsed ? 'justify-center' : ''}`}
                                    >
                                        <BoxIcon name='stats' color={pathname === '/analysis' ? 'var(--green-medium)' : 'currentColor'} />
                                        {!isCollapsed && <span className="ml-2 text-sm font-semibold">Analyses</span>}
                                    </a>
                                </li>
                            )}
                            <li>
                                <a 
                                    href="/register" 
                                    className={`menu-item flex items-center px-2 py-1 rounded-lg text-gray-700 hover:bg-gray-300 active:bg-gray-200 ${
                                        pathname === '/register' ? 'bg-gray-200 text-[var(--green-medium)]' : ''
                                    } ${isCollapsed ? 'justify-center' : ''}`}
                                >
                                    <BoxIcon name='data' color={pathname === '/register' ? 'var(--green-medium)' : 'currentColor'} />
                                    {!isCollapsed && <span className="ml-2 text-sm font-semibold">Registre</span>}
                                </a>
                            </li>
                            <li>
                                <a 
                                    href="/import_page" 
                                    className={`menu-item flex items-center px-2 py-1 rounded-lg text-gray-700 hover:bg-gray-300 active:bg-gray-400 ${
                                        pathname === '/import_page' ? 'bg-gray-200 text-[var(--green-medium)]' : ''
                                    } ${isCollapsed ? 'justify-center' : ''}`}
                                >
                                    <BoxIcon name='import' color={pathname === '/import_page' ? 'var(--green-medium)' : 'currentColor'} />
                                    {!isCollapsed && <span className="ml-2 text-sm font-semibold">Importer</span>}
                                </a>
                            </li>
                            {cofounderPermission && (
                                <li>
                                    <a 
                                        href="/interface_admin_2" 
                                        className={`menu-item flex items-center px-2 py-1 rounded-lg text-gray-700 hover:bg-gray-300 active:bg-gray-400 ${
                                            pathname === '/interface_admin_2' ? 'bg-gray-200 text-[var(--green-medium)]' : ''
                                        } ${isCollapsed ? 'justify-center' : ''}`}
                                    >
                                        <BoxIcon name='file' color={pathname === '/interface_admin_2' ? 'var(--green-medium)' : 'currentColor'} />
                                        {!isCollapsed && <span className="ml-2 text-sm font-semibold">Vérification</span>}
                                    </a>
                                </li>
                            )}
                            {cofounderPermission && (
                                <li>
                                    <a 
                                        href="/lien" 
                                        className={`menu-item flex items-center px-2 py-1 rounded-lg text-gray-700 hover:bg-gray-300 active:bg-gray-400 ${
                                            pathname === '/lien' ? 'bg-gray-200 text-[var(--green-medium)]' : ''
                                        } ${isCollapsed ? 'justify-center' : ''}`}
                                    >
                                        <BoxIcon type='solid' name='cross' color={pathname === '/lien' ? 'white' : 'currentColor'} />
                                        {!isCollapsed && <span className="ml-2 text-sm font-semibold">Factures - BSDs</span>}
                                    </a>
                                </li>
                            )}
                        </ul>
                    </div>
                    {!isCollapsed && <DetailsSideBar 
                        session={!!session}
                        userNames={userNames} 
                        handleParameterPage={handleParameterPage} 
                        handleLogout={handleLogout}
                    />}
                </div>
            }
        </div>
    )
}

export default SideBar
