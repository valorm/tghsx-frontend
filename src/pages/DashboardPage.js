
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, Droplet, Zap, Clock, Shield, LogOut, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, Github, Twitter, Send, MessageSquare } from 'lucide-react';
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
  "function allowance(address owner, address spender) view returns (uint256)"
];

// --- Helper Functions & Constants ---
const COLORS = { HEALTHY: '#22c55e', WARNING: '#f59e0b', DANGER: '#ef4444' };
const formatCurrency = (value, decimals = 2) => {
  const number = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(number)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(number);
};
const formatNumber = value => {
  const number = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(number)) return '0';
  return number.toLocaleString();
};
const getHealthColor = ratio => (ratio >= 200 ? COLORS.HEALTHY : ratio >= 150 ? COLORS.WARNING : COLORS.DANGER);

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

  // --- Collateral list & selection ---
  const [collaterals, setCollaterals] = useState([]);
  const [selectedCollateral, setSelectedCollateral] = useState('');

  // --- Connect wallet ---
  const connectWallet = useCallback(async () => {
    if (typeof window.ethereum === 'undefined') {
      setError('MetaMask not installed.');
      return;
    }
    try {
      const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
      await web3Provider.send('eth_requestAccounts', []);
      const signer = web3Provider.getSigner();
      const address = await signer.getAddress();
      setProvider(web3Provider);
      setWalletAddress(address);
    } catch (err) {
      setError('Wallet connection failed.');
    }
  }, []);
  useEffect(() => { connectWallet(); }, [connectWallet]);

  // --- Fetch enabled collaterals ---
  useEffect(() => {
    if (!authToken) return;
    fetch(`${API_BASE_URL}/collaterals`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then(res => res.json())
      .then(list => {
        setCollaterals(list);
        if (list.length) setSelectedCollateral(list[0].address);
      })
      .catch(console.error);
  }, [authToken]);

  // --- Fetch dashboard data ---
  const fetchData = useCallback(async () => {
    if (!authToken || !walletAddress || !selectedCollateral) return;
    setIsLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${authToken}` };
      const [vaultRes, mintRes, oracleRes, txRes, healthRes] = await Promise.all([
        fetch(`${API_BASE_URL}/vault/status/${selectedCollateral}`, { headers }),
        fetch(`${API_BASE_URL}/vault/mint-status`, { headers }),
        fetch(`${API_BASE_URL}/oracle/price`, { headers }),
        fetch(`${API_BASE_URL}/transactions?page=1&limit=5`, { headers }),
        fetch(`${API_BASE_URL}/protocol/health`, { headers })
      ]);
      if (![vaultRes, mintRes, oracleRes, txRes, healthRes].every(r => r.ok)) {
        throw new Error('Failed to fetch dashboard data.');
      }
      setVaultOverview(await vaultRes.json());
      setMintStatus(await mintRes.json());
      setOraclePrice(await oracleRes.json());
      setTransactions(await txRes.json());
      setProtocolHealth(await healthRes.json());
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [authToken, walletAddress, selectedCollateral]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = actionType => setActiveModal(actionType);
  const closeModal = () => setActiveModal(null);
  const handleLogout = () => {
    localStorage.removeItem('authToken');
    setAuthToken(null);
    setWalletAddress(null);
    setProvider(null);
    window.location.href = '/';
  };
  const parsedRatio = useMemo(() => parseFloat(vaultOverview?.collateralRatio), [vaultOverview]);

  if (!authToken) return <AuthWall message="Please log in to view the dashboard." />;
  if (!walletAddress) return <AuthWall message="Please connect your wallet." onAction={connectWallet} actionText="Connect Wallet" />;
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={fetchData} />;

  return (
    <div className="bg-gray-900 text-white min-h-screen flex flex-col">
      <Header walletAddress={walletAddress} onLogout={handleLogout} />
      <main className="flex-grow p-6 max-w-7xl mx-auto w-full">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <div className="flex items-center space-x-4">
            <button onClick={fetchData} className="flex items-center text-sm text-gray-400 hover:text-white">
              <RefreshCw className="w-4 h-4 mr-2" />Last: {lastRefreshed.toLocaleTimeString()}
            </button>
            <div className="flex rounded bg-gray-800">
              <button onClick={() => setView('dashboard')} className={`${view === 'dashboard' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'} px-3 py-1.5 rounded-l`}>Overview</button>
              <button onClick={() => setView('manage')} className={`${view === 'manage' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'} px-3 py-1.5 rounded-r`}>Manage</button>
            </div>
          </div>
        </div>

        {view === 'dashboard' ? (
          <DashboardView
            vaultOverview={vaultOverview}
            mintStatus={mintStatus}
            oraclePrice={oraclePrice}
            transactions={transactions?.transactions}
            protocolHealth={protocolHealth}
            onAction={handleAction}
            parsedRatio={parsedRatio}
          />
        ) : (
          <ManageVaultView
            vaultOverview={vaultOverview}
            collaterals={collaterals}
            selectedCollateral={selectedCollateral}
            onSelectCollateral={setSelectedCollateral}
            onAction={handleAction}
            parsedRatio={parsedRatio}
          />
        )}
      </main>
      <Footer />
      {activeModal && (
        <ActionModal
          modalType={activeModal}
          onClose={closeModal}
          provider={provider}
          onSuccess={fetchData}
          collateralAddress={selectedCollateral}
        />
      )}
    </div>
  );
}

// --- Header & Footer ---
const Header = ({ walletAddress, onLogout }) => (
  <header className="bg-gray-900/80 sticky top-0 z-40 border-b border-gray-700">
    <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
      <div className="flex items-center space-x-2">
        <Droplet className="h-8 w-8 text-blue-500" />
        <span className="text-xl font-bold">tGHSX Protocol</span>
      </div>
      <div className="flex items-center space-x-4">
        <div className="bg-gray-800 px-3 py-1 rounded text-sm font-mono text-gray-300">
          {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
        </div>
        <button onClick={onLogout} className="p-2 hover:bg-gray-700 rounded">
          <LogOut className="w-5 h-5 text-gray-400" />
        </button>
      </div>
    </div>
  </header>
);
const Footer = () => (
  <footer className="py-6 border-t border-gray-800 text-center text-gray-400">
    <div className="flex justify-center space-x-6 mb-4">
      <a href="#"><Github /></a>
      <a href="#"><Send /></a>
      <a href="#"><MessageSquare /></a>
      <a href="#"><Twitter /></a>
    </div>
    <div className="text-xs space-x-4">
      <a href="#">TGHSXToken</a>|
      <a href="#">CollateralVault</a>
    </div>
  </footer>
);

// --- Dashboard View & Cards ---
const DashboardView = ({ vaultOverview, mintStatus, oraclePrice, transactions, protocolHealth, onAction, parsedRatio }) => (
  <div className="grid lg:grid-cols-3 gap-6">
    <div className="lg:col-span-2 space-y-6">
      <VaultOverviewCard {...vaultOverview} onAction={onAction} parsedRatio={parsedRatio} />
      <ProtocolHealthCard {...protocolHealth} />
    </div>
    <div className="space-y-6">
      <MintStatusCard {...mintStatus} />
      <OraclePriceCard {...oraclePrice} />
      <TransactionHistory transactions={transactions} />
    </div>
  </div>
);
const VaultOverviewCard = ({ collateralValueUSD, mintedAmount, collateralRatio, isLiquidatable, onAction, parsedRatio }) => (
  <Card>
    <CardHeader>
      <h2 className="text-xl font-semibold">📊 Your Vault Overview</h2>
      {isLiquidatable && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">At Risk</span>}
    </CardHeader>
    <div className="p-6 grid sm:grid-cols-3 gap-6 text-center">
      <InfoBox icon={<DollarSign />} title="Collateral Value" value={formatCurrency(collateralValueUSD)} />
      <InfoBox icon={<Droplet />} title="Minted tGHSX" value={formatNumber(mintedAmount)} />
      <InfoBox icon={<Shield />} title="Collateral Ratio" value={`${collateralRatio}%`} valueColor={getHealthColor(parsedRatio)} />
    </div>
    <div className="p-6">
      <h3 className="text-lg font-medium text-gray-300 mb-4 text-center">⚡ Quick Actions</h3>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <ActionButton onClick={() => onAction('deposit')}>Deposit</ActionButton>
        <ActionButton onClick={() => onAction('withdraw')}>Withdraw</ActionButton>
        <ActionButton onClick={() => onAction('mint')}>Mint</ActionButton>
        <ActionButton onClick={() => onAction('repay')}>Repay</ActionButton>
        <ActionButton onClick={() => onAction('auto-mint')} className="bg-purple-600 hover:bg-purple-700">Auto-Mint</ActionButton>
      </div>
    </div>
  </Card>
);
const ProtocolHealthCard = ({ totalValueLockedUSD, totalDebt, globalCollateralizationRatio }) => (
  <Card>
    <CardHeader><h2 className="text-xl font-semibold">🌐 Protocol Health</h2></CardHeader>
    <div className="p-6 grid md:grid-cols-2 gap-6">
      <InfoBox icon={<DollarSign />} title="TVL" value={formatCurrency(totalValueLockedUSD)} alignment="left" />
      <InfoBox icon={<Droplet />} title="Total Debt" value={formatCurrency(totalDebt)} alignment="left" />
      <InfoBox icon={<Shield />} title="Global Collateral Ratio" value={`${globalCollateralizationRatio}%`} valueColor={getHealthColor(parseFloat(globalCollateralizationRatio))} alignment="left" />
    </div>
  </Card>
);
const MintStatusCard = ({ dailyMinted, remainingDaily, cooldownRemaining }) => {
  const totalDaily = Number(dailyMinted) + Number(remainingDaily);
  const progress = totalDaily > 0 ? (Number(dailyMinted) / totalDaily) * 100 : 0;
  return (
    <Card>
      <CardHeader><h2 className="text-xl font-semibold">📈 Mint Status</h2></CardHeader>
      <div className="p-6 space-y-4">
        <div>
          <div className="flex justify-between text-sm text-gray-400 mb-1">
            <span>Daily Minted</span>
            <span>{formatNumber(dailyMinted)} / {formatNumber(totalDaily)} tGHSX</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2.5">
            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-400">Cooldown</span>
          {cooldownRemaining > 0 ? (
            <span className="flex items-center text-amber-400"><Clock className="w-4 h-4 mr-1" />{Math.ceil(cooldownRemaining/60)}m</span>
          ) : (
            <span className="flex items-center text-green-400"><Zap className="w-4 h-4 mr-1" />Ready</span>
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
      <p className="text-3xl font-bold text-blue-400">{formatCurrency(eth_usd_price/10**decimals)}</p>
      <p className="text-sm text-gray-400">per ETH</p>
    </div>
  </Card>
);
const TransactionHistory = ({ transactions }) => (
  <Card>
    <CardHeader><h2 className="text-xl font-semibold">📜 Recent Activity</h2></CardHeader>
    <div className="p-4">
      <ul className="space-y-3">
        {transactions?.length ? transactions.map(tx => (
          <li key={tx.tx_hash} className="flex justify-between text-sm">
            <div>
              <p className="font-medium">{tx.event_name}</p>
              <p className="text-xs text-gray-500 font-mono">{tx.tx_hash.slice(0,10)}…</p>
            </div>
            <p className="text-gray-400">{new Date(tx.block_timestamp).toLocaleTimeString()}</p>
          </li>
        )) : <p className="text-center text-gray-500 py-4">No recent transactions.</p>}
      </ul>
    </div>
  </Card>
);

// --- Manage Vault View ---
const ManageVaultView = ({ vaultOverview, collaterals, selectedCollateral, onSelectCollateral, onAction, parsedRatio }) => {
  const [inputAmount, setInputAmount] = useState('');
  // Compute liquidation price etc. based on vaultOverview and selectedCollateral
  const liquidationPrice = useMemo(() => {
    if (!vaultOverview) return 0;
    const { collateralValueUSD, mintedAmount } = vaultOverview;
    const minValue = Number(mintedAmount) * 1.5;
    const currValue = Number(collateralValueUSD);
    if (!currValue) return 0;
    const tokenInfo = collaterals.find(c => c.address === selectedCollateral);
    const amount = tokenInfo ? /* balance from vaultOverview if available */ 1 : 0;
    if (!amount) return 0;
    const dropPct = (currValue - minValue)/currValue;
    const price = currValue/amount;
    return price * (1 - dropPct);
  }, [vaultOverview, collaterals, selectedCollateral]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><h2 className="text-xl font-semibold">⚙️ Manage Vault</h2></CardHeader>
        <div className="p-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">Choose Collateral</label>
          <select
            value={selectedCollateral}
            onChange={e => onSelectCollateral(e.target.value)}
            className="w-full bg-gray-900 border border-gray-600 rounded-md p-2 text-white mb-4"
          >
            {collaterals.map(c => (
              <option key={c.address} value={c.address}>
                {c.symbol} — {c.name}
              </option>
            ))}
          </select>

          <div className="mb-4">Your Balance: {/* display vaultOverview.balance for this collateral */}</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Amount</label>
              <input
                type="number"
                value={inputAmount}
                onChange={e => setInputAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-gray-900 border border-gray-600 rounded-l-md p-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex flex-col justify-between">
              <ActionButton onClick={() => onAction('deposit')} className="mb-2">Deposit</ActionButton>
              <ActionButton onClick={() => onAction('withdraw')}>Withdraw</ActionButton>
            </div>
          </div>

          <div className="mt-6 bg-red-900/50 border border-red-500/50 p-4 rounded-lg">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-8 h-8 text-red-400" />
              <div>
                <h4 className="font-semibold text-red-300">Liquidation Price</h4>
                <p className="text-2xl font-bold">{formatCurrency(liquidationPrice)}</p>
                <p className="text-sm text-red-300/80">Position is at risk if price falls below this.</p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

// --- Action Modal ---
const ActionModal = ({ modalType, onClose, provider, onSuccess, collateralAddress }) => {
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState({ loading:false, error:null, success:null });
  const titles = { deposit:'Deposit', withdraw:'Withdraw', mint:'Mint', repay:'Repay', 'auto-mint':'Auto-Mint' };

  const handleConfirm = async () => {
    if (!provider || (modalType!=='auto-mint' && (!amount || Number(amount)<=0))) {
      setStatus({loading:false,error:'Enter a valid amount',success:null}); return;
    }
    setStatus({loading:true,error:null,success:'Preparing...'});
    try {
      const signer = provider.getSigner();
      const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);
      const decimals = 6;
      const parsed = ethers.utils.parseUnits(amount||'0', decimals);
      let tx;
      if (modalType==='deposit') {
        const token = new ethers.Contract(collateralAddress, ERC20_ABI, signer);
        setStatus(s=>({...s,success:'Waiting approval...'}));
        await (await token.approve(VAULT_ADDRESS, parsed)).wait();
        setStatus(s=>({...s,success:'Depositing...'}));
        tx = await vault.depositCollateral(collateralAddress, parsed);
      } else if (modalType==='withdraw') {
        tx = await vault.withdrawCollateral(collateralAddress, parsed);
      } else if (modalType==='mint') {
        tx = await vault.mintTokens(collateralAddress, parsed);
      } else if (modalType==='repay') {
        tx = await vault.burnTokens(collateralAddress, parsed);
      } else if (modalType==='auto-mint') {
        tx = await vault.autoMint(collateralAddress);
      }
      setStatus(s=>({...s,success:'Sending tx...'}));
      await tx.wait();
      setStatus({loading:false,error:null,success:'Success!'});
      onSuccess();
      setTimeout(onClose,2000);
    } catch (err) {
      console.error(err);
      let msg='Unknown error.';
      if (err.code==='UNPREDICTABLE_GAS_LIMIT') msg='Gas estimate failed.';
      else if (err.reason) msg=err.reason;
      setStatus({loading:false,error:msg,success:null});
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg w-full max-w-md" onClick={e=>e.stopPropagation()}>
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-xl font-semibold">{titles[modalType]} Collateral</h3>
        </div>
        <div className="p-6 space-y-4">
          {modalType!=='auto-mint' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Amount</label>
              <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-2" />
            </div>
          )}
          {status.loading && <div className="text-blue-400 flex items-center justify-center"><RefreshCw className="animate-spin mr-2"/>{status.success}</div>}
          {!status.loading && status.success && <div className="text-green-400 text-center">{status.success}</div>}
          {status.error && <div className="text-red-400 text-center">{status.error}</div>}
        </div>
        <div className="p-4 flex justify-end space-x-3 bg-gray-900/50 rounded-b-lg">
          <button onClick={onClose} disabled={status.loading} className="px-4 py-2 bg-gray-600 rounded disabled:opacity-50">Cancel</button>
          <button onClick={handleConfirm} disabled={status.loading} className="px-4 py-2 bg-blue-600 rounded disabled:opacity-50">{status.loading?'Processing':'Confirm'}</button>
        </div>
      </div>
    </div>
  );
};

// --- Utility Components ---
const Card = ({ children }) => <div className="bg-gray-800/50 rounded-xl shadow-lg border border-gray-700/50 backdrop-blur-sm mb-6">{children}</div>;
const CardHeader = ({ children }) => <div className="p-4 border-b border-gray-700 flex justify-between items-center">{children}</div>;
const InfoBox = ({ icon, title, value, valueColor, alignment }) => (
  <div className={`${alignment==='left'?'text-left':'text-center'}`}>  
    <div className="flex items-center justify-center mb-1">{React.cloneElement(icon,{className:'w-6 h-6 text-blue-500'})}</div>
    <p className="text-sm text-gray-400">{title}</p>
    <p className={`text-2xl font-bold ${valueColor||'text-white'}`}>{value}</p>
  </div>
);
const ActionButton = ({ onClick, children, className, disabled }) => (
  <button onClick={onClick} disabled={disabled} className={`w-full px-4 py-2 rounded-md font-semibold transition ${disabled?'bg-gray-600 cursor-not-allowed':'bg-blue-600 hover:bg-blue-700'} ${className||''}`}>{children}</button>
);
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-900">
    <RefreshCw className="w-12 h-12 text-blue-500 animate-spin" />
  </div>
);
const ErrorMessage = ({ message, onRetry }) => (
  <div className="flex items-center justify-center min-h-screen bg-gray-900">
    <div className="bg-gray-800 p-8 rounded-lg text-center">
      <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
      <h2 className="mt-4 text-2xl font-bold text-white">Error</h2>
      <p className="mt-2 text-gray-400">{message}</p>
      <button onClick={onRetry} className="mt-6 px-5 py-2 bg-blue-600 rounded">Retry</button>
    </div>
  </div>
);
const AuthWall = ({ message, onAction, actionText }) => (
  <div className="flex items-center justify-center min-h-screen bg-gray-900">
    <div className="bg-gray-800 p-8 rounded-lg text-center">
      <Shield className="w-12 h-12 text-blue-500 mx-auto" />
      <h2 className="mt-4 text-2xl font-bold text-white">Authentication Required</h2>
      <p className="mt-2 text-gray-400">{message}</p>
      {onAction && <button onClick={onAction} className="mt-6 px-5 py-2 bg-blue-600 rounded">{actionText}</button>}
    </div>
  </div>
);
