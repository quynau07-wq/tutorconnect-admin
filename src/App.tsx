import {useEffect, useState} from 'react';
import {browserLocalPersistence, browserSessionPersistence, setPersistence, onAuthStateChanged, signInWithEmailAndPassword, signOut, User} from 'firebase/auth';
import {Eye, EyeOff, ShieldCheck} from 'lucide-react';
import {auth} from './firebase';
import {getAdminSession} from './api';
import AdminDashboard from './AdminDashboard';

const REMEMBER_KEY = 'tutorconnect-admin-remember';

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [adminRole, setAdminRole] = useState<'admin' | 'super_admin' | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as {email?: string; password?: string};
      if (parsed.email) setEmail(parsed.email);
      if (parsed.password) setPassword(parsed.password);
      setRememberMe(true);
    } catch {
      localStorage.removeItem(REMEMBER_KEY);
    }
  }, []);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) {
      setAdminRole(null);
      return;
    }
    getAdminSession()
      .then(session => setAdminRole(session.role))
      .catch(error => setError(error.message));
  }, [user]);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email.trim(), password);
      if (rememberMe) {
        localStorage.setItem(REMEMBER_KEY, JSON.stringify({email: email.trim(), password}));
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }
    } catch (error: any) {
      setError(error.message || 'Đăng nhập thất bại.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <main className="auth-shell"><section className="login-panel">
      <div className="brand-mark"><ShieldCheck size={22} /></div>
      <p className="eyebrow">TUTORCONNECT / CONTROL ROOM</p>
      <h1>Quản trị<br /><em>gọn, rõ, có kiểm soát.</em></h1>
      <p className="muted">Đăng nhập bằng tài khoản quản trị của bạn.</p>
      <form onSubmit={login} className="login-form">
        <label>Email<input value={email} onChange={event => setEmail(event.target.value)} type="email" name="username" autoComplete="username" required /></label>
        <label className="password-field">
          <span>Mật khẩu</span>
          <div className="password-wrap">
            <input value={password} onChange={event => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'} name="password" autoComplete="current-password" required />
            <button type="button" className="password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showPassword}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>
        <label className="remember-row"><input type="checkbox" checked={rememberMe} onChange={event => { setRememberMe(event.target.checked); if (!event.target.checked) localStorage.removeItem(REMEMBER_KEY); }} /> Ghi nhớ tài khoản và mật khẩu</label>
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={loading}>{loading ? 'Đang đăng nhập...' : 'Đăng nhập quản trị'}</button>
      </form>
    </section></main>;
  }

  if (!adminRole) {
    return <main className="auth-shell"><section className="login-panel"><div className="brand-mark"><ShieldCheck size={22} /></div><h1>Không có quyền quản trị</h1><p className="muted">{error || 'Tài khoản này chưa được cấp quyền admin.'}</p><button className="primary" onClick={() => signOut(auth)}>Đăng xuất</button></section></main>;
  }

  return <AdminDashboard user={user} role={adminRole} />;
};

export default App;
