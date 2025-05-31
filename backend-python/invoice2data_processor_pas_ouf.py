# from invoice2data import extract_data
# from invoice2data.extract.loader import read_templates
# import os
# import json
# from datetime import datetime
# from reportlab.pdfgen import canvas
# from reportlab.lib.colors import red, blue
# from PyPDF2 import PdfReader, PdfWriter
# import io

# # Définition des templates personnalisés
# CUSTOM_TEMPLATES = [
#     {
#         'fields': {
#             'invoice_number': {'parser': 'regex', 'pattern': r'Facture\s*[N°n°]*\s*:?\s*(\w+)'},
#             'date': {'parser': 'regex', 'pattern': r'Date\s*:?\s*(\d{2}[/-]\d{2}[/-]\d{4})'},
#             'amount': {'parser': 'regex', 'pattern': r'Total\s*(?:TTC|HT)?\s*:?\s*(\d+[.,]\d{2})'},
#             'vat': {'parser': 'regex', 'pattern': r'TVA\s*:?\s*(\d+[.,]\d{2})'},
#         },
#         'keywords': ['LELY', 'SUEZ', 'VEOLIA', 'PAPREC'],
#         'options': {
#             'remove_whitespace': True,
#             'remove_accents': True,
#             'lowercase': True,
#             'currency': 'EUR',
#             'date_formats': ['%d/%m/%Y', '%d-%m-%Y'],
#         }
#     }
# ]

# class Invoice2DataProcessor:
#     def __init__(self):
#         """
#         Initialise le processeur avec les templates personnalisés
#         """
#         self.templates = CUSTOM_TEMPLATES
            
#     def process_directory(self, input_dir, output_dir):
#         """
#         Traite tous les PDF dans un dossier
#         """
#         os.makedirs(output_dir, exist_ok=True)
#         results = []
        
#         for filename in os.listdir(input_dir):
#             if filename.lower().endswith('.pdf'):
#                 input_path = os.path.join(input_dir, filename)
#                 print(f"\nTraitement de {filename}...")
                
#                 try:
#                     # Extraire les données avec pdfminer
#                     from pdfminer.high_level import extract_text
#                     text = extract_text(input_path)
                    
#                     # Analyser le texte avec nos templates
#                     result = self.process_text(text, filename)
#                     if result:
#                         results.append({
#                             'filename': filename,
#                             'data': result
#                         })
                        
#                         # Créer PDF annoté
#                         output_path = os.path.join(output_dir, f"annotated_{filename}")
#                         self.create_annotated_pdf(input_path, result, output_path)
                        
#                 except Exception as e:
#                     print(f"Erreur lors du traitement de {filename}: {str(e)}")
        
#         # Sauvegarder les résultats
#         with open(os.path.join(output_dir, 'results.json'), 'w', encoding='utf-8') as f:
#             json.dump(results, f, ensure_ascii=False, indent=2, default=str)
            
#         return results

#     def process_text(self, text, filename):
#         """
#         Traite le texte extrait du PDF avec nos templates personnalisés
#         """
#         import re
#         result = {}
        
#         for template in self.templates:
#             # Vérifier si c'est le bon template pour ce document
#             if not any(keyword.lower() in text.lower() for keyword in template['keywords']):
#                 continue
                
#             # Extraire les informations selon les patterns définis
#             for field, config in template['fields'].items():
#                 if config['parser'] == 'regex':
#                     match = re.search(config['pattern'], text, re.IGNORECASE)
#                     if match:
#                         result[field] = match.group(1)
            
#             if result:  # Si on a trouvé des informations
#                 print(f"\nInformations extraites de {filename}:")
#                 self._print_extracted_info(result)
#                 return result
                
#         print(f"Aucune information extraite de {filename}")
#         return None

#     def create_annotated_pdf(self, input_path, data, output_path):
#         """
#         Crée une version annotée du PDF avec les informations extraites
#         """
#         try:
#             # Lire le PDF original
#             pdf_reader = PdfReader(input_path)
#             first_page = pdf_reader.pages[0]
            
#             # Créer un nouveau PDF pour les annotations
#             packet = io.BytesIO()
#             c = canvas.Canvas(packet)
            
#             # Configurer le style du texte
#             c.setFont("Helvetica", 10)
#             c.setFillColor(blue)
            
#             # Position initiale pour les annotations
#             y = 800
            
#             # Ajouter les informations extraites
#             c.drawString(30, y, "Informations extraites par invoice2data:")
#             y -= 20
            
#             for key, value in data.items():
#                 if value:
#                     text = f"{key}: {value}"
#                     c.drawString(40, y, text)
#                     y -= 15
                    
#                     if y < 50:  # Si on arrive en bas de la page
#                         break
            
#             c.save()
#             packet.seek(0)
            
#             # Fusionner les annotations avec la première page
#             new_pdf = PdfReader(packet)
#             first_page.merge_page(new_pdf.pages[0])
            
#             # Sauvegarder le résultat
#             output = PdfWriter()
#             output.add_page(first_page)
            
#             with open(output_path, 'wb') as output_file:
#                 output.write(output_file)
                
#             print(f"PDF annoté créé : {output_path}")
            
#         except Exception as e:
#             print(f"Erreur lors de la création du PDF annoté : {str(e)}")

#     def _print_extracted_info(self, data):
#         """
#         Affiche les informations extraites de manière formatée
#         """
#         for key, value in data.items():
#             if isinstance(value, datetime):
#                 value = value.strftime('%Y-%m-%d')
#             print(f"{key:20}: {value}")

# def main():
#     # Configuration
#     input_dir = "public/pdfs/mes_docs"
#     output_dir = "public/pdfs/invoice2data_results"
    
#     # Créer et utiliser le processeur
#     processor = Invoice2DataProcessor()
#     results = processor.process_directory(input_dir, output_dir)
    
#     # Afficher un résumé
#     print("\nRésumé du traitement :")
#     print(f"Nombre de factures traitées : {len(results)}")
    
#     # Afficher les résultats détaillés
#     print("\nRésultats détaillés sauvegardés dans :", os.path.join(output_dir, 'results.json'))

# if __name__ == "__main__":
#     main() 