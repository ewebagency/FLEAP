import { SelectInput } from './SelectInput';
import { FactureLine } from '../types/interfaces';

interface HeaderSectionProps {
    formData: FactureLine;
    prestataireType: 'transporteur' | 'destinataire';
    setPrestataireType: (type: 'transporteur' | 'destinataire') => void;
    prestataires: { nom: string; siret: string; }[];
    onUpdate: (formData: FactureLine) => void;
}

export const HeaderSection = ({ 
    formData, 
    prestataireType, 
    setPrestataireType, 
    prestataires,
    onUpdate 
}: HeaderSectionProps) => {
    const handleChange = (field: string, value: string) => {
        onUpdate({
            ...formData,
            header: {
                ...formData.header,
                [field]: value
            }
        });
    };

    return (
        <div className="bg-white p-3 rounded shadow text-sm">
            <h3 className="text-base font-semibold mb-2">Informations générales</h3>
            
            <div className="flex gap-4 mb-2">
                <label className="flex items-center">
                    <input
                        type="radio"
                        checked={prestataireType === 'transporteur'}
                        onChange={() => setPrestataireType('transporteur')}
                        className="mr-2"
                    />
                    <span className="text-xs">Transporteur</span>
                </label>
                <label className="flex items-center">
                    <input
                        type="radio"
                        checked={prestataireType === 'destinataire'}
                        onChange={() => setPrestataireType('destinataire')}
                        className="mr-2"
                    />
                    <span className="text-xs">Destinataire</span>
                </label>
            </div>

            <div className="grid grid-cols-3 gap-2">
                <input
                    type="text"
                    placeholder="Description prestataire"
                    value={formData.header.prestataire_description || ''}
                    onChange={(e) => handleChange('prestataire_description', e.target.value)}
                    className="w-full p-1 text-xs border rounded"
                />
                <input
                    type="text"
                    placeholder="N° client"
                    value={formData.header.prestataire_num_client || ''}
                    onChange={(e) => handleChange('prestataire_num_client', e.target.value)}
                    className="w-full p-1 text-xs border rounded"
                />
                <SelectInput
                    label=""
                    value={formData.header.prestataire_nom}
                    onChange={(value) => {
                        const [nom, siret] = value.split(' - ');
                        handleChange('prestataire_nom', nom);
                        handleChange('prestataire_siret', siret);
                    }}
                    options={['', ...Array.from(prestataires.map(p => `${p.nom} - ${p.siret}`))]}
                />
                <input
                    type="date"
                    value={formData.header.date_facture || ''}
                    onChange={(e) => handleChange('date_facture', e.target.value)}
                    className="w-full p-1 text-xs border rounded"
                />
            </div>

            <div className="mt-2">
                <input
                    type="text"
                    placeholder="N° facture"
                    value={formData.header.num_facture || ''}
                    onChange={(e) => handleChange('num_facture', e.target.value)}
                    className="w-full p-1 text-xs border rounded"
                />
            </div>
        </div>
    );
}; 