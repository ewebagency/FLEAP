"use client";
import { supabase } from '@/app/database/supabaseClient';
import { useRouter } from 'next/navigation';
import { SessionMore, useSession } from '@/app/component/SessionProvider';
import { useState, useEffect } from 'react';
import BoxIcon from '@/app/component/BoxIconWrapper';

// Import components
import PersonalTab from './components/Personal/PersonalTab';
import FiliereTab from './components/Filiere/FiliereTab';
import SiteTab from './components/Site/SiteTab';
//import PermissionsTab from './components/Permissions/PermissionsTab';
import ParametrageTab from './components/ParametrageTable/ParametrageTab';
//import AutocompletionTab from './components/TableAutocompletion/AutocompletionTab';

export default function UserSettings() {
    const router = useRouter();
    const session = useSession() as SessionMore;
    const email = session?.user_email;
    const [activeTab, setActiveTab] = useState('tab_personal');
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
            
            <div className="w-[90%] mx-auto">
                <div role="tablist" className="tabs border-b border-gray-200 mb-8">
                    <a role="tab" 
                       className={`tab border-0 ${activeTab === 'tab_personal' ? 'border-b-4 border-green-500' : ''}`}
                       onClick={() => handleTabClick('tab_personal')}>
                       Informations personnelles
                    </a>
                    {/*<a role="tab" 
                       className={`tab border-0 ${activeTab === 'tab_filiere' ? 'border-b-4 border-green-500' : ''}`}
                       onClick={() => handleTabClick('tab_filiere')}>
                       Filière
                    </a>
                    <a role="tab" 
                       className={`tab border-0 ${activeTab === 'tab_site' ? 'border-b-4 border-green-500' : ''}`}
                       onClick={() => handleTabClick('tab_site')}>
                       Site
                    </a>*/}
                    {/*<a role="tab" 
                       className={`tab border-0 ${activeTab === 'tab_permissions' ? 'border-b-4 border-green-500' : ''}`}
                       onClick={() => handleTabClick('tab_permissions')}>
                       Permissions
                    </a>
                    <a role="tab" 
                       className={`tab border-0 ${activeTab === 'tab_parametrage' ? 'border-b-4 border-green-500' : ''}`}
                       onClick={() => handleTabClick('tab_parametrage')}>
                       Paramétrage
                    </a>*/}
                    {/*<a role="tab" 
                       className={`tab border-0 ${activeTab === 'tab_autocompletion' ? 'border-b-4 border-green-500' : ''}`}
                       onClick={() => handleTabClick('tab_autocompletion')}>
                       Table Autocomplétion
                    </a>*/}
                </div>

                {activeTab === 'tab_personal' && <PersonalTab email={email} currentProfile={currentProfile} />}
                {activeTab === 'tab_filiere' && <FiliereTab />}
                {activeTab === 'tab_site' && <SiteTab />}
                {/*activeTab === 'tab_permissions' && <PermissionsTab />*/}
                {activeTab === 'tab_parametrage' && <ParametrageTab />}
                {/*activeTab === 'tab_autocompletion' && <AutocompletionTab />*/}
            </div>
        </div>
    );
}
