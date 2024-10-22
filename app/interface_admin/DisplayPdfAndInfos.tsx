'use client';
import React, { useState, useEffect } from 'react';
import Tesseract from 'tesseract.js';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/build/pdf';
import ProgressBar from './ProgressBar'; // Import de la barre de progression
//import { extractInvoiceDetails } from './invoiceUtils'; // Importer les fonctions d'extraction
import { ExtractInfosFromTextOCR } from './ExtractInfosFromTextOCR';

// Définir le chemin du worker de pdf.js
GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.mjs'; // Assurez-vous que ce chemin est correct

interface Props {
  pdfFiles: string[];
}


const DisplayPdfAndInfos: React.FC<Props> = ({ pdfFiles }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [extractedTexts, setExtractedTexts] = useState<string[]>([]); // Pour stocker le texte extrait
  const [infosFromPdf, setInfosFromPdf] = useState<any>(null); // Pour stocker les détails de la facture
  const [progress, setProgress] = useState<number>(0); // Pour suivre le progrès de l'extraction
  const [numPages, setNumPages] = useState<number>(0); // Pour stocker le nombre total de pages
  const [fullText, setFullText] = useState<string>(''); // État pour stocker le texte complet

  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % pdfFiles.length);
    setInfosFromPdf(null);
    setExtractedTexts([]);
    setNumPages(0);
  };

  const extractTextFromPdf = async (pdfFile: string) => {
    setLoading(true);
    setProgress(0); // Réinitialiser la progression
    const pdfPath = pdfFile;
    console.log('PDF Path: ' + pdfPath); // Log pour déboguer
  
    try {
      // Charger le document PDF
      const loadingTask = getDocument(pdfPath);
      const pdf = await loadingTask.promise;
  
      // Récupérer le nombre de pages
      const totalNumPages = pdf.numPages;
      setNumPages(totalNumPages); // Mettre à jour le nombre total de pages
  
      // Extraire le texte de chaque page
      const texts: string[] = []; // Pour stocker le texte extrait de chaque page
      const pagesToExtract = totalNumPages - 1; // Arrêter à l'avant-dernière page
      for (let i = 1; i <= pagesToExtract; i++) { // Inclure l'avant-dernière page
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
  
        // Préparer un canvas pour rendre la page du PDF
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
  
        // Rendre la page PDF dans le contexte du canvas
        await page.render({ canvasContext: context!, viewport: viewport }).promise;
  
        // Convertir le canvas en URL de données d'image
        const imageDataUrl = canvas.toDataURL('image/png');
  
        // Utiliser Tesseract pour extraire le texte de l'image
        const result = await Tesseract.recognize(imageDataUrl, 'fra', {
          logger: (info) => {
            if (info.status === 'recognizing text') {
              // Calculer la progression des pages
              const pageProgress = (i / pagesToExtract) * 100; // Progression jusqu'à 100%
              const tesseractProgress = info.progress * (100 / pagesToExtract); 
              const totalProgress = pageProgress + (i > 1 ? tesseractProgress : 0); 
              setProgress(Math.min(Math.round(totalProgress), 100)); 
            }
          },
        });

        // Remplacer les sauts de ligne par une chaîne identifiable
        const formattedText = result.data.text.replace(/\n/g, '[NEWLINE]');
        texts.push(formattedText); // Ajouter le texte extrait
        texts.push('[PAGE_BREAK]'); //Séparateur de page
      }
  
      setExtractedTexts(texts); // Mettre à jour l'état avec le texte extrait
        
      // Combine all extracted texts to analyze invoice details
      const combinedText = texts.join('\n');
      setFullText(combinedText); // Mettre à jour l'état avec le texte complet
      
      const results = ExtractInfosFromTextOCR(combinedText);
      console.log("mes infos du pdf", results)
      setInfosFromPdf(results); // Mettre à jour l'état avec les détails de la facture
      console.log('Mon use state info pdf', infosFromPdf);

    } catch (error) {
      console.log('Erreur lors de l\'extraction du texte : ' + error);
    } finally {
      setLoading(false);
    }
  };
  

  useEffect(() => {
    if (pdfFiles.length > 0) {
      extractTextFromPdf(pdfFiles[currentIndex]);
    }
  }, [currentIndex, pdfFiles]);

  useEffect(() => {
    //console.log('Texte extrait mis à jour:', extractedTexts);
  }, [extractedTexts]);
  
  useEffect(() => {
    console.log('Les détails de la facture sont mis à jour:', infosFromPdf);
  }, [infosFromPdf]);
  console.log('les details enregistré dans le state', infosFromPdf) //=> fonctionne mais pas si on lui demande directement après qu'on lui ai affecté parce que asynchrone

  //console.log("Voici mes pdfs",pdfFiles);

  return (
    <div className='m-5 flex'>
      {/* Colonne pour le PDF */}
      <div style={{ 
        transform: 'scale(0.9)',
        transformOrigin: 'top left',
        width: '66%',
        overflow: 'hidden'
      }}>
        {pdfFiles.length > 0 ? (
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

      <div className='bg-gray-200 rounded-md w-1/3 p-4 ml-4 mb-10 flex flex-col justify-between'>
        <div className='text-lg mb-4'>Veuillez valider les informations :</div>

        {/* Barre de chargement */}
        <ProgressBar progress={progress} loading={loading} />

        <div className='flex flex-col justify-start'>        
          {/* Commenté pour ne pas afficher les textes extraits */}         
          {/*extractedTexts.map((text, index) => (
            <div key={index} className='flex my-2 justify-between items-center'>
              <div className='flex justify-center'>
                <div className='py-3 px-2 justify-center bg-white rounded-md text-xs'>Texte de la page {index + 1}</div>
                <div className='ml-3 py-3 px-2 justify-center bg-white rounded-md text-xs'>{text}</div>
              </div>
              <button className='btn btn-success text-xs rounded-md px-2 py-1 ml-3'>
                Valider
              </button>
            </div>
          ))*/} 
        </div>

        {infosFromPdf && (
          <div className='mt-4'>
            <h3>Détails de la Facture</h3>
            <p><strong>Numéro de Facture :</strong> {infosFromPdf.facture}</p>
            <p><strong>Période :</strong> {infosFromPdf.facturation_periode}</p>
            
            
            
            <h4>Détails des Services</h4>
            {infosFromPdf.results && infosFromPdf.results.length > 0 ? (
            <ul>
                {infosFromPdf.results.map((row, index) => (
                <li key={index} className='pl-1 mb-2 ml-2 mt-2 bg-sky-300 text-gray-700 rounded-md'>
                    <p><strong>Numéro de dossier :</strong> {row.dossierNumber}</p>
                    <p><strong>Description + :</strong> {row.description_plus}</p>
                    <p><strong>Total HT + :</strong> {row.total_ht_plus}</p>
                    <p><strong>Description - :</strong> {row.description_minus}</p>
                    <p><strong>Total HT - :</strong> {row.total_ht_minus}</p>
                </li>
                ))}
            </ul>
            ) : (
            <p>Aucun détail de service trouvé.</p>
            )}
            </div>
          
        )}

        <button 
          className='mt-4 btn btn-primary rounded-md px-3 py-1 hover:bg-blue-600 transition duration-200'
          onClick={handleNext}
          disabled={pdfFiles.length === 0}
        >
          Suivant
        </button>
      </div>
    </div>
  );
};

export default DisplayPdfAndInfos;
