import Formulaire from "./Formulaire";
import { useModalContextNew } from "./ContextModal";
import { getDataAutocompletion } from "./utils";
import { useSession } from "@/app/component/SessionProvider";
import { useEffect } from "react";
import { DataTotalInterface } from "../../interface/BSD_Interface";
import ModifyCard from "./ModifyCard";


const ModalSource = () => {
    const session = useSession();
    const { setDataTotal, setOptions, setModalType, displayFormulaire } = useModalContextNew();
    
    useEffect(() => {
        const fetchData = async () => {
            if (session && session.user && session.user.id) {
                const data = await getDataAutocompletion(session.user.id) as DataTotalInterface[];
                if (data && data.length > 0) {  
                    setDataTotal(data[0]);
                    setOptions(data);
                    //setModalType('modify');
                }
            }
        };
        fetchData();
    }, [session]);

    
    return (
        <div>
            {displayFormulaire && 
                <div>
                    <Formulaire/>
                </div>
            }
        </div>
    );
}

export default ModalSource;
