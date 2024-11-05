// contexts/ModalReloadContext.tsx
import { createContext, useContext, useState } from 'react';

// Define the context type
type ModalContextType = {
    modalId: string | null;
    setModalId: (value: string | null) => void;
    modalType: string;
    setModalType: (value: string) => void;
    modalReload: boolean;
    setModalReload: (value: boolean) => void;
};

// Create context with initial value
const ModalContext = createContext<ModalContextType>({
    modalId: "",
    setModalId: () => {},
    modalType: "",
    setModalType: () => {},
    modalReload: false,
    setModalReload: () => {},
});

// Hook personnalisé pour faciliter l'utilisation
export const useModal = () => useContext(ModalContext);

// Provider du contexte
export const ModalProvider = ({ children }: { children: React.ReactNode }) => {
    const [modalId, setModalId] = useState<string | null>("");
    const [modalType, setModalType] = useState("");
    const [modalReload, setModalReload] = useState(false);

    return (
        <ModalContext.Provider value={{ modalId, setModalId, modalType, setModalType, modalReload, setModalReload }}>
            {children}
        </ModalContext.Provider>
    );
};
