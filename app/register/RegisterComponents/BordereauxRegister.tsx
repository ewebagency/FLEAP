'use client'
import { useEffect, useState } from 'react';
import { supabase } from '../../database/supabaseClient';
import { useSession } from '../../component/SessionProvider';
import { BoutonOpenModal } from './Modal/BoutonOpenModal';
import { useModalContextNew } from './Modal/ContextModal';
import { Filiere, useFilterContext } from '@/app/FilterContext';

const BordereauxRegister = () => {
    const session = useSession();
    const { filterPendingBSDs, setFilterPendingBSDs } = useModalContextNew();
    //const {filieres, setFilieres} = useFilterContext();
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
        <div className="bg-gray-100 p-2 rounded-lg shadow-sm mb-2">
            <div className="flex items-center justify-between">
                <BoutonOpenModal/>
                <div className="flex space-x-8">
                    {/*<div className="text-center">
                        <div className="text-2xl font-bold text-gray-800">{stats.collected}</div>
                        <div className="text-sm text-gray-600">BSD collectés</div>
                    </div>*/}
                    <div>
                        <button className={`text-center ${filterPendingBSDs ? 'text-[var(--green-medium)] font-bold' : 'text-gray-600'}`} onClick={() => setFilterPendingBSDs(!filterPendingBSDs)}>
                            <div className="text-2xl font-bold">{stats.pending}</div>
                            <div className={`text-sm ${filterPendingBSDs ? 'font-bold' : 'text-medium'}`}>En attente de collecte</div>
                        </button>
                    </div>

                    <div className="text-center hidden">
                        <div className="text-2xl font-bold text-gray-800">{stats.anomalies}</div>
                        <div className="text-sm text-gray-600">Anomalies</div>
                    </div>
                </div>
            </div>
        </div>
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
