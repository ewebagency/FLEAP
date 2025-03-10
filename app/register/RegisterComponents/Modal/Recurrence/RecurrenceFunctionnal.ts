import { supabase } from "@/app/database/supabaseClient";
import { FormInput } from "../../../interface/BSD_Interface";

// Types pour la récurrence
export interface RecurrencePattern {
    name: string;
    frequency: 'seconds' | 'days' | 'weeks' | 'months' | 'years';
    frequencyNumber: number;
    selectedDays: string[];
    endType: 'never' | 'date' | 'occurrences';
    endDate?: string;
    occurrences?: number;
    isScheduled: boolean;
    created_bsd_ids?: string[];
}

export interface RecurrenceEntry {
    id: string;
    user_id: string;
    entreprise_id: string;
    pattern: RecurrencePattern;
    bsd_template: FormInput;
    created_at: string;
    last_execution: string;
    next_execution: string;
    execution_count: number;
    is_active: boolean;
}

// Créer un objet qui contient toutes nos fonctions
const RecurrenceFunctions = {
    calculateNextExecution: (pattern: RecurrencePattern, lastExecution?: Date): Date => {
        const now = lastExecution || new Date();
        const next = new Date(now);

        switch (pattern.frequency) {
            case 'seconds':
                next.setSeconds(next.getSeconds() + pattern.frequencyNumber);
                break;
            case 'days':
                next.setDate(next.getDate() + pattern.frequencyNumber);
                break;
            case 'weeks':
                next.setDate(next.getDate() + (pattern.frequencyNumber * 7));
                break;
            case 'months':
                next.setMonth(next.getMonth() + pattern.frequencyNumber);
                break;
            case 'years':
                next.setFullYear(next.getFullYear() + pattern.frequencyNumber);
                break;
        }

        return next;
    },

    shouldContinueRecurrence: (pattern: RecurrencePattern, executionCount: number, lastExecution: Date): boolean => {
        if (pattern.endType === 'never') return true;
        if (pattern.endType === 'occurrences' && pattern.occurrences) {
            return executionCount < pattern.occurrences;
        }
        if (pattern.endType === 'date' && pattern.endDate) {
            return new Date(lastExecution) <= new Date(pattern.endDate);
        }
        return false;
    },

    createRecurrence: async (
        user_id: string,
        entreprise_id: string,
        pattern: RecurrencePattern,
        bsd_template: FormInput
    ): Promise<boolean> => {
        try {
            const nextExecution = RecurrenceFunctions.calculateNextExecution(pattern);

            const { error } = await supabase
                .from('recurrence')
                .insert({
                    user_id,
                    entreprise_id,
                    pattern,
                    bsd_template,
                    next_execution: nextExecution.toISOString(),
                    last_execution: null,
                    execution_count: 0,
                    is_active: true
                });

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('[Recurrence] Error creating:', error);
            return false;
        }
    },

    createBSDFromTemplate: async (
        user_id: string,
        entreprise_id: string,
        template: FormInput
    ): Promise<string | null> => {
        try {
            const { data, error } = await supabase
                .from('bsd')
                .insert({
                    user_id,
                    entreprise_id,
                    infos_json: {
                        formAPI: { createFormInput: template }
                    },
                    created_on_fleap: true,
                    on_track_dechets: false,
                    status_track_dechets: 'Ligne créée automatiquement',
                    id_track_dechets: 'Ligne automatique',
                    readable_id_track_dechets: 'Ligne automatique'
                })
                .select('id')
                .single();

            if (error) throw error;
            return data?.id || null;
        } catch (error) {
            console.error('[Recurrence] Error creating BSD:', error);
            return null;
        }
    },

    updateRecurrenceAfterExecution: async (
        recurrence_id: string,
        nextExecution: Date,
        executionCount: number,
        isActive: boolean,
        newBsdId: string | null
    ): Promise<boolean> => {
        try {
            const { data: currentRecurrence } = await supabase
                .from('recurrence')
                .select('pattern')
                .eq('id', recurrence_id)
                .single();

            if (!currentRecurrence) return false;

            const updatedPattern = {
                ...currentRecurrence.pattern,
                created_bsd_ids: [
                    ...(currentRecurrence.pattern.created_bsd_ids || []),
                    newBsdId
                ].filter(Boolean)
            };

            const { error } = await supabase
                .from('recurrence')
                .update({
                    last_execution: new Date().toISOString(),
                    next_execution: nextExecution.toISOString(),
                    execution_count: executionCount,
                    is_active: isActive,
                    pattern: updatedPattern
                })
                .eq('id', recurrence_id);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('[Recurrence] Error updating:', error);
            return false;
        }
    },

    executeRecurrences: async (): Promise<void> => {
        try {
            const now = new Date().toISOString();
            
            const { data: dueRecurrences, error } = await supabase
                .from('recurrence')
                .select('*')
                .eq('is_active', true)
                .lte('next_execution', now);

            if (error) throw error;

            console.log(`[Recurrence] Processing ${dueRecurrences?.length || 0} recurrences`);

            for (const recurrence of dueRecurrences) {
                const newBsdId = await RecurrenceFunctions.createBSDFromTemplate(
                    recurrence.user_id,
                    recurrence.entreprise_id,
                    recurrence.bsd_template
                );

                if (newBsdId) {
                    console.log(`[Recurrence] Created BSD ${newBsdId} for pattern "${recurrence.pattern.name}"`);
                    
                    const newExecutionCount = recurrence.execution_count + 1;
                    const shouldContinue = RecurrenceFunctions.shouldContinueRecurrence(
                        recurrence.pattern,
                        newExecutionCount,
                        new Date()
                    );

                    const nextExecution = RecurrenceFunctions.calculateNextExecution(recurrence.pattern);
                    
                    await RecurrenceFunctions.updateRecurrenceAfterExecution(
                        recurrence.id,
                        nextExecution,
                        newExecutionCount,
                        shouldContinue,
                        newBsdId
                    );

                    // Invalider le cache après la création d'un BSD
                    try {
                        const response = await fetch('/api/invalidate_bsd_cache', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                entreprise_id: recurrence.entreprise_id,
                                user_id: recurrence.user_id,
                            }),
                        });

                        if (!response.ok) {
                            throw new Error('Failed to invalidate cache');
                        }

                        // Forcer le rechargement des données dans TableBSD
                        /*const reloadEvent = new CustomEvent('bsd-created', {
                            detail: { 
                                user_id: recurrence.user_id,
                                entreprise_id: recurrence.entreprise_id 
                            }
                        });
                        window.dispatchEvent(reloadEvent);*/
                        
                        console.log('[Recurrence] Cache invalidated and reload triggered');
                    } catch (error) {
                        console.error('[Recurrence] Error invalidating cache:', error);
                    }
                }
            }
        } catch (error) {
            console.error('[Recurrence] Error executing:', error);
        }
    },

    checkRecurrences: async (): Promise<void> => {
        try {
            await RecurrenceFunctions.executeRecurrences();
        } catch (error) {
            console.error('[Recurrence] Error checking:', error);
        }
    }
};

export default RecurrenceFunctions;