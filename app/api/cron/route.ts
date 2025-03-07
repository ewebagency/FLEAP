import { NextResponse } from 'next/server';
import RecurrenceFunctions from '@/app/register/RegisterComponents/Modal/Recurrence/RecurrenceFunctionnal';

export async function GET() {
    try {
        const recurrencesExecuted = await RecurrenceFunctions.executeRecurrences();
        return NextResponse.json({ success: true, recurrencesExecuted });
    } catch (error) {
        console.error('Error executing recurrences:', error);
        return NextResponse.json({ success: false, error: 'Failed to execute recurrences' }, { status: 500 });
    }
} 