import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, Droplet, Zap, Clock, Shield, LogOut, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, Github, Twitter, Send, MessageSquare } from 'lucide-react';
import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.esm.js";

// --- LIVE API & WEB3 CONFIG ---
const API_BASE_URL = 'https://tghsx.onrender.com'; 
const VAULT_ADDRESS = '0xF681Ba510d3C93A49a7AB2d02d9697BB2B0091FE';
const USDC_ADDRESS = '0xAC2f1680f2705d3Dd314534Bf24b424ccBC8D8f5'; 

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
const COLORS = {
    HEALTHY: '#22c55e', // green-500
    WARNING: '#f59e0b', // amber-500
    DANGER: '#ef4444',  // red-500
};

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

    // --- Auth & Wallet State ---
    const [authToken, setAuthToken] = useState(localStorage.getItem('authToken'));
    const [walletAddress, setWalletAddress] = useState(null);
    const [provider, setProvider] = useState(null);

    // --- Data State ---
    const [vaultOverview, setVaultOverview] = useState(null);
    const [mintStatus, setMintStatus] = useState(null);
    const [oraclePrice, setOraclePrice] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [protocolHealth, setProtocolHealth] = useState(null);

    const connectWallet = useCallback(async () => {
        if (typeof window.ethereum !== 'undefined') {
            try {
                const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
                await web3Provider.send('eth_requestAccounts', []);
                const signer = await web3Provider.getSigner();
                const address = await signer.getAddress();
                
                setProvider(web3Provider);
                setWalletAddress(address);
            } catch (err) {
                console.error("User denied account access or error occurred:", err);
                setError("Wallet connection failed. Please try again.");
            }
        } else {
            setError("MetaMask is not installed. Please install it to use this app.");
        }
    }, []);
    
    useEffect(() => {
        connectWallet();
    }, [connectWallet]);


    const fetchData = useCallback(async () => {
        if (!authToken || !walletAddress) return;

        setIsLoading(true);
        setError(null);
        try {
            const authHeader = { 'Authorization': `Bearer ${authToken}` };

            const [
                vaultRes, 
                mintStatusRes, 
                oracleRes, 
                transactionsRes,
                protocolHealthRes
            ] = await Promise.all([
                fetch(`${API_BASE_URL}/vault/status/${USDC_ADDRESS}`, { headers: authHeader }),
                fetch(`${API_BASE_URL}/vault/mint-status`, { headers: authHeader }),
                fetch(`${API_BASE_URL}/oracle/price`, { headers: authHeader }),
                fetch(`${API_BASE_URL}/transactions?page=1&limit=5`, { headers: authHeader }),
                fetch(`${API_BASE_URL}/protocol/health`, { headers: authHeader })
            ]);

            if (!vaultRes.ok || !mintStatusRes.ok || !oracleRes.ok || !transactionsRes.ok || !protocolHealthRes.ok) {
                throw new Error('Failed to fetch dashboard data. Your session might have expired.');
            }

            setVaultOverview(await vaultRes.json());
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
    }, [authToken, walletAddress]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleAction = (actionType) => {
        console.log(`Triggering action: ${actionType}`);
        setActiveModal(actionType);
    };

    const closeModal = () => {
        setActiveModal(null);
    };

    const handleLogout = () => {
        localStorage.removeItem('authToken');
        setAuthToken(null);
        setWalletAddress(null);
        setProvider(null);
        window.location.href = '/'; 
    };
    
    const parsedRatio = useMemo(() => parseFloat(vaultOverview?.collateralRatio), [vaultOverview]);
    
    if (!authToken) {
        return <AuthWall message="Please log in to view the dashboard." />;
    }
    
    if (!walletAddress) {
        return <AuthWall message="Please connect your wallet to continue." onAction={connectWallet} actionText="Connect Wallet" />;
    }

    if (isLoading) {
        return <LoadingSpinner />;
    }

    if (error) {
        return <ErrorMessage message={error} onRetry={fetchData} />;
    }

    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans flex flex-col">
            <Header walletAddress={walletAddress} onLogout={handleLogout} />
            
            <main className="flex-grow p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-white">Dashboard</h1>
                    <div className="flex items-center space-x-4">
                        <button onClick={fetchData} className="flex items-center text-sm text-gray-400 hover:text-white transition-colors">
                            <RefreshCw className="w-4 h-4 mr-2" />
                            <span>Last updated: {lastRefreshed.toLocaleTimeString()}</span>
                        </button>
                        <div className="flex rounded-md bg-gray-800">
                           <button onClick={() => setView('dashboard')} className={`px-3 py-1.5 text-sm font-medium rounded-l-md transition-colors ${view === 'dashboard' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>Overview</button>
                           <button onClick={() => setView('manage')} className={`px-3 py-1.5 text-sm font-medium rounded-r-md transition-colors ${view === 'manage' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>Manage Vault</button>
                        </div>
                    </div>
                </div>

                {view === 'dashboard' ? (
                    <DashboardView
                        vaultOverview={vaultOverview}
                        mintStatus={mintStatus}
                        oraclePrice={oraclePrice}
                        transactions={transactions}
                        protocolHealth={protocolHealth}
                        onAction={handleAction}
                        parsedRatio={parsedRatio}
                    />
                ) : (
                    <ManageVaultView
                        vaultOverview={vaultOverview}
                        onAction={handleAction}
                        parsedRatio={parsedRatio}
                    />
                )}
            </main>
            
            <Footer />
            
            {activeModal && <ActionModal modalType={activeModal} onClose={closeModal} provider={provider} onSuccess={fetchData} />}
        </div>
    );
}

// --- Sub-Components ---

const Header = ({ walletAddress, onLogout }) => (
    <header className="bg-gray-900/80 backdrop-blur-sm sticky top-0 z-40 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
                <div className="flex items-center">
                    <Droplet className="h-8 w-8 text-blue-500" />
                    <span className="ml-3 text-xl font-bold text-white">tGHSX Protocol</span>
                </div>
                <div className="flex items-center space-x-4">
                    <div className="bg-gray-800 px-4 py-2 rounded-md text-sm font-mono text-gray-300">
                        {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Not Connected'}
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

const DashboardView = ({ vaultOverview, mintStatus, oraclePrice, transactions, protocolHealth, onAction, parsedRatio }) => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
            <VaultOverviewCard {...vaultOverview} onAction={onAction} parsedRatio={parsedRatio} />
            <ProtocolHealthCard {...protocolHealth} onAction={onAction} />
        </div>
        <div className="space-y-6">
            <MintStatusCard {...mintStatus} />
            <OraclePriceCard {...oraclePrice} />
            <TransactionHistory transactions={transactions?.transactions} />
        </div>
    </div>
);

const VaultOverviewCard = ({ collateralValueUSD, mintedAmount, collateralRatio, isLiquidatable, onAction, parsedRatio }) => (
    <Card>
        <CardHeader>
            <h2 className="text-xl font-semibold">📊 Your Vault Overview</h2>
            {isLiquidatable && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full">At Risk</span>}
        </CardHeader>
        <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
                <InfoBox icon={<DollarSign />} title="Collateral Value" value={formatCurrency(collateralValueUSD)} />
                <InfoBox icon={<Droplet />} title="Minted tGHSX" value={formatNumber(mintedAmount)} />
                <InfoBox icon={<Shield />} title="Collateral Ratio" value={collateralRatio} valueColor={getHealthColor(parsedRatio)} />
            </div>
            <div className="mt-8">
                <h3 className="text-lg font-medium text-gray-300 mb-4 text-center">⚡ Quick Actions</h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <ActionButton onClick={() => onAction('deposit')}>Deposit</ActionButton>
                    <ActionButton onClick={() => onAction('withdraw')}>Withdraw</ActionButton>
                    <ActionButton onClick={() => onAction('mint')}>Mint</ActionButton>
                    <ActionButton onClick={() => onAction('repay')}>Repay</ActionButton>
                    <ActionButton onClick={() => onAction('auto-mint')} className="bg-purple-600 hover:bg-purple-700 col-span-2 sm:col-span-1">Auto-Mint</ActionButton>
                </div>
            </div>
        </div>
    </Card>
);

const ProtocolHealthCard = ({ totalValueLockedUSD, totalDebt, globalCollateralizationRatio, onAction }) => (
    <Card>
        <CardHeader>
            <h2 className="text-xl font-semibold">🌐 Protocol Health</h2>
        </CardHeader>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
                <InfoBox icon={<DollarSign />} title="Total Value Locked (TVL)" value={formatCurrency(totalValueLockedUSD)} alignment="left" />
                <InfoBox icon={<Droplet />} title="Total Debt (tGHSX)" value={formatCurrency(totalDebt)} alignment="left" />
                <InfoBox icon={<Shield />} title="Global Collateral Ratio" value={`${globalCollateralizationRatio}%`} valueColor={getHealthColor(parseFloat(globalCollateralizationRatio))} alignment="left" />
            </div>
        </div>
    </Card>
);


const MintStatusCard = ({ dailyMinted, remainingDaily, cooldownRemaining }) => {
    const totalDaily = parseFloat(dailyMinted) + parseFloat(remainingDaily);
    const mintProgress = totalDaily > 0 ? (parseFloat(dailyMinted) / totalDaily) * 100 : 0;

    return (
        <Card>
            <CardHeader><h2 className="text-xl font-semibold">📈 Mint Status</h2></CardHeader>
            <div className="p-6 space-y-4">
                <div>
                    <div className="flex justify-between text-sm mb-1 text-gray-400">
                        <span>Daily Minted</span>
                        <span>{formatNumber(dailyMinted)} / {formatNumber(totalDaily)} tGHSX</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2.5"><div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${mintProgress}%` }}></div></div>
                </div>
                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Cooldown:</span>
                    {cooldownRemaining > 0 ? (
                        <span className="font-medium text-amber-400 flex items-center"><Clock className="w-4 h-4 mr-1.5" /> {Math.ceil(cooldownRemaining / 60)}m remaining</span>
                    ) : (
                        <span className="font-medium text-green-400 flex items-center"><Zap className="w-4 h-4 mr-1.5" /> Ready</span>
                    )}
                </div>
            </div>
        </Card>
    );
};

const OraclePriceCard = ({ eth_usd_price, decimals }) => (
    <Card>
        <CardHeader><h2 className="text-xl font-semibold">🔮 Oracle Price</h2></CardHeader>
        <div className="p-6 text-center">
            <p className="text-3xl font-bold text-blue-400">{formatCurrency(eth_usd_price / Math.pow(10, decimals))}</p>
            <p className="text-sm text-gray-400 mt-1">per ETH</p>
        </div>
    </Card>
);

const TransactionHistory = ({ transactions }) => (
    <Card>
        <CardHeader><h2 className="text-xl font-semibold">📜 Recent Activity</h2></CardHeader>
        <div className="p-4">
            <ul className="space-y-3">
                {transactions && transactions.length > 0 ? transactions.map(tx => (
                    <li key={tx.tx_hash} className="flex items-center justify-between text-sm">
                        <div>
                            <p className="font-medium text-gray-200">{tx.event_name}</p>
                            <p className="font-mono text-xs text-gray-500">{tx.tx_hash.slice(0, 10)}...</p>
                        </div>
                        <p className="text-gray-400">{new Date(tx.block_timestamp).toLocaleTimeString()}</p>
                    </li>
                )) : (<p className="text-center text-gray-500 py-4">No recent transactions.</p>)}
            </ul>
        </div>
    </Card>
);

const ManageVaultView = ({ vaultOverview, onAction, parsedRatio }) => {
    const [collaterals, setCollaterals] = useState([
        { name: 'USDC', symbol: 'USDC', amount: 1, valueUSD: 2500.50, logo: 'https://placehold.co/32x32/1f2937/9ca3af?text=USDC', address: USDC_ADDRESS },
    ]);

    const liquidationPrice = useMemo(() => {
        if (!vaultOverview || !collaterals.find(c => c.symbol === 'USDC')) return 0;
        const { collateralValueUSD, mintedAmount } = vaultOverview;
        const minCollateralValue = parseFloat(mintedAmount) * 1.5;
        const currentCollateralValue = parseFloat(collateralValueUSD);
        if (currentCollateralValue === 0) return 0;
        
        const usdcAmount = collaterals.find(c => c.symbol === 'USDC').amount;
        if (usdcAmount === 0) return 0;

        const priceDropPercentage = ((currentCollateralValue - minCollateralValue) / currentCollateralValue);
        const usdcPrice = currentCollateralValue / usdcAmount;
        
        return usdcPrice * (1 - priceDropPercentage);

    }, [vaultOverview, collaterals]);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader><h2 className="text-xl font-semibold">⚙️ Detailed Vault Management</h2></CardHeader>
                <div className="p-6">
                    <h3 className="text-lg font-medium mb-4">Your Collateral</h3>
                    <div className="bg-gray-800 rounded-lg divide-y divide-gray-700">
                        {collaterals.map(c => <CollateralRow key={c.symbol} {...c} onAction={onAction} />)}
                    </div>
                </div>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader><h2 className="text-xl font-semibold">Mint & Repay tGHSX</h2></CardHeader>
                    <div className="p-6 space-y-4">
                        <MintRepayForm type="mint" onAction={onAction} />
                        <div className="border-t border-gray-700 my-4"></div>
                        <MintRepayForm type="repay" onAction={onAction} />
                    </div>
                </Card>
                <Card>
                     <CardHeader><h2 className="text-xl font-semibold">Position Monitoring</h2></CardHeader>
                    <div className="p-6 space-y-6">
                        <div>
                            <h3 className="text-lg font-medium text-gray-300">Collateralization Health</h3>
                            <div className="w-full bg-gray-700 rounded-full h-4 mt-2 relative">
                                <div className="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-4 rounded-full"></div>
                                <div className="absolute top-0 h-4 border-l-2 border-white transition-all duration-300" style={{ left: `${Math.min(100, (parsedRatio / 300) * 100)}%` }}>
                                    <div className="absolute -top-6 -translate-x-1/2 text-xs bg-gray-900 px-1.5 py-0.5 rounded">{parsedRatio ? parsedRatio.toFixed(2) : '0.00'}%</div>
                                </div>
                            </div>
                            <div className="flex justify-between text-xs text-gray-400 mt-1"><span>150%</span><span>300%+</span></div>
                        </div>
                        <div className="bg-red-900/50 border border-red-500/50 p-4 rounded-lg flex items-start space-x-3">
                            <AlertTriangle className="w-8 h-8 text-red-400 flex-shrink-0 mt-1" />
                            <div>
                                <h4 className="font-semibold text-red-300">Liquidation Price</h4>
                                <p className="text-2xl font-bold text-white">{formatCurrency(liquidationPrice)}</p>
                                <p className="text-sm text-red-300/80">Your position will be at risk if the price of USDC drops to this level.</p>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

const CollateralRow = ({ name, symbol, amount, valueUSD, logo, onAction, address }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    return (
        <div className="p-4">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex items-center">
                    <img src={logo} alt={name} className="w-8 h-8 rounded-full mr-4" />
                    <div>
                        <p className="font-semibold">{name}</p>
                        <p className="text-sm text-gray-400">{amount} {symbol}</p>
                    </div>
                </div>
                <div className="text-right flex items-center">
                    <div>
                        <p className="font-semibold">{formatCurrency(valueUSD)}</p>
                        <p className="text-sm text-gray-400">Value</p>
                    </div>
                    <button className="ml-4 p-1 rounded-md hover:bg-gray-700">{isExpanded ? <ChevronUp /> : <ChevronDown />}</button>
                </div>
            </div>
            {isExpanded && (
                <div className="mt-4 pt-4 border-t border-gray-700 flex justify-end space-x-3">
                    <ActionButton onClick={() => onAction('deposit')}>Deposit {symbol}</ActionButton>
                    <ActionButton onClick={() => onAction('withdraw')} disabled={amount <= 0} className="bg-gray-600 hover:bg-gray-500">Withdraw {symbol}</ActionButton>
                </div>
            )}
        </div>
    );
};

const MintRepayForm = ({ type, onAction }) => {
    const isMint = type === 'mint';
    return (
        <div>
            <label htmlFor={type} className="block text-sm font-medium text-gray-300 mb-1">{isMint ? 'Mint Amount' : 'Repay Amount'}</label>
            <div className="flex">
                <input id={type} type="number" placeholder="0.00" className="flex-grow bg-gray-900 border border-gray-600 rounded-l-md p-2 focus:ring-blue-500 focus:border-blue-500" />
                <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-600 bg-gray-700 text-gray-300 text-sm">tGHSX</span>
            </div>
            <ActionButton onClick={() => onAction(type)} className="w-full mt-3">{isMint ? 'Mint tGHSX' : 'Repay Debt'}</ActionButton>
        </div>
    );
};


const ActionModal = ({ modalType, onClose, provider, onSuccess }) => {
    const [amount, setAmount] = useState('');
    const [status, setStatus] = useState({ loading: false, error: null, success: null });

    const titles = {
        deposit: 'Deposit USDC',
        withdraw: 'Withdraw USDC',
        mint: 'Mint tGHSX',
        repay: 'Repay tGHSX',
        'auto-mint': 'Auto-Mint tGHSX',
    };

    const handleConfirm = async () => {
        if (!provider || (!amount && modalType !== 'auto-mint')) {
            setStatus({ loading: false, error: "Amount is required.", success: null });
            return;
        }

        if (modalType !== 'auto-mint' && (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)) {
            setStatus({ loading: false, error: "Please enter a valid amount greater than zero.", success: null });
            return;
        }
        
        setStatus({ loading: true, error: null, success: "Preparing transaction..." });

        try {
            const signer = provider.getSigner();
            const vaultContract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);
            const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
            let tx;

            const amountStr = String(amount || '0');
            const decimals = 6; // USDC and tGHSX use 6 decimals
            const parsedAmount = ethers.utils.parseUnits(amountStr, decimals);
            
            console.log(`Action: ${modalType}, Amount: ${amountStr}, Parsed Amount (wei): ${parsedAmount.toString()}`);

            // FIX: Implement pre-flight checks for balance and allowance on deposit/repay
            if (modalType === 'deposit' || modalType === 'repay') {
                const balance = await usdcContract.balanceOf(signer.getAddress());
                if (balance.lt(parsedAmount)) {
                    setStatus({ loading: false, error: `Insufficient USDC balance. You have ${ethers.utils.formatUnits(balance, decimals)} USDC.`, success: null });
                    return;
                }
            }
            
            if (modalType === 'deposit') {
                setStatus({ loading: true, error: null, success: "Waiting for approval..." });
                const approveTx = await usdcContract.approve(VAULT_ADDRESS, parsedAmount);
                await approveTx.wait();

                setStatus({ loading: true, error: null, success: "Approval successful. Depositing..." });
                tx = await vaultContract.depositCollateral(USDC_ADDRESS, parsedAmount);

            } else if (modalType === 'withdraw') {
                tx = await vaultContract.withdrawCollateral(USDC_ADDRESS, parsedAmount);

            } else if (modalType === 'mint') {
                tx = await vaultContract.mintTokens(USDC_ADDRESS, parsedAmount);

            } else if (modalType === 'repay') {
                 setStatus({ loading: true, error: null, success: "Waiting for approval..." });
                const approveTx = await usdcContract.approve(VAULT_ADDRESS, parsedAmount);
                await approveTx.wait();
                
                setStatus({ loading: true, error: null, success: "Approval successful. Repaying debt..." });
                tx = await vaultContract.burnTokens(USDC_ADDRESS, parsedAmount);

            } else if (modalType === 'auto-mint') {
                tx = await vaultContract.autoMint(USDC_ADDRESS);

            } else {
                throw new Error("Invalid action type");
            }

            setStatus({ loading: true, error: null, success: "Transaction sent..." });
            await tx.wait();

            setStatus({ loading: false, error: null, success: "Transaction successful!" });
            onSuccess();
            setTimeout(() => onClose(), 2000);

        } catch (err) {
            console.error("Transaction failed:", err);
            
            let friendlyMessage = "An unknown error occurred. Please check the console.";
            const errorString = JSON.stringify(err);

            if (err.code === 'UNPREDICTABLE_GAS_LIMIT' || err.code === -32603 || err.code === 'CALL_EXCEPTION') {
                 if (errorString.includes('0xe450d38c')) { // PriceStale custom error signature
                    friendlyMessage = "Transaction failed: The oracle price for this asset is outdated. Please wait for the price to update and try again.";
                } else {
                    friendlyMessage = "Cannot estimate gas. The transaction is likely to fail. This could be due to insufficient funds, an on-chain issue like stale prices, or another contract error.";
                }
            } else if (err.reason) {
                friendlyMessage = `Transaction failed: ${err.reason}`;
            } else if (errorString.includes("PriceStale")) {
                 friendlyMessage = "Transaction failed: The oracle price for this asset is outdated.";
            }

            setStatus({ 
                loading: false, 
                error: friendlyMessage, 
                success: null 
            });
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
                            <label htmlFor="amount" className="block text-sm font-medium text-gray-300 mb-1">Amount</label>
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

                    {status.loading && (
                        <div className="text-center text-blue-400 flex items-center justify-center">
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            {status.success || 'Processing transaction...'}
                        </div>
                    )}

                    {status.success && !status.loading && (
                        <div className="text-center text-green-400">{status.success}</div>
                    )}

                    {status.error && (
                        <div className="text-center text-red-400 text-sm whitespace-pre-wrap">{status.error}</div>
                    )}
                </div>
                <div className="p-4 bg-gray-900/50 rounded-b-lg flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        disabled={status.loading}
                        className="px-4 py-2 rounded-md text-sm font-medium bg-gray-600 hover:bg-gray-500 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={status.loading}
                        className="px-4 py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-wait"
                    >
                        {status.loading ? 'Processing...' : 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Utility Components ---

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
