import React, { useState, useEffect, useCallback } from 'react';
import { DollarSign, Shield, Zap, TrendingUp, LogIn, GitMerge, AlertTriangle, RefreshCw, Layers, Lock, Wind, Github, Twitter, Send, MessageSquare } from 'lucide-react';

// --- LIVE API & CONFIG ---
const API_BASE_URL = 'https://tghsx.onrender.com';

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

// --- JWT Decoder ---
function parseJwt(token) {
    try {
        return JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
        return null;
    }
}

// --- Main Landing Page Component ---
export default function LandingPage() {
    const [protocolHealth, setProtocolHealth] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showLogin, setShowLogin] = useState(false);

    const fetchProtocolHealth = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/protocol/health`);
            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.detail || 'Failed to fetch protocol statistics.');
            }
            const data = await response.json();
            setProtocolHealth(data);
        } catch (err) { // FIX: Added missing opening brace
            setError(err.message);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProtocolHealth();
    }, [fetchProtocolHealth]);

    const handleConnectWallet = () => {
        // This will be handled by the login/register flow which leads to the dashboard
        setShowLogin(true);
    };

    const handleAuthAction = async (endpoint, email, password) => {
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.detail || 'An error occurred.');
            }
            
            console.log('Success:', data);
            localStorage.setItem('authToken', data.access_token);
            
            const decodedToken = parseJwt(data.access_token);
            if (decodedToken && decodedToken.role === 'admin') {
                window.location.href = '/admin';
            } else {
                window.location.href = '/dashboard';
            }

        } catch (err) {
            console.error(err);
            alert(`Error: ${err.message}`);
        }
    };
    
    const handleLogin = (email, password) => handleAuthAction('/auth/login', email, password);
    const handleRegister = (email, password) => handleAuthAction('/auth/register', email, password);

    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans">
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-gray-900 via-gray-900 to-blue-900/40 z-0"></div>
            <div className="relative z-10">
                <Header onLoginClick={() => setShowLogin(true)} />
                <main>
                    <HeroSection onConnectWallet={handleConnectWallet} />
                    <StatsBar healthData={protocolHealth} isLoading={isLoading} error={error} />
                    <FeaturesSection />
                </main>
                <Footer />
            </div>
            {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={handleLogin} onRegister={handleRegister} />}
        </div>
    );
}

// --- Sub-Components ---

const Header = ({ onLoginClick }) => (
    <header className="py-4 px-4 sm:px-6 lg:px-8">
        <nav className="flex justify-between items-center max-w-7xl mx-auto">
            <div className="flex items-center">
                <Layers className="h-8 w-8 text-blue-500" />
                <span className="ml-3 text-xl font-bold text-white">tGHSX Protocol</span>
            </div>
            <div className="flex items-center space-x-4">
                <button onClick={onLoginClick} className="flex items-center text-sm font-medium text-gray-300 hover:text-white transition-colors">
                    <LogIn className="w-4 h-4 mr-2" />
                    Login / Register
                </button>
            </div>
        </nav>
    </header>
);

const HeroSection = ({ onConnectWallet }) => (
    <section className="text-center py-20 sm:py-28">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight">
            A Decentralized Stablecoin, <br />
            <span className="text-blue-500">Secured by Your Assets.</span>
        </h1>
        {/* FIX: Updated text to be accurate about testnet status */}
        <p className="max-w-2xl mx-auto mt-6 text-lg text-gray-300">
            Mint the tGHSX stablecoin by depositing collateral. Explore capital efficiency with our transparent protocol, currently live on the Amoy testnet.
        </p>
        <div className="mt-10">
            <button
                onClick={onConnectWallet}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-lg text-lg transition-transform transform hover:scale-105"
            >
                Launch App
            </button>
        </div>
    </section>
);

const StatsBar = ({ healthData, isLoading, error }) => (
    <section className="py-8 bg-black/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                <StatBox
                    icon={<DollarSign />}
                    label="Total Value Locked"
                    value={healthData ? formatCurrency(healthData.totalValueLockedUSD) : '...'}
                    isLoading={isLoading}
                    error={error}
                />
                <StatBox
                    icon={<Shield />}
                    label="Global Collateral Ratio"
                    value={healthData ? `${parseFloat(healthData.globalCollateralizationRatio).toFixed(2)}%` : '...'}
                    isLoading={isLoading}
                    error={error}
                />
                <StatBox
                    icon={<GitMerge />}
                    label="Collateral Types"
                    value={healthData ? healthData.numberOfCollateralTypes : '...'}
                    isLoading={isLoading}
                    error={error}
                />
            </div>
        </div>
    </section>
);

const StatBox = ({ icon, label, value, isLoading, error }) => (
    <div className="flex flex-col items-center">
        <div className="text-blue-400 mb-2">{React.cloneElement(icon, { className: "w-8 h-8" })}</div>
        <p className="text-sm text-gray-400 uppercase tracking-wider">{label}</p>
        {isLoading ? (
            <div className="h-9 w-24 bg-gray-700/50 rounded-md animate-pulse mt-1"></div>
        ) : error ? (
            <p className="text-2xl font-bold text-red-500">-</p>
        ) : (
            <p className="text-3xl font-bold text-white">{value}</p>
        )}
    </div>
);

const FeaturesSection = () => (
    <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
                <h2 className="text-3xl sm:text-4xl font-bold">Why Choose tGHSX?</h2>
                <p className="max-w-2xl mx-auto mt-4 text-gray-400">Our protocol is built on transparency, efficiency, and user-empowerment.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* FIX: Updated feature card to be accurate */}
                <FeatureCard
                    icon={<AlertTriangle />}
                    title="Public Testnet"
                    description="Our smart contracts are publicly deployed on the Amoy testnet. We encourage community review and feedback during this experimental phase."
                />
                <FeatureCard
                    icon={<Wind />}
                    title="Capital Efficiency"
                    description="Mint tGHSX against your assets to unlock liquidity without selling your holdings."
                />
                <FeatureCard
                    icon={<Zap />}
                    title="Instant Liquidity"
                    description="Utilize our Auto-Mint feature for immediate access to tGHSX based on your vault's health."
                />
            </div>
        </div>
    </section>
);

const FeatureCard = ({ icon, title, description }) => (
    <div className="bg-gray-800/50 p-8 rounded-xl border border-gray-700/50 text-center transform hover:-translate-y-2 transition-transform">
        <div className="inline-block p-4 bg-blue-600/20 text-blue-400 rounded-full mb-4">
            {React.cloneElement(icon, { className: "w-8 h-8" })}
        </div>
        <h3 className="text-xl font-bold mb-2">{title}</h3>
        <p className="text-gray-400">{description}</p>
    </div>
);

const Footer = () => (
    <footer className="py-8 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-400">
            <div className="flex justify-center space-x-6 mb-6">
                <a href="https://github.com/valorm/tghsx" target="_blank" rel="noopener noreferrer" className="hover:text-white"><Github /></a>
                <a href="https://t.me/tghsstablecoin" target="_blank" rel="noopener noreferrer" className="hover:text-white"><Send /></a>
                <a href="https://discord.com/invite/NPtrctnJhu" target="_blank" rel="noopener noreferrer" className="hover:text-white"><MessageSquare /></a>
                <a href="https://x.com/tokenGHC" target="_blank" rel="noopener noreferrer" className="hover:text-white"><Twitter /></a>
            </div>
            <div className="text-xs space-x-4 mb-4">
                 <a href="https://amoy.polygonscan.com/address/0xb04093d34F5feC6DE685B8684F3e2086dd866a50#code" target="_blank" rel="noopener noreferrer" className="hover:text-white">TGHSXToken Contract</a>
                 <span className="text-gray-600">|</span>
                 <a href="https://amoy.polygonscan.com/address/0xF681Ba510d3C93A49a7AB2d02d9697BB2B0091FE#code" target="_blank" rel="noopener noreferrer" className="hover:text-white">CollateralVault Contract</a>
            </div>
            <p className="text-sm">&copy; {new Date().getFullYear()} tGHSX Protocol. All rights reserved.</p>
        </div>
    </footer>
);

const LoginModal = ({ onClose, onLogin, onRegister }) => {
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        if (isRegister) {
            await onRegister(email, password);
        } else {
            await onLogin(email, password);
        }
        setIsSubmitting(false);
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-gray-700">
                    <h3 className="text-xl font-semibold">{isRegister ? 'Create an Account' : 'Welcome Back'}</h3>
                    <p className="text-sm text-gray-400 mt-1">
                        {isRegister ? 'Already have an account? ' : 'Need an account? '}
                        <button onClick={() => setIsRegister(!isRegister)} className="text-blue-500 hover:underline font-medium">
                            {isRegister ? 'Log In' : 'Register'}
                        </button>
                    </p>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                        <input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-gray-900 border border-gray-600 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">Password</label>
                        <input type="password" id="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-gray-900 border border-gray-600 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <button type="submit" disabled={isSubmitting} className="w-full py-2.5 rounded-md text-sm font-semibold bg-blue-600 hover:bg-blue-700 transition-colors disabled:bg-gray-500 disabled:cursor-wait flex justify-center items-center">
                        {isSubmitting && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                        {isRegister ? 'Register' : 'Log In'}
                    </button>
                </form>
            </div>
        </div>
    );
};
