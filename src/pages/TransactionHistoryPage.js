import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle, Clock, Download, Upload, Droplet, Zap, RefreshCw, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// --- MOCK API & CONFIG (Replace with actual implementation) ---
const MOCK_API_BASE_URL = 'http://localhost:8000'; // Your backend URL

// --- Mock Data Generation ---
// This function generates realistic mock data based on the backend schema.
const generateMockTransactions = (page, limit, type) => {
    const eventTypes = ['CollateralDeposited', 'CollateralWithdrawn', 'TokensMinted', 'TokensBurned', 'AutoMintExecuted'];
    const allTransactions = Array.from({ length: 47 }, (_, i) => {
        const event_name = eventTypes[i % eventTypes.length];
        let event_data = {};
        switch (event_name) {
            case 'CollateralDeposited':
            case 'CollateralWithdrawn':
                event_data = { user: '0xUser...', collateral: '0xETH...', amount: '1000000000000000000' }; // 1 ETH
                break;
            case 'TokensMinted':
            case 'TokensBurned':
                event_data = { user: '0xUser...', collateral: '0xETH...', amount: (500 * (i + 1) * 1e6).toString() }; // 500+ tGHSX
                break;
            case 'AutoMintExecuted':
                 event_data = { user: '0xUser...', amount: (15 * 1e6).toString(), bonus: (2 * 1e6).toString() }; // 15 tGHSX
                break;
        }
        return {
            tx_hash: `0x${Math.random().toString(16).substr(2, 40)}`,
            user_id: 'user123',
            event_name,
            event_data: JSON.stringify(event_data),
            block_timestamp: new Date(Date.now() - i * 3600000 * 2).toISOString(),
            // Adding a mock status for demonstration
            status: i % 10 === 2 ? 'pending' : 'done'
        };
    });

    const filtered = type === 'all' ? allTransactions : allTransactions.filter(tx => tx.event_name === type);
    const start = (page - 1) * limit;
    const end = start + limit;
    
    return {
        total: filtered.length,
        transactions: filtered.slice(start, end)
    };
};


