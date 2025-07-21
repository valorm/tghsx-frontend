import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Shield, ShieldCheck, ShieldOff, Zap, Settings, AlertTriangle, FileText, CheckCircle, XCircle, LogOut, RefreshCw, Power, Play, Users, Github, Twitter, Send, MessageSquare } from 'lucide-react';
import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.esm.js";

// --- LIVE API & CONFIG ---
const API_BASE_URL = 'https://tghsx.onrender.com';
const VAULT_ADDRESS = '0xF681Ba510d3C93A49a7AB2d02d9697BB2B0091FE';
const AMOY_CHAIN_ID = '0x13882'; // 80002 in hex

// --- Helper Functions ---
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

// --- Main Admin Component ---
export default function AdminPage() {
    const [view, setView] = useState('dashboard');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastRefreshed, setLastRefreshed] = useState(new Date());
    const [activeModal, setActiveModal] = useState(null);

    // --- Auth & Wallet State ---
    const [authToken, setAuthToken] = useState(localStorage.getItem('authToken'));
    const [walletAddress, setWalletAddress] = useState(null);
    const [provider, setProvider] = useState(null);

    // --- Admin Data State ---
    const [protocolStatus, setProtocolStatus] = useState(null);
    const [protocolHealth, setProtocolHealth] = useState(null);
    const [autoMintConfig, setAutoMintConfig] = useState(null);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [atRiskVaults, setAtRiskVaults] = useState([]);

    const connectWallet = useCallback(async () => {
        if (typeof window.ethereum !== 'undefined') {
            try {
                const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
                const network = await web3Provider.getNetwork();

                if (network.chainId !== 80002) { // 80002 is the Amoy chainId
                    try {
                        await window.ethereum.request({
                            method: 'wallet_switchEthereumChain',
                            params: [{ chainId: AMOY_CHAIN_ID }],
                        });
                    } catch (switchError) {
                        // This error code indicates that the chain has not been added to MetaMask.
                        if (switchError.code === 4902) {
                            await window.ethereum.request({
                                method: 'wallet_addEthereumChain',
                                params: [{
                                    chainId: AMOY_CHAIN_ID,
                                    chainName: 'Polygon Amoy',
                                    rpcUrls: ['https://rpc-amoy.polygon.technology'],
                                    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
                                    blockExplorerUrls: ['https://amoy.polygonscan.com']
                                }],
                            });
                        } else {
                           throw switchError;
                        }
                    }
                }
                
                await web3Provider.send('eth_requestAccounts', []);
                const signer = await web3Provider.getSigner();
                const address = await signer.getAddress();
                setProvider(web3Provider);
                setWalletAddress(address);
            } catch (err) {
                console.error("Wallet connection failed:", err);
                setError("Failed to connect wallet. Please ensure you are on the Amoy network.");
            }
        } else {
             setError("Please install MetaMask or another Web3 wallet.");
        }
    }, []);

    useEffect(() => {
        connectWallet();
    }, [connectWallet]);

    const fetchData = useCallback(async () => {
        if (!authToken) return;
        setIsLoading(true);
        setError(null);
        try {
            const adminHeaders = { 'Authorization': `Bearer ${authToken}` };

            const [statusRes, healthRes, automintRes, liquidationsRes, pendingRes] = await Promise.all([
                fetch(`${API_BASE_URL}/admin/status`, { headers: adminHeaders }),
                fetch(`${API_BASE_URL}/protocol/health`),
                fetch(`${API_BASE_URL}/admin/automint-config`, { headers: adminHeaders }),
                fetch(`${API_BASE_URL}/liquidations/at-risk`, { headers: adminHeaders }),
                fetch(`${API_BASE_URL}/admin/pending-requests`, { headers: adminHeaders }),
            ]);

            const statusData = await statusRes.json();
            const healthData = await healthRes.json();
            const automintData = await automintRes.json();
            const liquidationsData = await liquidationsRes.json();
            const pendingData = await pendingRes.json();
            
            console.log("API Response - Status:", statusData);
            console.log("API Response - Health:", healthData);
            console.log("API Response - AutoMint Config:", automintData);
            console.log("API Response - At-Risk Vaults:", liquidationsData);
            console.log("API Response - Pending Requests:", pendingData);

            if (!statusRes.ok || !healthRes.ok || !automintRes.ok || !liquidationsRes.ok || !pendingRes.ok) {
                throw new Error('Failed to fetch admin data. You may not have admin privileges or the server may be down.');
            }
            
            setProtocolStatus(statusData);
            setProtocolHealth(healthData);
            setAutoMintConfig(automintData);
            setAtRiskVaults(liquidationsData);
            setPendingRequests(pendingData);
            setLastRefreshed(new Date());

        } catch (err) {
            setError(err.message);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [authToken]);


    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleAdminAction = async (action, payload) => {
        console.log(`Executing admin action: ${action}`, payload);
        const adminHeaders = { 
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        };
        
        let endpoint = '';
        let method = 'POST';
        let body = payload ? JSON.stringify(payload) : null;

        switch(action) {
            case 'pause':
                endpoint = '/admin/pause';
                body = null;
                break;
            case 'unpause':
                endpoint = '/admin/unpause';
                body = null;
                break;
            case 'update-automint-config':
                endpoint = '/admin/update-automint-config';
                break;
             case 'toggle-automint':
                endpoint = `/admin/toggle-automint?enabled=${payload.enabled}`;
                body = null;
                break;
            default:
                alert(`Action "${action}" is not implemented yet.`);
                return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, { method, headers: adminHeaders, body });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.detail || 'Admin action failed.');
            }

            alert(`Success: ${result.message || 'Action completed.'}`);
            fetchData(); // Refresh data after action
        } catch (err) {
            console.error(`Failed to execute admin action "${action}":`, err);
            alert(`Error: ${err.message}`);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('authToken');
        setAuthToken(null);
        window.location.href = '/';
    };

    if (!authToken) {
        return <AuthWall message="Please log in to view the admin panel." />;
    }
    if (isLoading) return <LoadingSpinner />;
    if (error) return <ErrorMessage message={error} onRetry={fetchData} />;

    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans flex flex-col">
            <AdminHeader walletAddress={walletAddress} onLogout={handleLogout} />
            <main className="flex-grow p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-white flex items-center"><ShieldCheck className="mr-3 text-blue-500" /> Admin Panel</h1>
                     <button onClick={fetchData} className="flex items-center text-sm text-gray-400 hover:text-white transition-colors">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        <span>Last updated: {lastRefreshed.toLocaleTimeString()}</span>
                    </button>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <nav className="lg:col-span-1 space-y-2">
                        <AdminNavButton text="Dashboard" icon={<Settings />} active={view === 'dashboard'} onClick={() => setView('dashboard')} />
                        <AdminNavButton text="Pending Requests" icon={<FileText />} active={view === 'requests'} onClick={() => setView('requests')} notificationCount={pendingRequests.length} />
                        <AdminNavButton text="At-Risk Vaults" icon={<AlertTriangle />} active={view === 'liquidations'} onClick={() => setView('liquidations')} notificationCount={atRiskVaults.length} />
                    </nav>

                    <div className="lg:col-span-3">
                        {view === 'dashboard' && <DashboardView protocolStatus={protocolStatus} protocolHealth={protocolHealth} autoMintConfig={autoMintConfig} onAdminAction={handleAdminAction} onConfigure={() => setActiveModal('autoMintConfig')} />}
                        {view === 'requests' && <PendingRequestsView requests={pendingRequests} onAdminAction={handleAdminAction} />}
                        {view === 'liquidations' && <AtRiskVaultsView vaults={atRiskVaults} onAdminAction={handleAdminAction} />}
                    </div>
                </div>
            </main>
            <Footer />
            {activeModal === 'autoMintConfig' && <AutoMintConfigModal currentConfig={autoMintConfig} onClose={() => setActiveModal(null)} onSave={(newConfig) => { handleAdminAction('update-automint-config', newConfig); setActiveModal(null); }} />}
        </div>
    );
}

