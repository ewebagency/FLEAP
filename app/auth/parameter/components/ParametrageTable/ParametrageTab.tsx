import { useState, useEffect } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import { useSession } from '@/app/component/SessionProvider';
import InputFull from '@/app/register/RegisterComponents/Modal/FormulaireFull/InputFull';
import { FormInput, OtherInfos } from '@/app/register/interface/BSD_Interface';
import { toast } from 'react-hot-toast';
import BoxIcon from '@/app/component/BoxIconWrapper';

// Type pour une ligne de paramétrage
interface ParametrageLine {
    id: string;
    json_row: FormInput;
    entreprise_id: string;
    other_infos?: OtherInfos;
}

// Type pour les sections de champs
interface FieldSection {
    title: string;
    mainField: string;
    associatedFields: {
        label: string;
        field: string;
        placeholder: string;
        type?: 'text' | 'checkbox';
    }[];
}

// Ajouter un nouveau type pour les champs
interface Field {
    label: string;
    field: string;
    placeholder: string;
    type?: 'text' | 'checkbox';  // Ajouter le type de champ
}

const fieldSections: FieldSection[] = [
    {
        title: "Site",
        mainField: "emitter.company.name",
        associatedFields: [
            { label: "SIRET", field: "emitter.company.siret", placeholder: "SIRET du site" },
            { label: "Adresse", field: "emitter.company.address", placeholder: "Adresse du site" },
        ]
    },
    {
        title: "Point de Collecte",
        mainField: "emitter.workSite.name",
        associatedFields: [
            { label: "Adresse", field: "emitter.workSite.fullAddress", placeholder: "Adresse complète" },
            { label: "Infos", field: "emitter.workSite.infos", placeholder: "Informations supplémentaires" }
        ]
    },
    {
        title: "Contact",
        mainField: "emitter.company.contact",
        associatedFields: [
            { label: "Téléphone", field: "emitter.company.phone", placeholder: "Numéro de téléphone" },
            { label: "Email", field: "emitter.company.mail", placeholder: "Adresse email" }
        ]
    },
    {
        title: "Déchet",
        mainField: "wasteDetails.name",
        associatedFields: [
            { label: "Code", field: "wasteDetails.code", placeholder: "Code déchet", type: 'text' },
            { label: "Code ONU", field: "wasteDetails.onuCode", placeholder: "Code ONU", type: 'text' },
            { label: "Consistance", field: "wasteDetails.consistence", placeholder: "Consistance", type: 'text' },
            { label: "Dangerous", field: "wasteDetails.isDangerous", placeholder: "Dangerous", type: 'checkbox' },
            { label: "ADR", field: "wasteDetails.isSubjectToADR", placeholder: "ADR", type: 'checkbox' },
            { label: "Pop", field: "wasteDetails.pop", placeholder: "Pop", type: 'checkbox' }
        ] as Field[]
    },
    {
        title: "Contenant",
        mainField: "other_infos.containerDescription",
        associatedFields: [
            { label: "Volume", field: "other_infos.volume", placeholder: "Volume" },
            { label: "Unité", field: "other_infos.volumeUnit", placeholder: "Unité (L ou m3)" }
        ]
    },
    {
        title: "Transporteur",
        mainField: "transporter.company.name",
        associatedFields: [
            { label: "SIRET", field: "transporter.company.siret", placeholder: "SIRET transporteur" },
            { label: "Contact", field: "transporter.company.contact", placeholder: "Contact" },
            { label: "Téléphone", field: "transporter.company.phone", placeholder: "Téléphone" },
            { label: "Email", field: "transporter.company.mail", placeholder: "Email" },
            { label: "Récépissé", field: "transporter.receipt", placeholder: "Numéro de récépissé" }
        ]
    },
    {
        title: "Destinataire",
        mainField: "recipient.company.name",
        associatedFields: [
            { label: "SIRET", field: "recipient.company.siret", placeholder: "SIRET destinataire" },
            { label: "Contact", field: "recipient.company.contact", placeholder: "Contact" },
            { label: "Téléphone", field: "recipient.company.phone", placeholder: "Téléphone" },
            { label: "Email", field: "recipient.company.mail", placeholder: "Email" },
            { label: "CAP", field: "recipient.cap", placeholder: "CAP" },
            { label: "Code traitement", field: "recipient.processingOperation", placeholder: "Code" }
        ]
    }
];

