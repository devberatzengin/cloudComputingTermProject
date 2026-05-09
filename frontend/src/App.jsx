import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as Lucide from 'lucide-react';

const VERSION = "v3.3.0-LOG";
const API_BASE_URL = 'http://127.0.0.1:8000';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false); 
  const [isLoginView, setIsLoginView] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [files, setFiles] = useState([]);
  const [activities, setActivities] = useState([]);
  const [stats, setStats] = useState({ total_count: 0, total_size_bytes: 0 });
  const [selectedFileVersions, setSelectedFileVersions] = useState(null);
  const [authForm, setAuthForm] = useState({ email: '', password: '', full_name: '' });
  const [isUploading, setIsUploading] = useState(false);

  const theme = {
    bg: isDarkMode ? '#0f172a' : '#f8fafc',
    sidebar: isDarkMode ? '#1e293b' : '#ffffff',
    card: isDarkMode ? '#1e293b' : '#ffffff',
    text: isDarkMode ? '#f1f5f9' : '#0f172a',
    subText: isDarkMode ? '#94a3b8' : '#64748b',
    border: isDarkMode ? '#334155' : '#e2e8f0',
    primary: '#3b82f6', 
    surface: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'
  };

  useEffect(() => { initAuth(); }, []);
  useEffect(() => { if (isAuthenticated) { fetchFiles(); fetchActivities(); } }, [isAuthenticated, activeTab]);

  const initAuth = async () => {
    const token = localStorage.getItem('token');
    if (token && token !== "undefined") {
      try {
        const response = await axios.get(`${API_BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        setCurrentUser(response.data);
        setIsAuthenticated(true);
      } catch (error) { localStorage.removeItem('token'); }
    }
    setIsCheckingAuth(false);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (isLoginView) {
        const params = new URLSearchParams();
        params.append('username', authForm.email);
        params.append('password', authForm.password);
        const response = await axios.post(`${API_BASE_URL}/auth/login`, params);
        localStorage.setItem('token', response.data.access_token);
      } else {
        await axios.post(`${API_BASE_URL}/auth/register`, { first_name: authForm.full_name.split(' ')[0] || 'User', last_name: authForm.full_name.split(' ')[1] || 'Zen', email: authForm.email, password: authForm.password });
        setIsLoginView(true); alert('Kayıt Başarılı'); return;
      }
      initAuth();
    } catch (error) { alert('Hata!'); }
  };

  const fetchFiles = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/files`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      if (res.data.success) { setFiles(res.data.files || []); setStats(res.data.stats || { total_count: 0, total_size_bytes: 0 }); }
    } catch (e) {}
  };

  const fetchActivities = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/activities`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setActivities(Array.isArray(res.data) ? res.data : []);
    } catch (e) {}
  };

  const handleUpload = async (file) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      await axios.post(`${API_BASE_URL}/upload`, formData, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'multipart/form-data' } });
      fetchFiles(); fetchActivities();
    } catch (error) { alert('Hata!'); }
    finally { setIsUploading(false); }
  };

  const handleDownload = (name, gen) => {
    window.open(`${API_BASE_URL}/download?name=${name}${gen ? `&generation=${gen}` : ''}&token=${localStorage.getItem('token')}`, '_blank');
  };

  const handleDelete = async (name, purge = false) => {
    if (!window.confirm('Emin misiniz?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/files?name=${name}&purge=${purge}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      fetchFiles(); fetchActivities();
    } catch (e) {}
  };

  const fetchVersions = async (name) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/files/versions?name=${name}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setSelectedFileVersions({ name, versions: res.data.versions || [] });
    } catch (e) { alert('Sürüm bilgisi alınamadı'); }
  };

  if (isCheckingAuth) return <div style={{ height: '100vh', background: theme.bg, color: theme.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Zen Modu...</div>;

  if (!isAuthenticated) {
    return (
      <div style={{ height: '100vh', background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '380px', padding: '3rem', borderRadius: '1.5rem', background: theme.card, border: `1px solid ${theme.border}`, textAlign: 'center' }}>
          <Lucide.Shield color={theme.primary} size={48} style={{ marginBottom: '1.5rem' }} />
          <h2 style={{ color: theme.text, fontSize: '1.5rem', fontWeight: 700, marginBottom: '2rem' }}>CloudGuard Zen</h2>
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {!isLoginView && <input type="text" placeholder="Ad Soyad" style={{ padding: '0.8rem', border: `1px solid ${theme.border}`, borderRadius: '0.5rem' }} value={authForm.full_name} onChange={e => setAuthForm({...authForm, full_name: e.target.value})} />}
            <input type="email" placeholder="Email" style={{ padding: '0.8rem', border: `1px solid ${theme.border}`, borderRadius: '0.5rem' }} value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} />
            <input type="password" placeholder="Şifre" style={{ padding: '0.8rem', border: `1px solid ${theme.border}`, borderRadius: '0.5rem' }} value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} />
            <button type="submit" style={{ padding: '0.8rem', background: theme.primary, color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 'bold' }}>Giriş</button>
          </form>
          <p onClick={() => setIsLoginView(!isLoginView)} style={{ marginTop: '1.5rem', color: theme.subText, cursor: 'pointer' }}>Hesap oluştur</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: theme.bg, color: theme.text, fontFamily: 'sans-serif' }}>
      <aside style={{ width: '280px', background: theme.sidebar, borderRight: `1px solid ${theme.border}`, padding: '2rem', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '3rem' }}>
          <Lucide.Cloud color={theme.primary} size={24} />
          <span style={{ fontWeight: 700, fontSize: '1.25rem' }}>CloudGuard</span>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          {['Dashboard', 'Yedekler', 'Günlük'].map(id => (
            <div key={id} onClick={() => setActiveTab(id)} style={{ padding: '0.75rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', background: activeTab === id ? `${theme.primary}15` : 'transparent', color: activeTab === id ? theme.primary : theme.subText, display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: '500' }}>
              {id === 'Dashboard' && <Lucide.Layout size={18} />}
              {id === 'Yedekler' && <Lucide.Database size={18} />}
              {id === 'Günlük' && <Lucide.Activity size={18} />}
              {id}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <button onClick={() => setIsDarkMode(!isDarkMode)} style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: `1px solid ${theme.border}`, background: 'transparent', color: theme.text, cursor: 'pointer', fontSize: '0.85rem' }}>
            {isDarkMode ? 'Aydınlık Mod' : 'Karanlık Mod'}
          </button>
          <div style={{ padding: '1rem', background: theme.surface, borderRadius: '1rem', border: `1px solid ${theme.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: theme.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.8rem' }}>
                {currentUser?.first_name?.[0]}{currentUser?.last_name?.[0]}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <p style={{ fontWeight: '700', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser?.first_name} {currentUser?.last_name}</p>
                <p style={{ fontSize: '0.7rem', color: theme.subText, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser?.email}</p>
              </div>
            </div>
            <button onClick={() => { localStorage.removeItem('token'); window.location.reload(); }} style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', background: 'transparent', border: `1px solid ${theme.border}`, color: '#ef4444', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              <Lucide.LogOut size={12} /> Çıkış Yap
            </button>
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, padding: '3rem', maxWidth: '1000px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '3rem' }}>{activeTab}</h1>
        {activeTab === 'Dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
              <div style={{ padding: '1.5rem', background: theme.card, borderRadius: '1rem', border: `1px solid ${theme.border}` }}>
                <p style={{ color: theme.subText, fontSize: '0.75rem', fontWeight: 'bold' }}>TOPLAM DOSYA</p>
                <h2 style={{ fontSize: '2rem', fontWeight: 700 }}>{stats.total_count}</h2>
              </div>
              <div style={{ padding: '1.5rem', background: theme.card, borderRadius: '1rem', border: `1px solid ${theme.border}` }}>
                <p style={{ color: theme.subText, fontSize: '0.75rem', fontWeight: 'bold' }}>TOPLAM BOYUT</p>
                <h2 style={{ fontSize: '2rem', fontWeight: 700 }}>{(stats.total_size_bytes / 1024).toFixed(2)} KB</h2>
              </div>
            </div>
            <div style={{ padding: '4rem 2rem', background: theme.card, border: `2px dashed ${theme.border}`, borderRadius: '1.5rem', textAlign: 'center' }}>
               <Lucide.UploadCloud size={40} color={theme.primary} style={{ marginBottom: '1rem' }} />
               <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Dosya Yedekle</h3>
               <label style={{ padding: '0.8rem 2.5rem', background: theme.primary, color: 'white', borderRadius: '0.5rem', fontWeight: 'bold', cursor: 'pointer', display: 'inline-block', marginTop: '1.5rem' }}>
                 {isUploading ? 'Yükleniyor...' : 'Dosya Seç'}
                 <input type="file" style={{ display: 'none' }} onChange={e => e.target.files[0] && handleUpload(e.target.files[0])} disabled={isUploading} />
               </label>
            </div>
          </div>
        )}
        {activeTab === 'Yedekler' && (
          <div style={{ background: theme.card, borderRadius: '1rem', border: `1px solid ${theme.border}`, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: theme.surface, color: theme.subText, fontSize: '0.8rem', textAlign: 'left' }}>
                <tr><th style={{ padding: '1rem' }}>DOSYA</th><th style={{ padding: '1rem' }}>BOYUT</th><th style={{ padding: '1rem', textAlign: 'right' }}>İŞLEM</th></tr>
              </thead>
              <tbody>
                {files.map((f, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${theme.border}` }}>
                    <td style={{ padding: '1rem' }}>{f.name}</td>
                    <td style={{ padding: '1rem' }}>{(f.size / 1024).toFixed(2)} KB</td>
                    <td style={{ padding: '1rem', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <button onClick={() => fetchVersions(f.name)} style={{ padding: '0.4rem', border: `1px solid ${theme.border}`, background: 'transparent', borderRadius: '0.4rem', cursor: 'pointer' }}><Lucide.History size={14} /></button>
                      <button onClick={() => handleDownload(f.name)} style={{ padding: '0.4rem', border: `1px solid ${theme.border}`, background: 'transparent', borderRadius: '0.4rem', cursor: 'pointer' }}><Lucide.Download size={14} /></button>
                      <button onClick={() => handleDelete(f.name)} style={{ padding: '0.4rem', border: `1px solid ${theme.border}`, background: 'transparent', borderRadius: '0.4rem', cursor: 'pointer', color: '#ef4444' }}><Lucide.Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {activeTab === 'Günlük' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {activities.map((a, i) => (
              <div key={i} style={{ padding: '1rem', background: theme.card, borderRadius: '0.75rem', border: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontWeight: '600', fontSize: '0.9rem' }}>{a.action}</p>
                  <p style={{ color: theme.subText, fontSize: '0.8rem' }}>{a.details}</p>
                </div>
                <span style={{ fontSize: '0.7rem', color: theme.subText }}>{new Date(a.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* VERSION LOG MODAL (GIT LOG STYLE) */}
      {selectedFileVersions && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: theme.card, padding: '2rem', borderRadius: '1.5rem', width: '500px', border: `1px solid ${theme.border}`, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Lucide.GitBranch size={20} color={theme.primary} />
                <h3 style={{ fontWeight: 800, fontSize: '1.1rem' }}>{selectedFileVersions.name} Geçmişi</h3>
              </div>
              <Lucide.X style={{ cursor: 'pointer' }} onClick={() => setSelectedFileVersions(null)} />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', maxHeight: '450px', overflowY: 'auto' }}>
              {selectedFileVersions.versions.length === 0 ? (
                <p style={{ color: theme.subText, textAlign: 'center', padding: '3rem' }}>Henüz sürüm kaydı bulunamadı.</p>
              ) : (
                selectedFileVersions.versions.map((v, i) => (
                  <div key={i} style={{ display: 'flex', gap: '1.5rem', position: 'relative' }}>
                    {/* TIMELINE LINE */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: i === 0 ? theme.primary : theme.border, zIndex: 1, marginTop: '5px' }}></div>
                      {i !== selectedFileVersions.versions.length - 1 && <div style={{ width: '2px', flex: 1, background: theme.border }}></div>}
                    </div>
                    
                    {/* COMMIT CARD */}
                    <div style={{ flex: 1, paddingBottom: '2rem' }}>
                      <div style={{ padding: '1rem', background: theme.surface, borderRadius: '1rem', border: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Lucide.User size={14} color={theme.primary} />
                            <p style={{ fontSize: '0.85rem', fontWeight: 700 }}>{v.uploader || 'System'}</p>
                          </div>
                          <p style={{ fontSize: '0.75rem', color: theme.subText, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Lucide.Clock size={12} /> {new Date(v.updated).toLocaleString()}
                          </p>
                          <p style={{ fontSize: '0.65rem', color: theme.subText, fontFamily: 'monospace' }}>SHA: {String(v.generation).slice(-8)}</p>
                        </div>
                        <button onClick={() => handleDownload(selectedFileVersions.name, v.generation)} style={{ padding: '0.5rem 1rem', background: theme.card, border: `1px solid ${theme.border}`, borderRadius: '0.6rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Lucide.Download size={14} /> Geri Yükle
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ position: 'fixed', bottom: '1rem', right: '1rem', fontSize: '0.7rem', color: theme.subText }}>{VERSION}</div>
    </div>
  );
}

export default App;
