import { useModalContextNew } from "../ContextModal";
import FormulaireFull from "./FormulaireFull";

const ModalSource = () => {
    const { displayFormulaire } = useModalContextNew();
    
    return (
        <div>
            {displayFormulaire && <FormulaireFull/>}
            {/*displayFormulaire && <FormulaireNew/>*/}
        </div>
    );
}

export default ModalSource;
