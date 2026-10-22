import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/api';
import { useTheme } from '../context/ThemeContext';
import './Account.css';

export default function Account() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '' });
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const navigate = useNavigate(); const { setTheme, availableThemes } = useTheme();
  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const user = mode === 'login'
        ? await authApi.login(form.email || form.username, form.password)
        : await authApi.register(form);
      setTheme(user.theme_choice === 'kerala-green' ? availableThemes.MONSOON_FOREST : user.theme_choice);
      navigate(user.role === 'admin' ? '/admin/dashboard' : '/');
    } catch (err) { setError(err.message || 'Please try again.'); } finally { setLoading(false); }
  };
  return <section className="account-page"><div className="account-card glass-card">
    <div className="account-leaf"><span className="material-symbols-outlined">forest</span></div>
    <p className="text-label-caps">TravelEase account</p><h1 className="text-headline-lg">{mode === 'login' ? 'Welcome back' : 'Start exploring Kerala'}</h1>
    <p className="text-body-sm">Your account uses our Kerala nature-green theme by default.</p>
    <div className="account-tabs"><button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Log in</button><button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Sign up</button></div>
    <form onSubmit={submit} className="account-form">{error && <div className="account-error">{error}</div>}
      {mode === 'signup' && <><input className="input-field" placeholder="Full name" value={form.name} onChange={update('name')} required /><input className="input-field" placeholder="Username" value={form.username} onChange={update('username')} required /></>}
      <input className="input-field" type={mode === 'login' ? 'text' : 'email'} placeholder={mode === 'login' ? 'Email or username' : 'Email address'} value={form.email} onChange={update('email')} required={mode === 'signup'} />
      {mode === 'login' && <input className="input-field" placeholder="Or enter username" value={form.username} onChange={update('username')} />}
      <input className="input-field" type="password" placeholder="Password (min. 8 characters)" value={form.password} onChange={update('password')} minLength="8" required />
      <button className="btn btn-primary btn-lg" disabled={loading}>{loading ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}</button>
    </form>
  </div></section>;
}
