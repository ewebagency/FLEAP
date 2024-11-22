import React, { createContext, useContext, useState, ReactNode } from 'react';
import { DataTotalInterface } from '../../interface/BSD_Interface';

/*interface this_FormAPI {
  formAPI?: {
      createFormInput?: {
          emitter?: {
              company?: {
                  siret?: string;
                  name?: string;
                  address?: string;
                  contact?: string;
                  phone?: string;
                  mail?: string;
              };
              workSite?: {
                  address?: string;
                  postalCode?: string;
                  city?: string;
              } | null;
          };
          recipient?: {
              cap?: string;
              company?: {
                  siret?: string;
                  name?: string;
                  address?: string;
                  contact?: string;
                  phone?: string;
                  mail?: string;
              };
              processingOperation?: string;
          };
          transporter?: {
              company?: {
                  siret?: string;
                  name?: string;
                  address?: string;
                  contact?: string;
                  phone?: string;
                  mail?: string;
              };
          };
          wasteDetails?: {
              code?: string;
              name?: string;
              onuCode?: string;
              quantity?: number | string;
              quantityType?: string;
              consistence?: string;
              packagingInfos?: {
                  type?: string;
                  quantity?: string | number;
                  description?: string;
                  unitVolume?: number;
              }[];
          };
      };
  };
}*/


// Définir le type pour le contexte
interface ModalContextType {
    displayFormulaire: boolean;
    setDisplayFormulaire: (value: boolean) => void;
    dataTotal: DataTotalInterface;
    setDataTotal: (data: DataTotalInterface) => void;
    options: DataTotalInterface[];
    setOptions: (options: DataTotalInterface[]) => void;

    modalId: string | null;
    setModalId: (modalId: string | null) => void;
    modalType: string; //'display' ou 'modify' ou un truc dans le genre (si rien alors on ne display pas la DisplayCard)
    setModalType: (modalType: string) => void;
    modalReload: boolean;
    setModalReload: (modalReload: boolean) => void;
}

// Créer le contexte
const ModalContextNew = createContext<ModalContextType>({} as ModalContextType);

// Créer un fournisseur de contexte
export const ModalProviderNew = ({ children }: { children: ReactNode }) => {
    const [displayFormulaire, setDisplayFormulaire] = useState<boolean>(false);
    
    const [dataTotal, setDataTotal] = useState<DataTotalInterface>({} as DataTotalInterface);
    const [options, setOptions] = useState<DataTotalInterface[]>([]);

    const [modalId, setModalId] = useState<string | null>("");
    const [modalType, setModalType] = useState("");
    const [modalReload, setModalReload] = useState(false);


    return (
        <ModalContextNew.Provider value={{
            displayFormulaire,
            setDisplayFormulaire,
            dataTotal,
            setDataTotal,
            options,
            setOptions,
            modalId,
            setModalId,
            modalType,
            setModalType,
            modalReload,
            setModalReload
        }}>
            {children}
        </ModalContextNew.Provider>
    );
};

// Créer un hook pour utiliser le contexte
export const useModalContextNew = (): ModalContextType => {
    const context = useContext(ModalContextNew);
    if (!context) {
        throw new Error('useModalContext must be used within a ModalProvider');
    }
    return context;
};
