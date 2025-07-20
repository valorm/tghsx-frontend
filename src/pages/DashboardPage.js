import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, Droplet, Zap, Clock, Shield, LogOut, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, Github, Twitter, Send, MessageSquare, Inbox } from 'lucide-react';
import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.esm.js";

// --- LIVE API & WEB3 CONFIG ---
const API_BASE_URL = 'https://tghsx.onrender.com'; 
const VAULT_ADDRESS = '0xF681Ba510d3C93A49a7AB2d02d9697BB2B0091FE';
const AMOY_CHAIN_ID = '0x13882'; // 80002 in hex
const LIQUIDATION_THRESHOLD = 125;

const DEPLOYMENT_DATA = {
  USDC: '0xAC2f1680f2705d3Dd314534Bf24b424ccBC8D8f5',
  WETH: '0xF5FcbF9D665DC89b2d18f87a6994F04849dC80E5',
  WBTC: '0x6F74072d5AF1132B13c5a7226E41aAC1f8DBBdae',
  WMATIC: '0x13c09eAa18d75947A5426CaeDdEb65922400028c'
};

// --- SMART CONTRACT ABIs ---
const VAULT_ABI = [
  "function depositCollateral(address collateral, uint256 amount)", "function withdrawCollateral(address collateral, uint256 amount)", "function mintTokens(address collateral, uint256 amount)", "function burnTokens(address collateral, uint256 amount)", "function autoMint(address collateral)", "function getUserPosition(address user, address collateral) view returns (uint256, uint256, uint256, uint256, bool, uint256)", "function getUserMintStatus(address user) view returns (uint256, uint256, uint256, uint256, uint256, uint256)", "function collateralConfigs(address collateral) view returns (bool, uint128, uint64, uint32, uint32, uint8)", "event CollateralDeposited(address indexed user, address indexed collateral, uint256 amount)", "event CollateralWithdrawn(address indexed user, address indexed collateral, uint256 amount)", "event TokensMinted(address indexed user, address indexed collateral, uint256 amount)", "event TokensBurned(address indexed user, address indexed collateral, uint256 amount)", "event AutoMintExecuted(address indexed user, uint256 amount, uint256 bonus)"
];
const ERC20_ABI = [ "function approve(address spender, uint256 amount) returns (bool)", "function allowance(address owner, address spender) view returns (uint256)" ];

