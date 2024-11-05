//api/filtres_globales/filtre_sites
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    console.log(userId);
    //suivant le user id on va chercher les sites dans la bdd

    const sites = ['Usine Achenheim', 'Usine Seltz'];

    return NextResponse.json(sites);
    

    
}