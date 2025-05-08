import os
import subprocess
import shutil
from pathlib import Path

def test_marker_directly():
    """
    Test marker-pdf directly with a simple PDF file
    """
    # Chemins des dossiers
    test_dir = Path("test_marker")
    input_dir = test_dir / "input"
    output_dir = test_dir / "output"
    
    # Créer les dossiers de test
    input_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Chemin du PDF de test
    pdf_path = r"C:\Users\arthu\Documents\1StartUp\Fichiers_souvent_utilisés\FacturesDossier\01.factureAll\S ITE_test.pdf"
    
    # Copier le PDF dans le dossier d'entrée
    shutil.copy2(pdf_path, input_dir / "test.pdf")
    
    print("🔄 Test de marker-pdf...")
    print(f"📁 Dossier d'entrée: {input_dir}")
    print(f"📁 Dossier de sortie: {output_dir}")
    
    try:
        # Exécuter marker avec différentes options
        print("\n1️⃣ Test avec les options de base:")
        result = subprocess.run(
            ["marker", str(input_dir), "--output_dir", str(output_dir)],
            capture_output=True,
            text=True
        )
        print(f"Sortie: {result.stdout}")
        print(f"Erreur: {result.stderr}")
        
        # Vérifier le résultat
        if result.returncode == 0:
            print("✅ Test réussi!")
            print("📁 Contenu du dossier de sortie:")
            for file in output_dir.glob("**/*"):
                print(f"  - {file.relative_to(output_dir)}")
        else:
            print("❌ Test échoué!")
            
        # Nettoyer
        shutil.rmtree(test_dir)
        
    except Exception as e:
        print(f"❌ Erreur: {str(e)}")
        # Nettoyer en cas d'erreur
        if test_dir.exists():
            shutil.rmtree(test_dir)

if __name__ == "__main__":
    test_marker_directly() 