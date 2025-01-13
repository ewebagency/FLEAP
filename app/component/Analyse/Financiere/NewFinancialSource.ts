/*import { supabase } from "@/app/database/supabaseClient";
import { SessionMore, useSession } from "../../SessionProvider";
import { useEffect, useState } from "react";

const NewFinancialSource = () => {

    const session = useSession() as SessionMore;
    const entreprise_id = session.entreprise_id;
    const [factures, setFactures] = useState<Facture[]>([]);
    
    useEffect(() => {
        const fetchFactures = async () => {
            const { data: factures, error } = await supabase
                .from('factures')
                .select('*')
                .eq('entreprise_id', entreprise_id)
            if (error) {
                console.error('Error fetching factures:', error);
            } else {
                setFactures(factures);
            }
        }
        fetchFactures();
    }, []);

    return (
        <div>
            <h1>NewFinancialSource</h1>
        </div>
    );
};

export default NewFinancialSource;*/