// Ajouter un type pour les valeurs groupées
interface GroupedValues {
    mainValue: string;
    associatedValues: Record<string, string[]>;
}

// Modifier le type pour éviter les any
type NestedObject = {
    [key: string]: NestedObject | string | number | boolean | null | undefined;
};

// Modifier getNestedValue pour un typage plus strict
const getNestedValue = (obj: FormInput | OtherInfos | Record<string, unknown>, path: string): string => {
    try {
        if (path.startsWith('other_infos.')) {
            const [, field] = path.split('.');
            return ((obj as Record<string, OtherInfos>).other_infos?.[field as keyof OtherInfos] || '').toString();
        }

        // Cas spécial pour fullAddress
        if (path === 'emitter.workSite.fullAddress') {
            const workSite = (obj as FormInput).emitter.workSite;
            if (workSite.fullAddress) return workSite.fullAddress;
            return [workSite.address, workSite.postalCode, workSite.city]
                .filter(Boolean)
                .join(' ');
        }

        return path.split('.').reduce((acc: unknown, part) => {
            if (part.includes('[')) {
                const [arrayName, indexStr] = part.split(/[\[\]]/);
                const index = parseInt(indexStr);
                return (acc as Record<string, unknown[]>)[arrayName]?.[index];
            }
            return (acc as Record<string, unknown>)[part];
        }, obj)?.toString() || '';
    } catch (error) {
        return '';
    }
};

