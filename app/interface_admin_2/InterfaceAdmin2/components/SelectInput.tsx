import { SelectInputProps } from '../types/interfaces';

interface Option {
    value: string;
    isSuggested?: boolean;
}

export const SelectInput = ({ 
    label, 
    value, 
    onChange, 
    options, 
    className = "" 
}: SelectInputProps) => {
    // Séparer les options en deux groupes
    const suggestedOptions = options.filter(opt => opt.isSuggested);
    const otherOptions = options.filter(opt => !opt.isSuggested);

    return (
        <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
                {label}
            </label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={`w-full p-1 text-xs border rounded ${className}`}
            >
                <option value="">Sélectionner...</option>
                
                {/* Options suggérées en bleu */}
                {suggestedOptions.length > 0 && (
                    <optgroup label="Options suggérées">
                        {suggestedOptions.map((option) => (
                            <option 
                                key={option.value} 
                                value={option.value}
                                className="text-blue-600 font-medium"
                            >
                                {option.value}
                            </option>
                        ))}
                    </optgroup>
                )}

                {/* Autres options en noir */}
                {otherOptions.length > 0 && (
                    <optgroup label="Autres options">
                        {otherOptions.map((option) => (
                            <option 
                                key={option.value} 
                                value={option.value}
                            >
                                {option.value}
                            </option>
                        ))}
                    </optgroup>
                )}
            </select>
        </div>
    );
}; 