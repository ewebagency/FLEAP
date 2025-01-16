import { SelectInputProps } from '../types/interfaces';

export const SelectInput = ({ label, value, onChange, options, className = "" }: SelectInputProps) => (
    <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
            {label}
        </label>
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full p-1 text-xs border rounded ${className}`}
        >
            {options.map((option) => (
                <option key={option} value={option}>
                    {option}
                </option>
            ))}
        </select>
    </div>
); 