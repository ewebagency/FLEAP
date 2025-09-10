"use client";

import { useState } from 'react';
import LinkMeta from './LinkMeta';

interface LinkedItem {
	index_dechet: number;
	bsd_id?: string;
	status?: 'linked' | 'created' | 'check_by_user';
}

interface LinkMetaButtonProps {
	pdfId: string;
	label?: string;
	className?: string;
	bsd_linked?: LinkedItem[];
}

export default function LinkMetaButton({ pdfId, bsd_linked }: LinkMetaButtonProps) {
	const [open, setOpen] = useState(false);

	const hasToCheck = Array.isArray(bsd_linked)
		? bsd_linked.some(item => item?.status === 'check_by_user')
		: false;

	return (
		<>
			<button onClick={() => setOpen(true)} className="px-3 py-1 rounded-lg bg-blue-600 text-white text-sm">
				<span className="relative inline-flex items-center">
					Lier le document
					{hasToCheck && (
						<span className="absolute -top-2 -right-4 inline-block w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
					)}
				</span>
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
