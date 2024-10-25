import React, { useEffect, useState } from 'react';
import { useSession } from '../SessionProvider';
import { supabase } from '@/app/database/supabaseClient';

type FormDataType = { [key: string]: string | number | boolean | FormDataType | FormDataType[] }; // Définir un type pour formData

const renderField = (key: string, value: any, handleChange: (key: string, value: any) => void) => {
  if (typeof value === 'object' && !Array.isArray(value)) {
    return (
      <fieldset key={key} className="mb-4 border p-2 rounded">
        <legend className="font-bold">{key}</legend>
        {Object.entries(value).map(([subKey, subValue]) => renderField(subKey, subValue, (newKey, newValue) => handleChange(`${key}.${newKey}`, newValue)))}
      </fieldset>
    );
  }
  if (Array.isArray(value)) {
    return (
      <fieldset key={key} className="mb-4 border p-2 rounded">
        <legend className="font-bold">{key}</legend>
        {value.map((item, index) =>
          typeof item === 'object' ? (
            <div key={index} className="mb-2">
              {Object.entries(item).map(([subKey, subValue]) => renderField(subKey, subValue, (newKey, newValue) => handleChange(`${key}[${index}].${newKey}`, newValue)))}
            </div>
          ) : null
        )}
      </fieldset>
    );
  }
  return (
    <div key={key} className="mb-2">
      <label className="block text-sm font-medium text-gray-700">{key}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(key, e.target.value)}
        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
      />
    </div>
  );
};

const JsonForm = ({ data, currentPdfId, onNextPdf }: { data: any, currentPdfId: string | null, onNextPdf: () => void }) => {
    const [formData, setFormData] = useState<FormDataType>(data);
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false); // État pour le loader

    const session = useSession();

    useEffect(() => {
        if (session && session.user) {
            setUserId(session.user.id);
        }
    }, [session]);

    const handleChange = (key: string, value: any) => {
        setFormData((prevData: FormDataType) => {
            const newData = { ...prevData };
            const keys = key.split('.');
            let current = newData;
            keys.forEach((k, index) => {
                if (index === keys.length - 1) {
                    current[k] = value;
                } else {
                    current = current[k] as FormDataType;
                }
            });
            return newData;
        });
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setLoading(true); // Commence le chargement
        try {
            const {data :result, error} = await supabase
            .from('facture')
            .insert([{
                user_id: userId,
                pdf_infos_id: currentPdfId,
                infos_json: formData
            }]);
            if (error) {
                console.error("Error inserting facture", error);
            } else {
                console.log("Facture inserted !");
                onNextPdf(); // Appel de la fonction pour passer au prochain PDF
            }
        } finally {
            setLoading(false); // Termine le chargement
        }
    };

    return (
    <form className="space-y-4" onSubmit={handleSubmit}>
        {loading ? (
            <div className="flex justify-center items-center">
                <div className="loader">Envoi en cours...</div>
            </div>
        ) : (
            <>
                {Object.entries(formData).map(([key, value]) => renderField(key, value, handleChange))}
                <div className="flex justify-end">
                    <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">Valider & Passer à la suite</button>
                </div>
            </>
        )}
    </form>
    );
};

export default JsonForm;
