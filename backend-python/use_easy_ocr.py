# from easy_ocr_processor import OCRProcessor

# #processor = OCRProcessor()
# #processor.process_directory("public/pdfs/mes_docs", "public/pdfs/ocr_results")


# from analyze_ocr_results import OCRAnalyzer
# import json

# analyzer = OCRAnalyzer("public/pdfs/ocr_results/ocr_results.json")

# for file in ['Collecte bennes 30 m3 Production - Actirob.pdf', 'ITE1104397_env581233.pdf', 'NC ITE1008202_env530752.pdf', 'S ITE893576_env469515.pdf', 'S ITE975395_env506173.pdf', 'lely_facture.pdf']:
#     results = analyzer.analyze_document(file)
#     print(json.dumps(results, indent=2, ensure_ascii=False, default=lambda x: x.__dict__))