// --- Helper Functions ---
const COLORS = { HEALTHY: '#22c55e', WARNING: '#f59e0b', DANGER: '#ef4444' };
const formatCurrency = (v, d=2) => !isNaN(parseFloat(v)) ? new Intl.NumberFormat('en-US', {style:'currency', currency:'USD', minimumFractionDigits:d, maximumFractionDigits:d}).format(v) : '$0.00';
const formatNumber = (v) => !isNaN(parseFloat(v)) ? parseFloat(v).toLocaleString() : '0';
const getHealthColor = (r) => r >= 200 ? COLORS.HEALTHY : (r >= 150 ? COLORS.WARNING : COLORS.DANGER);

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

    const [vaultOverview, setVaultOverview] = useState(null);
    const [mintStatus, setMintStatus] = useState(null);
    const [oraclePrice, setOraclePrice] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [protocolHealth, setProtocolHealth] = useState(null);
    const [pendingRequests, setPendingRequests] = useState([]); // FIX: State for pending requests

    const connectWallet = useCallback(async () => {
        if (typeof window.ethereum !== 'undefined') {
            try {
                const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
                const network = await web3Provider.getNetwork();
                if (network.chainId !== 80002) {
                    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: AMOY_CHAIN_ID }] }).catch(async (e) => { if (e.code === 4902) await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: AMOY_CHAIN_ID, chainName: 'Polygon Amoy', rpcUrls: ['https://rpc-amoy.polygon.technology'], nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 }, blockExplorerUrls: ['https://amoy.polygonscan.com'] }]}); else throw e; });
                }
                await web3Provider.send('eth_requestAccounts', []);
                const signer = web3Provider.getSigner();
                setProvider(web3Provider);
                setWalletAddress(await signer.getAddress());
            } catch (err) {
                setError("Wallet connection failed. Please ensure you are on the Amoy network.");
            }
        } else setError("MetaMask is not installed.");
    }, []);
    
    useEffect(() => { connectWallet(); }, [connectWallet]);

    const fetchData = useCallback(async () => {
        if (!authToken || !walletAddress) return;
        setIsLoading(true);
        setError(null);
        try {
            const authHeader = { 'Authorization': `Bearer ${authToken}` };
            const defaultCollateral = DEPLOYMENT_DATA.USDC;

            const responses = await Promise.all([
                fetch(`${API_BASE_URL}/vault/status/${defaultCollateral}`, { headers: authHeader }),
                fetch(`${API_BASE_URL}/vault/mint-status`, { headers: authHeader }),
                fetch(`${API_BASE_URL}/protocol/health`),
                fetch(`${API_BASE_URL}/transactions?page=1&limit=5`, { headers: authHeader }),
                fetch(`${API_BASE_URL}/mint/requests`, { headers: authHeader }) // FIX: Fetch user's pending requests
            ]);

            for (const res of responses) {
                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.detail || `Failed to fetch data from ${res.url}`);
                }
            }
            
            const [vaultData, mintStatusData, healthData, txData, requestsData] = await Promise.all(responses.map(res => res.json()));

            setVaultOverview(vaultData);
            setMintStatus(mintStatusData);
            setProtocolHealth(healthData);
            setTransactions(txData.transactions || []);
            setPendingRequests(requestsData || []);
            setLastRefreshed(new Date());
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [authToken, walletAddress]);

    useEffect(() => { if (authToken && walletAddress) fetchData(); }, [authToken, walletAddress, fetchData]);

    useEffect(() => {
        if (!provider || !walletAddress) return;
        const contract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, provider);
        const onEvent = (user) => { if (user?.toLowerCase() === walletAddress.toLowerCase()) fetchData(); };
        const events = ["CollateralDeposited", "CollateralWithdrawn", "TokensMinted", "TokensBurned", "AutoMintExecuted"];
        events.forEach(event => contract.on(event, onEvent));
        return () => events.forEach(event => contract.off(event, onEvent));
    }, [provider, walletAddress, fetchData]);

    const handleAction = (type, collateral) => setActiveModal({ type, collateral });
    const closeModal = () => setActiveModal(null);
    const handleLogout = () => { localStorage.removeItem('authToken'); setAuthToken(null); window.location.href = '/'; };
    
    const parsedRatio = useMemo(() => parseFloat(vaultOverview?.collateralRatio), [vaultOverview]);
    
    if (!authToken) return <AuthWall message="Please log in." />;
    if (!walletAddress) return <AuthWall message="Please connect wallet." onAction={connectWallet} actionText="Connect" />;
    if (isLoading) return <LoadingSpinner />;
    if (error) return <ErrorMessage message={error} onRetry={fetchData} />;

    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans flex flex-col">
            <Header walletAddress={walletAddress} onLogout={handleLogout} />
            <main className="flex-grow p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold">Dashboard</h1>
                    <div className="flex items-center space-x-4">
                        <button onClick={fetchData} className="flex items-center text-sm text-gray-400 hover:text-white"><RefreshCw className="w-4 h-4 mr-2" />Last updated: {lastRefreshed.toLocaleTimeString()}</button>
                        <div className="flex rounded-md bg-gray-800">
                           <button onClick={() => setView('dashboard')} className={`px-3 py-1.5 text-sm font-medium rounded-l-md ${view === 'dashboard' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}>Overview</button>
                           <button onClick={() => setView('manage')} className={`px-3 py-1.5 text-sm font-medium rounded-r-md ${view === 'manage' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}>Manage</button>
                        </div>
                    </div>
                </div>
                {view === 'dashboard' ? <DashboardView {...{vaultOverview, mintStatus, oraclePrice, transactions, protocolHealth, pendingRequests, onAction, parsedRatio}} /> : <ManageVaultView {...{provider, walletAddress, onAction}} />}
            </main>
            <Footer />
            {activeModal && <ActionModal modalConfig={activeModal} onClose={closeModal} provider={provider} onSuccess={fetchData} />}
        </div>
    );
}

