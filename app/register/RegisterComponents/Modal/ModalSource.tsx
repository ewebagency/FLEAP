import { useModalContextNew } from "./ContextModal";
import { getDataAutocompletion } from "./utils_new";
import { useSession } from "@/app/component/SessionProvider";
import { useEffect } from "react";
import { FormInput } from "../../interface/BSD_Interface";
import FormulaireNew from "./FormulaireNew";
import { MailProvider } from "../../MailComponents/MailContext";


const ModalSource = () => {
    const session = useSession();
    const { setDataToogle, setOptions, setModalType, displayFormulaire } = useModalContextNew();
    
    /*useEffect(() => {
        const fetchData = async () => {
            if (session && session.user_id && session.entreprise_id) {
                const data = await getDataAutocompletion(session.entreprise_id) as FormInput[];
                if (data && data.length > 0) {  
                    //setDataToogle(data[0]);
                    setOptions(data);
                    //setModalType('modify');
                }
            }
        };
        fetchData();
    }, [session]);*/

    
    return (
        <div>
            <MailProvider>
                {displayFormulaire && 
                    <div>
                        <FormulaireNew/>
                    </div>
                }
            </MailProvider>
        </div>
    );
}

export default ModalSource;
