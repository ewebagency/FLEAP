"use client";
import img_to_text_convertor from "../../lib/img_to_text_convertor";
import React, { useRef, useState, useEffect } from "react";
import { BsImageFill } from "react-icons/bs";
import TextCard from "./TextCard";
import { getDocument } from 'pdfjs-dist/build/pdf';


GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.mjs';

const Home = () => {
  const [processing, setProcessing] = useState<boolean>(false);
  const [texts, setTexts] = useState<Array<string>>([]);
  const imageInputRef: any = useRef(null);

  const openBrowseImage = async () => {
    await imageInputRef.current.click();
  };

  const convertPdfToImages = async (pdfPath: string) => {
    try {
      const loadingTask = getDocument(pdfPath);
      const pdfDoc = await loadingTask.promise;

      const numPages = pdfDoc.numPages;

      for (let i = 1; i <= numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 2 });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Rends la page sur le canvas
        await page.render({ canvasContext: context, viewport }).promise;

        // Conversion en image PNG
        const imgSrc = canvas.toDataURL('image/png');
        
        // Appeler la fonction de conversion d'image à texte
        await convert(imgSrc);
      }
    } catch (error) {
      console.error('Erreur lors de la conversion du PDF en images :', error);
    }
  };

  const convert = async (url: string) => {
    if (url.length) {
      setProcessing(true);
      await img_to_text_convertor(url).then((txt: string) => {
        setTexts((prevTexts) => [...prevTexts, txt]); // Ajouter le texte à la liste
      });
      setProcessing(false);
    }
  };

  const handlePdfUpload = async (file: File) => {
    const url = URL.createObjectURL(file);
    await convertPdfToImages(url);
  };

  return (
    <div className="min-h-[90vh]">
      <h1 className="text-white text-4xl md:text-6xl text-center px-5 pt-5 font-[800] ">
        Built With{" "}
        <span className="bg-gradient-to-r from-blue-600 via-green-500 to-indigo-400 inline-block text-transparent bg-clip-text">
          Tesseract Js{" "}
        </span>
      </h1>
      <input
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          e.preventDefault();
          handlePdfUpload(e.target.files?.[0]!); // Traite le PDF
        }}
        ref={imageInputRef}
        type="file"
        accept=".pdf" // Limiter les fichiers à PDF
        hidden
        required
      />
      <div className="relative md:bottom-10 w-full flex flex-col gap-10 items-center justify-center p-5 md:p-20">
        <div
          onClick={() => {
            openBrowseImage();
          }}
          onDragOver={(e: any) => {
            e.preventDefault();
          }}
          onDrop={(e: any) => {
            e.preventDefault();
            handlePdfUpload(e.dataTransfer.files?.[0]!); // Traite le PDF
          }}
          className="w-full min-h-[30vh] md:min-h-[50vh] p-5 bg-[#202020] cursor-pointer rounded-xl flex items-center justify-center"
        >
          <div className="w-full flex items-center justify-center flex-col gap-3">
            <p className="text-2xl md:text-3xl text-center text-[#707070] font-[800]">
              {processing
                ? "Processing Image..."
                : "Browse Or Drop Your PDF Here"}
            </p>
            <span className="text-8xl md:text-[150px] block text-[#5f5f5f]">
              <BsImageFill className={processing ? "animate-pulse" : ""} />
            </span>
          </div>
        </div>
        {texts.map((t, i) => {
          return <TextCard key={i} t={t} i={i} />;
        })}
      </div>
    </div>
  );
};

export default Home;
