import { ModalProviderNew } from "../RegisterComponents/Modal/ContextModal";
import ModalSource from "../RegisterComponents/Modal/ModalSource";

const ModalSourceBefore = () => {

    return (
        <div>
            <ModalProviderNew>
                <ModalSource/>
            </ModalProviderNew>
        </div>
    );
}
export default ModalSourceBefore;