// --- Sub-Components ---
const Header = ({ walletAddress, onLogout }) => ( <header className="bg-gray-900/80 backdrop-blur-sm sticky top-0 z-40 border-b border-gray-700"> <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"> <div className="flex items-center justify-between h-16"> <div className="flex items-center"> <Droplet className="h-8 w-8 text-blue-500" /> <span className="ml-3 text-xl font-bold">tGHSX Protocol</span> </div> <div className="flex items-center space-x-4"> <div className="bg-gray-800 px-4 py-2 rounded-md text-sm font-mono">{walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : '...'}</div> <button onClick={onLogout} className="p-2 rounded-md hover:bg-gray-700"><LogOut className="h-5 w-5 text-gray-400" /></button> </div> </div> </div> </header> );
const Footer = () => ( <footer className="py-6 border-t border-gray-800 mt-8"> <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-400"> <div className="flex justify-center space-x-6 mb-4"> <a href="https://github.com/valorm/tghsx" target="_blank" rel="noopener noreferrer" className="hover:text-white"><Github /></a> <a href="https://t.me/tghsstablecoin" target="_blank" rel="noopener noreferrer" className="hover:text-white"><Send /></a> <a href="https://discord.com/invite/NPtrctnJhu" target="_blank" rel="noopener noreferrer" className="hover:text-white"><MessageSquare /></a> <a href="https://x.com/tokenGHC" target="_blank" rel="noopener noreferrer" className="hover:text-white"><Twitter /></a> </div> <div className="text-xs space-x-4"> <a href="https://amoy.polygonscan.com/address/0xb04093d34F5feC6DE685B8684F3e2086dd866a50#code" target="_blank" rel="noopener noreferrer" className="hover:text-white">Token Contract</a> <span className="text-gray-600">|</span> <a href="https://amoy.polygonscan.com/address/0xF681Ba510d3C93A49a7AB2d02d9697BB2B0091FE#code" target="_blank" rel="noopener noreferrer" className="hover:text-white">Vault Contract</a> </div> </div> </footer> );

const DashboardView = ({ vaultOverview, mintStatus, oraclePrice, transactions, protocolHealth, pendingRequests, onAction, parsedRatio }) => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
            <VaultOverviewCard {...vaultOverview} onAction={onAction} parsedRatio={parsedRatio} />
            <ProtocolHealthCard {...protocolHealth} />
            <PendingRequestsView requests={pendingRequests} /> {/* FIX: Display pending requests */}
        </div>
        <div className="space-y-6">
            <MintStatusCard {...mintStatus} />
            <OraclePriceCard {...oraclePrice} />
            <TransactionHistory transactions={transactions} />
        </div>
    </div>
);

const VaultOverviewCard = ({ collateralValueUSD, mintedAmount, collateralRatio, isLiquidatable, onAction, parsedRatio }) => ( <Card> <CardHeader> <h2 className="text-xl font-semibold">📊 Vault Overview (USDC)</h2> {isLiquidatable && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full">At Risk</span>} </CardHeader> <div className="p-6"> <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center"> <InfoBox icon={<DollarSign />} title="Collateral Value" value={formatCurrency(collateralValueUSD)} /> <InfoBox icon={<Droplet />} title="Minted tGHSX" value={formatNumber(mintedAmount)} /> <InfoBox icon={<Shield />} title="Collateral Ratio" value={collateralRatio} valueColor={getHealthColor(parsedRatio)} /> </div> <div className="mt-8"> <h3 className="text-lg font-medium text-gray-300 mb-4 text-center">⚡ Quick Actions (USDC)</h3> <div className="grid grid-cols-2 sm:grid-cols-5 gap-3"> <ActionButton onClick={() => onAction('deposit', DEPLOYMENT_DATA.USDC)}>Deposit</ActionButton> <ActionButton onClick={() => onAction('withdraw', DEPLOYMENT_DATA.USDC)}>Withdraw</ActionButton> <ActionButton onClick={() => onAction('mint', DEPLOYMENT_DATA.USDC)}>Mint</ActionButton> <ActionButton onClick={() => onAction('repay', DEPLOYMENT_DATA.USDC)}>Repay</ActionButton> <ActionButton onClick={() => onAction('auto-mint', DEPLOYMENT_DATA.USDC)} className="bg-purple-600 hover:bg-purple-700 col-span-2 sm:col-span-1">Auto-Mint</ActionButton> </div> </div> </div> </Card> );
const ProtocolHealthCard = ({ totalValueLockedUSD, totalDebt, globalCollateralizationRatio }) => ( <Card> <CardHeader><h2 className="text-xl font-semibold">🌐 Protocol Health</h2></CardHeader> <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6"> <div className="space-y-4"> <InfoBox icon={<DollarSign />} title="Total Value Locked (TVL)" value={formatCurrency(totalValueLockedUSD)} alignment="left" /> <InfoBox icon={<Droplet />} title="Total Debt (tGHSX)" value={formatCurrency(totalDebt)} alignment="left" /> <InfoBox icon={<Shield />} title="Global Collateral Ratio" value={`${globalCollateralizationRatio}%`} valueColor={getHealthColor(parseFloat(globalCollateralizationRatio))} alignment="left" /> </div> </div> </Card> );
const MintStatusCard = ({ dailyMinted, remainingDaily, cooldownRemaining }) => { const total = parseFloat(dailyMinted) + parseFloat(remainingDaily); const progress = total > 0 ? (parseFloat(dailyMinted) / total) * 100 : 0; return ( <Card> <CardHeader><h2 className="text-xl font-semibold">📈 Mint Status</h2></CardHeader> <div className="p-6 space-y-4"> <div> <div className="flex justify-between text-sm mb-1 text-gray-400"> <span>Daily Minted</span> <span>{formatNumber(dailyMinted)} / {formatNumber(total)} tGHSX</span> </div> <div className="w-full bg-gray-700 rounded-full h-2.5"><div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div></div> </div> <div className="flex justify-between items-center text-sm"> <span className="text-gray-400">Cooldown:</span> {cooldownRemaining > 0 ? ( <span className="font-medium text-amber-400 flex items-center"><Clock className="w-4 h-4 mr-1.5" /> {Math.ceil(cooldownRemaining / 60)}m left</span> ) : ( <span className="font-medium text-green-400 flex items-center"><Zap className="w-4 h-4 mr-1.5" /> Ready</span> )} </div> </div> </Card> );};
const OraclePriceCard = ({ eth_usd_price, decimals, timestamp }) => { const lastUpdate = timestamp ? new Date(timestamp * 1000).toLocaleString() : 'N/A'; const price = eth_usd_price && decimals ? formatCurrency(eth_usd_price / Math.pow(10, decimals)) : '...'; return ( <Card> <CardHeader><h2 className="text-xl font-semibold">🔮 Oracle Price</h2></CardHeader> <div className="p-6 text-center"> <p className="text-3xl font-bold text-blue-400">{price}</p> <p className="text-sm text-gray-400 mt-1">per ETH</p> <p className="text-xs text-gray-500 mt-2">Last Update: {lastUpdate}</p> </div> </Card> );};
const TransactionHistory = ({ transactions }) => ( <Card> <CardHeader><h2 className="text-xl font-semibold">📜 Recent Activity</h2></CardHeader> <div className="p-4"> <ul className="space-y-3"> {transactions?.length > 0 ? transactions.map(tx => ( <li key={tx.tx_hash} className="flex items-center justify-between text-sm"> <div> <p className="font-medium">{tx.event_name}</p> <p className="font-mono text-xs text-gray-500">{tx.tx_hash.slice(0, 10)}...</p> </div> <p className="text-gray-400">{new Date(tx.block_timestamp).toLocaleTimeString()}</p> </li> )) : (<p className="text-center text-gray-500 py-4">No recent transactions.</p>)} </ul> </div> </Card> );

// FIX: New component to display pending mint requests
const PendingRequestsView = ({ requests }) => (
    <Card>
        <CardHeader><h2 className="text-xl font-semibold">📬 Your Mint Requests</h2></CardHeader>
        <div className="p-4 divide-y divide-gray-700">
            {requests?.length > 0 ? requests.map(req => (
                <div key={req.id} className="py-3 flex items-center justify-between text-sm">
                    <div>
                        <p className="font-semibold text-gray-200">{formatNumber(req.mint_amount)} tGHSX</p>
                        <p className="text-xs text-gray-400">Collateral: {req.collateral_address.slice(0, 6)}...{req.collateral_address.slice(-4)}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        req.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        req.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                        'bg-red-500/20 text-red-400'
                    }`}>{req.status}</span>
                </div>
            )) : (<p className="text-center text-gray-500 py-4">No pending mint requests.</p>)}
        </div>
    </Card>
);

const ManageVaultView = ({ provider, walletAddress, onAction }) => { const [collaterals, setCollaterals] = useState([]); const [isLoading, setIsLoading] = useState(true); useEffect(() => { const fetchCollaterals = async () => { if (!provider || !walletAddress) return; setIsLoading(true); try { const contract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, provider); const data = []; for (const [symbol, address] of Object.entries(DEPLOYMENT_DATA)) { const pos = await contract.getUserPosition(walletAddress, address); if (pos.collateralAmount.gt(0)) { const cfg = await contract.collateralConfigs(address); data.push({ name: symbol, symbol, address, amount: ethers.utils.formatUnits(pos.collateralAmount, cfg.decimals), valueUSD: ethers.utils.formatUnits(pos.collateralValue, 6), logo: `https://placehold.co/32x32/1f2937/9ca3af?text=${symbol}` }); } } setCollaterals(data); } catch (e) { console.error("Failed to fetch positions:", e); } finally { setIsLoading(false); } }; fetchCollaterals(); }, [provider, walletAddress]); if (isLoading) return <div className="text-center p-8"><RefreshCw className="w-8 h-8 mx-auto animate-spin" /></div>; return ( <div className="space-y-6"> <Card> <CardHeader><h2 className="text-xl font-semibold">⚙️ Your Collateral Positions</h2></CardHeader> <div className="p-6"> <div className="bg-gray-800 rounded-lg divide-y divide-gray-700"> {collaterals.length > 0 ? collaterals.map(c => <CollateralRow key={c.symbol} {...c} onAction={onAction} />) : <p className="p-4 text-center text-gray-500">No collateral deposited.</p>} </div> </div> </Card> </div> ); };
const CollateralRow = ({ name, symbol, amount, valueUSD, logo, onAction, address }) => { const [expanded, setExpanded] = useState(false); return ( <div className="p-4"> <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}> <div className="flex items-center"> <img src={logo} alt={name} className="w-8 h-8 rounded-full mr-4" /> <div> <p className="font-semibold">{name}</p> <p className="text-sm text-gray-400">{formatNumber(amount)} {symbol}</p> </div> </div> <div className="text-right flex items-center"> <div> <p className="font-semibold">{formatCurrency(valueUSD)}</p> <p className="text-sm text-gray-400">Value</p> </div> <button className="ml-4 p-1 rounded-md hover:bg-gray-700">{expanded ? <ChevronUp /> : <ChevronDown />}</button> </div> </div> {expanded && ( <div className="mt-4 pt-4 border-t border-gray-700 flex justify-end space-x-3"> <ActionButton onClick={() => onAction('deposit', address)}>Deposit {symbol}</ActionButton> <ActionButton onClick={() => onAction('withdraw', address)} disabled={parseFloat(amount) <= 0} className="bg-gray-600 hover:bg-gray-500">Withdraw {symbol}</ActionButton> </div> )} </div> ); };

// FIX: Integrate backend validation for auto-mint
const ActionModal = ({ modalConfig, onClose, provider, onSuccess }) => {
    const [amount, setAmount] = useState('');
    const [status, setStatus] = useState({ loading: false, error: null, success: null });
    const { type, collateral } = modalConfig;
    const [authToken] = useState(localStorage.getItem('authToken'));

    const titles = { deposit: 'Deposit', withdraw: 'Withdraw', mint: 'Mint tGHSX', repay: 'Repay tGHSX', 'auto-mint': 'Auto-Mint tGHSX' };

    const handleConfirm = async () => {
        if (!provider || (!amount && type !== 'auto-mint')) return setStatus({ ...status, error: "Amount is required." });
        if (type !== 'auto-mint' && (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)) return setStatus({ ...status, error: "Please enter a valid amount > 0." });

        setStatus({ loading: true, error: null, success: "Preparing..." });
        try {
            const signer = provider.getSigner();
            const contract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);
            let tx;

            if (type === 'auto-mint') {
                setStatus({ loading: true, error: null, success: "Validating..." });
                const res = await fetch(`${API_BASE_URL}/mint/auto`, { method: 'POST', headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ collateral_address: collateral }) });
                if (!res.ok) { const err = await res.json(); throw new Error(err.detail || 'Auto-mint validation failed'); }
                setStatus({ loading: true, error: null, success: "Sending transaction..." });
                tx = await contract.autoMint(collateral);
            } else {
                // Handle manual actions
                const cfg = await contract.collateralConfigs(collateral);
                const decimals = type === 'mint' || type === 'repay' ? 6 : cfg.decimals;
                const parsedAmt = ethers.utils.parseUnits(amount, decimals);
                
                if (type === 'deposit') {
                    const token = new ethers.Contract(collateral, ERC20_ABI, signer);
                    setStatus({ loading: true, error: null, success: "Approving..." });
                    await (await token.approve(VAULT_ADDRESS, parsedAmt)).wait();
                    setStatus({ loading: true, error: null, success: "Depositing..." });
                    tx = await contract.depositCollateral(collateral, parsedAmt);
                } else if (type === 'withdraw') tx = await contract.withdrawCollateral(collateral, parsedAmt);
                else if (type === 'mint') tx = await contract.mintTokens(collateral, parsedAmt);
                else if (type === 'repay') tx = await contract.burnTokens(collateral, parsedAmt);
            }

            await tx.wait();
            setStatus({ loading: false, error: null, success: "Success!" });
            onSuccess();
            setTimeout(onClose, 2000);
        } catch (err) {
            setStatus({ loading: false, error: err?.reason || err?.data?.message || err.message || "Transaction failed.", success: null });
        }
    };

    return ( <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}> <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}> <div className="p-6 border-b border-gray-700"><h3 className="text-xl font-semibold">{titles[type]}</h3></div> <div className="p-6 space-y-4"> {type !== 'auto-mint' && ( <div> <label htmlFor="amount" className="block text-sm font-medium text-gray-300 mb-1">Amount</label> <input type="number" id="amount" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="w-full bg-gray-900 border border-gray-600 rounded-md p-2 focus:ring-blue-500" /> </div> )} {status.loading && (<div className="text-center text-blue-400 flex items-center justify-center"><RefreshCw className="w-4 h-4 mr-2 animate-spin" />{status.success || 'Processing...'}</div>)} {status.success && !status.loading && (<div className="text-center text-green-400">{status.success}</div>)} {status.error && (<div className="text-center text-red-400 text-sm">{status.error}</div>)} </div> <div className="p-4 bg-gray-900/50 rounded-b-lg flex justify-end space-x-3"> <button onClick={onClose} disabled={status.loading} className="px-4 py-2 rounded-md text-sm font-medium bg-gray-600 hover:bg-gray-500 disabled:opacity-50">Cancel</button> <button onClick={handleConfirm} disabled={status.loading} className="px-4 py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50">{status.loading ? 'Processing...' : 'Confirm'}</button> </div> </div> </div> );
};

