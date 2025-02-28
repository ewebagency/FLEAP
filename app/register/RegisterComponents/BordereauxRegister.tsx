'use client'
import { useEffect, useState } from 'react';
import { supabase } from '../../database/supabaseClient';
import { useSession } from '../../component/SessionProvider';
import { BoutonOpenModal } from './Modal/BoutonOpenModal';
import { useModalContextNew } from './Modal/ContextModal';
import { Filiere, useFilterContext } from '@/app/FilterContext';
import NewDemandeMailButon from '../DemandeCollecteNew/NewDemandeMailButton';
import { RowBSD } from "../interface/BSD_Interface";

const BordereauxRegister = () => {
    const session = useSession();
    const { filterPendingBSDs, setFilterPendingBSDs } = useModalContextNew();
    const [stats, setStats] = useState({
        collected: 0,
        pending: 0,
        anomalies: 0
    });

    useEffect(() => {
        const fetchStats = async () => {
            if (!session?.entreprise_id) return;

            const { data: collectedData, error: collectedError } = await supabase
                .from('bsd')
                .select('count')
                .eq('entreprise_id', session.entreprise_id)
                .in('status_track_dechets', ['Collecté', 'SENT', 'Traité', 'Accepté', 'AWAITING_GROUP', 'GROUPED', 'ACCEPTED', 'PROCESSED']);
            
            /*const ListStatusEnAttente = ['Collecté', 'SENT', 'Traité', 'Accepté', 'AWAITING_GROUP', 'GROUPED', 'ACCEPTED', 'PROCESSED'];
            const response = await fetch(`/api/get_data_bsd?entreprise_id=${session.entreprise_id}&forceReload=${false}`);
            const { data: BSDs } = await response.json();
            const collectedData = BSDs.filter(bsd => ListStatusEnAttente.includes(bsd.status_track_dechets));*/

            const pendingData = await getPendingBSDs(session.entreprise_id);

            if (!collectedError && !pendingData!==null) {
                setStats({
                    collected: collectedData?.[0]?.count || 0,
                    pending: pendingData?.length || 0,
                    anomalies: 0
                });
            }
        };

        fetchStats();
    }, [session?.entreprise_id]);

    return (
        <>
            {/* Version Mobile */}
            <div className="md:hidden">
                <div className={`w-full bg-white rounded-lg shadow-sm p-3 mb-2 flex items-center justify-between
                    ${filterPendingBSDs ? 'border-2 border-[var(--green-medium)]' : 'border border-gray-200'}`}
                >
                    <div className="flex-grow">
                        {/*<BoutonOpenModal />*/}
                        <NewDemandeMailButon/>
                    </div>
                </div>
                </div>

            {/* Version Desktop */}
            <div className="hidden md:block bg-gray-100 p-2 rounded-lg shadow-sm mb-2">
                <div className="flex items-center justify-between">
                    <div className="flex space-x-2">
                    <NewDemandeMailButon/>
                    {/*<BoutonOpenModal/>*/}
                    </div>
                    <div className="flex space-x-8">
                        <div>
                            {/*<button className={`text-center ${filterPendingBSDs ? 'text-[var(--green-medium)] font-bold' : 'text-gray-600'}`} 
                                    onClick={() => setFilterPendingBSDs(!filterPendingBSDs)}>}*/}
                                <div className="text-2xl font-bold">{stats.pending}</div>



                                <div className={`text-sm ${filterPendingBSDs ? 'font-bold' : 'text-medium'}`}>
                                    En attente de collecte
                                </div>
                            {/*</button>*/}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default BordereauxRegister;

export const getPendingBSDs = async (entrepriseId:string) => {
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
}
