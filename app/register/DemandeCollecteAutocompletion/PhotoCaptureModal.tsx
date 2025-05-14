import React from 'react';
import BoxIcon from "@/app/component/BoxIconWrapper";
import { toast } from 'react-hot-toast';

interface PhotoCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

const PhotoCaptureModal: React.FC<PhotoCaptureModalProps> = ({ isOpen, onClose, onCapture }) => {
  const handleTakePhoto = async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.click();

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        // Compresser l'image
        const compressedFile = await compressImage(file);
        onCapture(compressedFile);
        onClose();
        toast.success('Photo ajoutée');
      };
    } catch (error) {
      console.error('Erreur lors de la prise de photo:', error);
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue');
    }
  };

  // Fonction de compression d'image
  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = document.createElement('img');
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Compression failed'));
            }
          }, 'image/jpeg', 0.7);
        };
      };
      reader.onerror = (error) => reject(error);
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 w-[95%] max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Prendre une photo</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <BoxIcon name="x" type="solid" size="md" />
          </button>
        </div>
        
        <div className="flex flex-col items-center gap-4">
          <div className="text-center text-gray-600 mb-4">
            Cliquez sur le bouton ci-dessous pour prendre une photo ou sélectionner une image depuis votre galerie
          </div>
          
          <button
            onClick={handleTakePhoto}
            className="px-6 py-3 bg-[var(--green-medium)] text-white rounded-full hover:bg-[var(--green-dark)] transition-colors flex items-center gap-2"
          >
            <BoxIcon name="camera" type="solid" size="md" color="white" />
            <span>Prendre une photo</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PhotoCaptureModal; 