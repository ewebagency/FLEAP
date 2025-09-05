"use client";

import { useState } from 'react';
import { AutoLinkParams, AutoLinkResult } from '../utils/link';
import { EXAMPLE_AUTO_LINK_PARAMS, STRICT_MATCHING_PARAMS, LOOSE_MATCHING_PARAMS } from '../utils/test_auto_link';

interface AutoLinkDemoProps {
	pdfId: string;
	onTestParams: (params: AutoLinkParams) => Promise<AutoLinkResult>;
}

export default function AutoLinkDemo({ pdfId, onTestParams }: AutoLinkDemoProps) {
	const [selectedParams, setSelectedParams] = useState<AutoLinkParams>(EXAMPLE_AUTO_LINK_PARAMS);
	const [result, setResult] = useState<AutoLinkResult | null>(null);
	const [loading, setLoading] = useState(false);

	const handleTest = async () => {
		setLoading(true);
		try {
			const res = await onTestParams(selectedParams);
			setResult(res);
		} catch (error) {
			console.error('Erreur lors du test:', error);
		} finally {
			setLoading(false);
		}
	};

	const paramSets = [
		{ name: 'Exemple par défaut', params: EXAMPLE_AUTO_LINK_PARAMS },
		{ name: 'Matching strict', params: STRICT_MATCHING_PARAMS },
		{ name: 'Matching large', params: LOOSE_MATCHING_PARAMS }
	];

	return (
		<div className="p-4 border rounded-lg bg-gray-50">
			<h3 className="text-lg font-semibold mb-4">Démonstration Auto Link avec paramètres JSON</h3>
			
			<div className="mb-4">
				<label className="block text-sm font-medium mb-2">Choisir un jeu de paramètres :</label>
				<select 
					value={paramSets.findIndex(p => p.name === (selectedParams === EXAMPLE_AUTO_LINK_PARAMS ? 'Exemple par défaut' : 
						selectedParams === STRICT_MATCHING_PARAMS ? 'Matching strict' : 'Matching large'))}
					onChange={(e) => setSelectedParams(paramSets[parseInt(e.target.value)].params)}
					className="w-full p-2 border rounded"
				>
					{paramSets.map((set, index) => (
						<option key={index} value={index}>{set.name}</option>
					))}
				</select>
			</div>

			<div className="mb-4">
				<button 
					onClick={handleTest}
					disabled={loading}
					className="px-4 py-2 bg-purple-600 text-white rounded disabled:opacity-50"
				>
					{loading ? 'Test en cours...' : 'Tester les paramètres'}
				</button>
			</div>

			{result && (
				<div className="p-3 bg-white border rounded">
					<h4 className="font-semibold mb-2">Résultat :</h4>
					<div className="text-sm space-y-1">
						<div><strong>Action:</strong> {result.result}</div>
						{result.id && <div><strong>ID BSD:</strong> {result.id}</div>}
						{result.pluto && <div><strong>Pluto:</strong> {result.pluto}</div>}
					</div>
				</div>
			)}

			<div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
				<h4 className="font-semibold text-blue-800 mb-2">Comment ça marche :</h4>
				<div className="text-sm text-blue-700 space-y-1">
					<div>1. <strong>to_link:</strong> Règles pour lier automatiquement (≥1 candidat trouvé)</div>
					<div>2. <strong>to_check_by_user:</strong> Règles pour vérification manuelle (≥1 candidat trouvé)</div>
					<div>3. <strong>create:</strong> Règles pour créer un nouveau BSD (≥1 candidat trouvé)</div>
					<div>4. Si aucune règle ne correspond, retourne create par défaut</div>
				</div>
			</div>
		</div>
	);
}
