import { useState } from 'react';
import { OtherInfos } from '../../../interface/BSD_Interface';
import InputFull from './InputFull';
import InputMobile from './InputMobile';

interface MelangeDataProps {
    otherInfos: OtherInfos;
    onUpdate: (melange: Array<{name: string, percent: string}>) => void;
    onMobile?: boolean;
}

const WASTE_TYPES = [
    'Papier',
    'Carton',
    'Métaux',
    'Plastiques',
    'Bois',
    'Verre',
    'Textile',
    'Déchets organiques',
    'Autres'
];

export default function MelangeData({ otherInfos, onUpdate, onMobile = false }: MelangeDataProps) {
    const [rows, setRows] = useState<Array<{name: string, percent: string}>>(
        otherInfos.melange || [{name: '', percent: '0'}]
    );

    const handleAddRow = () => {
        const newRows = [...rows, {name: '', percent: '0'}];
        setRows(newRows);
        onUpdate(newRows);
    };

    const handleRemoveRow = (index: number) => {
        const newRows = rows.filter((_, i) => i !== index);
        setRows(newRows);
        onUpdate(newRows);
    };

    const handleChange = (index: number, field: 'name' | 'percent', value: string) => {
        const newRows = rows.map((row, i) => {
            if (i === index) {
                return { ...row, [field]: value };
            }
            return row;
        });
        setRows(newRows);
        onUpdate(newRows);
    };

    const Input = onMobile ? InputMobile : InputFull;

    return (
        <div className={`space-y-1 ${onMobile ? 'mt-4' : 'mt-8'}`}>
            <div className="text-sm font-medium text-gray-700 mb-4">
                Composition du mélange
            </div>
            {rows.map((row, index) => (
                <div key={index} className={`flex items-center ${onMobile ? 'space-x-2' : 'space-x-4'}`}>
                    <div className={onMobile ? 'flex-1' : 'w-[250px] ml-0 mr-12'}>
                        <Input
                            titre=""
                            placeholder="Sélectionner un type"
                            name={`melange-${index}`}
                            value={row.name}
                            onChange={(e) => handleChange(index, 'name', typeof e === 'string' ? e : e.target.value)}
                            options={{
                                filteredOptions: [],
                                allOptions: WASTE_TYPES
                            }}
                            enabled={true}
                            width={onMobile ? undefined : 35}
                            onMobile={onMobile}
                        />
                    </div>
                    <div className="flex items-center space-x-2 text-[16px]">
                        <input
                            type="number"
                            min="0"
                            max="100"
                            step="10"
                            className={`${onMobile ? 'w-20 h-10 text-[16px]' : 'w-14 h-6 text-[14px]'} px-2 border border-gray-300 rounded-md`}
                            value={row.percent}
                            onChange={(e) => handleChange(index, 'percent', e.target.value)}
                        />
                        <span className={`text-sm ${onMobile ? 'text-base' : ''}`}>%</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => handleRemoveRow(index)}
                        className={`p-1 text-red-500 hover:text-red-700 ${onMobile ? 'text-xl px-3' : ''}`}
                    >
                        ✕
                    </button>
                </div>
            ))}
            <button
                type="button"
                onClick={handleAddRow}
                className={`flex items-center text-sm text-blue-600 hover:text-blue-800 ${onMobile ? 'mt-3 text-base' : 'mt-2'}`}
            >
                <span className="mr-1">+</span> Ajouter un type
            </button>
        </div>
    );
}
