import { Profil, useAccessOtherAccount } from './AccessOtherAccountContext';

export function AccountSelector() {
    const { accounts, selectedAccounts, setSelectedAccounts } = useAccessOtherAccount();

    const handleRadioChange = (account: Profil) => {
        setSelectedAccounts([account]);
        window.location.reload();
    };

    return (
        <div className="p-1 ml-6">
            <h2 className="text-lg font-semibold">Sélectionner les comptes</h2>
            <div className="flex justify-start items-center gap-2">
                {accounts.map((account) => (
                    <div key={account.user_id} className="flex items-center">
                        <input
                            type="radio"
                            id={account.user_id}
                            checked={selectedAccounts.some(a => a.user_id === account.user_id)}
                            onChange={() => handleRadioChange(account)}
                            className="mr-2"
                        />
                        <label htmlFor={account.user_id}>
                            {account.first_name} {account.last_name}
                        </label>
                    </div>
                ))}
            </div>
        </div>
    );
} 