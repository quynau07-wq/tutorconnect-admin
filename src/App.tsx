import {useEffect, useState} from 'react';
import {browserLocalPersistence, browserSessionPersistence, setPersistence, onAuthStateChanged, signInWithEmailAndPassword, signOut, User} from 'firebase/auth';
import {Eye, EyeOff} from 'lucide-react';
import {auth} from './firebase';
import {ApiError, getAdminSession} from './api';
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
  const [authReady, setAuthReady] = useState(false);
  const [accessStatus, setAccessStatus] = useState<'checking' | 'ready' | 'denied' | 'error'>('checking');
  const [accessError, setAccessError] = useState('');
  const [sessionRevision, setSessionRevision] = useState(0);

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

  useEffect(() => onAuthStateChanged(auth, nextUser => {
    setAdminRole(null);
    setAccessStatus('checking');
    setAccessError('');
    setUser(nextUser);
    setSessionRevision(value => value + 1);
    setAuthReady(true);
  }), []);

  useEffect(() => {
    let active = true;
    if (!user) {
      setAdminRole(null);
      return;
    }
    setAccessStatus('checking');
    setAccessError('');
    getAdminSession()
      .then(session => {
        if (!active) return;
        if (!['admin', 'super_admin'].includes(session.role)) {
          setAccessStatus('denied');
          return;
        }
        setAdminRole(session.role);
        setAccessStatus('ready');
      })
      .catch(caught => {
        if (!active) return;
        setAccessStatus(caught instanceof ApiError && caught.status === 403 ? 'denied' : 'error');
        setAccessError(caught instanceof ApiError && caught.status === 401 ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' : 'Chưa kết nối được máy chủ để kiểm tra quyền. Vui lòng thử lại.');
      });
    return () => {active = false;};
  }, [user, sessionRevision]);

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

  if (!authReady || (user && accessStatus === 'checking')) {
    return <main className="auth-shell"><section className="login-panel" role="status" aria-live="polite" aria-busy="true"><div className="brand-mark"><img src="/tutorconnect-logo.svg" alt="TutorConnect" width="44" height="44" /></div><h1>Đang đăng nhập…</h1><p className="muted">Đang kết nối trang quản trị, vui lòng đợi trong giây lát.</p></section></main>;
  }

  if (!user) {
    return <main className="auth-shell"><section className="login-panel">
      <div className="brand-mark"><img src="/tutorconnect-logo.svg" alt="TutorConnect" width="44" height="44" /></div>
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
    return <main className="auth-shell"><section className="login-panel"><div className="brand-mark"><img src="/tutorconnect-logo.svg" alt="TutorConnect" width="44" height="44" /></div><h1>{accessStatus === 'denied' ? 'Không có quyền quản trị' : 'Chưa thể vào trang quản trị'}</h1><p className="muted" role="alert">{accessStatus === 'denied' ? 'Tài khoản này chưa được cấp quyền admin.' : accessError}</p>{accessStatus === 'error' && <button className="primary" onClick={() => {setAccessStatus('checking'); setSessionRevision(value => value + 1);}}>Thử lại</button>}<button className="primary" onClick={() => signOut(auth)}>Đăng xuất</button></section></main>;
  }

  return <AdminDashboard user={user} role={adminRole} />;
};

export default App;
