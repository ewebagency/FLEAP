'use client'
import { useEffect, useState } from 'react';
import { supabase } from '../../database/supabaseClient';
import { useSession } from '../../component/SessionProvider';
import { BoutonOpenModal } from './Modal/BoutonOpenModal';
import { useModalContextNew } from './Modal/ContextModal';
import { Filiere, useFilterContext } from '@/app/FilterContext';
import NewDemandeMailButon from '../DemandeCollecteNew/NewDemandeMailButton';
import { RowBSD } from "../interface/BSD_Interface";
import NewFormulaireDemande from '../DemandeCollecteNew/NewFormulaireDemande';
import OpenFormulaireButton from '../DemandeCollecteAutocompletion/OpenFormulaireButton';
import Formulaire from '../DemandeCollecteAutocompletion/Formulaire';
import { checkIsOnDemandRevalidate } from 'next/dist/server/api-utils';


export const ListStatusEnAttente = ['Ligne créée automatiquement', 'Ligne demandée', 'Collecte demandée', 'REFUSED', 'CANCELED'];

const BordereauxRegister = () => {
    const {entreprise_id, user_id} = useSession();
    const { filterPendingBSDs, setFilterPendingBSDs } = useModalContextNew();
    const [showFormulaire, setShowFormulaire] = useState(false);
    const [stats, setStats] = useState({
        //collected: 0,
        pending: 0,
        anomalies: 0
    });


    useEffect(() => {
        const fetchStats = async () => {
            if (!entreprise_id) return;

            const { data: siteAccess, error: siteAccessError } = await supabase
                .from('profiles')
                .select('site_access')
                .eq('user_id', user_id)
                .single();

            if (siteAccessError) {
                console.error('Erreur lors de la récupération des sites :', siteAccessError);
                return;
            }
            
            let query = supabase
                .from('bsd')
                .select('count')
                .eq('entreprise_id', entreprise_id)
                .in('status_track_dechets', ListStatusEnAttente);

            // Si site_access existe et n'est pas vide, on ajoute le filtre sur les siret
            if (siteAccess?.site_access?.length > 0) {
                const siretConditions = siteAccess.site_access
                    .map((site: string) => `infos_json->formAPI->createFormInput->emitter->company->>siret.eq.${site}`)
                    .join(',');
                query = query.or(siretConditions);
            }

            const { data: pendingData, error: pendingError } = await query;
            

            /*const response = await fetch(`/api/get_data_bsd?entreprise_id=${session.entreprise_id}&forceReload=${false}`);
            const { data: BSDs } = await response.json();
            const collectedData = BSDs.filter(bsd => ListStatusEnAttente.includes(bsd.status_track_dechets));*/

            //const pendingData = await getPendingBSDs(session.entreprise_id);

            if (!pendingError) {
                setStats({
                    pending: pendingData?.[0]?.count || 0,
                    //pending: pendingData?.length || 0,
                    anomalies: 0
                });
            }
        };

        fetchStats();
    }, [entreprise_id]);

    return (
        <>
            {/* Version Mobile */}
            <div className="md:hidden">
                <div className={`w-full bg-white rounded-lg shadow-sm p-3 mb-2 flex items-center justify-between
                    ${filterPendingBSDs ? 'border-2 border-[var(--green-medium)]' : 'border border-gray-200'}`}
                >
                    <div className="flex-grow">
                        {/*<NewDemandeMailButon/>*/}
                        <OpenFormulaireButton onClick={() => setShowFormulaire(true)} />
                        {showFormulaire && <Formulaire setDisplayThis={setShowFormulaire} />}
                    </div>
                    <div className="border border-[var(--green-medium)] rounded-lg ml-2">
                        <button className={`text-center py-1.5 px-2 rounded-lg ${filterPendingBSDs ? 'text-white bg-[var(--green-medium)]' : 'text-gray-600 bg-gray-50 hover:bg-white'}`} 
                                onClick={() => setFilterPendingBSDs(!filterPendingBSDs)}>
                            <div className="text-xl font-bold hidden">{stats.pending}</div>
                            <div className={`text-xs`}>
                                En attente
                            </div>
                            <div className={`text-xs`}>de collecte</div>
                        </button>
                    </div>
                </div>
            </div>

            {/* Version Desktop */}
            <div className="hidden md:block bg-gray-100 p-2 rounded-lg shadow-sm mb-2">
                <div className="flex items-center justify-between">
                    <div className="flex space-x-2">
                    {/*<NewDemandeMailButon/>*/}
                    {/*<BoutonOpenModal/>*/}
                    <OpenFormulaireButton onClick={() => setShowFormulaire(true)} />
                    {showFormulaire && <Formulaire setDisplayThis={setShowFormulaire} />}
                    </div>
                    <div className="flex space-x-8">
                        <div className='border border-[var(--green-medium)] rounded-lg hidden'>
                            <button className={`text-center p-2 rounded-lg ${filterPendingBSDs ? 'text-white bg-[var(--green-medium)]' : 'text-gray-600 bg-gray-50 hover:bg-white'}`} 
                                    onClick={() => setFilterPendingBSDs(!filterPendingBSDs)}>
                                <div className="text-2xl font-bold">{stats.pending}</div>

                                <div className={`text-sm ${filterPendingBSDs ? 'font-bold' : 'text-medium'}`}>
                                    En attente de collecte
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default BordereauxRegister;

/*export const getPendingBSDs = async (entrepriseId:string) => {
    const { data: collectedData, error: collectedError } = await supabase
        .from('bsd')
        .select('*')
        .eq('entreprise_id', entrepriseId)
        .in('status_track_dechets', ['Collecte demandée', 'SEALED', 'SIGNED_BY_PRODUCER', 'Ligne créée', 'Ligne créée automatiquement'])

    if (collectedError) {
        console.error('Erreur lors de la récupération des BSD en attente de collecte :', collectedError);
        return null;
    }  

    return collectedData;
}*/
