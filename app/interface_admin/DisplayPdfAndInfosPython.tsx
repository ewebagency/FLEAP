import React, { useState, useEffect } from 'react';
import ProgressBar from './ProgressBar'; 
import { ExtractInfosFromTextOCR } from './ExtractInfosFromTextOCR';
import { supabase } from '@/app/database/supabaseClient';
import PdfForm from './PdfForm';
import PdfMano from './FormMano';

interface Props {
  pdfFiles: string[];
  session_user_id: string;
  pdfIds: string[];
}

const DisplayPdfAndInfosPython: React.FC<Props> = ({ pdfFiles, pdfIds, session_user_id }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [extractedTexts, setExtractedTexts] = useState<string[]>([]);
  const [infosFromPdf, setInfosFromPdf] = useState<any>(null);
  const [formValues, setFormValues] = useState<any[]>([]);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  const checkPdfExists = async (pdfId: string) => {
    const { data, error } = await supabase
      .from('facture')
      .select('id')
      .eq('pdf_infos_id', pdfId)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Erreur lors de la vérification de l\'existence du PDF :', error);
      return false;
    }

    return data !== null;
  };

  const handleNext = async () => {
    const nextIndex = currentIndex + 1;

    if (nextIndex < pdfFiles.length) {
      const pdfId = pdfIds[nextIndex];
      const exists = await checkPdfExists(pdfId); // Vérifier si le PDF existe déjà

      if (!exists) {
        setCurrentIndex(nextIndex);
        setInfosFromPdf(null);
        setExtractedTexts([]);
        setFormValues([]); // Réinitialiser les valeurs du formulaire ici
      } else {
        handleNext(); // Passer au suivant si le PDF existe
      }
    } else {
      setIsCompleted(true); // Mettre à jour l'état pour indiquer que tous les PDF ont été parcourus
    }
  };

  const extractTextFromPdf = async (pdfFile: string) => {
    setLoading(true);
    const pdfPath = pdfFile;

    try {
      const formData = new FormData();
      const response = await fetch(pdfPath);
      const blob = await response.blob();
      formData.append('file', blob, `document-${currentIndex}.pdf`);

      const apiResponse = await fetch('http://localhost:8000/extract-text/', {
        method: 'POST',
        body: formData,
      });

      const result = await apiResponse.json();
      const extractedText = result.text;
      const formattedText = extractedText.replace(/\n/g, '[NEWLINE]');
      const texts = formattedText.split('[PAGE_BREAK]');
      setExtractedTexts(texts);
      
      const results = ExtractInfosFromTextOCR(formattedText);
      setInfosFromPdf(results);

      

      setFormValues(results.map(row => ({
        dossierNumber: row.dossierNumber,
        cedNumber: row.cedNumber,
        uppercaseLine: row.uppercaseLine,
        matterLine: row.matterLine,
        description_plus: row.description_plus,
        type_plus: row.type_plus,
        total_ht_plus: row.total_ht_plus,
        prix_unitaire_plus: row.prix_unitaire_plus,
        quantite_plus: row.quantite_plus,
        description_minus: row.description_minus,
        type_minus: row.type_minus,
        total_ht_minus: row.total_ht_minus,
        prix_unitaire_minus: row.prix_unitaire_minus,
        quantite_minus: row.quantite_minus,
        tva_minus: row.tva_minus,
      })));

    } catch (error) {
      console.log('Erreur lors de l\'extraction du texte depuis l\'API : ' + error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkAllPdfsProcessed = async () => {
      const checks = await Promise.all(pdfIds.map(pdfId => checkPdfExists(pdfId)));
      const allProcessed = checks.every(exists => exists);
      setIsCompleted(allProcessed);
      
      // Si tous les PDFs sont traités, ne pas afficher le premier PDF
      if (allProcessed) {
        setCurrentIndex(pdfFiles.length); // Mettre à un index en dehors des limites
      } else {
        extractTextFromPdf(pdfFiles[currentIndex]);
      }
    };

    if (pdfFiles.length > 0) {
      checkAllPdfsProcessed();
    }
  }, [pdfFiles, pdfIds, currentIndex]);

  const handleChange = (index: number, field: string, value: string) => {
    const updatedValues = [...formValues];
    updatedValues[index][field] = value;
    setFormValues(updatedValues);
  };

  const handleSubmit = async () => {
    const dataToSend = {
      pdfId: pdfIds[currentIndex],
      session_user_id,
      formValues,
    };


    try {
      const response = await fetch('api/store-info-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de l\'envoi des données');
      }

      const result = await response.json();
      console.log('Données soumises avec succès :', result);

    } catch (error) {
      console.error('Erreur lors de l\'envoi des données :', error);
    }
  };

  return (
    <div className='m-5 flex'>
      {isCompleted ? (
        <div className="mt-4 text-green-500 font-bold">
          Terminé
        </div>
      ) : (
        <>
          <div style={{ 
            transform: 'scale(0.9)',
            transformOrigin: 'top left',
            width: '66%',
            overflow: 'hidden'
          }}>
            {pdfFiles.length > 0 && currentIndex < pdfFiles.length ? (
              <iframe
                src={pdfFiles[currentIndex]}
                width="100%"
                height="auto"
                style={{ 
                  border: 'none', 
                  aspectRatio: '210 / 297',
                  maxHeight: '100vh'
                }}
                title="Mon PDF"
              />
            ) : (
              <p>Aucun fichier PDF trouvé.</p>
            )}
          </div>

          {/*<PdfForm 
            formValues={formValues}
            handleChange={handleChange}
            handleSubmit={handleSubmit}
            isCompleted={isCompleted}
            onNext={handleNext}
          />*/}
          <PdfMano
            handleChange={(index, field, value) => {
              // Handle changes from PdfForm if needed
            }}
            isCompleted={isCompleted}
            onNext={handleNext}
            session_user_id={session_user_id}
            pdfId={pdfIds[currentIndex]}
          />
        </>
      )}
    </div>
  );
};

export default DisplayPdfAndInfosPython;
