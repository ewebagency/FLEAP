"use client";
import { useEffect, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { createCanvas } from 'canvas';

export default function Home() {
  const [images, setImages] = useState([]);

  useEffect(() => {
    const convertPdfToImages = async () => {
      try {
        // Chemin vers le fichier PDF dans le dossier public/pdfs
        const pdfPath = '/pdfs/mes_docs/20240805144059384.pdf';
        const response = await fetch(pdfPath);
        const existingPdfBytes = await response.arrayBuffer();
        
        // Charge le PDF
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const numPages = pdfDoc.getPageCount();
        const imgList = [];

        for (let i = 0; i < numPages; i++) {
          const page = pdfDoc.getPage(i);
          const { width, height } = page.getSize();

          // Crée un canvas pour chaque page
          const canvas = createCanvas(width, height);
          const context = canvas.getContext('2d');

          // Dessine une page vierge (ici, on pourrait faire du rendu de contenu PDF plus tard)
          context.fillStyle = 'white';
          context.fillRect(0, 0, width, height);
          context.font = '30px Arial';
          context.fillStyle = 'black';
          context.fillText(`Page ${i + 1} Render`, 50, 50); // Exemple de contenu

          // Conversion en image PNG
          const buffer = canvas.toDataURL('image/png');
          imgList.push(buffer);
        }

        setImages(imgList); // Mettre à jour l'état avec la liste des images
        console.log('ok');
      } catch (error) {
        console.error('Erreur lors de la conversion :', error);
      }
    };

    convertPdfToImages();
  }, []);

  return (
    <div>
      <h1>Conversion PDF en images</h1>
      {images.length > 0 && (
        <div>
          {images.map((imgSrc, index) => (
            <img key={index} src={imgSrc} alt={`Page ${index + 1}`} />
          ))}
        </div>
      )}
    </div>
  );
}
