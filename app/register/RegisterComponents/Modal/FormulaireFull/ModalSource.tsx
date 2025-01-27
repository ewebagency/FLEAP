import { useModalContextNew } from "../ContextModal";
import FormulaireFull from "./FormulaireFull";
import FormulaireMobile from "./FormulaireMobile";
import { useEffect, useState } from "react";

const ModalSource = () => {
    const { displayFormulaire } = useModalContextNew();
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        // Fonction pour vérifier si l'écran est en mode mobile
        const checkIfMobile = () => {
            setIsMobile(window.innerWidth <= 768); // 768px est une breakpoint commune pour mobile
        };

        // Vérifier initialement
        checkIfMobile();

        // Ajouter un listener pour les changements de taille d'écran
        window.addEventListener('resize', checkIfMobile);

        // Cleanup
        return () => window.removeEventListener('resize', checkIfMobile);
    }, []);
    
    return (
        <div>
            {displayFormulaire && (
                isMobile ? <FormulaireMobile /> : <FormulaireFull />
            )}
            {/*displayFormulaire && <FormulaireNew/>*/}
        </div>
    );
}

export default ModalSource;