// --- Sub-Components ---

const AdminHeader = ({ walletAddress, onLogout }) => (
    <header className="bg-gray-900/80 backdrop-blur-sm sticky top-0 z-40 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
                <div className="flex items-center">
                    <ShieldCheck className="h-8 w-8 text-blue-500" />
                    <span className="ml-3 text-xl font-bold text-white">tGHSX Admin</span>
                </div>
                <div className="flex items-center space-x-4">
                    <div className="bg-gray-800 px-4 py-2 rounded-md text-sm font-mono text-gray-300">
                        {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Connecting...'}
                    </div>
                    <button onClick={onLogout} className="p-2 rounded-md hover:bg-gray-700 transition-colors">
                        <LogOut className="h-5 w-5 text-gray-400" />
                    </button>
                </div>
            </div>
        </div>
    </header>
);

const Footer = () => (
    <footer className="py-6 border-t border-gray-800 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-400">
            <div className="flex justify-center space-x-6 mb-4">
                <a href="https://github.com/valorm/tghsx" target="_blank" rel="noopener noreferrer" className="hover:text-white"><Github /></a>
                <a href="https://t.me/tghsstablecoin" target="_blank" rel="noopener noreferrer" className="hover:text-white"><Send /></a>
                <a href="https://discord.com/invite/NPtrctnJhu" target="_blank" rel="noopener noreferrer" className="hover:text-white"><MessageSquare /></a>
                <a href="https://x.com/tokenGHC" target="_blank" rel="noopener noreferrer" className="hover:text-white"><Twitter /></a>
            </div>
            <div className="text-xs space-x-4">
                 <a href="https://amoy.polygonscan.com/address/0xb04093d34F5feC6DE685B8684F3e2086dd866a50#code" target="_blank" rel="noopener noreferrer" className="hover:text-white">TGHSXToken Contract</a>
                 <span className="text-gray-600">|</span>
                 <a href="https://amoy.polygonscan.com/address/0xF681Ba510d3C93A49a7AB2d02d9697BB2B0091FE#code" target="_blank" rel="noopener noreferrer" className="hover:text-white">CollateralVault Contract</a>
            </div>
        </div>
    </footer>
);

const AdminNavButton = ({ text, icon, active, onClick, notificationCount = 0 }) => (
    <button onClick={onClick} className={`w-full flex items-center p-3 rounded-lg text-left font-medium transition-colors ${active ? 'bg-blue-600/20 text-blue-300' : 'hover:bg-gray-800 text-gray-400'}`}>
        {icon}
        <span className="ml-3 flex-grow">{text}</span>
        {notificationCount > 0 && <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{notificationCount}</span>}
    </button>
);

const DashboardView = ({ protocolStatus, protocolHealth, autoMintConfig, onAdminAction, onConfigure }) => (
    <div className="space-y-6">
        <Card>
            <CardHeader>
                <h2 className="text-xl font-semibold">🌐 Global Protocol Status</h2>
                <div className={`flex items-center text-sm px-3 py-1 rounded-full ${protocolStatus.isPaused ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                    {protocolStatus.isPaused ? <ShieldOff className="w-4 h-4 mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                    {protocolStatus.isPaused ? 'Paused' : 'Active'}
                </div>
            </CardHeader>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                <InfoBox title="Total Value Locked" value={formatCurrency(protocolHealth.totalValueLockedUSD)} />
                <InfoBox title="Total Debt" value={formatCurrency(protocolHealth.totalDebt, 0)} subtitle="tGHSX" />
                <InfoBox title="Global Ratio" value={`${parseFloat(protocolHealth.globalCollateralizationRatio).toFixed(2)}%`} />
            </div>
        </Card>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
                <CardHeader><h2 className="text-xl font-semibold">⚙️ Emergency Controls</h2></CardHeader>
                <div className="p-6 flex space-x-4">
                    <AdminButton icon={<Power />} text="Pause Protocol" className="bg-red-600 hover:bg-red-700" onClick={() => onAdminAction('pause')} />
                    <AdminButton icon={<Play />} text="Resume Protocol" className="bg-green-600 hover:bg-green-700" onClick={() => onAdminAction('unpause')} />
                </div>
            </Card>
            <Card>
                <CardHeader>
                    <h2 className="text-xl font-semibold">🤖 Auto-Mint Configuration</h2>
                    <div className={`flex items-center text-sm px-3 py-1 rounded-full ${autoMintConfig.isEnabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                        <Zap className="w-4 h-4 mr-2" />
                        {autoMintConfig.isEnabled ? 'Enabled' : 'Disabled'}
                    </div>
                </CardHeader>
                <div className="p-6">
                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                        <ConfigItem label="Base Reward" value={formatNumber(autoMintConfig.baseReward / 1e6)} />
                        <ConfigItem label="Bonus Multiplier" value={`${autoMintConfig.bonusMultiplier}%`} />
                        <ConfigItem label="Min Hold Time" value={`${autoMintConfig.minHoldTime / 86400} days`} />
                        <ConfigItem label="Collateral Req." value={`${autoMintConfig.collateralRequirement}%`} />
                    </div>
                    <AdminButton icon={<Settings />} text="Configure Auto-Mint" onClick={onConfigure} />
                     <AdminButton icon={autoMintConfig.isEnabled ? <XCircle/> : <CheckCircle/>} text={autoMintConfig.isEnabled ? "Disable Auto-Mint" : "Enable Auto-Mint"} className="mt-2" onClick={() => onAdminAction('toggle-automint', { enabled: !autoMintConfig.isEnabled })} />
                </div>
            </Card>
        </div>
    </div>
);

const PendingRequestsView = ({ requests, onAdminAction }) => (
    <Card>
        <CardHeader><h2 className="text-xl font-semibold">📋 Pending Mint Requests ({requests.length})</h2></CardHeader>
        <div className="divide-y divide-gray-700">
            {requests.length > 0 ? requests.map(req => (
                <div key={req.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                    <div>
                        <p className="font-semibold">{formatNumber(req.mint_amount)} tGHSX</p>
                        <p className="text-sm text-gray-400 font-mono">User: {req.user_id.slice(0,15)}...</p>
                        <p className="text-xs text-gray-500 font-mono">Collateral: {req.collateral_address}</p>
                    </div>
                    <div className="flex space-x-2 mt-3 sm:mt-0">
                        <AdminButton icon={<CheckCircle />} text="Approve" className="bg-green-600 hover:bg-green-700 text-xs py-1.5" onClick={() => onAdminAction('approve-mint', { requestId: req.id })} />
                        <AdminButton icon={<XCircle />} text="Decline" className="bg-red-600 hover:bg-red-700 text-xs py-1.5" onClick={() => onAdminAction('decline-mint', { requestId: req.id })} />
                    </div>
                </div>
            )) : <p className="p-6 text-center text-gray-500">No pending requests.</p>}
        </div>
    </Card>
);

const AtRiskVaultsView = ({ vaults, onAdminAction }) => (
    <Card>
        <CardHeader><h2 className="text-xl font-semibold">⚠️ At-Risk Vaults ({vaults.length})</h2></CardHeader>
        <div className="divide-y divide-gray-700">
            {vaults.length > 0 ? vaults.map(vault => (
                <div key={vault.wallet_address} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                    <div>
                        <p className="font-semibold font-mono">{vault.wallet_address}</p>
                        <p className="text-sm text-amber-400">Ratio: {vault.collateralization_ratio}</p>
                        <p className="text-sm text-gray-400">Debt: {formatNumber(vault.minted_amount)} tGHSX</p>
                    </div>
                    <div className="mt-3 sm:mt-0">
                        <AdminButton icon={<AlertTriangle />} text="Liquidate" className="bg-amber-600 hover:bg-amber-700" onClick={() => onAdminAction('liquidate', { wallet: vault.wallet_address, collateral: vault.collateral_address })} />
                    </div>
                </div>
            )) : <p className="p-6 text-center text-gray-500">No vaults are currently eligible for liquidation.</p>}
        </div>
    </Card>
);

const AutoMintConfigModal = ({ currentConfig, onClose, onSave }) => {
    const [config, setConfig] = useState({
        baseReward: (currentConfig.baseReward / 1e6) || 0,
        bonusMultiplier: currentConfig.bonusMultiplier || 0,
        minHoldTime: currentConfig.minHoldTime || 0,
        collateralRequirement: currentConfig.collateralRequirement || 0
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setConfig(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = () => {
        const newConfig = {
            baseReward: Math.round(parseFloat(config.baseReward) * 1e6),
            bonusMultiplier: parseInt(config.bonusMultiplier, 10),
            minHoldTime: parseInt(config.minHoldTime, 10),
            collateralRequirement: parseInt(config.collateralRequirement, 10)
        };
        onSave(newConfig);
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-gray-700"><h3 className="text-xl font-semibold">Configure Auto-Mint</h3></div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ModalInput name="baseReward" label="Base Reward (tGHSX)" value={config.baseReward} onChange={handleChange} type="number" step="0.000001" />
                    <ModalInput name="bonusMultiplier" label="Bonus Multiplier (%)" value={config.bonusMultiplier} onChange={handleChange} type="number" />
                    <ModalInput name="minHoldTime" label="Min Hold Time (seconds)" value={config.minHoldTime} onChange={handleChange} type="number" />
                    <ModalInput name="collateralRequirement" label="Collateral Requirement (%)" value={config.collateralRequirement} onChange={handleChange} type="number" />
                </div>
                <div className="p-4 bg-gray-900/50 rounded-b-lg flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium bg-gray-600 hover:bg-gray-500">Cancel</button>
                    <button onClick={handleSave} className="px-4 py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700">Save Changes</button>
                </div>
            </div>
        </div>
    );
};


// --- Utility Components ---
const Card = ({ children }) => <div className="bg-gray-800/50 rounded-xl shadow-lg border border-gray-700/50">{children}</div>;
const CardHeader = ({ children }) => <div className="p-4 border-b border-gray-700 flex justify-between items-center">{children}</div>;
const InfoBox = ({ title, value, subtitle }) => (<div><p className="text-sm text-gray-400">{title}</p><p className="text-3xl font-bold text-white">{value}</p>{subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}</div>);
const AdminButton = ({ icon, text, onClick, className = '' }) => (<button onClick={onClick} className={`w-full flex items-center justify-center px-4 py-2 rounded-md text-sm font-semibold transition-colors ${className || 'bg-blue-600 hover:bg-blue-700'}`}>{icon}<span className="ml-2">{text}</span></button>);
const ConfigItem = ({ label, value }) => (<div><p className="text-xs text-gray-400">{label}</p><p className="font-semibold">{value}</p></div>);
const ModalInput = ({ label, ...props }) => (<div><label className="block text-sm font-medium text-gray-300 mb-1">{label}</label><input {...props} className="w-full bg-gray-900 border border-gray-600 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500" /></div>);
const LoadingSpinner = () => <div className="flex items-center justify-center min-h-screen"><RefreshCw className="w-12 h-12 text-blue-500 animate-spin" /></div>;
const ErrorMessage = ({ message, onRetry }) => (<div className="flex items-center justify-center min-h-screen"><div className="bg-gray-800 p-8 rounded-lg text-center"><AlertTriangle className="w-12 h-12 text-red-500 mx-auto" /><h2 className="mt-4 text-2xl font-bold">Admin Panel Error</h2><p className="mt-2 text-gray-400">{message}</p><button onClick={onRetry} className="mt-6 px-5 py-2.5 rounded-md text-sm font-semibold bg-blue-600 hover:bg-blue-700">Try Again</button></div></div>);
const AuthWall = ({ message }) => (<div className="flex items-center justify-center min-h-screen"><div className="bg-gray-800 p-8 rounded-lg text-center"><Shield className="w-12 h-12 text-blue-500 mx-auto" /><h2 className="mt-4 text-2xl font-bold">Authentication Required</h2><p className="mt-2 text-gray-400">{message}</p></div></div>);