// --- Main Transaction History Component ---
export default function TransactionHistoryView() {
    const [transactions, setTransactions] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });
    const [filterType, setFilterType] = useState('all');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchTransactions = useCallback(async (page, type) => {
        setIsLoading(true);
        setError(null);
        try {
            // In a real app, you'd get the JWT token after login
            const mockAuthHeader = { 'Authorization': 'Bearer YOUR_JWT_TOKEN' };
            
            // MOCK API Call - Replace with your actual fetch call
            // const response = await fetch(`${MOCK_API_BASE_URL}/transactions?page=${page}&limit=${pagination.limit}&type=${type}`, { headers: mockAuthHeader });
            // if (!response.ok) throw new Error('Failed to fetch transactions.');
            // const data = await response.json();
            
            // Using mock data generator
            const data = generateMockTransactions(page, pagination.limit, type);

            setTransactions(data.transactions);
            setPagination(prev => ({ ...prev, page, total: data.total }));
        } catch (err) {
            setError(err.message);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [pagination.limit]);

    useEffect(() => {
        fetchTransactions(1, filterType);
    }, [filterType, fetchTransactions]);

    const handleFilterChange = (type) => {
        setFilterType(type);
    };

    const handlePageChange = (newPage) => {
        if (newPage < 1 || newPage > Math.ceil(pagination.total / pagination.limit)) {
            return;
        }
        fetchTransactions(newPage, filterType);
    };

    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans p-4 sm:p-6 lg:p-8">
            <div className="max-w-4xl mx-auto">
                <Card>
                    <CardHeader>
                        <h2 className="text-xl font-semibold">📋 Transaction History</h2>
                    </CardHeader>
                    <div className="p-4 border-b border-gray-700">
                        <FilterToolbar currentFilter={filterType} onFilterChange={handleFilterChange} />
                    </div>
                    <div className="p-2">
                        {isLoading ? (
                            <div className="flex justify-center items-center h-64">
                                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                            </div>
                        ) : error ? (
                             <div className="flex flex-col items-center justify-center h-64 text-center">
                                <AlertTriangle className="w-10 h-10 text-red-500" />
                                <p className="mt-4 text-lg">Failed to load history</p>
                                <p className="text-sm text-gray-400">{error}</p>
                            </div>
                        ) : (
                            <TransactionTable transactions={transactions} />
                        )}
                    </div>
                    {!isLoading && !error && (
                        <div className="p-4 border-t border-gray-700">
                            <PaginationControls {...pagination} onPageChange={handlePageChange} />
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}

// --- Sub-Components ---

const Card = ({ children }) => (
    <div className="bg-gray-800/50 rounded-xl shadow-lg border border-gray-700/50">{children}</div>
);

const CardHeader = ({ children }) => (
    <div className="p-4 border-b border-gray-700 flex justify-between items-center">{children}</div>
);

const FilterToolbar = ({ currentFilter, onFilterChange }) => {
    const filters = [
        { key: 'all', label: 'All' },
        { key: 'CollateralDeposited', label: 'Deposits' },
        { key: 'CollateralWithdrawn', label: 'Withdrawals' },
        { key: 'TokensMinted', label: 'Mints' },
        { key: 'TokensBurned', label: 'Repays' },
        { key: 'AutoMintExecuted', label: 'Auto-Mints' },
    ];

    return (
        <div className="flex flex-wrap gap-2">
            {filters.map(filter => (
                <button
                    key={filter.key}
                    onClick={() => onFilterChange(filter.key)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        currentFilter === filter.key
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    }`}
                >
                    {filter.label}
                </button>
            ))}
        </div>
    );
};

const TransactionTable = ({ transactions }) => {
    if (transactions.length === 0) {
        return <p className="text-center text-gray-500 py-16">No transactions found for this filter.</p>;
    }
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="text-xs text-gray-400 uppercase">
                    <tr>
                        <th className="p-4">Type</th>
                        <th className="p-4">Amount</th>
                        <th className="p-4 text-center">Status</th>
                        <th className="p-4 text-right">Date</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                    {transactions.map(tx => <TransactionRow key={tx.tx_hash} tx={tx} />)}
                </tbody>
            </table>
        </div>
    );
};

const TransactionRow = ({ tx }) => {
    const { type, amount, status, date } = useMemo(() => {
        const eventData = JSON.parse(tx.event_data || '{}');
        let formattedAmount = 'N/A';
        let typeInfo = { label: tx.event_name, icon: <Droplet />, color: 'text-gray-400' };

        switch (tx.event_name) {
            case 'CollateralDeposited':
                formattedAmount = `${(parseFloat(eventData.amount) / 1e18).toFixed(4)} ETH`;
                typeInfo = { label: 'Deposit', icon: <Download />, color: 'text-green-400' };
                break;
            case 'CollateralWithdrawn':
                formattedAmount = `${(parseFloat(eventData.amount) / 1e18).toFixed(4)} ETH`;
                typeInfo = { label: 'Withdraw', icon: <Upload />, color: 'text-red-400' };
                break;
            case 'TokensMinted':
                formattedAmount = `${(parseFloat(eventData.amount) / 1e6).toLocaleString()} tGHSX`;
                typeInfo = { label: 'Mint', icon: <Droplet />, color: 'text-blue-400' };
                break;
            case 'TokensBurned':
                formattedAmount = `${(parseFloat(eventData.amount) / 1e6).toLocaleString()} tGHSX`;
                typeInfo = { label: 'Repay', icon: <Droplet />, color: 'text-purple-400' };
                break;
            case 'AutoMintExecuted':
                formattedAmount = `${(parseFloat(eventData.amount) / 1e6).toLocaleString()} tGHSX`;
                typeInfo = { label: 'Auto-Mint', icon: <Zap />, color: 'text-yellow-400' };
                break;
        }

        return {
            type: typeInfo,
            amount: formattedAmount,
            status: tx.status === 'done'
                ? { label: 'Done', icon: <CheckCircle className="text-green-500" /> }
                : { label: 'Pending', icon: <Clock className="text-amber-500 animate-pulse" /> },
            date: formatDistanceToNow(new Date(tx.block_timestamp), { addSuffix: true })
        };
    }, [tx]);

    return (
        <tr className="hover:bg-gray-700/30">
            <td className="p-4">
                <div className={`flex items-center font-semibold ${type.color}`}>
                    {React.cloneElement(type.icon, { className: "w-5 h-5 mr-3" })}
                    {type.label}
                </div>
            </td>
            <td className="p-4 font-mono text-gray-200">{amount}</td>
            <td className="p-4">
                <div className="flex items-center justify-center space-x-2 text-sm text-gray-300">
                    {status.icon}
                    <span>{status.label}</span>
                </div>
            </td>
            <td className="p-4 text-right text-sm text-gray-400">{date}</td>
        </tr>
    );
};

const PaginationControls = ({ page, limit, total, onPageChange }) => {
    const totalPages = Math.ceil(total / limit);
    const startRecord = total > 0 ? (page - 1) * limit + 1 : 0;
    const endRecord = Math.min(page * limit, total);

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between text-sm text-gray-400">
            <p className="mb-2 sm:mb-0">
                Showing <span className="font-medium text-gray-200">{startRecord}</span> to <span className="font-medium text-gray-200">{endRecord}</span> of <span className="font-medium text-gray-200">{total}</span> results
            </p>
            <div className="flex items-center space-x-2">
                <button
                    onClick={() => onPageChange(page - 1)}
                    disabled={page === 1}
                    className="p-2 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <span className="px-2">
                    Page {page} of {totalPages}
                </span>
                <button
                    onClick={() => onPageChange(page + 1)}
                    disabled={page === totalPages}
                    className="p-2 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
