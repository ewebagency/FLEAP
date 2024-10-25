import JsonForm from "./JsonForm";

interface FormulaireDisplayerProps {
    infosJsonFromPdf: any; // Vous pouvez remplacer 'any' par un type plus spécifique si vous connaissez la structure exacte
    currentPdfId: string | null;
    onNextPdf: () => void; // Ajout de la fonction onNextPdf
}

const FormulaireDisplayer: React.FC<FormulaireDisplayerProps> = ({infosJsonFromPdf, currentPdfId, onNextPdf}) => {
    return (
        <div className="p-4">
            <JsonForm data={infosJsonFromPdf} currentPdfId={currentPdfId} onNextPdf={onNextPdf} />
        </div>
    )
}

export default FormulaireDisplayer;
