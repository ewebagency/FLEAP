import { SelectInput } from './SelectInput';
import { FactureLine, FactureLineHeader } from '../types/interfaces';
import { getNestedValue } from '../utils/helpers';

interface HeaderSectionProps {
    formData: FactureLine;
    onUpdate: (formData: FactureLine) => void;
    allOptions: FactureLine[];
    filteredOptionsByDepart: FactureLine[][];
}

// Ajout du type pour company
type Company = {
    name?: string;
    siret?: string;
};

// Mise à jour de la fonction formatPrestataire
const formatPrestataire = (company: Company): string => {
    if (!company) return '';
    return company.name && company.siret ? `${company.name} - ${company.siret}` : '';
};

// Update the interface to extend FactureLineHeader
interface FactureHeader extends FactureLineHeader {
    [key: string]: string | undefined;
}

export const HeaderSection = ({ 
    formData, 
    onUpdate,
    allOptions,
    filteredOptionsByDepart 
}: HeaderSectionProps) => {
    
    // Helper pour extraire les options des prestataires depuis les BSDs
    const extractPrestataireOptions = () => {
        const allValues = new Set<string>();
        const suggestedValues = new Set<string>();
        
        // Ajouter toutes les valeurs possibles
        allOptions.forEach(bsd => {
            try {
                const transporteur = getNestedValue(bsd, 'formAPI.createFormInput.transporter.company') as Company;
                const formattedValue = formatPrestataire(transporteur);
                if (formattedValue) allValues.add(formattedValue);
            } catch (error) {
                console.warn('Erreur lors de l\'extraction du prestataire:', error);
            }
        });

        // Marquer les valeurs suggérées
        const firstDepartOptions = filteredOptionsByDepart[0] || [];
        firstDepartOptions.forEach(bsd => {
            try {
                const transporteur = getNestedValue(bsd, 'formAPI.createFormInput.transporter.company') as Company;
                const formattedValue = formatPrestataire(transporteur);
                if (formattedValue) suggestedValues.add(formattedValue);
            } catch (error) {
                console.warn('Erreur lors de l\'extraction du prestataire suggéré:', error);
            }
        });

        return Array.from(allValues)
            .filter(value => value && value.trim() !== '')
            .map(value => ({
                value,
                isSuggested: suggestedValues.has(value)
            }))
            .sort((a, b) => a.value.localeCompare(b.value));
    };

    const handleChange = (field: keyof FactureHeader | 'prestataire_nom_complet', value: string) => {
        const newFormData = { ...formData };
        
        if (field === 'prestataire_nom_complet') {
            const [nom, siret] = value.split(' - ');
            newFormData.header.prestataire_nom = nom;
            newFormData.header.prestataire_siret = siret;
        } else {
            (newFormData.header as FactureHeader)[field] = value;
        }
        
        onUpdate(newFormData);
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDate = e.target.value;
        onUpdate({
            ...formData,
            header: {
                ...formData.header,
                date_facture: new Date(newDate).toISOString()
            }
        });
    };

    return (
        <div className="bg-white p-3 rounded shadow">
            <h3 className="font-semibold mb-3">En-tête</h3>
            <div className="grid grid-cols-3 gap-2">
                <input
                    type="text"
                    placeholder="Description Prestataire"
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
                <input
                    type="text"
                    placeholder="N° facture"
                    value={formData.header.num_facture || ''}
                    onChange={(e) => handleChange('num_facture', e.target.value)}
                    className="w-full p-1 text-xs border rounded"
                />
                <SelectInput
                    label="Prestataire"
                    value={`${formData.header.prestataire_nom} - ${formData.header.prestataire_siret}`}
                    onChange={(value) => handleChange('prestataire_nom_complet', value)}
                    options={extractPrestataireOptions()}
                    className="w-full"
                />
                <input
                    type="date"
                    value={formData.header.date_facture 
                        ? new Date(formData.header.date_facture).toISOString().split('T')[0]
                        : new Date().toISOString().split('T')[0]}
                    onChange={handleDateChange}
                    className="w-full p-1 text-xs border rounded"
                />
            </div>
        </div>
    );
}; 