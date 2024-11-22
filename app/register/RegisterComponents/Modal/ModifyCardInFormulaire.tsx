import { useState, useEffect } from "react";
import { DataTotalInterface } from "../../interface/BSD_Interface";

interface ModifyCardInFormulaireProps {
    dataTotal: DataTotalInterface;
    setDataTotal: (data: DataTotalInterface) => void;
    onSubmit: (data: DataTotalInterface) => Promise<void>;
    onClose: () => void;
}

const LabelInput = ({ label, value, onChange, path }: { 
    label: string, 
    value: string | number | undefined,
    onChange: (path: string, value: string) => void,
    path: string
}) => (
    <div className="text-sm flex flex-col mb-2">
        <span className="font-medium text-gray-700">{label}: </span>
        <input 
            type="text"
            value={value || ''}
            onChange={(e) => onChange(path, e.target.value)}
            className="border rounded px-2 py-1 text-gray-600"
        />
    </div>
);

const ModifyCardInFormulaire = ({ dataTotal, setDataTotal, onSubmit, onClose }: ModifyCardInFormulaireProps) => {
    const [localData, setLocalData] = useState<DataTotalInterface>(dataTotal);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        setLocalData(dataTotal);
    }, [dataTotal]);

    const handleLocalChange = (path: string, value: string) => {
        setLocalData(prev => {
            const newData = { ...prev };
            const keys = path.split('.');
            let current = newData;
            
            for (let i = 0; i < keys.length - 1; i++) {
                current = current[keys[i]];
            }
            
            current[keys[keys.length - 1]] = value;
            return newData;
        });
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            await onSubmit(localData);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        onClose();
    };

    return (
        <div>
            <div className='text-md font-bold mt-8 mb-4'>Détails complets</div>
            <div className="grid grid-cols-2 gap-6">
                {/* Émetteur */}
                <div className="bg-blue-50 p-3 rounded border border-blue-100">
                    <h3 className="font-semibold text-blue-800 mb-2">Émetteur</h3>
                    <LabelInput 
                        label="Nom" 
                        value={localData.dataFormAPI.formAPI.createFormInput.emitter.company.name}
                        onChange={handleLocalChange}
                        path="dataFormAPI.formAPI.createFormInput.emitter.company.name"
                    />
                    <LabelInput 
                        label="Adresse" 
                        value={localData.dataFormAPI.formAPI.createFormInput.emitter.company.address}
                        onChange={handleLocalChange}
                        path="dataFormAPI.formAPI.createFormInput.emitter.company.address"
                    />
                    <LabelInput 
                        label="SIRET" 
                        value={localData.dataFormAPI.formAPI.createFormInput.emitter.company.siret}
                        onChange={handleLocalChange}
                        path="dataFormAPI.formAPI.createFormInput.emitter.company.siret"
                    />
                    <LabelInput 
                        label="Contact" 
                        value={localData.dataFormAPI.formAPI.createFormInput.emitter.company.contact}
                        onChange={handleLocalChange}
                        path="dataFormAPI.formAPI.createFormInput.emitter.company.contact"
                    />
                    <LabelInput 
                        label="Téléphone" 
                        value={localData.dataFormAPI.formAPI.createFormInput.emitter.company.phone}
                        onChange={handleLocalChange}
                        path="dataFormAPI.formAPI.createFormInput.emitter.company.phone"
                    />
                    <LabelInput 
                        label="Email" 
                        value={localData.dataFormAPI.formAPI.createFormInput.emitter.company.mail}
                        onChange={handleLocalChange}
                        path="dataFormAPI.formAPI.createFormInput.emitter.company.mail"
                    />
                </div>

                {/* Destinataire */}
                <div className="bg-purple-50 p-3 rounded border border-purple-100">
                    <h3 className="font-semibold text-purple-800 mb-2">Destinataire</h3>
                    <LabelInput 
                        label="Nom" 
                        value={localData.dataFormAPI.formAPI.createFormInput.recipient.company.name}
                        onChange={handleLocalChange}
                        path="dataFormAPI.formAPI.createFormInput.recipient.company.name"
                    />
                    <LabelInput 
                        label="Adresse" 
                        value={localData.dataFormAPI.formAPI.createFormInput.recipient.company.address}
                        onChange={handleLocalChange}
                        path="dataFormAPI.formAPI.createFormInput.recipient.company.address"
                    />
                    <LabelInput 
                        label="SIRET" 
                        value={localData.dataFormAPI.formAPI.createFormInput.recipient.company.siret}
                        onChange={handleLocalChange}
                        path="dataFormAPI.formAPI.createFormInput.recipient.company.siret"
                    />
                    <LabelInput 
                        label="Contact" 
                        value={localData.dataFormAPI.formAPI.createFormInput.recipient.company.contact}
                        onChange={handleLocalChange}
                        path="dataFormAPI.formAPI.createFormInput.recipient.company.contact"
                    />
                    <LabelInput 
                        label="Téléphone" 
                        value={localData.dataFormAPI.formAPI.createFormInput.recipient.company.phone}
                        onChange={handleLocalChange}
                        path="dataFormAPI.formAPI.createFormInput.recipient.company.phone"
                    />
                    <LabelInput 
                        label="Email" 
                        value={localData.dataFormAPI.formAPI.createFormInput.recipient.company.mail}
                        onChange={handleLocalChange}
                        path="dataFormAPI.formAPI.createFormInput.recipient.company.mail"
                    />
                    <LabelInput 
                        label="CAP" 
                        value={localData.dataFormAPI.formAPI.createFormInput.recipient.cap}
                        onChange={handleLocalChange}
                        path="dataFormAPI.formAPI.createFormInput.recipient.cap"
                    />
                    <LabelInput 
                        label="Code traitement" 
                        value={localData.dataFormAPI.formAPI.createFormInput.recipient.processingOperation}
                        onChange={handleLocalChange}
                        path="dataFormAPI.formAPI.createFormInput.recipient.processingOperation"
                    />
                </div>

                {/* Transporteur */}
                <div className="bg-yellow-50 p-3 rounded border border-yellow-100">
                    <h3 className="font-semibold text-yellow-800 mb-2">Transporteur</h3>
                    <LabelInput 
                        label="Nom" 
                        value={localData.dataFormAPI.formAPI.createFormInput.transporter.company.name}
                        onChange={handleLocalChange}
                        path="dataFormAPI.formAPI.createFormInput.transporter.company.name"
                    />
                    <LabelInput 
                        label="Adresse" 
                        value={localData.dataFormAPI.formAPI.createFormInput.transporter.company.address}
                        onChange={handleLocalChange}
                        path="dataFormAPI.formAPI.createFormInput.transporter.company.address"
                    />
                    <LabelInput 
                        label="SIRET" 
                        value={localData.dataFormAPI.formAPI.createFormInput.transporter.company.siret}
                        onChange={handleLocalChange}
                        path="dataFormAPI.formAPI.createFormInput.transporter.company.siret"
                    />
                    <LabelInput 
                        label="Contact" 
                        value={localData.dataFormAPI.formAPI.createFormInput.transporter.company.contact}
                        onChange={handleLocalChange}
                        path="dataFormAPI.formAPI.createFormInput.transporter.company.contact"
                    />
                    <LabelInput 
                        label="Téléphone" 
                        value={localData.dataFormAPI.formAPI.createFormInput.transporter.company.phone}
                        onChange={handleLocalChange}
                        path="dataFormAPI.formAPI.createFormInput.transporter.company.phone"
                    />
                    <LabelInput 
                        label="Email" 
                        value={localData.dataFormAPI.formAPI.createFormInput.transporter.company.mail}
                        onChange={handleLocalChange}
                        path="dataFormAPI.formAPI.createFormInput.transporter.company.mail"
                    />
                </div>


                {/* Détails du déchet */}
                <div className="bg-red-50 p-3 rounded border border-red-100">
                    <h3 className="font-semibold text-red-800 mb-2">Détails du déchet</h3>
                    <LabelInput 
                        label="Code CED" 
                        value={localData.dataFormAPI.formAPI.createFormInput.wasteDetails.code}
                        onChange={handleLocalChange}
                        path="dataFormAPI.formAPI.createFormInput.wasteDetails.code"
                    />
                    <LabelInput 
                        label="Code ONU" 
                        value={localData.dataFormAPI.formAPI.createFormInput.wasteDetails.onuCode}
                        onChange={handleLocalChange}
                        path="dataFormAPI.formAPI.createFormInput.wasteDetails.onuCode"
                    />
                    <LabelInput 
                        label="Consistance" 
                        value={localData.dataFormAPI.formAPI.createFormInput.wasteDetails.consistence}
                        onChange={handleLocalChange}
                        path="dataFormAPI.formAPI.createFormInput.wasteDetails.consistence"
                    />
                    <LabelInput 
                        label="Quantité" 
                        value={localData.dataFormAPI.formAPI.createFormInput.wasteDetails.quantity}
                        onChange={handleLocalChange}
                        path="dataFormAPI.formAPI.createFormInput.wasteDetails.quantity"
                    />
                    <LabelInput 
                        label="Type de quantité" 
                        value={localData.dataFormAPI.formAPI.createFormInput.wasteDetails.quantityType}
                        onChange={handleLocalChange}
                        path="dataFormAPI.formAPI.createFormInput.wasteDetails.quantityType"
                    />
                </div>

                {/* Site d'enlèvement */}
                <div className="bg-green-50 p-3 rounded border border-green-100">
                    <h3 className="font-semibold text-green-800 mb-2">Site d'enlèvement</h3>
                    <LabelInput 
                        label="Adresse" 
                        value={localData.dataFormAPI.formAPI.createFormInput.emitter.workSite.address}
                        onChange={handleLocalChange}
                        path="dataFormAPI.formAPI.createFormInput.emitter.workSite.address"
                    />
                    <LabelInput 
                        label="Code postal" 
                        value={localData.dataFormAPI.formAPI.createFormInput.emitter.workSite.postalCode}
                        onChange={handleLocalChange}
                        path="dataFormAPI.formAPI.createFormInput.emitter.workSite.postalCode"
                    />
                    <LabelInput 
                        label="Ville" 
                        value={localData.dataFormAPI.formAPI.createFormInput.emitter.workSite.city}
                        onChange={handleLocalChange}
                        path="dataFormAPI.formAPI.createFormInput.emitter.workSite.city"
                    />
                </div>
                
            </div>
            
            <div className="flex justify-end space-x-2 mt-6">
                <button
                    type="button"
                    onClick={() => handleClose()}
                    className="px-4 py-2 text-gray-600 border rounded hover:bg-gray-100"
                >
                    Fermer
                </button>
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                    {isSubmitting ? "En cours..." : "Envoyer"}
                </button>
            </div>
        </div>
    );
};

export default ModifyCardInFormulaire; 