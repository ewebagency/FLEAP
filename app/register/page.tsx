"use client"
export const dynamic = 'force-dynamic';
import React from "react";
import FiltreFilieresSwitcher from "../component/FiltreFilieresSwitcher";
import TableBSD from "./TableBSD";
import { Toaster } from "react-hot-toast";
import ImportRegisterButton from "./ImportRegisterButton";
import ModalSource from "./RegisterComponents/Modal/FormulaireFull/ModalSource";
import DisplayCard from "./RegisterComponents/Modal/DisplayModifyOnTable/DisplayCard";
import ModifyCard from "./RegisterComponents/Modal/DisplayModifyOnTable/ModifyCard";
import EnrichImportedDataButton from "./EnrichImportedDataButton";
import ConnectedToTrack from "../component/ConnectedToTrack";
import ExportRegisterButton from "./ExportRegisterButton";
import BordereauxRegister from "./RegisterComponents/BordereauxRegister";
import CreateBSDLine from "./RegisterComponents/CreateBSDLineButton";
import FiltreSiteEtablissement from "../import_page/FiltreSiteEtablissement";
import { useRouter } from 'next/navigation';
import { supabase } from '../database/supabaseClient';
import BoxIcon from '../component/BoxIconWrapper';
// import { FiltresPersoProvider } from "../component/FiltresPerso/FiltresPersoProvider";
import { useSession } from "../component/SessionProvider";
// import ButtonReportAMO from "../component/ReportAMO/ButtonReportAMO";
import { AnalysisProvider } from "../analysis/AnalysisProvider";
import { useModalContextNew } from "./RegisterComponents/Modal/ContextModal";

const RegisterPage = () => {
    const router = useRouter();
    const {user_id, display_features} = useSession();
    const { registerFilterType, setRegisterFilterType } = useModalContextNew();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/auth/signin');
    };

    return (
        <AnalysisProvider>
        <div className='m-4'>
            <Toaster position="top-right"/>
            <div className="mb-0">
                <div className="text-xl font-bold mb-2 hidden">Registre</div>
                <div className="hidden md:flex justify-between items-center mb-0">
                    <FiltreFilieresSwitcher showTypeFilter={false}/>
                    <ConnectedToTrack/>
                </div>
                <div className="md:hidden flex items-center gap-2 mb-2">
                    <div className="flex-[5]">
                        <FiltreSiteEtablissement />
                    </div>
                    {(user_id === "a0542794-bbae-4132-9dde-485595bfa2aa") && <button 
                        onClick={handleLogout}
                        className="flex-1 px-1 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-all duration-200"
                    >
                        <BoxIcon name='log-out' size="24px" color="#666666" />
                    </button>}
                </div>
                {display_features?.demande_collecte && (
                    <BordereauxRegister />
                )}
                <div className="hidden md:flex justify-between items-center mb-0 mt-1">
                    <div className="flex items-center gap-3">
                        {display_features?.demande_collecte ? (
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setRegisterFilterType('imported')}
                                    className={`px-4 py-2 text-sm transition-all border-b-2 ${
                                        registerFilterType === 'imported'
                                            ? 'border-[var(--green-medium)] text-[var(--green-medium)] font-bold'
                                            : 'border-transparent text-gray-600 hover:text-gray-800'
                                    }`}
                                >
                                    Registre
                                </button>
                                <button
                                    onClick={() => setRegisterFilterType('demandes')}
                                    className={`px-4 py-2 text-sm transition-all border-b-2 ${
                                        registerFilterType === 'demandes'
                                            ? 'border-[var(--green-medium)] text-[var(--green-medium)] font-bold'
                                            : 'border-transparent text-gray-600 hover:text-gray-800'
                                    }`}
                                >
                                    Demandes
                                </button>
                            </div>
                        ) : (
                            <h3 className="text-md text-gray-500 mb-0 hidden">Registre des déchets</h3>
                        )}
                    </div>
                    <div className="flex gap-2 mr-[-8px] justify-end">
                        <CreateBSDLine/>
                        <ImportRegisterButton/>
                        <ExportRegisterButton/>
                        <EnrichImportedDataButton/>
                    </div>
                </div>
                <div className="md:hidden mb-0 flex justify-between items-center">
                    {display_features?.demande_collecte ? (
                        <div className="flex gap-0.5">
                            <button
                                onClick={() => setRegisterFilterType('imported')}
                                className={`px-3 py-1 text-xs transition-all border-b-2 ${
                                    registerFilterType === 'imported'
                                        ? 'border-[var(--green-medium)] text-[var(--green-medium)] font-bold'
                                        : 'border-transparent text-gray-600'
                                }`}
                            >
                                Registre
                            </button>
                            <button
                                onClick={() => setRegisterFilterType('demandes')}
                                className={`px-3 py-1 text-xs transition-all border-b-2 ${
                                    registerFilterType === 'demandes'
                                        ? 'border-[var(--green-medium)] text-[var(--green-medium)] font-bold'
                                        : 'border-transparent text-gray-600'
                                }`}
                            >
                                Demandes
                            </button>
                        </div>
                    ) : (
                        <div></div>
                    )}
                    <CreateBSDLine/>
                </div>
            </div>
            <div className="mt-2">
                <TableBSD/>
            </div>
            <ModalSource/>
            <DisplayCard/>
            <ModifyCard/>
        </div>
        </AnalysisProvider>
    )
}

export default RegisterPage
