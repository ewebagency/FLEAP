/*import { getDocument } from 'pdfjs-dist';
import { createCanvas } from 'canvas';

export const pdfToImg = async (file: File): Promise<string[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer }).promise;
  const images: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');

    // Rendre la page PDF dans le canvas
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    await page.render(renderContext).promise;

    // Convertir le canvas en URL d'image
    const imageDataUrl = canvas.toDataURL('image/png');
    images.push(imageDataUrl);
  }

  return images;
};
*/