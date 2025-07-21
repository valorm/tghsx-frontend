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
const formatCurrency = (value, decimals = 2) => {
    const number = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(number)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(number);
};
const formatNumber = (value) => {
    const number = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(number)) return '0';
    return number.toLocaleString();
};
const getHealthColor = (ratio) => {
    if (ratio >= 200) return COLORS.HEALTHY;
    if (ratio >= 150) return COLORS.WARNING;
    return COLORS.DANGER;
};

// --- Main App Component ---
export default function App() {
    const [view, setView] = useState('dashboard');
    const [activeModal, setActiveModal] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastRefreshed, setLastRefreshed] = useState(new Date());

    const [authToken, setAuthToken] = useState(localStorage.getItem('authToken'));
    const [walletAddress, setWalletAddress] = useState(null);
    const [provider, setProvider] = useState(null);

    const [positionData, setPositionData] = useState(null);
    const [mintStatus, setMintStatus] = useState(null);
    const [oraclePrice, setOraclePrice] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [protocolHealth, setProtocolHealth] = useState(null);
    
    const [collaterals, setCollaterals] = useState([]);
    const [selectedCollateral, setSelectedCollateral] = useState(null);

    // FIX: Add comprehensive logging to track component state
    console.log("--- Dashboard Render Cycle ---");
    console.log(`Is Loading: ${isLoading}`);
    console.log(`Error State: ${error}`);
    console.log(`Auth Token Present: ${!!authToken}`);
    console.log(`Wallet Connected: ${walletAddress}`);
    console.log(`Selected Collateral: ${selectedCollateral ? selectedCollateral.symbol : 'None'}`);
    console.log("--------------------------");


    const connectWallet = useCallback(async () => {
        if (typeof window.ethereum !== 'undefined') {
            try {
                const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
                await web3Provider.send('eth_requestAccounts', []);
                const signer = await web3Provider.getSigner();
                const address = await signer.getAddress();
                setProvider(web3Provider);
                setWalletAddress(address);
                 console.log("Wallet connected:", address);
            } catch (err) {
                console.error("Wallet connection error:", err);
                setError("Wallet connection failed. Please try again.");
            }
        } else {
             console.error("MetaMask is not installed.");
            setError("MetaMask is not installed. Please install it to use this app.");
        }
    }, []);
    
    useEffect(() => { connectWallet(); }, [connectWallet]);

    useEffect(() => {
        const fetchCollaterals = async () => {
            console.log("Fetching collateral types...");
            try {
                const response = await fetch(`${API_BASE_URL}/protocol/collaterals`);
                if (!response.ok) throw new Error("Failed to fetch collateral types.");
                const data = await response.json();
                console.log("Collaterals fetched:", data);
                setCollaterals(data);
                if (data.length > 0) {
                    const usdc = data.find(c => c.symbol === 'USDC');
                    setSelectedCollateral(usdc || data[0]);
                     console.log("Default collateral set to:", usdc || data[0]);
                } else {
                    console.warn("No enabled collaterals found from API.");
                    setIsLoading(false);
                }
            } catch (err) {
                console.error("Error fetching collaterals:", err);
                setError(err.message);
                setIsLoading(false);
            }
        };
        fetchCollaterals();
    }, []);

    const fetchData = useCallback(async () => {
        if (!authToken || !walletAddress || !selectedCollateral) {
            console.warn("FetchData skipped: Missing auth, wallet, or selected collateral.");
            // If these are missing after initial load, stop loading.
            if(!isLoading) setIsLoading(false);
            return;
        }

        console.log(`Fetching all dashboard data for ${selectedCollateral.symbol}...`);
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
            
            console.log("All API calls successful. Parsing data...");

            const positionJson = await vaultRes.json();
            const mintStatusJson = await mintStatusRes.json();
            const oraclePriceJson = await oracleRes.json();
            const transactionsJson = await transactionsRes.json();
            const protocolHealthJson = await protocolHealthRes.json();

            setPositionData(positionJson);
            setMintStatus(mintStatusJson);
            setOraclePrice(oraclePriceJson);
            setTransactions(transactionsJson);
            setProtocolHealth(protocolHealthJson);
            
            console.log("Dashboard data state updated.");
            setLastRefreshed(new Date());
        } catch (err) {
            console.error("Error in fetchData:", err);
            setError(err.message);
        } finally {
            console.log("Fetch process finished, setting isLoading to false.");
            setIsLoading(false);
        }
    }, [authToken, walletAddress, selectedCollateral]);

    useEffect(() => {
        if (selectedCollateral) {
            fetchData();
        }
    }, [selectedCollateral, fetchData]);

    const handleAction = (actionType) => setActiveModal(actionType);
    const closeModal = () => setActiveModal(null);
    const handleLogout = () => {
        localStorage.removeItem('authToken');
        setAuthToken(null);
        setWalletAddress(null);
        setProvider(null);
        window.location.href = '/'; 
    };
    
    const parsedRatio = useMemo(() => parseFloat(positionData?.collateralRatio), [positionData]);
    
    if (!authToken) return <AuthWall message="Please log in to view the dashboard." />;
    if (!walletAddress) return <AuthWall message="Please connect your wallet to continue." onAction={connectWallet} actionText="Connect Wallet" />;
    
    // FIX: Refined loading and error display logic
    if (isLoading) return <LoadingSpinner />;
    if (error) return <ErrorMessage message={error} onRetry={fetchData} />;
    if (!selectedCollateral || !positionData) return <div className="text-center p-8">No collateral data available.</div>;

    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans flex flex-col">
            <Header walletAddress={walletAddress} onLogout={handleLogout} />
            <main className="flex-grow p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <div className="flex items-center gap-4">
                        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
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
const CollateralSelector = ({ collaterals, selected, onSelect }) => { /* ... existing code ... */ };
const DashboardView = ({ positionData, mintStatus, oraclePrice, transactions, protocolHealth, onAction, parsedRatio, selectedCollateral }) => { /* ... existing code ... */ };
const VaultOverviewCard = ({ collateralValueUSD, mintedAmount, collateralRatio, isLiquidatable, onAction, parsedRatio, selectedCollateral }) => { /* ... existing code ... */ };
const ProtocolHealthCard = ({ totalValueLockedUSD, totalDebt, globalCollateralizationRatio }) => { /* ... existing code ... */ };
const MintStatusCard = ({ dailyMinted, remainingDaily, cooldownRemaining }) => { /* ... existing code ... */ };
const OraclePriceCard = ({ eth_usd_price, decimals }) => { /* ... existing code ... */ };
const TransactionHistory = ({ transactions }) => { /* ... existing code ... */ };
const ActionModal = ({ modalType, collateral, onClose, provider, onSuccess }) => { /* ... existing code ... */ };
const Card = ({ children }) => (<div className="bg-gray-800/50 rounded-xl shadow-lg border border-gray-700/50 backdrop-blur-sm">{children}</div>);
const CardHeader = ({ children }) => (<div className="p-4 border-b border-gray-700 flex justify-between items-center">{children}</div>);
const InfoBox = ({ icon, title, value, valueColor, alignment = 'center' }) => (
    <div className={`flex items-start space-x-3 ${alignment === 'left' ? 'text-left' : 'flex-col sm:flex-row sm:text-left'}`}>
        <div className="text-blue-500 bg-blue-500/10 p-2 rounded-lg">{React.cloneElement(icon, { className: "w-6 h-6" })}</div>
        <div>
            <p className="text-sm text-gray-400">{title}</p>
            <p className={`text-2xl font-bold ${valueColor || 'text-white'}`}>{value}</p>
        </div>
    </div>
);
const ActionButton = ({ onClick, children, className = '', disabled=false }) => (
    <button onClick={onClick} disabled={disabled} className={`w-full px-4 py-2.5 rounded-md text-sm font-semibold transition-all duration-200 ease-in-out transform hover:scale-105 ${disabled ? 'bg-gray-600 cursor-not-allowed' : `bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/50 ${className}`}`}>{children}</button>
);
const LoadingSpinner = () => (<div className="flex items-center justify-center min-h-screen bg-gray-900"><div className="flex flex-col items-center"><RefreshCw className="w-12 h-12 text-blue-500 animate-spin" /><p className="mt-4 text-lg text-gray-300">Loading Protocol Data...</p></div></div>);
const ErrorMessage = ({ message, onRetry }) => (<div className="flex items-center justify-center min-h-screen bg-gray-900"><div className="bg-gray-800 p-8 rounded-lg text-center shadow-xl"><AlertTriangle className="w-12 h-12 text-red-500 mx-auto" /><h2 className="mt-4 text-2xl font-bold text-white">An Error Occurred</h2><p className="mt-2 text-gray-400">{message}</p><button onClick={onRetry} className="mt-6 px-5 py-2.5 rounded-md text-sm font-semibold bg-blue-600 hover:bg-blue-700 transition-colors">Try Again</button></div></div>);
const AuthWall = ({ message, onAction, actionText }) => (<div className="flex items-center justify-center min-h-screen bg-gray-900"><div className="bg-gray-800 p-8 rounded-lg text-center shadow-xl"><Shield className="w-12 h-12 text-blue-500 mx-auto" /><h2 className="mt-4 text-2xl font-bold text-white">Authentication Required</h2><p className="mt-2 text-gray-400">{message}</p>{onAction && (<button onClick={onAction} className="mt-6 px-5 py-2.5 rounded-md text-sm font-semibold bg-blue-600 hover:bg-blue-700 transition-colors">{actionText}</button>)}</div></div>);