// --- Utility Components ---
const Card = ({ children }) => (<div className="bg-gray-800/50 rounded-xl shadow-lg border border-gray-700/50 backdrop-blur-sm">{children}</div>);
const CardHeader = ({ children }) => (<div className="p-4 border-b border-gray-700 flex justify-between items-center">{children}</div>);
const InfoBox = ({ icon, title, value, valueColor, alignment = 'center' }) => ( <div className={`flex items-start space-x-3 ${alignment === 'left' ? 'text-left' : 'flex-col sm:flex-row sm:text-left'}`}> <div className="text-blue-500 bg-blue-500/10 p-2 rounded-lg">{React.cloneElement(icon, { className: "w-6 h-6" })}</div> <div> <p className="text-sm text-gray-400">{title}</p> <p className={`text-2xl font-bold ${valueColor || 'text-white'}`}>{value}</p> </div> </div> );
const ActionButton = ({ onClick, children, className = '', disabled=false }) => ( <button onClick={onClick} disabled={disabled} className={`w-full px-4 py-2.5 rounded-md text-sm font-semibold transition-all duration-200 ease-in-out transform hover:scale-105 ${disabled ? 'bg-gray-600 cursor-not-allowed' : `bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/50 ${className}`}`}>{children}</button> );
const LoadingSpinner = () => (<div className="flex items-center justify-center min-h-screen bg-gray-900"><div className="flex flex-col items-center"><RefreshCw className="w-12 h-12 text-blue-500 animate-spin" /><p className="mt-4 text-lg">Loading Protocol Data...</p></div></div>);
const ErrorMessage = ({ message, onRetry }) => (<div className="flex items-center justify-center min-h-screen bg-gray-900"><div className="bg-gray-800 p-8 rounded-lg text-center shadow-xl"><AlertTriangle className="w-12 h-12 text-red-500 mx-auto" /><h2 className="mt-4 text-2xl font-bold">An Error Occurred</h2><p className="mt-2">{message}</p><button onClick={onRetry} className="mt-6 px-5 py-2.5 rounded-md text-sm font-semibold bg-blue-600 hover:bg-blue-700">Try Again</button></div></div>);
const AuthWall = ({ message, onAction, actionText }) => (<div className="flex items-center justify-center min-h-screen bg-gray-900"><div className="bg-gray-800 p-8 rounded-lg text-center shadow-xl"><Shield className="w-12 h-12 text-blue-500 mx-auto" /><h2 className="mt-4 text-2xl font-bold">Authentication Required</h2><p className="mt-2">{message}</p>{onAction && (<button onClick={onAction} className="mt-6 px-5 py-2.5 rounded-md text-sm font-semibold bg-blue-600 hover:bg-blue-700">{actionText}</button>)}</div></div>);
