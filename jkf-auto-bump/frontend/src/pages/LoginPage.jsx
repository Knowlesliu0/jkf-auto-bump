import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Lock, Mail, AlertCircle } from 'lucide-react';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const API_BASE_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : 'https://back888.zeabur.app');

            const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (res.ok) {
                localStorage.setItem('jkf_token', data.token);
                navigate('/dashboard');
            } else {
                setError(data.error || '登入失敗，請檢查帳號密碼。');
            }
        } catch (err) {
            setError('系統錯誤，無法連線至伺服器。');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-red-900/10 mix-blend-screen pointer-events-none"></div>

            <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
                <div className="flex justify-center flex-col items-center">
                    <div className="w-16 h-16 bg-red-600/20 shadow-[0_0_30px_rgba(220,38,38,0.3)] rounded-full flex items-center justify-center mb-4 border border-red-500/30">
                        <Zap className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-center text-3xl font-extrabold tracking-widest bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                        黑閃行銷系統
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-500 font-medium">
                        授權人員專用登入介面
                    </p>
                </div>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="glass py-8 px-4 shadow-2xl rounded-2xl sm:px-10 border border-white/10 backdrop-blur-xl">

                    {error && (
                        <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2">
                            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                            <span className="text-sm text-red-200">{error}</span>
                        </div>
                    )}

                    <form className="space-y-6" onSubmit={handleLogin}>
                        <div>
                            <label className="block text-sm font-medium text-gray-300">帳號</label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-gray-500" />
                                </div>
                                <input
                                    type="text"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-10 bg-black/40 border border-white/10 rounded-lg py-3 text-white focus:ring-1 focus:ring-red-500/50 focus:border-red-500/50 transition-colors sm:text-sm"
                                    placeholder="請輸入系統帳號"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300">密碼</label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-500" />
                                </div>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full pl-10 bg-black/40 border border-white/10 rounded-lg py-3 text-white focus:ring-1 focus:ring-red-500/50 focus:border-red-500/50 transition-colors sm:text-sm"
                                    placeholder="請輸入系統密碼"
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 focus:ring-offset-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? '登入中...' : '安全登入'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
