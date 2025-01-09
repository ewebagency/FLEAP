'use client'
import { useEffect, useState } from 'react';
import { supabase } from '../../database/supabaseClient';
import { useSession } from '../../component/SessionProvider';
import { BoutonOpenModal } from './Modal/BoutonOpenModal';

const BordereauxRegister = () => {
    const session = useSession();
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
                .in('status_track_dechets', ['Collecté', 'SENT', 'Traité', 'PROCESSED']);

            const { data: pendingData, error: pendingError } = await supabase
                .from('bsd')
                .select('count')
                .eq('entreprise_id', session.entreprise_id)
                .in('status_track_dechets', ['Collecte demandée', 'SEALED', 'SIGNED_BY_PRODUCER']);

            if (!collectedError && !pendingError) {
                setStats({
                    collected: collectedData?.[0]?.count || 0,
                    pending: pendingData?.[0]?.count || 0,
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
                    <div className="text-center">
                        <div className="text-2xl font-bold text-gray-800">{stats.collected}</div>
                        <div className="text-sm text-gray-600">BSD collectés</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-gray-800">{stats.pending}</div>
                        <div className="text-sm text-gray-600">En attente de collecte</div>
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

