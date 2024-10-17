'use client';
import React, { useState, useEffect } from 'react';
import Tesseract from 'tesseract.js';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/build/pdf';
import ProgressBar from './ProgressBar'; // Import de la barre de progression
import { extractInvoiceDetails } from './invoiceUtils'; // Importer les fonctions d'extraction

// Définir le chemin du worker de pdf.js
GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.mjs'; // Assurez-vous que ce chemin est correct

interface Props {
  pdfFiles: string[];
}


const ClientComponent: React.FC<Props> = ({ pdfFiles }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [extractedTexts, setExtractedTexts] = useState<string[]>([]); // Pour stocker le texte extrait
  const [invoiceDetails, setInvoiceDetails] = useState<any>(null); // Pour stocker les détails de la facture
  const [progress, setProgress] = useState<number>(0); // Pour suivre le progrès de l'extraction
  const [numPages, setNumPages] = useState<number>(0); // Pour stocker le nombre total de pages

  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % pdfFiles.length);
    setInvoiceDetails(null);
    setExtractedTexts([]);
    setNumPages(0);
  };

  const extractTextFromPdf = async (pdfFile: string) => {
    setLoading(true);
    setProgress(0); // Réinitialiser la progression
    const pdfPath = `/pdfs/mes_docs/${pdfFile}`;
    console.log('PDF Path:', pdfPath); // Log pour déboguer
  
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
              // Progression de Tesseract normalisée pour la page courante
              const tesseractProgress = info.progress * (100 / pagesToExtract); 
              // Mettre à jour la progression
              const totalProgress = pageProgress + (i > 1 ? tesseractProgress : 0); // Ajout de la progression de Tesseract uniquement après la première page
              setProgress(Math.min(Math.round(totalProgress), 100)); // Limiter la progression à 100%
            }
          },
        });

        // Log le texte extrait
        //console.log(`Texte extrait de la page ${i}:`, result.data.text); 
        texts.push(result.data.text); // Ajouter le texte extrait
      }
  
      setExtractedTexts(texts); // Mettre à jour l'état avec le texte extrait
        
      // Combine all extracted texts to analyze invoice details
      const fullText = texts.join('\n');
      
      const details = extractInvoiceDetails(fullText);
      
      setInvoiceDetails(details); // Mettre à jour l'état avec les détails de la facture
      
    } catch (error) {
      console.error('Erreur lors de l\'extraction du texte :', error);
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
    console.log('Les détails de la facture sont mis à jour:', invoiceDetails);
  }, [invoiceDetails]);
  console.log('les details enregistré dans le state', invoiceDetails) //=> fonctionne mais pas si on lui demande directement après qu'on lui ai affecté parce que asynchrone

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
            src={`/pdfs/mes_docs/${pdfFiles[currentIndex]}`}
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

        {invoiceDetails && (
          <div className='mt-4'>
            <h3>Détails de la Facture</h3>
            <p><strong>Numéro de Facture :</strong> {invoiceDetails.invoiceNumber}</p>
            <p><strong>Période de Facturation :</strong> {invoiceDetails.billingPeriod}</p>
            <p><strong>Total HT :</strong> {invoiceDetails.totalHT} EUR</p>
            <p><strong>Montant TTC :</strong> {invoiceDetails.totalTTC} EUR</p>
            <p><strong>Date d'Échéance :</strong> {invoiceDetails.dueDate}</p>
            
            
            <h4>Détails des Services</h4>
            {invoiceDetails.serviceDetails && invoiceDetails.serviceDetails.length > 0 ? (
            <ul>
                {invoiceDetails.serviceDetails.map((service, index) => (
                <li key={index} className='pl-1 mb-2 ml-2 mt-2 bg-sky-300 text-gray-700 rounded-md'>
                    <p><strong>Description :</strong> {service.description}</p>
                    <p><strong>Quantité :</strong> {service.qty}</p>
                    <p><strong>Unité :</strong> {service.unit}</p>
                    <p><strong>Prix Unitaire :</strong> {service.pu} EUR</p>
                    <p><strong>Total HT :</strong> {service.totalHT} EUR</p>
                    <p><strong>TVA :</strong> {service.tva} %</p>
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

export default ClientComponent;
