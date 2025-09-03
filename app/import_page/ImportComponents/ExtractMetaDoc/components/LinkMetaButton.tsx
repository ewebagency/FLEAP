"use client";

import { useState } from 'react';
import LinkMeta from './LinkMeta';

interface LinkMetaButtonProps {
	pdfId: string;
	label?: string;
	className?: string;
}

export default function LinkMetaButton({ pdfId, label = "LinkMeta", className }: LinkMetaButtonProps) {
	const [open, setOpen] = useState(false);

	return (
		<>
			<button onClick={() => setOpen(true)} className={className || "px-3 py-1 rounded bg-blue-600 text-white text-sm"}>
				{label}
			</button>
			{open && (
				<div className="fixed inset-0 z-50">
					<div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
					<div className="absolute inset-0 flex items-center justify-center p-4">
						<div className="w-full max-w-5xl max-h-[85vh] overflow-auto rounded bg-white shadow-lg">
							<div className="flex items-center justify-between border-b p-3">
								<div className="font-semibold">Linker les déchets du PDF</div>
								<button onClick={() => setOpen(false)} className="px-2 py-1 text-sm rounded bg-gray-200">Fermer</button>
							</div>
							<div className="p-3">
								<LinkMeta pdfId={pdfId} />
							</div>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