const ParametrageTab = () => {
    const session = useSession();
    const [lines, setLines] = useState<ParametrageLine[]>([]);
    const [expandedLines, setExpandedLines] = useState<{[key: string]: boolean}>({});
    const [newLine, setNewLine] = useState<FormInput>({
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
            onuCode: "",
            quantity: 0,
            quantityType: "ESTIMATED",
            consistence: "",
            pop: false,
            isDangerous: false,
            isSubjectToADR: false,
            packagingInfos: [{type: "AUTRE", quantity: 0, other: ""}],
        }
    });
    const [showNewLineForm, setShowNewLineForm] = useState(false);
    const [other_infos_line, setOtherInfosLine] = useState<OtherInfos>({
        volume: "",
        inputMode: "volume",
        volumeUnit: "",
        containerDescription: "",
        fillRate: "",
        automaticMode: true
    });

    // Charger les lignes existantes
    useEffect(() => {
        if (session?.entreprise_id) {
            loadLines();
        }
    }, [session]);

    const loadLines = async () => {
        const { data, error } = await supabase
            .from('table_parametrage')
            .select('*')
            .eq('entreprise_id', session?.entreprise_id);

        if (error) {
            toast.error('Erreur lors du chargement des lignes');
            return;
        }

        setLines(data || []);
    };

    const handleChange = (field: string, value: string) => {
        if (field.startsWith('other_infos.')) {
            const otherInfoField = field.split('.')[1] as keyof OtherInfos;
            setOtherInfosLine((prev: OtherInfos) => ({
                ...prev,
                [otherInfoField]: value
            }));
            return;
        }

        setNewLine((prev: FormInput) => {
            const updated = { ...prev };
            const keys = field.split('.');
            let current: Record<string, unknown> = updated as unknown as Record<string, unknown>;
            
            // Gestion spéciale pour fullAddress
            if (field === 'emitter.workSite.fullAddress') {
                const { street, postalCode, city } = parseAddress(value);
                updated.emitter.workSite.fullAddress = value;
                updated.emitter.workSite.address = street;
                updated.emitter.workSite.postalCode = postalCode;
                updated.emitter.workSite.city = city;
                return updated;
            }

            // Gestion normale pour les autres champs
            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]]) {
                    current[keys[i]] = {};
                }
                current = current[keys[i]] as Record<string, unknown>;
            }
            current[keys[keys.length - 1]] = value;
            
            return updated;
        });
    };

    const handleSubmit = async () => {
        if (!session?.entreprise_id) {
            toast.error('Session non valide');
            return;
        }

        const { error } = await supabase
            .from('table_parametrage')
            .insert({
                entreprise_id: session.entreprise_id,
                user_id: session.user_id,
                json_row: newLine,
                other_infos: other_infos_line
            });

        if (error) {
            toast.error('Erreur lors de la création de la ligne');
            return;
        }

        toast.success('Ligne ajoutée avec succès');
        loadLines();
        setShowNewLineForm(false);
        setNewLine({
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
                onuCode: "",
                quantity: 0,
                quantityType: "ESTIMATED",
                consistence: "",
                pop: false,
                isDangerous: false,
                isSubjectToADR: false,
                packagingInfos: [{type: "AUTRE", quantity: 0, other: ""}],
            }
        });
        setOtherInfosLine({
            volume: "",
            inputMode: "volume",
            volumeUnit: "",
            containerDescription: "",
            fillRate: "",
            automaticMode: true
        });
    };

    const toggleLineExpansion = (lineId: string) => {
        setExpandedLines(prev => ({
            ...prev,
            [lineId]: !prev[lineId]
        }));
    };

    return (
        <div className="p-2">
            {/* Section explicative en 3 colonnes */}
            <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-2 text-blue-800">
                        <span>✨</span>
                        <span className="font-medium">Création</span>
                    </div>
                    <p className="text-blue-700">
                        Remplissez les sections qui vous intéressent, les suggestions apparaîtront automatiquement !
                    </p>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-2 text-purple-800">
                        <span>💡</span>
                        <span className="font-medium">Astuce</span>
                    </div>
                    <p className="text-purple-700">
                        Les sections sont indépendantes, remplissez uniquement celles dont vous avez besoin !
                    </p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-2 text-green-800">
                        <span>👀</span>
                        <span className="font-medium">Affichage</span>
                    </div>
                    <p className="text-green-700">
                        Cliquez sur une section pour voir tous les détails associés.
                    </p>
                </div>
            </div>

            <div className="flex justify-end mb-2">
                <button
                    onClick={() => setShowNewLineForm(!showNewLineForm)}
                    className="bg-green-600 text-white px-3 py-1 text-sm rounded hover:bg-green-700 flex items-center gap-2"
                >
                    {showNewLineForm ? '❌ Annuler' : '✨ Nouvelle Ligne'}
                </button>
            </div>

            {showNewLineForm && (
                <div className="bg-white p-4 rounded shadow mb-2">
                    <h3 className="text-lg font-medium text-gray-700 mb-4">✏️ Création d&apos;une nouvelle ligne</h3>
                    <div className="grid grid-cols-3 gap-6">
                        {fieldSections.map((section) => {
                            if (section.title === "Contenant") {
                                return (
                                    <div key={section.title} className="space-y-3">
                                        <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                                            {getEmojiForSection(section.title)}
                                            <span className="font-medium text-gray-700">{section.title}</span>
                                        </div>
                                        <InputFull
                                            titre=""
                                            placeholder="Description du contenant"
                                            name="other_infos.containerDescription"
                                            value={other_infos_line.containerDescription}
                                            onChange={e => handleChange('other_infos.containerDescription', e.target.value)}
                                            width={40}
                                            options={{
                                                filteredOptions: Array.from(new Set(lines.map(l => l.other_infos?.containerDescription || ''))),
                                                allOptions: []
                                            }}
                                            enableText={true}
                                            stylePrimary={true}
                                        />
                                        <InputFull
                                            titre=""
                                            placeholder="Volume"
                                            name="other_infos.volume"
                                            value={other_infos_line.volume}
                                            onChange={e => handleChange('other_infos.volume', e.target.value)}
                                            width={40}
                                            options={{
                                                filteredOptions: Array.from(new Set(lines.map(l => l.other_infos?.volume || ''))),
                                                allOptions: []
                                            }}
                                            enableText={true}
                                        />
                                        <InputFull
                                            titre=""
                                            placeholder="Unité de volume"
                                            name="other_infos.volumeUnit"
                                            value={other_infos_line.volumeUnit}
                                            onChange={e => handleChange('other_infos.volumeUnit', e.target.value)}
                                            width={40}
                                            options={{
                                                filteredOptions: ['L', 'm3'],
                                                allOptions: []
                                            }}
                                            enableText={true}
                                        />
                                    </div>
                                );
                            }

                            return (
                                <div key={section.title} className="space-y-3">
                                    <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                                        {getEmojiForSection(section.title)}
                                        <span className="font-medium text-gray-700">{section.title}</span>
                                    </div>
                                    <InputFull
                                        titre=""
                                        placeholder={section.title}
                                        name={section.mainField}
                                        value={getNestedValue(newLine, section.mainField)}
                                        onChange={e => handleChange(section.mainField, e.target.value)}
                                        width={40}
                                        options={{
                                            filteredOptions: Array.from(new Set(lines.map(l => getNestedValue(l.json_row, section.mainField)))),
                                            allOptions: []
                                        }}
                                        enableText={true}
                                        stylePrimary={true}
                                    />
                                    {section.associatedFields.map((field) => (
                                        !field.field.includes('packagingInfos') && (
                                            field.type === 'checkbox' ? (
                                                <div key={field.field} className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        id={field.field}
                                                        name={field.field}
                                                        checked={getNestedValue(newLine, field.field) === 'true'}
                                                        onChange={e => handleChange(field.field, e.target.checked.toString())}
                                                        className="h-4 w-4 text-blue-600 rounded"
                                                    />
                                                    <label htmlFor={field.field} className="text-sm text-gray-600">
                                                        {field.label}
                                                    </label>
                                                </div>
                                            ) : (
                                                <InputFull
                                                    key={field.field}
                                                    titre=""
                                                    placeholder={field.placeholder}
                                                    name={field.field}
                                                    value={getNestedValue(newLine, field.field)}
                                                    onChange={e => handleChange(field.field, e.target.value)}
                                                    width={40}
                                                    options={{
                                                        filteredOptions: Array.from(new Set(lines.map(l => getNestedValue(l.json_row, field.field)))),
                                                        allOptions: []
                                                    }}
                                                    enableText={true}
                                                />
                                            )
                                        )
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={handleSubmit}
                            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
                        >
                            <span>Ajouter</span> 
                            <span>✅</span>
                        </button>
                    </div>
                </div>
            )}

            <UnifiedLinesList lines={lines} />
        </div>
    );
};

// Fonction parseAddress
const parseAddress = (fullAddress: string) => {
    try {
        const regex = /^(.*?)(?:\s*(\d{5}))?\s*([^0-9]*)$/;
        const match = fullAddress.match(regex);
        
        if (match) {
            return {
                street: match[1]?.trim() || '',
                postalCode: match[2] || '',
                city: match[3]?.trim() || ''
            };
        }
        
        return {
            street: fullAddress,
            postalCode: '',
            city: ''
        };
    } catch (error) {
        console.error('Erreur lors du parsing de l\'adresse:', error);
        return { street: '', postalCode: '', city: '' };
    }
};

// Fonction helper pour obtenir l'emoji approprié pour chaque section
const getEmojiForSection = (sectionTitle: string): string => {
    const emojiMap: { [key: string]: string } = {
        "Site": "🏢",
        "Point de Collecte": "📍",
        "Contact": "👤",
        "Déchet": "🗑️",
        "Contenant": "📦",
        "Transporteur": "🚛",
        "Destinataire": "🏭"
    };
    return emojiMap[sectionTitle] || "📝";
};

// Modifier l'affichage dans UnifiedLinesList
const UnifiedLinesList = ({ lines }: { lines: ParametrageLine[] }) => {
    const [expandedSections, setExpandedSections] = useState<{[key: string]: boolean}>({});
    
    const toggleSection = (sectionTitle: string) => {
        setExpandedSections(prev => ({
            ...prev,
            [sectionTitle]: !prev[sectionTitle]
        }));
    };
    
    return (
        <div className="space-y-1">
            {fieldSections.map((section) => {
                const groupedValues = getGroupedValues(lines, section);
                
                return (
                    <div key={section.title} className="bg-white p-2 rounded shadow text-xs">
                        <div 
                            className="font-medium text-gray-600 mb-1 flex justify-between items-center cursor-pointer"
                            onClick={() => toggleSection(section.title)}
                        >
                            <span>{section.title}</span>
                            <BoxIcon
                                name={expandedSections[section.title] ? 'chevron-up' : 'chevron-down'}
                                type="regular"
                                className="w-4 h-4"
                            />
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            {groupedValues.map((group, idx) => (
                                <div key={`${section.title}-${idx}`} className="space-y-2">
                                    <div className="bg-gray-50 px-2 py-1 rounded font-medium">
                                        {group.mainValue}
                                    </div>
                                    {expandedSections[section.title] && (
                                        <div className="pl-2 space-y-1 text-[10px]">
                                            {section.associatedFields.map(field => {
                                                const values = group.associatedValues[field.field];
                                                if (!values?.length) return null;
                                                
                                                return (
                                                    <div key={field.field} className="flex flex-col">
                                                        <span className="text-gray-500">{field.label}:</span>
                                                        {field.type === 'checkbox' ? (
                                                            <div className="flex items-center gap-1">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={values.includes('true')}
                                                                    readOnly
                                                                    className="h-3 w-3"
                                                                />
                                                                <span>{field.label}</span>
                                                            </div>
                                                        ) : (
                                                            values.map((value, valueIdx) => (
                                                                <span 
                                                                    key={`${field.field}-${valueIdx}`}
                                                                    className="bg-gray-50 px-1.5 py-0.5 rounded text-gray-600 mt-0.5"
                                                                >
                                                                    {value}
                                                                </span>
                                                            ))
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// Modifier getGroupedValues pour un meilleur typage
const getGroupedValues = (lines: ParametrageLine[], section: FieldSection): GroupedValues[] => {
    const groupedValues: GroupedValues[] = [];
    
    Array.from(new Set(lines.map(line => 
        section.mainField.startsWith('other_infos.') 
            ? line.other_infos?.[section.mainField.split('.')[1] as keyof OtherInfos]?.toString() || ''
            : getNestedValue(line.json_row, section.mainField)
    ).filter(Boolean))).forEach(mainValue => {
        const relevantLines = lines.filter(line => {
            const lineMainValue = section.mainField.startsWith('other_infos.')
                ? line.other_infos?.[section.mainField.split('.')[1] as keyof OtherInfos]?.toString()
                : getNestedValue(line.json_row, section.mainField);
            return lineMainValue === mainValue;
        });

        const associatedValues: Record<string, string[]> = {};
        section.associatedFields.forEach(field => {
            const values = new Set(relevantLines.map(line => 
                field.field.startsWith('other_infos.')
                    ? line.other_infos?.[field.field.split('.')[1] as keyof OtherInfos]?.toString() || ''
                    : getNestedValue(line.json_row, field.field)
            ).filter(Boolean));
            if (values.size > 0) {
                associatedValues[field.field] = Array.from(values);
            }
        });

        groupedValues.push({
            mainValue,
            associatedValues
        });
    });

    return groupedValues;
};

export default ParametrageTab;

