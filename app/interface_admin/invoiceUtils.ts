export const extractInvoiceDetails = (text: string) => {
    const invoiceNumberMatch = text.match(/Facture N° (\w+)/);
    const billingPeriodMatch = text.match(/Période de facturation : (\d{2}\/\d{2}\/\d{4}) au (\d{2}\/\d{2}\/\d{4})/);
    const totalHTMatch = text.match(/Total HT (\d+.*\d+)/);
    const totalTTMatch = text.match(/Montant di TTC (\d+.*\d+)/);
    const dueDateMatch = text.match(/Echéance \| (\d{2}\/\d{2}\/\d{4})/);
  
    const serviceDetails = extractServiceDetails(text); // Extraire les détails des services

    return {
      invoiceNumber: invoiceNumberMatch ? invoiceNumberMatch[1] : null,
      billingPeriod: billingPeriodMatch ? `${billingPeriodMatch[1]} - ${billingPeriodMatch[2]}` : null,
      totalHT: totalHTMatch ? totalHTMatch[1] : null,
      totalTTC: totalTTMatch ? totalTTMatch[1] : null,
      dueDate: dueDateMatch ? dueDateMatch[1] : null,
      serviceDetails, // Inclure les détails des services dans le retour
    };
  };
  
  export const extractServiceDetails = (text: string) => {
    const serviceLines = text.match(/- (.*?)\n/g); // Trouver toutes les lignes qui commencent par '-'
    const details: Array<{ description: string; qty: string; unit: string; pu: string; totalHT: string; tva: string }> = [];
  
    if (serviceLines) {
      serviceLines.forEach((line) => {
        const parts = line.trim().split(/\s+/); // Diviser par espace
        const description = parts.slice(1, parts.length - 5).join(' '); // Description est tout sauf les 5 derniers éléments
        const qty = parts[parts.length - 5]; // Quantité
        const unit = parts[parts.length - 4]; // Unité
        const pu = parts[parts.length - 3]; // Prix Unitaire
        const totalHT = parts[parts.length - 2]; // Total HT
        const tva = parts[parts.length - 1]; // TVA
  
        details.push({
          description,
          qty,
          unit,
          pu,
          totalHT,
          tva,
        });
      });
    }
    return details;
  };
  