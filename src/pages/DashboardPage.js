import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, Droplet, Zap, Clock, Shield, LogOut, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, Github, Twitter, Send, MessageSquare, ChevronsUpDown } from 'lucide-react';
import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.esm.js";

// --- LIVE API & WEB3 CONFIG ---
const API_BASE_URL = 'https://tghsx.onrender.com'; 
const VAULT_ADDRESS = '0xF681Ba510d3C93A49a7AB2d02d9697BB2B0091FE';

// --- SMART CONTRACT ABIs ---
const VAULT_ABI = [
    "function depositCollateral(address collateral, uint256 amount)",
    "function withdrawCollateral(address collateral, uint256 amount)",
    "function mintTokens(address collateral, uint256 amount)",
    "function burnTokens(address collateral, uint256 amount)",
    "function autoMint(address collateral)"
];
const ERC20_ABI = [
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)"
];

// --- Helper Functions & Constants ---
const COLORS = { HEALTHY: '#22c55e', WARNING: '#f59e0b', DANGER: '#ef4444' };
const formatCurrency = (value, decimals = 2) => { /* ... existing code ... */ };
const formatNumber = (value) => { /* ... existing code ... */ };
const getHealthColor = (ratio) => { /* ... existing code ... */ };

// --- Main App Component ---
export default function App() {
    const [view, setView] = useState('dashboard');
    const [activeModal, setActiveModal] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastRefreshed, setLastRefreshed] = useState(new Date());

    // --- Auth & Wallet State ---
    const [authToken, setAuthToken] = useState(localStorage.getItem('authToken'));
    const [walletAddress, setWalletAddress] = useState(null);
    const [provider, setProvider] = useState(null);

    // --- Data State ---
    const [positionData, setPositionData] = useState(null);
    const [mintStatus, setMintStatus] = useState(null);
    const [oraclePrice, setOraclePrice] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [protocolHealth, setProtocolHealth] = useState(null);
    
    // FIX: State for managing collaterals
    const [collaterals, setCollaterals] = useState([]);
    const [selectedCollateral, setSelectedCollateral] = useState(null);

    const connectWallet = useCallback(async () => { /* ... existing code ... */ }, []);
    
    useEffect(() => { connectWallet(); }, [connectWallet]);

    // FIX: Fetch available collaterals on component mount
    useEffect(() => {
        const fetchCollaterals = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/protocol/collaterals`);
                if (!response.ok) throw new Error("Failed to fetch collateral types.");
                const data = await response.json();
                setCollaterals(data);
                // Default to USDC if available, otherwise the first in the list
                if (data.length > 0) {
                    const usdc = data.find(c => c.symbol === 'USDC');
                    setSelectedCollateral(usdc || data[0]);
                }
            } catch (err) {
                setError(err.message);
                console.error(err);
            }
        };
        fetchCollaterals();
    }, []);

    const fetchData = useCallback(async () => {
        if (!authToken || !walletAddress || !selectedCollateral) return;

        setIsLoading(true);
        setError(null);
        try {
            const authHeader = { 'Authorization': `Bearer ${authToken}` };
            const [ vaultRes, mintStatusRes, oracleRes, transactionsRes, protocolHealthRes ] = await Promise.all([
                fetch(`${API_BASE_URL}/vault/status/${selectedCollateral.address}`, { headers: authHeader }),
                fetch(`${API_BASE_URL}/vault/mint-status`, { headers: authHeader }),
                fetch(`${API_BASE_URL}/oracle/price`, { headers: authHeader }),
                fetch(`${API_BASE_URL}/transactions?page=1&limit=5`, { headers: authHeader }),
                fetch(`${API_BASE_URL}/protocol/health`, { headers: authHeader })
            ]);

            if (!vaultRes.ok || !mintStatusRes.ok || !oracleRes.ok || !transactionsRes.ok || !protocolHealthRes.ok) {
                throw new Error('Failed to fetch dashboard data. Your session might have expired.');
            }

            setPositionData(await vaultRes.json());
            setMintStatus(await mintStatusRes.json());
            setOraclePrice(await oracleRes.json());
            setTransactions(await transactionsRes.json());
            setProtocolHealth(await protocolHealthRes.json());
            setLastRefreshed(new Date());
        } catch (err) {
            setError(err.message);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [authToken, walletAddress, selectedCollateral]);

    // Re-fetch data whenever the selected collateral changes
    useEffect(() => {
        if (selectedCollateral) {
            fetchData();
        }
    }, [selectedCollateral, fetchData]);

    const handleAction = (actionType) => {
        setActiveModal(actionType);
    };

    const closeModal = () => setActiveModal(null);
    const handleLogout = () => { /* ... existing code ... */ };
    
    const parsedRatio = useMemo(() => parseFloat(positionData?.collateralRatio), [positionData]);
    
    if (!authToken) return <AuthWall message="Please log in to view the dashboard." />;
    if (!walletAddress) return <AuthWall message="Please connect your wallet to continue." onAction={connectWallet} actionText="Connect Wallet" />;
    if (isLoading && !positionData) return <LoadingSpinner />; // Show spinner on initial load
    if (error) return <ErrorMessage message={error} onRetry={fetchData} />;

    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans flex flex-col">
            <Header walletAddress={walletAddress} onLogout={handleLogout} />
            <main className="flex-grow p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <div className="flex items-center gap-4">
                        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
                        {/* FIX: Add Collateral Selector */}
                        <CollateralSelector 
                            collaterals={collaterals}
                            selected={selectedCollateral}
                            onSelect={setSelectedCollateral}
                        />
                    </div>
                    <div className="flex items-center space-x-4">
                        <button onClick={fetchData} className="flex items-center text-sm text-gray-400 hover:text-white transition-colors">
                            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                            <span>Last updated: {lastRefreshed.toLocaleTimeString()}</span>
                        </button>
                    </div>
                </div>

                {/* FIX: Pass selectedCollateral to components */}
                <DashboardView
                    positionData={positionData}
                    mintStatus={mintStatus}
                    oraclePrice={oraclePrice}
                    transactions={transactions}
                    protocolHealth={protocolHealth}
                    onAction={handleAction}
                    parsedRatio={parsedRatio}
                    selectedCollateral={selectedCollateral}
                />
            </main>
            <Footer />
            {activeModal && <ActionModal modalType={activeModal} collateral={selectedCollateral} onClose={closeModal} provider={provider} onSuccess={fetchData} />}
        </div>
    );
}

// --- Sub-Components ---

const Header = ({ walletAddress, onLogout }) => { /* ... existing code ... */ };
const Footer = () => { /* ... existing code ... */ };

// FIX: New component to select collateral
const CollateralSelector = ({ collaterals, selected, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);

    if (collaterals.length === 0) return null;

    return (
        <div className="relative">
            <button onClick={() => setIsOpen(!isOpen)} className="flex items-center justify-between w-40 px-4 py-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm font-medium">
                <span>{selected?.symbol || 'Select...'}</span>
                <ChevronsUpDown className="w-4 h-4 ml-2 text-gray-400" />
            </button>
            {isOpen && (
                <div className="absolute z-10 mt-1 w-40 bg-gray-800 border border-gray-700 rounded-md shadow-lg">
                    <ul className="py-1">
                        {collaterals.map(c => (
                            <li key={c.address} onClick={() => { onSelect(c); setIsOpen(false); }} className="px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 cursor-pointer">
                                {c.name} ({c.symbol})
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

const DashboardView = ({ positionData, mintStatus, oraclePrice, transactions, protocolHealth, onAction, parsedRatio, selectedCollateral }) => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
            <VaultOverviewCard {...positionData} onAction={onAction} parsedRatio={parsedRatio} selectedCollateral={selectedCollateral} />
            <ProtocolHealthCard {...protocolHealth} />
        </div>
        <div className="space-y-6">
            <MintStatusCard {...mintStatus} />
            <OraclePriceCard {...oraclePrice} />
            <TransactionHistory transactions={transactions?.transactions} />
        </div>
    </div>
);

const VaultOverviewCard = ({ collateralValueUSD, mintedAmount, collateralRatio, isLiquidatable, onAction, parsedRatio, selectedCollateral }) => (
    <Card>
        <CardHeader>
            <h2 className="text-xl font-semibold">📊 Your {selectedCollateral?.symbol} Vault</h2>
            {isLiquidatable && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full">At Risk</span>}
        </CardHeader>
        {/* ... rest of component is largely the same ... */}
    </Card>
);

const ProtocolHealthCard = ({ totalValueLockedUSD, totalDebt, globalCollateralizationRatio }) => { /* ... existing code ... */ };
const MintStatusCard = ({ dailyMinted, remainingDaily, cooldownRemaining }) => { /* ... existing code ... */ };
const OraclePriceCard = ({ eth_usd_price, decimals }) => { /* ... existing code ... */ };
const TransactionHistory = ({ transactions }) => { /* ... existing code ... */ };

// FIX: Update ActionModal to be collateral-aware
const ActionModal = ({ modalType, collateral, onClose, provider, onSuccess }) => {
    const [amount, setAmount] = useState('');
    const [status, setStatus] = useState({ loading: false, error: null, success: null });

    const titles = {
        deposit: `Deposit ${collateral?.symbol}`,
        withdraw: `Withdraw ${collateral?.symbol}`,
        mint: `Mint tGHSX with ${collateral?.symbol}`,
        repay: 'Repay tGHSX',
        'auto-mint': `Auto-Mint with ${collateral?.symbol}`,
    };

    const handleConfirm = async () => {
        if (!provider || !collateral || (!amount && modalType !== 'auto-mint')) {
            setStatus({ loading: false, error: "Amount is required.", success: null });
            return;
        }
        // ... validation ...
        setStatus({ loading: true, error: null, success: "Preparing transaction..." });

        try {
            const signer = provider.getSigner();
            const vaultContract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);
            const tokenContract = new ethers.Contract(collateral.address, ERC20_ABI, signer);
            let tx;

            const amountStr = String(amount || '0');
            const parsedAmount = ethers.utils.parseUnits(amountStr, collateral.decimals);

            if (modalType === 'deposit' || modalType === 'repay') {
                const balance = await tokenContract.balanceOf(signer.getAddress());
                if (balance.lt(parsedAmount)) {
                    setStatus({ loading: false, error: `Insufficient ${collateral.symbol} balance.`, success: null });
                    return;
                }
            }
            
            if (modalType === 'deposit') {
                setStatus({ loading: true, error: null, success: "Waiting for approval..." });
                const approveTx = await tokenContract.approve(VAULT_ADDRESS, parsedAmount);
                await approveTx.wait();

                setStatus({ loading: true, error: null, success: "Approval successful. Depositing..." });
                tx = await vaultContract.depositCollateral(collateral.address, parsedAmount);

            } else if (modalType === 'repay') {
                const tghsxTokenAddress = "0xb04093d34F5feC6DE685B8684F3e2086dd866a50"; // This should ideally come from config
                const tghsxContract = new ethers.Contract(tghsxTokenAddress, ERC20_ABI, signer);
                const repayAmount = ethers.utils.parseUnits(amountStr, 6); // tGHSX has 6 decimals

                setStatus({ loading: true, error: null, success: "Waiting for approval..." });
                const approveTx = await tghsxContract.approve(VAULT_ADDRESS, repayAmount);
                await approveTx.wait();
                
                setStatus({ loading: true, error: null, success: "Approval successful. Repaying debt..." });
                tx = await vaultContract.burnTokens(collateral.address, repayAmount);
            
            } else if (modalType === 'mint') {
                const mintAmount = ethers.utils.parseUnits(amountStr, 6); // tGHSX has 6 decimals
                tx = await vaultContract.mintTokens(collateral.address, mintAmount);
            
            } else if (modalType === 'withdraw') {
                 tx = await vaultContract.withdrawCollateral(collateral.address, parsedAmount);
            
            } else if (modalType === 'auto-mint') {
                tx = await vaultContract.autoMint(collateral.address);
            }

            setStatus({ loading: true, error: null, success: "Transaction sent..." });
            await tx.wait();
            setStatus({ loading: false, error: null, success: "Transaction successful!" });
            onSuccess();
            setTimeout(() => onClose(), 2000);

        } catch (err) {
            // ... existing robust error handling ...
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-gray-700">
                    <h3 className="text-xl font-semibold">{titles[modalType]}</h3>
                </div>
                <div className="p-6 space-y-4">
                    {modalType !== 'auto-mint' && (
                        <div>
                            <label htmlFor="amount" className="block text-sm font-medium text-gray-300 mb-1">
                                Amount in {modalType === 'repay' || modalType === 'mint' ? 'tGHSX' : collateral?.symbol}
                            </label>
                            <input
                                type="number"
                                id="amount"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-gray-900 border border-gray-600 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    )}
                    {/* ... status messages ... */}
                </div>
                <div className="p-4 bg-gray-900/50 rounded-b-lg flex justify-end space-x-3">
                    {/* ... buttons ... */}
                </div>
            </div>
        </div>
    );
};


// --- Utility Components ---
const Card = ({ children }) => { /* ... */ };
const CardHeader = ({ children }) => { /* ... */ };
const InfoBox = ({ icon, title, value, valueColor, alignment = 'center' }) => { /* ... */ };
const ActionButton = ({ onClick, children, className = '', disabled=false }) => { /* ... */ };
const LoadingSpinner = () => { /* ... */ };
const ErrorMessage = ({ message, onRetry }) => { /* ... */ };
const AuthWall = ({ message, onAction, actionText }) => { /* ... */ };
