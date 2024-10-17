'use client';
import React, { useState } from 'react';
import * as pdfjsLib from "pdfjs-dist/build/pdf";
import { pdfjs } from 'pdfjs-dist';
import { Tesseract } from 'tesseract.js';

// Set the workerSrc to the path of the pdf.worker.mjs file
pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdfjs/pdf.worker.mjs`;

const NewClientComponent: React.FC = () => {
  const [ocrResult, setOcrResult] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleExtractPdf = async (file: File) => {
    setLoading(true);
    try {
      const fileReader = new FileReader();
      fileReader.onload = async (event) => {
        const typedArray = new Uint8Array(event.target?.result as ArrayBuffer);
        const loadingTask = pdfjs.getDocument(typedArray);
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: context!, viewport: viewport }).promise;

        const imageDataUrl = canvas.toDataURL('image/png');

        // Use Tesseract to recognize text from the image
        const { data: { text } } = await Tesseract.recognize(
          imageDataUrl,
          'fra', // Language for OCR
          {
            logger: (m) => console.log(m) // Logger to track progress
          }
        );

        setOcrResult(text);
      };
      fileReader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Erreur d\'extraction:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleExtractPdf(file);
    }
  };

  return (
    <div>
      <input type="file" accept="application/pdf" onChange={handleFileUpload} />
      {loading && <p>Chargement de l'OCR...</p>}
      {ocrResult && (
        <div>
          <h3>Résultat OCR :</h3>
          <p>{ocrResult}</p>
        </div>
      )}
    </div>
  );
};

export default NewClientComponent;
