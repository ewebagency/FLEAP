// components/FormulaireManoJson.tsx

import { useState } from 'react';
import Editor from "@monaco-editor/react";
import { jsonDefaultData } from './placeholders';
import { supabase } from '@/app/database/supabaseClient';

// Add this type at the top of your file
type JsonDataType = typeof jsonDefaultData[keyof typeof jsonDefaultData];

interface FormulaireManoJsonProps { 
    currentPdfId: string | null;
    onNextPdf: () => void;
}

export default function FormulaireManoJson({currentPdfId, onNextPdf}: FormulaireManoJsonProps) {
  const [jsonInput, setJsonInput] = useState(JSON.stringify(jsonDefaultData.facture_form, null, 2));
  const [jsonData, setJsonData] = useState<JsonDataType | null>(jsonDefaultData.facture_form); // Allow null
  const [loading, setLoading] = useState(false);
  const [typeForm, setTypeForm] = useState('facture_form');

  const handleChangeForm = (type: keyof typeof jsonDefaultData) => {
    setJsonInput(JSON.stringify(jsonDefaultData[type], null, 2));
    setJsonData(jsonDefaultData[type]);
    setTypeForm(type);
  };

  const handleInputChange = (value?: string) => { // Allow value to be undefined
    setJsonInput(value || ''); // Default to empty string if value is undefined
    try {
      const parsedData = JSON.parse(value || '{}'); // Parse as empty object if value is undefined
      setJsonData(parsedData);
    } catch (error) {
      setJsonData(null); // Now this is valid
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    let user_id = '';
    try {
        //Récupération de l'id de l'utilisateur associé au pdf
        const {data, error: pdfError} = await supabase
        .from('pdf_infos')
        .select('user_id')
        .eq('id', currentPdfId)
        .single();
        if (pdfError) {
            console.error("Erreur dans la récolte du user_id du pdf", pdfError);
        } else {
            user_id = data.user_id;
        }

        if (typeForm === 'facture_form') {
            //Insertion de la facture dans la base de données
            const { data: result, error } = await supabase
            .from('facture')
            .insert([{
                user_id: user_id,
                pdf_infos_id: currentPdfId,
                infos_json: jsonData
            }]);
            if (error) {
                console.error("Error inserting facture", error);
            } else {
                console.log("Facture inserted !");
                onNextPdf();
            }
        } else if (typeForm === 'bsd_formulaire') {
            //Insertion du BSD dans la base de données
            const { data: result, error } = await supabase
            .from('bsd')
            .insert([{
                user_id: user_id,
                pdf_infos_id: currentPdfId,
                infos_json: jsonData
            }]);
            if (error) {
                console.error("Error inserting BSD", error);
            } else {
                console.log("BSD inserted !");
                onNextPdf();
            }
        }
    } finally {
        setLoading(false);
        }
  };


  return (
    <div style={{ width: '100%', maxWidth: '600px', margin: 'auto' }}>
      <h2>Formulaire JSON</h2>

      <div>
        <select className="m-2 rounded-md bg-gray-200 p-2" onChange={(e) => handleChangeForm(e.target.value as keyof typeof jsonDefaultData)}>
          <option value="facture_form">Formulaire Facture</option>
          <option value="bsd_formulaire">Formulaire BSD</option>
        </select>
      </div>

      <Editor
        height="400px"
        defaultLanguage="json"
        value={jsonInput}
        onChange={handleInputChange}
        theme="vs-dark" // ou "light" pour un thème clair
        options={{
            minimap: { enabled: false },
            fontSize: 12, // Réduire la taille de la police
            formatOnPaste: true,
            formatOnType: true,
            scrollBeyondLastLine: false,
            lineHeight: 1.3, // Réduire l'espacement des lignes
            letterSpacing: -0.5, // Réduire légèrement l'espacement des caractères
            fontFamily: 'Consolas, Monaco, monospace', // Police plus compacte
            wordWrap: 'on', // Activer le retour à la ligne automatique
          }}
      />

      <div className="flex justify-end mt-4 mr-3">
        <form onSubmit={handleSubmit}>
          <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-md">Next</button>
        </form>
      </div>
    </div>
  );
}
