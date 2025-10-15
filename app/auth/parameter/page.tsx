"use client";
import { supabase } from '@/app/database/supabaseClient';
import { useRouter } from 'next/navigation';
import { SessionMore, useSession } from '@/app/component/SessionProvider';
import { useState, useEffect } from 'react';
import BoxIcon from '@/app/component/BoxIconWrapper';
import { cofounders_user_id } from '@/app/component/SideBar';

// Import components
import PersonalTab from './components/Personal/PersonalTab';
import FiliereNomTab from './components/FiliereNom/FiliereNomTab';
import SiteTab from './components/Site/SiteTab';
//import PermissionsTab from './components/Permissions/PermissionsTab';
import ParametrageTab from './components/ParametrageTable/ParametrageTab';
import AutocompletionTab from './components/TableAutocompletion/AutocompletionTab';
//import FormatDataTab from './components/ClusterParams/FormatDataTab';
import MetaClusterParamsTab from './components/MetaClusterParams/MetaClusterParamsTab';
import { RAW_FIELD_CLASS, REFERENCE_ENTITY_CLASS, ENTITY_CATEGORY_CLASS } from './components/MetaClusterParams/fieldStyles';

export default function UserSettings() {
    const router = useRouter();
    const session = useSession() as SessionMore;
    const email = session?.user_email;
    const [activeTab, setActiveTab] = useState('tab_personal');
    const [showSiteSection, setShowSiteSection] = useState<boolean>(true);
    const [showFiliereNomSection, setShowFiliereNomSection] = useState<boolean>(true);
    const [currentProfile, setCurrentProfile] = useState<{first_name?: string, last_name?: string, phone?: string} | null>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            if (session) {
                const { data } = await supabase
                    .from('profiles')
                    .select('first_name, last_name, phone')
                    .eq('user_id', session.user_id)
                    .single();
                setCurrentProfile(data);
            }
        };
        fetchProfile();
    }, [session]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/auth/signin');
    };

    const handleTabClick = (tab: string) => {
        setActiveTab(tab);
    };

    return (
        <div className="flex flex-col min-h-screen bg-gray-100">
            <div className="absolute top-4 right-4">
                <button
                    onClick={handleSignOut}
                    className="bg-red-700 hover:bg-red-800 text-sm text-white px-2 py-1 rounded-lg flex items-center gap-2"
                >
                    <BoxIcon name='log-out' size="sm" color="currentColor" />
                    Déconnexion
                </button>
            </div>

            <h1 className="text-4xl font-bold text-green-800 mb-8 text-center mt-8">Paramètres</h1>
            
            <div className="w-[95%] mx-auto">
                <div role="tablist" className="tabs border-b border-gray-200 mb-8">
                    <a role="tab" 
                       className={`tab border-0 ${activeTab === 'tab_personal' ? 'border-b-4 border-green-500' : ''}`}
                       onClick={() => handleTabClick('tab_personal')}>
                       Informations personnelles
                    </a>
                    <a role="tab" 
                       className={`tab border-0 ${activeTab === 'tab_autocompletion' ? 'border-b-4 border-green-500' : ''}`}
                       onClick={() => handleTabClick('tab_autocompletion')}>
                       Entités de référence
                    </a>
                    {cofounders_user_id(session?.user_id) && (
                        <a role="tab" 
                            className={`tab border-0 ${activeTab === 'tab_meta_cluster_params' ? 'border-b-4 border-green-500' : ''}`}
                            onClick={() => handleTabClick('tab_meta_cluster_params')}>
                            Association des champs bruts
                        </a>
                    )}
                    <a role="tab" 
                        className={`tab border-0 ${activeTab === 'tab_categorie' ? 'border-b-4 border-green-500' : ''}`}
                        onClick={() => handleTabClick('tab_categorie')}>
                        Regroupement par catégorie
                    </a>
                    {/*<a role="tab" 
                       className={`tab border-0 ${activeTab === 'tab_permissions' ? 'border-b-4 border-green-500' : ''}`}
                       onClick={() => handleTabClick('tab_permissions')}>
                       Permissions
                    </a>*/}
                    {/*<a role="tab" 
                       className={`tab border-0 ${activeTab === 'tab_parametrage' ? 'border-b-4 border-green-500' : ''}`}
                       onClick={() => handleTabClick('tab_parametrage')}>
                       Paramétrage
                    </a>*/}
                </div>

                {activeTab === 'tab_personal' && <PersonalTab email={email} currentProfile={currentProfile} />}
                {/*activeTab === 'tab_filiere' && <FiliereTab />*/}
                {activeTab === 'tab_categorie' && (
                    <div className="bg-white rounded-lg shadow p-6 space-y-6">
                        <div className="rounded-lg">
                            <button
                                className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-200"
                                onClick={() => setShowSiteSection(s => !s)}
                            >
                                <div className="flex items-center justify-between w-full gap-4">
                                    <div className="flex flex-col items-start gap-1">
                                        <div className="text-lg font-semibold text-gray-800">Site</div>
                                        <div className="text-xs text-gray-600">Regrouper des sites</div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2 text-xs text-gray-600 select-none">
                                            <span className={REFERENCE_ENTITY_CLASS}>Sites</span>
                                            <span>→</span>
                                            <span className={ENTITY_CATEGORY_CLASS}>Groupe de sites</span>
                                        </div>
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className={`h-5 w-5 text-gray-500 transform transition-transform ${showSiteSection ? 'rotate-180' : ''}`}
                                            viewBox="0 0 20 20" fill="currentColor"
                                        >
                                            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.061l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.06z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                </div>
                            </button>
                            {showSiteSection && (
                                <div className="pt-4">
                                    <SiteTab />
                                </div>
                            )}
                        </div>

                        <div className="rounded-lg">
                            <button
                                className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-200"
                                onClick={() => setShowFiliereNomSection(s => !s)}
                            >
                                <div className="flex items-center justify-between w-full gap-4">
                                    <div className="flex flex-col items-start gap-1">
                                        <div className="text-lg font-semibold text-gray-800">Filières</div>
                                        <div className="text-xs text-gray-600">Regrouper vos noms de déchets par filière.</div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2 text-xs text-gray-600 select-none">
                                            <span className={RAW_FIELD_CLASS}>Noms de déchets</span>
                                            <span>→</span>
                                            <span className={ENTITY_CATEGORY_CLASS}>Filière</span>
                                        </div>
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className={`h-5 w-5 text-gray-500 transform transition-transform ${showFiliereNomSection ? 'rotate-180' : ''}`}
                                            viewBox="0 0 20 20" fill="currentColor"
                                        >
                                            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.061l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.06z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                </div>
                            </button>
                            {showFiliereNomSection && (
                                <div className="pt-4">
                                    <FiliereNomTab />
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {/*activeTab === 'tab_permissions' && <PermissionsTab />*/}
                {activeTab === 'tab_parametrage' && <ParametrageTab />}
                {activeTab === 'tab_autocompletion' && <AutocompletionTab />}
                {/*activeTab === 'tab_format_data' && <FormatDataTab />*/}
                {activeTab === 'tab_meta_cluster_params' && <MetaClusterParamsTab />}
            </div>
        </div>
    );
}
