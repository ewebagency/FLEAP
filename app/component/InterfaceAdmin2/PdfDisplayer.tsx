import { supabase } from "@/app/database/supabaseClient";
import { useEffect, useState } from "react";

interface PdfDisplayerProps {
    pdfUrl: string | null;
}

const PdfDisplayer = ({ pdfUrl }: PdfDisplayerProps) => {


    return (
        <div style={{ 
            margin: '5px',
            border: '2px solid gray',
            borderRadius: '10px',
            transform: 'scale(1)',
            transformOrigin: 'top left',
            overflow: 'hidden'
          }}>
              {pdfUrl &&<iframe
                src={pdfUrl}
                width="100%"
                height="auto"
                style={{ 
                  border: 'none', 
                  aspectRatio: '210 / 297',
                  maxHeight: '92vh'
                }}
                title="Mon PDF"
              />}
          </div>
    )
}

export default PdfDisplayer;
