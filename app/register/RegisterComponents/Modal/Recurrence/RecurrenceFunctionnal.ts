import { supabase } from "@/app/database/supabaseClient";
import { FormInput } from "../../../interface/BSD_Interface";
import { useModalContextNew } from "../ContextModal";

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
    created_bsd_ids?: string[]; // Ajout des IDs des BSD créés
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

            if (error) {
                console.error('Error creating recurrence:', error);
                throw error;
            }
            return true;
        } catch (error) {
            console.error('Error creating recurrence:', error);
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
            console.error('Error creating BSD from template:', error);
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
            // Récupérer d'abord la récurrence actuelle pour mettre à jour created_bsd_ids
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

            if (error) {
                console.error('Error updating recurrence:', error);
                throw error;
            }
            return true;
        } catch (error) {
            console.error('Error updating recurrence:', error);
            return false;
        }
    },

    executeRecurrences: async (setNextFullReload?: (value: boolean) => void): Promise<boolean> => {
        try {
            const now = new Date().toISOString();
            console.log('Executing recurrences at:', now);
            
            // Récupérer toutes les récurrences actives dont la prochaine exécution est due
            const { data: dueRecurrences, error } = await supabase
                .from('recurrence')
                .select('*')
                .eq('is_active', true)
                .lte('next_execution', now);

            if (error) {
                console.error('Error fetching due recurrences:', error);
                throw error;
            }

            console.log(`Found ${dueRecurrences?.length || 0} recurrences to execute`);

            let anyRecurrenceExecuted = false;

            if (dueRecurrences && dueRecurrences.length > 0) {
                for (const recurrence of dueRecurrences) {
                    console.log(`Processing recurrence ${recurrence.id}:`, {
                        pattern: recurrence.pattern,
                        nextExecution: recurrence.next_execution,
                        executionCount: recurrence.execution_count
                    });

                    // Créer le nouveau BSD
                    const newBsdId = await RecurrenceFunctions.createBSDFromTemplate(
                        recurrence.user_id,
                        recurrence.entreprise_id,
                        recurrence.bsd_template
                    );

                    if (newBsdId) {
                        console.log(`Created new BSD ${newBsdId} for recurrence ${recurrence.id}`);
                        anyRecurrenceExecuted = true;
                        
                        const newExecutionCount = recurrence.execution_count + 1;
                        const shouldContinue = RecurrenceFunctions.shouldContinueRecurrence(
                            recurrence.pattern,
                            newExecutionCount,
                            new Date()
                        );

                        console.log(`Recurrence ${recurrence.id} should continue:`, shouldContinue);

                        // Calculer la prochaine exécution
                        const nextExecution = RecurrenceFunctions.calculateNextExecution(recurrence.pattern);
                        console.log(`Next execution for ${recurrence.id}:`, nextExecution);
                        
                        // Mettre à jour la récurrence avec le nouveau BSD
                        const updateSuccess = await RecurrenceFunctions.updateRecurrenceAfterExecution(
                            recurrence.id,
                            nextExecution,
                            newExecutionCount,
                            shouldContinue,
                            newBsdId
                        );

                        console.log(`Update success for ${recurrence.id}:`, updateSuccess);
                    } else {
                        console.error(`Failed to create BSD for recurrence ${recurrence.id}`);
                    }
                }

                if (anyRecurrenceExecuted && setNextFullReload) {
                    setNextFullReload(true);
                }
            }

            return anyRecurrenceExecuted;
        } catch (error) {
            console.error('Error executing recurrences:', error);
            return false;
        }
    },

    checkRecurrences: async (setNextFullReload: (value: boolean) => void): Promise<void> => {
        try {
            console.log('Checking recurrences via API...');
            const response = await fetch('/api/cron', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            
            if (!response.ok) {
                console.error('Failed to check recurrences:', response.status, response.statusText);
                throw new Error('Failed to check recurrences');
            }

            const data = await response.json();
            console.log('Recurrence check response:', data);
            
            // Si des récurrences ont été exécutées, activer nextFullReload
            if (data.recurrencesExecuted) {
                setNextFullReload(true);
            }
        } catch (error) {
            console.error('Error checking recurrences:', error);
        }
    }
};

export default RecurrenceFunctions;