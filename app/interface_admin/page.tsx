import React from 'react';
import { promises as fs } from 'fs';
import path from 'path';
import ClientComponent from './ClientComponent';



async function getPdfFiles() {
    const directoryPath = path.join(process.cwd(), 'public/pdfs/mes_docs');
    const files = await fs.readdir(directoryPath);
    return files.filter(file => file.endsWith('.pdf'));
}


export default async function Page() {    
    const pdfFiles = await getPdfFiles();
    return <ClientComponent pdfFiles={pdfFiles} />;
    
}
