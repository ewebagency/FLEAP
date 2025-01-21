import os
import easyocr
import cv2
import io
import json
from PyPDF2 import PdfReader, PdfWriter, PdfMerger
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import red, blue
from PIL import Image
from pdf2image import convert_from_path
import numpy as np

class OCRProcessor:
    def __init__(self, languages=['fr', 'en']):
        """
        Initialise le processeur OCR avec les langues spécifiées
        """
        print("Initialisation du lecteur EasyOCR...")
        self.reader = easyocr.Reader(languages)
        print("Lecteur EasyOCR initialisé")

    def process_directory(self, input_dir, output_dir):
        """
        Traite tous les PDF dans un dossier
        """
        os.makedirs(output_dir, exist_ok=True)
        
        # Pour stocker tous les résultats
        all_results = {}
        
        for filename in os.listdir(input_dir):
            if filename.lower().endswith('.pdf'):
                input_path = os.path.join(input_dir, filename)
                print(f"Traitement de {filename}...")
                try:
                    # Traiter le PDF et stocker les résultats
                    pdf_results = self.process_pdf(input_path, output_dir)
                    if pdf_results:
                        all_results[filename] = pdf_results
                except Exception as e:
                    print(f"Erreur lors du traitement de {filename}: {str(e)}")
                    all_results[filename] = {"error": str(e)}

        # Sauvegarder tous les résultats dans un fichier JSON
        results_path = os.path.join(output_dir, "ocr_results.json")
        with open(results_path, 'w', encoding='utf-8') as f:
            json.dump(all_results, f, ensure_ascii=False, indent=2)
        
        print(f"\nRésultats OCR sauvegardés dans {results_path}")
        return all_results

    def process_pdf(self, pdf_path, output_dir):
        """
        Traite un seul fichier PDF
        """
        base_name = os.path.basename(pdf_path).replace(".pdf", "")
        pdf_output_folder = os.path.join(output_dir, base_name)
        os.makedirs(pdf_output_folder, exist_ok=True)

        # Créer un dossier pour les images temporaires
        temp_folder = os.path.join(pdf_output_folder, "temp")
        os.makedirs(temp_folder, exist_ok=True)

        try:
            results = self.extract_text_with_bounding_boxes(pdf_path, pdf_output_folder, temp_folder)
            return results
        finally:
            # Nettoyer les fichiers temporaires
            for temp_file in os.listdir(temp_folder):
                os.remove(os.path.join(temp_folder, temp_file))
            os.rmdir(temp_folder)

    def extract_text_with_bounding_boxes(self, pdf_path, output_folder, temp_folder):
        """
        Extrait le texte avec les zones de détection
        """
        pdf_reader = PdfReader(pdf_path)
        num_pages = len(pdf_reader.pages)
        
        # Pour stocker les résultats de toutes les pages
        pdf_results = {
            "num_pages": num_pages,
            "pages": {}
        }

        # Traiter chaque page
        for page_num in range(num_pages):
            print(f"Traitement de la page {page_num + 1}/{num_pages}")
            
            # Convertir la page en image
            image_path = os.path.join(temp_folder, f"page_{page_num + 1}.png")
            self.extract_pdf_page_as_image(pdf_path, page_num, image_path)

            # Effectuer l'OCR
            ocr_results = self.reader.readtext(image_path)
            
            # Stocker les résultats de la page
            page_results = []
            for bbox, text, confidence in ocr_results:
                # Convertir les coordonnées numpy en listes Python
                bbox_list = [[float(x) for x in point] for point in bbox]
                page_results.append({
                    "text": text,
                    "confidence": float(confidence),  # Convertir en float Python natif
                    "bbox": bbox_list,
                    "position": {
                        "top_left": bbox_list[0],
                        "top_right": bbox_list[1],
                        "bottom_right": bbox_list[2],
                        "bottom_left": bbox_list[3]
                    }
                })
            
            pdf_results["pages"][f"page_{page_num + 1}"] = page_results

            # Créer les versions annotées si nécessaire
            self.create_annotated_files(
                pdf_reader, page_num, ocr_results, image_path, output_folder
            )

        return pdf_results

    def extract_pdf_page_as_image(self, pdf_path, page_num, output_path, dpi=300):
        """
        Convertit une page de PDF en image
        """
        images = convert_from_path(
            pdf_path, 
            dpi=dpi, 
            first_page=page_num + 1, 
            last_page=page_num + 1
        )
        images[0].save(output_path, "PNG")

    def create_annotated_files(self, pdf_reader, page_num, results, image_path, output_folder):
        """
        Crée les fichiers annotés (image et PDF)
        """
        base_name = f"page_{page_num + 1}"
        
        # Créer l'image annotée
        image = cv2.imread(image_path)
        annotated_image = self.annotate_image(image.copy(), results)
        cv2.imwrite(
            os.path.join(output_folder, f"{base_name}_annotated.png"),
            annotated_image
        )

        # Créer le PDF annoté
        self.create_pdf_with_annotations(
            pdf_reader,
            page_num,
            results,
            os.path.join(output_folder, f"{base_name}_annotated.pdf"),
            image.shape
        )

    def annotate_image(self, image, results):
        """
        Ajoute des annotations sur l'image
        """
        for (bbox, text, prob) in results:
            # Convertir les points en entiers
            points = np.array(bbox, np.int32)
            
            # Dessiner le polygone
            cv2.polylines(
                image, 
                [points], 
                isClosed=True, 
                color=(0, 0, 255),  # Rouge
                thickness=2
            )

            # Ajouter le texte avec un fond
            x, y = points[0]
            text_with_conf = f"{text} ({prob:.2f})"
            
            # Fond blanc pour le texte
            (text_w, text_h), _ = cv2.getTextSize(
                text_with_conf, 
                cv2.FONT_HERSHEY_SIMPLEX, 
                0.5, 
                1
            )
            cv2.rectangle(
                image,
                (x, y - text_h - 4),
                (x + text_w, y),
                (255, 255, 255),
                -1
            )
            
            # Texte
            cv2.putText(
                image,
                text_with_conf,
                (x, y - 4),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 0, 255),  # Rouge
                1
            )

        return image

    def create_pdf_with_annotations(self, pdf_reader, page_num, results, output_path, image_shape):
        """
        Crée un PDF avec les annotations
        """
        # Créer un nouveau PDF avec les annotations
        packet = io.BytesIO()
        c = canvas.Canvas(packet, pagesize=letter)
        
        # Obtenir les dimensions de la page
        page = pdf_reader.pages[page_num]
        pdf_width = float(page.mediabox.width)
        pdf_height = float(page.mediabox.height)
        
        # Facteurs d'échelle pour convertir les coordonnées de l'image au PDF
        scale_x = pdf_width / image_shape[1]
        scale_y = pdf_height / image_shape[0]

        # Dessiner les annotations
        for (bbox, text, prob) in results:
            points = np.array(bbox)
            
            # Convertir les coordonnées
            x1, y1 = points[0] * [scale_x, scale_y]
            x2, y2 = points[2] * [scale_x, scale_y]
            
            # Dessiner le rectangle
            c.setStrokeColor(red)
            c.setLineWidth(1)
            c.rect(
                x1,
                pdf_height - y1,  # Inverser Y car PDF utilise un système de coordonnées différent
                x2 - x1,
                y1 - y2,
                stroke=1,
                fill=0
            )
            
            # Ajouter le texte
            c.setFillColor(blue)
            c.setFont("Helvetica", 8)
            c.drawString(
                x1,
                pdf_height - y1 + 2,
                f"{text} ({prob:.2f})"
            )

        c.save()
        packet.seek(0)

        # Fusionner avec la page originale
        output = PdfWriter()
        page = pdf_reader.pages[page_num]
        page.merge_page(PdfReader(packet).pages[0])
        output.add_page(page)

        with open(output_path, 'wb') as output_file:
            output.write(output_file)

def main():
    # Configuration
    input_dir = "public/pdfs/mes_docs"  # Dossier contenant les PDFs
    output_dir = "public/pdfs/ocr_results"  # Dossier pour les résultats
    
    # Créer et utiliser le processeur OCR
    processor = OCRProcessor(languages=['fr', 'en'])
    processor.process_directory(input_dir, output_dir)

if __name__ == "__main__":
    main() 