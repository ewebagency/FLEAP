import json
import re
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from decimal import Decimal

@dataclass
class InvoiceLine:
    description: str
    quantity: Optional[float]
    unit_price: Optional[float]
    total_ht: Optional[float]
    tva_rate: Optional[float]
    tva_amount: Optional[float]

class OCRAnalyzer:
    def __init__(self, json_path: str):
        """
        Initialise l'analyseur avec le fichier JSON des résultats OCR
        """
        with open(json_path, 'r', encoding='utf-8') as f:
            self.ocr_results = json.load(f)

    def analyze_document(self, filename: str) -> Dict:
        """
        Analyse un document spécifique
        """
        if filename not in self.ocr_results:
            return {"error": "Document non trouvé"}

        doc_results = self.ocr_results[filename]
        all_text = self._get_all_text(doc_results)
        
        # Analyse structurée de la facture
        return {
            "metadata": {
                "invoice_number": self._find_invoice_numbers(all_text),
                "invoice_date": self._find_dates(all_text),
                "due_date": self._find_due_date(all_text),
            },
            "company_details": self._find_company_details(all_text),
            "customer_details": self._find_customer_details(all_text),
            "invoice_lines": self._find_invoice_lines(doc_results),
            "totals": self._find_totals(all_text),
            "payment_info": self._find_payment_info(all_text),
            "raw_text": all_text
        }

    def _get_all_text(self, doc_results: Dict) -> str:
        """
        Extrait tout le texte d'un document
        """
        all_text = []
        for page_num in doc_results["pages"]:
            page_text = [item["text"] for item in doc_results["pages"][page_num]]
            all_text.extend(page_text)
        return " ".join(all_text)

    def _find_dates(self, text: str) -> List[Dict]:
        """
        Trouve toutes les dates dans le texte
        """
        date_patterns = [
            (r'\b(\d{2})[/-](\d{2})[/-](\d{4})\b', '%d/%m/%Y'),
            (r'\b(\d{2})[/-](\d{2})[/-](\d{2})\b', '%d/%m/%y'),
        ]
        
        found_dates = []
        for pattern, date_format in date_patterns:
            matches = re.finditer(pattern, text)
            for match in matches:
                try:
                    date_str = match.group(0).replace('-', '/')
                    date_obj = datetime.strptime(date_str, date_format)
                    found_dates.append({
                        "date": date_obj.strftime('%Y-%m-%d'),
                        "original": match.group(0),
                        "format": date_format
                    })
                except ValueError:
                    continue
        return found_dates

    def _find_amounts(self, text: str) -> List[Dict]:
        """
        Trouve tous les montants dans le texte
        """
        amount_pattern = r'\b(\d+[.,]\d{2})\b\s*€?\b'
        amounts = []
        
        for match in re.finditer(amount_pattern, text):
            amount = match.group(1).replace(',', '.')
            amounts.append({
                "amount": float(amount),
                "original": match.group(0)
            })
        return amounts

    def _find_invoice_numbers(self, text: str) -> List[str]:
        """
        Trouve les numéros de facture potentiels
        """
        patterns = [
            r'facture\s*n[o°]\s*[:.]?\s*([A-Z0-9-]+)',
            r'invoice\s*number\s*[:.]?\s*([A-Z0-9-]+)'
        ]
        
        invoice_numbers = []
        for pattern in patterns:
            matches = re.finditer(pattern, text.lower())
            invoice_numbers.extend([match.group(1) for match in matches])
        return invoice_numbers

    def _find_company_info(self, text: str) -> Dict:
        """
        Trouve les informations sur l'entreprise
        """
        siret_pattern = r'\bsiret\s*:?\s*(\d{14})\b'
        rcs_pattern = r'\brcs\s+\w+\s+(\d{3}\s*\d{3}\s*\d{3})\b'
        
        return {
            "siret": re.search(siret_pattern, text.lower()),
            "rcs": re.search(rcs_pattern, text.lower()),
            "tva": self._find_tva_number(text)
        }

    def _find_tva_number(self, text: str) -> Optional[str]:
        """
        Trouve le numéro de TVA
        """
        tva_pattern = r'\b(?:FR|BE|LU)\s*\d{2}\s*\d{3}\s*\d{3}\s*\d{3}\b'
        match = re.search(tva_pattern, text.upper())
        return match.group(0) if match else None

    def _find_company_details(self, text: str) -> Dict:
        """Trouve les informations détaillées de l'entreprise émettrice"""
        company_info = {
            "name": None,
            "address": None,
            "siret": None,
            "rcs": None,
            "vat_number": None,
            "phone": None,
            "email": None
        }

        # SIRET (plus strict)
        siret_match = re.search(r'(?:SIRET|siret)\s*:?\s*(\d{3}\s*\d{3}\s*\d{3}\s*\d{5})', text)
        if siret_match:
            company_info["siret"] = siret_match.group(1).replace(" ", "")

        # RCS (plus complet)
        rcs_match = re.search(r'RCS\s+([A-Za-z]+\s+[A-Z0-9]\s*\d{3}\s*\d{3}\s*\d{3})', text, re.IGNORECASE)
        if rcs_match:
            company_info["rcs"] = rcs_match.group(1).strip()

        # TVA Intracommunautaire
        vat_match = re.search(r'(?:TVA\s+(?:intra(?:communautaire)?|FR)|FR)\s*:\s*([A-Z0-9]\s*\d{2}\s*\d{3}\s*\d{3}\s*\d{3})', text, re.IGNORECASE)
        if vat_match:
            company_info["vat_number"] = vat_match.group(1).replace(" ", "")

        # Téléphone
        phone_match = re.search(r'(?:Tél|Tel|Telephone)\s*:?\s*((?:\+33|0)\s*[1-9](?:[\s.-]*\d{2}){4})', text, re.IGNORECASE)
        if phone_match:
            company_info["phone"] = phone_match.group(1)

        # Email
        email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', text)
        if email_match:
            company_info["email"] = email_match.group(0)

        return company_info

    def _find_invoice_lines(self, doc_results: Dict) -> List[InvoiceLine]:
        """Analyse le corps de la facture pour extraire les lignes"""
        invoice_lines = []
        
        # Parcourir les pages pour trouver les tableaux
        for page_num in doc_results["pages"]:
            page_items = doc_results["pages"][page_num]
            
            # Regrouper les éléments par leur position Y approximative (même ligne)
            lines_by_y = self._group_by_vertical_position(page_items)
            
            # Analyser chaque ligne
            current_line = None
            for y_pos, line_items in lines_by_y.items():
                # Trier les items par position X
                sorted_items = sorted(line_items, key=lambda x: x["position"]["top_left"][0])
                
                line_text = " ".join(item["text"] for item in sorted_items)
                
                # Détecter si c'est une ligne de facture
                if self._is_invoice_line(line_text):
                    current_line = self._parse_invoice_line(line_text)
                    if current_line:
                        invoice_lines.append(current_line)

        return invoice_lines

    def _group_by_vertical_position(self, items: List[Dict], threshold: int = 10) -> Dict[int, List[Dict]]:
        """Regroupe les éléments par leur position verticale approximative"""
        lines = {}
        for item in items:
            y_pos = item["position"]["top_left"][1]
            # Trouver la ligne la plus proche
            matched = False
            for existing_y in lines.keys():
                if abs(existing_y - y_pos) < threshold:
                    lines[existing_y].append(item)
                    matched = True
                    break
            if not matched:
                lines[y_pos] = [item]
        return lines

    def _is_invoice_line(self, text: str) -> bool:
        """Détermine si une ligne de texte est probablement une ligne de facture"""
        # Une ligne de facture contient généralement un montant et peut-être une quantité
        amount_pattern = r'\d+[.,]\d{2}'
        quantity_pattern = r'\b\d+(?:[.,]\d+)?\s*(?:unités?|pcs?|kg|h|j)\b'
        
        has_amount = bool(re.search(amount_pattern, text))
        has_quantity = bool(re.search(quantity_pattern, text, re.IGNORECASE))
        
        return has_amount or has_quantity

    def _parse_invoice_line(self, text: str) -> Optional[InvoiceLine]:
        """Analyse une ligne de facture pour en extraire les informations"""
        # Patterns pour extraire les informations
        amount_pattern = r'(\d+[.,]\d{2})'
        quantity_pattern = r'(\d+(?:[.,]\d+)?)\s*(?:unités?|pcs?|kg|h|j)'
        tva_pattern = r'(?:TVA|VAT)\s*(?:à)?\s*(\d+(?:[.,]\d+)?)\s*%'

        try:
            # Extraire les montants (le dernier est probablement le total)
            amounts = [float(m.group(1).replace(',', '.')) for m in re.finditer(amount_pattern, text)]
            total_ht = amounts[-1] if amounts else None
            unit_price = amounts[0] if len(amounts) > 1 else None

            # Extraire la quantité
            quantity_match = re.search(quantity_pattern, text, re.IGNORECASE)
            quantity = float(quantity_match.group(1).replace(',', '.')) if quantity_match else None

            # Extraire le taux de TVA
            tva_match = re.search(tva_pattern, text)
            tva_rate = float(tva_match.group(1).replace(',', '.')) if tva_match else None

            # Extraire la description (tout ce qui n'est pas un nombre ou une unité)
            description = re.sub(r'\b\d+[.,]\d{2}\b|\b\d+\s*(?:unités?|pcs?|kg|h|j)\b|TVA\s*\d+%', '', text).strip()

            return InvoiceLine(
                description=description,
                quantity=quantity,
                unit_price=unit_price,
                total_ht=total_ht,
                tva_rate=tva_rate,
                tva_amount=total_ht * (tva_rate/100) if total_ht and tva_rate else None
            )
        except Exception:
            return None

    def _find_totals(self, text: str) -> Dict:
        """Trouve les totaux de la facture"""
        totals = {
            "total_ht": None,
            "total_tva": None,
            "total_ttc": None
        }

        # Patterns pour les totaux
        patterns = {
            "total_ht": r'(?:Total|Montant|Prix)\s+HT\s*:?\s*(\d+[.,]\d{2})',
            "total_tva": r'(?:Total|Montant)\s+TVA\s*:?\s*(\d+[.,]\d{2})',
            "total_ttc": r'(?:Total|Montant)\s+TTC\s*:?\s*(\d+[.,]\d{2})'
        }

        for key, pattern in patterns.items():
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                totals[key] = float(match.group(1).replace(',', '.'))

        return totals

    def _find_payment_info(self, text: str) -> Dict:
        """Trouve les informations de paiement"""
        payment_info = {
            "iban": None,
            "bic": None,
            "payment_terms": None
        }

        # IBAN
        iban_match = re.search(r'IBAN\s*:?\s*([A-Z0-9]\s*(?:\d{4}\s*){4,7})', text)
        if iban_match:
            payment_info["iban"] = iban_match.group(1).replace(" ", "")

        # BIC/SWIFT
        bic_match = re.search(r'(?:BIC|SWIFT)\s*:?\s*([A-Z0-9]{8,11})', text)
        if bic_match:
            payment_info["bic"] = bic_match.group(1)

        # Conditions de paiement
        payment_terms_match = re.search(r'(?:Conditions|Modalités)\s+de\s+paiement\s*:?\s*([^\n]+)', text, re.IGNORECASE)
        if payment_terms_match:
            payment_info["payment_terms"] = payment_terms_match.group(1).strip()

        return payment_info

    def _find_due_date(self, text: str) -> Optional[str]:
        """
        Trouve la date d'échéance de la facture
        """
        patterns = [
            r'(?:Date|échéance)\s*(?:de\s*)?(?:paiement|règlement)\s*:?\s*(\d{2}[/-]\d{2}[/-]\d{2,4})',
            r'(?:À\s*payer\s*avant\s*le|Payable\s*avant\s*le)\s*:?\s*(\d{2}[/-]\d{2}[/-]\d{2,4})',
            r'Due\s*date\s*:?\s*(\d{2}[/-]\d{2}[/-]\d{2,4})'
        ]

        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                date_str = match.group(1)
                try:
                    if len(date_str) <= 8:  # Format court (JJ/MM/YY)
                        date_obj = datetime.strptime(date_str, '%d/%m/%y')
                    else:  # Format long (JJ/MM/YYYY)
                        date_obj = datetime.strptime(date_str, '%d/%m/%Y')
                    return date_obj.strftime('%Y-%m-%d')
                except ValueError:
                    continue
        return None

    def _find_customer_details(self, text: str) -> Dict:
        """Trouve les informations du client"""
        customer_info = {
            "name": None,
            "address": None,
            "siret": None,
            "vat_number": None,
            "customer_reference": None
        }

        # Chercher la section client (souvent après "Client:", "Facturé à:", etc.)
        client_section_patterns = [
            r'(?:Client|Customer|Facturé\s+à|Bill\s+to)\s*:?\s*([^\n]+(?:\n[^\n]+)*)',
            r'(?:Adresse\s+de\s+facturation|Billing\s+address)\s*:?\s*([^\n]+(?:\n[^\n]+)*)'
        ]

        client_section = None
        for pattern in client_section_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                client_section = match.group(1)
                break

        if client_section:
            # Chercher le SIRET du client
            siret_match = re.search(r'(?:SIRET|siret)\s*:?\s*(\d{3}\s*\d{3}\s*\d{3}\s*\d{5})', client_section)
            if siret_match:
                customer_info["siret"] = siret_match.group(1).replace(" ", "")

            # Chercher la TVA du client
            vat_match = re.search(r'(?:TVA\s+(?:intra(?:communautaire)?|FR)|FR)\s*:\s*([A-Z0-9]\s*\d{2}\s*\d{3}\s*\d{3}\s*\d{3})', 
                                client_section, re.IGNORECASE)
            if vat_match:
                customer_info["vat_number"] = vat_match.group(1).replace(" ", "")

            # Chercher la référence client
            ref_match = re.search(r'(?:Référence|Reference|Customer\s+ref)\s*:?\s*([^\n]+)', client_section, re.IGNORECASE)
            if ref_match:
                customer_info["customer_reference"] = ref_match.group(1).strip()

            # Extraire le nom et l'adresse (première ligne = nom, reste = adresse)
            lines = client_section.strip().split('\n')
            if lines:
                customer_info["name"] = lines[0].strip()
                if len(lines) > 1:
                    customer_info["address"] = '\n'.join(line.strip() for line in lines[1:])

        return customer_info

def main():
    analyzer = OCRAnalyzer("public/pdfs/ocr_results/ocr_results.json")
    
    # Analyser chaque document
    for filename in analyzer.ocr_results.keys():
        print(f"\nAnalyse de {filename}:")
        results = analyzer.analyze_document(filename)
        print(json.dumps(results, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main() 