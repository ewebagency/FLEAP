import { useEffect, useState } from "react";
import { supabase } from "../database/supabaseClient";
import { useSession } from "../component/SessionProvider";

// Modifier le type FormDataType pour inclure un id
type BSD = {
    id: string;
    infos_json: {
        dechet_et_conditionnement: {
            code_ced: string;
            dechet_dangereux_facultatif: {
                code_adr: string;
                code_onu: string;
            };
            quantite: {
                collectee: string | number;
            };
        };
        acteurs: {
            site_emeteur: {
                adresse_collecte: string;
            };
        };
    };
};

const fetchBSDs = async (user_id: string | null) => {
    console.log("user_id : ", user_id);
    const { data, error } = await supabase
    .from('bsd')
    .select('id, infos_json')
    .eq('user_id', user_id);
    if(error){
        console.error("Error fetching BSD:", error);
    } else {
        console.log("BSDs fetched");
        return data;
    }
}

const TableBSD = () => {
    const session = useSession();
    const [bsds, setBSDs] = useState<BSD[]>([]);

    useEffect(() => {
        const loadBSDs = async () => {
            if (session?.user?.id) {
                try {
                    const data = await fetchBSDs(session.user.id);
                    if (data) {
                        console.log("data : ", data);
                        setBSDs(data);
                    }
                } catch (error) {
                    console.error("Error loading BSDs:", error);
                }
            }
        };
        loadBSDs();
    }, [session]); // Dépendance à session uniquement

    return (
        <div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ backgroundColor: '#f2f2f2' }}>
                        <th style={{ padding: '10px', border: '1px solid #ddd' }}>Code CED</th>
                        <th style={{ padding: '10px', border: '1px solid #ddd' }}>Adresse Collecte</th>
                        <th style={{ padding: '10px', border: '1px solid #ddd' }}>Code ADR</th>
                        <th style={{ padding: '10px', border: '1px solid #ddd' }}>Code ONU</th>
                        <th style={{ padding: '10px', border: '1px solid #ddd' }}>Quantité Collectée</th>
                    </tr>
                </thead>
                <tbody>
                    { bsds.map((bsd) => (
                        <tr key={bsd.id} style={{ borderBottom: '1px solid #ddd' }}>
                            <td style={{ padding: '10px', border: '1px solid #ddd' }}>{bsd.infos_json.dechet_et_conditionnement.code_ced}</td>
                            <td style={{ padding: '10px', border: '1px solid #ddd' }}>{bsd.infos_json.acteurs.site_emeteur.adresse_collecte}</td>
                            <td style={{ padding: '10px', border: '1px solid #ddd' }}>{bsd.infos_json.dechet_et_conditionnement.dechet_dangereux_facultatif.code_adr}</td>
                            <td style={{ padding: '10px', border: '1px solid #ddd' }}>{bsd.infos_json.dechet_et_conditionnement.dechet_dangereux_facultatif.code_onu}</td>
                            <td style={{ padding: '10px', border: '1px solid #ddd' }}>{bsd.infos_json.dechet_et_conditionnement.quantite.collectee}</td>
                        </tr>
                    )) }
                </tbody>
            </table>
        </div>
    )
}

export default TableBSD
