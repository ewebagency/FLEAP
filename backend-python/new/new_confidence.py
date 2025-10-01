from utils.utils_manuscrit import classify_ocr_with_density

def extract_values(d):
    values = []
    if isinstance(d, dict):
        for v in d.values():
            values.extend(extract_values(v))
    elif isinstance(d, list):
        for item in d:
            values.extend(extract_values(item))
    else:
        values.append(d)
    return values


def get_confidence(gemini_data, potential_json_from_ocr):
    json = potential_json_from_ocr
    score_brute, n, score_spec, n_spec = 0, 0, 0, 0
    raw_gemini_values = extract_values(gemini_data)
    #print("="*43, "les valeurs de gemini : ", "\n", raw_gemini_values, "\n"*4)
    for page in json["pages"] :
        for block in page["blocks"] :
            for line in block["lines"] :
                for word in line["words"] :
                    word_value = word["value"]
                    confidence = word["confidence"]
                    #print("="*43, "word_value : ", word_value, "="*4, "confidence :", confidence)
                    
                    score_brute += confidence
                    n += 1
                    for raw_g_value in raw_gemini_values :
                        if raw_g_value and word_value and ((raw_g_value in word_value) or (word_value in raw_g_value)) and len(word_value) > 3 :
                            #print("="*43, "raw_g_value : ", raw_g_value, "="*4, "word_value :", word_value)
                            score_spec += confidence
                            n_spec += 1
                            break
    score_brute = (score_brute / n) * 100
    score_spec = (score_spec / n_spec) * 100

    return {"brute": score_brute, "spec": score_spec}



def handwritten_confidence(file, ocr_json):
    # Normaliser la forme du JSON OCR attendu par classify_ocr_with_density
    # Ce dernier s'attend à un dict avec la clé 'raw_result' contenant 'pages'
    if ocr_json is None:
        normalized = {"raw_result": {"pages": []}}
    elif isinstance(ocr_json, dict) and "raw_result" in ocr_json:
        normalized = ocr_json
    else:
        # Quand on reçoit déjà le "raw_result" (ex: utils_doctr), on l'encapsule
        normalized = {"raw_result": ocr_json}

    results = classify_ocr_with_density(file, normalized, threshold=0.03)
    
    handwritten_words_list = [
        word for word in results 
        if word.get('classification') == 'handwritten'
    ]
    n = len(handwritten_words_list)
    too_much_handwritten_words = n > 6
    
    return n, too_much_handwritten_words