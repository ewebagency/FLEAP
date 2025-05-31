# import requests
# import os
# import glob

# def test_pdf_processing():
#     # URL de l'API
#     api_url = "http://localhost:8000/process-pdf"
    
#     # Chemin vers votre fichier PDF
#     pdf_path = r"C:\Users\arthu\Documents\1StartUp\Fichiers_souvent_utilisés\FacturesDossier\01.factureAll\S ITE_test.pdf"
    
#     # Vérifier si le fichier existe
#     if not os.path.exists(pdf_path):
#         print(f"❌ Le fichier {pdf_path} n'existe pas")
#         return
        
#     # Vérifier si c'est bien un PDF
#     if not pdf_path.lower().endswith('.pdf'):
#         print(f"❌ Le fichier {pdf_path} n'est pas un PDF")
#         return
    
#     try:
#         # Vérifier la taille du fichier
#         file_size = os.path.getsize(pdf_path)
#         if file_size == 0:
#             print("❌ Le fichier PDF est vide")
#             return
#         print(f"📊 Taille du fichier: {file_size / 1024:.2f} KB")
        
#         # Ouvrir le fichier PDF
#         with open(pdf_path, 'rb') as pdf_file:
#             # Préparer les fichiers pour l'envoi
#             files = {
#                 'pdf_file': ('input.pdf', pdf_file, 'application/pdf')
#             }
            
#             # Envoyer la requête
#             print("🔄 Envoi du PDF à l'API...")
#             response = requests.post(api_url, files=files)
            
#             # Vérifier la réponse
#             if response.status_code == 200:
#                 print("✅ PDF traité avec succès!")
#                 print("📄 Résultat:")
#                 print(response.json())
#             else:
#                 print(f"❌ Erreur: {response.status_code}")
#                 print(response.text)
                
#     except Exception as e:
#         print(f"❌ Erreur lors de l'envoi du PDF: {str(e)}")

# if __name__ == "__main__":
#     test_pdf_processing() 