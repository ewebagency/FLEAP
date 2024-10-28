import FormulaireManoJson from "./FormulaireManoJson";
import JsonForm from "./JsonForm";

type FormDataType = { [key: string]: string | number | boolean | FormDataType | FormDataType[] };

interface FormulaireDisplayerProps {
    infosJsonFromPdf: FormDataType; // Update to use the correct type
    currentPdfId: string | null;
    onNextPdf: () => void;
}

const FormulaireDisplayer: React.FC<FormulaireDisplayerProps> = ({ infosJsonFromPdf, currentPdfId, onNextPdf }) => {
    return (
        <div className="p-4">
            <JsonForm data={infosJsonFromPdf} currentPdfId={currentPdfId} onNextPdf={onNextPdf} />
        </div>
    )
}

export default FormulaireDisplayer;
