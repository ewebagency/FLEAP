# import os
# from fastapi import UploadFile
# from ai import convert_pdf_to_markdown, extract_invoice_info_from_markdown, process_invoice_file

# class MockFile:
#     def __init__(self, file_path):
#         self.file_path = file_path
#         self.file = open(file_path, 'rb')

#     async def read(self):
#         return self.file.read()

#     def close(self):
#         self.file.close()

# def test_convert_pdf_to_markdown(pdf_path):
#     print(f"\n=== Testing convert_pdf_to_markdown with {pdf_path} ===")
#     try:
#         mock_file = MockFile(pdf_path)
#         markdown = convert_pdf_to_markdown(mock_file)
#         print("✅ Conversion successful!")
#         print("\nFirst 500 characters of markdown:")
#         print(markdown[:500])
#         mock_file.close()
#         return markdown
#     except Exception as e:
#         print(f"❌ Error: {str(e)}")
#         return None

# def test_extract_invoice_info(markdown_text):
#     print(f"\n=== Testing extract_invoice_info_from_markdown ===")
#     try:
#         info = extract_invoice_info_from_markdown(markdown_text)
#         print("✅ Extraction successful!")
#         print("\nExtracted information:")
#         print(info)
#         return info
#     except Exception as e:
#         print(f"❌ Error: {str(e)}")
#         return None

# def test_process_invoice_file(pdf_path):
#     print(f"\n=== Testing process_invoice_file with {pdf_path} ===")
#     try:
#         mock_file = MockFile(pdf_path)
#         result = process_invoice_file(mock_file)
#         print("✅ Processing successful!")
#         print("\nFinal result:")
#         print(result)
#         mock_file.close()
#         return result
#     except Exception as e:
#         print(f"❌ Error: {str(e)}")
#         return None

# def main():
#     # Chemin vers le dossier public contenant les PDFs
#     pdf_dir = "public/pdfs/mes_docs"
    
#     # Liste tous les fichiers PDF dans le dossier
#     pdf_files = [f for f in os.listdir(pdf_dir) if f.endswith('.pdf')]
    
#     if not pdf_files:
#         print("❌ No PDF files found in the public directory!")
#         return
    
#     print(f"Found {len(pdf_files)} PDF files:")
#     for i, pdf in enumerate(pdf_files, 1):
#         print(f"{i}. {pdf}")
    
#     # Demande à l'utilisateur quel test effectuer
#     print("\nWhat would you like to test?")
#     print("1. Convert PDF to Markdown only")
#     print("2. Extract invoice info from markdown only")
#     print("3. Process entire invoice file")
#     print("4. Test all steps")
    
#     choice = input("\nEnter your choice (1-4): ")
    
#     # Demande à l'utilisateur quel PDF utiliser
#     pdf_choice = int(input(f"\nEnter the number of the PDF to test (1-{len(pdf_files)}): ")) - 1
#     if pdf_choice < 0 or pdf_choice >= len(pdf_files):
#         print("❌ Invalid PDF choice!")
#         return
    
#     pdf_path = os.path.join(pdf_dir, pdf_files[pdf_choice])
    
#     if choice == "1":
#         test_convert_pdf_to_markdown(pdf_path)
#     elif choice == "2":
#         markdown = input("Enter the markdown text to test: ")
#         test_extract_invoice_info(markdown)
#     elif choice == "3":
#         test_process_invoice_file(pdf_path)
#     elif choice == "4":
#         print("\n=== Testing all steps ===")
#         markdown = test_convert_pdf_to_markdown(pdf_path)
#         if markdown:
#             test_extract_invoice_info(markdown)
#         test_process_invoice_file(pdf_path)
#     else:
#         print("❌ Invalid choice!")

# if __name__ == "__main__":
#     main() 