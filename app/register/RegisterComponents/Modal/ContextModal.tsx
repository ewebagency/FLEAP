import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { CompleteFormInput, FormInput } from '../../interface/BSD_Interface';
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
export type ModalContextType = {
    displayFormulaire: boolean;
    setDisplayFormulaire: (value: boolean) => void;
    dataToogle: FormInput;
    setDataToogle: React.Dispatch<React.SetStateAction<FormInput>>;
    options: CompleteFormInput[];
    setOptions: (options: CompleteFormInput[]) => void;

    modalId: string | null;
    setModalId: (value: string | null) => void;
    modalType: string | null;
    setModalType: (value: string | null) => void;
    modalReload: boolean;
    setModalReload: (value: boolean) => void;

    filterPendingBSDs: boolean;
    setFilterPendingBSDs: (value: boolean) => void;
    nextFullReload: boolean;
    setNextFullReload: (value: boolean) => void;
};

// Créer le contexte
const ModalContextNew = createContext<ModalContextType | null>(null);

// Créer un fournisseur de contexte
export const ModalProviderNew = ({ children }: { children: ReactNode }) => {
    const [displayFormulaire, setDisplayFormulaire] = useState<boolean>(false);
    const [filterPendingBSDs, setFilterPendingBSDs] = useState<boolean>(false);
    const [nextFullReload, setNextFullReload] = useState(false);

    const initialToogleData: FormInput = {
        emitter: {
          type: "PRODUCER",
          workSite: { name: "", fullAddress: "", address: "", postalCode: "", city: "", infos: "" },
          company: { name: "", siret: "", address: "", country: "", contact: "", phone: "", mail: "" },
          isPrivateIndividual: false,
          isForeignShip: false,
        },
        recipient: {
          company: { name: "", siret: "", address: "", country: "", contact: "", phone: "", mail: "" },
          cap: "",
          processingOperation: "",
          isTempStorage: false,
        },
        transporter: {
          company: { name: "", siret: "", address: "", country: "", contact: "", phone: "", mail: "" },
          isExemptedOfReceipt: false,
          receipt: "",
          numberPlate: "",
          customInfo: "",
        },
        wasteDetails: {
          code: "",
          name: "",
          isSubjectToADR: false,
          onuCode: "",
          packagingInfos: [{ type: "AUTRE", quantity: 1 }],
          quantity: 0,
          quantityType: "ESTIMATED",
          consistence: "",
          pop: false,
          isDangerous: false,
          parcelNumbers: { city: "", postalCode: "", prefix: "", section: "", number: "" },
          analysisReferences: "",
          landIdentifiers: "",
          sampleNumber: "",
        },
        trader: {
          receipt: "",
          department: "",
          //validityLimit: "",
          company: { name: "", siret: "", address: "", country: "", contact: "", phone: "", mail: "" },
        },
        broker: {
          receipt: "",
          department: "",
          //validityLimit: "",
          company: { name: "", siret: "", address: "", country: "", contact: "", phone: "", mail: "" },
        },
        //grouping: { form: { id: "" }, quantity: 0 },//Pour l'instant on va dire qu'on ne permet pas de grouper les déchets
        ecoOrganisme: { name: "", siret: "" },
        temporaryStorageDetail: {
          company: { name: "", siret: "", address: "", country: "", contact: "", phone: "", mail: "" },
          cap: "",
          processingOperation: "",
        }, //Si le recipient est un stockage provisoire, on va mettre les infos du destinataire final pour le traitement 
        //intermediaries: [],
      };
    const [dataToogle, setDataToogle] = useState<FormInput>(initialToogleData);
    const [options, setOptions] = useState<CompleteFormInput[]>([]);
    const [modalId, setModalId] = useState<string | null>(null);
    const [modalType, setModalType] = useState<string | null>(null);
    const [modalReload, setModalReload] = useState(false);

    const value = {
        displayFormulaire,
        setDisplayFormulaire,
        dataToogle,
        setDataToogle,
        options,
        setOptions,
        modalId,
        setModalId,
        modalType,
        setModalType,
        modalReload,
        setModalReload,
        
        filterPendingBSDs,
        setFilterPendingBSDs,
        nextFullReload,
        setNextFullReload
    };

    return (
        <ModalContextNew.Provider value={value}>
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
