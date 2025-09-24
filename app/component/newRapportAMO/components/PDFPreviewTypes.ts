// Types spécifiques au composant PDFPreview
export interface BsdCompany { 
  orgId: string; 
  siret: string; 
  name: string; 
}

export interface BsdItem {
  id: string;
  readable_id_track_dechets: string;
  created_at: string;
  status_track_dechets?: string;
  created_on_fleap?: boolean;
  other_infos?: { numeroBon?: string };
  facture_infos?: { numeroFacture?: string };
  pdf_ids?: string[];
  infos_json: {
    formAPI: {
      createFormInput: {
        takenOverAt: string;
        recipient: { processingOperation: string; company: BsdCompany };
        emitter: { company: BsdCompany };
        wasteDetails: { name: string; code: string; quantity: string };
        quantityReceived?: string;
      }
    }
  }
}

export interface MappingCed { 
  ced?: string; 
  filiere: string; 
  multiflux?: boolean; 
  tri?: boolean; 
}

export interface MappingNom { 
  nom?: string; 
  filiere: string; 
  trie?: boolean; 
}

export interface PdfJsViewport { 
  width: number; 
  height: number; 
}

export interface PdfJsRenderTask { 
  promise: Promise<void>; 
}

export interface PdfJsPage {
  getViewport: (params: { scale: number }) => PdfJsViewport;
  render: (args: { canvasContext: CanvasRenderingContext2D; viewport: PdfJsViewport }) => PdfJsRenderTask;
}

export interface PdfJsDocument { 
  numPages: number; 
  getPage: (n: number) => Promise<PdfJsPage>; 
}

export interface AttachedPdf {
  id: string;
  data: ArrayBuffer;
}

export interface RenderedAttachment {
  id: string;
  images: string[];
}
