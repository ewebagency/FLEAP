import { useModalContextNew } from "./ContextModal";
import { useSession } from "@/app/component/SessionProvider";
import FormulaireNew from "./FormulaireNew";

const ModalSource = () => {
    const { displayFormulaire } = useModalContextNew();
    
    return (
        <div>
            {displayFormulaire && <FormulaireNew/>}
        </div>
    );
}

export default ModalSource;
