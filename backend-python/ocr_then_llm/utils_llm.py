# import os
# import requests
# import json
# from dotenv import load_dotenv

# load_dotenv()

# gemini_api_key = os.getenv("GEMINI_API_KEY")

# def send_to_gemini(data_text, prompt):
    
#     url = "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent"
#     headers = {
#         'Content-Type': 'application/json',
#     }
#     data = {
#         'contents': [{
#             'parts': [{
#                 'text': f"{prompt}\n\nVoici le texte à analyser :\n{data_text}"
#             }]
#         }]
#     }
#     params = {
#         'key': gemini_api_key
#     }
    
#     print("🔄 Envoi de la requête à Gemini...")
#     response = requests.post(url, json=data, headers=headers, params=params)
    
#     # Vérifie si la requête a réussi et renvoie le résultat
#     if response.status_code == 200:
#         try:
#             response_json = response.json()
#             print("✅ Réponse reçue de Gemini")
#             print(f"Structure de la réponse: {json.dumps(response_json, indent=2)}")
#             return response_json
#         except json.JSONDecodeError as e:
#             print(f"❌ Erreur de décodage JSON: {str(e)}")
#             print(f"Contenu de la réponse: {response.text}")
#             return None
#     else:
#         print(f"❌ Erreur lors de l'envoi à Gemini: {response.status_code}")
#         print(f"Contenu de l'erreur: {response.text}")
#         return None
