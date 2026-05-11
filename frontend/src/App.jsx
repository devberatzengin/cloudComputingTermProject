import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import * as Lucide from 'lucide-react';

const VERSION = "";
const API_BASE_URL = 'http://127.0.0.1:8000';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoginView, setIsLoginView] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [items, setItems] = useState([]);
  const [trashFiles, setTrashFiles] = useState([]);
  const [activities, setActivities] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPath, setCurrentPath] = useState('');
  const [stats, setStats] = useState({ total_size_bytes: 0, total_count: 0 });
  const [selectedFileVersions, setSelectedFileVersions] = useState(null);
  const [authForm, setAuthForm] = useState({ email: '', password: '', full_name: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [countdown, setCountdown] = useState("");

  // Settings State
  const [settings, setSettings] = useState({
    backup_time: "00:00",
    storage_limit_mb: 100,
    backup_enabled: true
  });

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
  useEffect(() => {
    if (isAuthenticated) {
      fetchItems();
      fetchActivities();
      if (activeTab === 'Çöp Kutusu') fetchTrash();
      if (activeTab === 'Analiz') fetchAnalytics();
      if (activeTab === 'Ayarlar') fetchSettings();
    }
  }, [isAuthenticated, activeTab, currentPath]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const [bHour, bMin] = settings.backup_time.split(':').map(Number);
      const nextBackup = new Date();
      nextBackup.setHours(bHour, bMin, 0, 0);
      if (nextBackup <= now) nextBackup.setDate(nextBackup.getDate() + 1);

      const diff = nextBackup - now;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff / (1000 * 60)) % 60);
      const secs = Math.floor((diff / 1000) % 60);
      setCountdown(`${hours}s ${mins}d ${secs}s`);
    }, 1000);
    return () => clearInterval(timer);
  }, [settings.backup_time]);

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
        const params = new URLSearchParams({ username: authForm.email, password: authForm.password });
        const response = await axios.post(`${API_BASE_URL}/auth/login`, params);
        localStorage.setItem('token', response.data.access_token);
      } else {
        await axios.post(`${API_BASE_URL}/auth/register`, { first_name: authForm.full_name.split(' ')[0] || 'User', last_name: authForm.full_name.split(' ')[1] || 'Zen', email: authForm.email, password: authForm.password });
        setIsLoginView(true); alert('Kayıt Başarılı'); return;
      }
      initAuth();
    } catch (error) { alert('Hata!'); }
  };

  const fetchItems = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/files?prefix=${currentPath}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      if (res.data.success) { setItems(res.data.items || []); setStats(res.data.stats || { total_size_bytes: 0, total_count: 0 }); }
    } catch (e) { }
  };

  const fetchTrash = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/files/trash`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      if (res.data.success) setTrashFiles(res.data.files || []);
    } catch (e) { }
  };

  const fetchActivities = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/activities`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setActivities(Array.isArray(res.data) ? res.data : []);
    } catch (e) { }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/analytics`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      if (res.data.success) setAnalyticsData(res.data);
    } catch (e) { }
  };

  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/settings`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setSettings(res.data);
    } catch (e) { }
  };

  const updateSettings = async (newSettings) => {
    try {
      const res = await axios.post(`${API_BASE_URL}/settings`, newSettings, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      if (res.data.success) { setSettings(res.data.settings); alert('Ayarlar Kaydedildi'); }
    } catch (e) { alert('Hata!'); }
  };

  const triggerManualBackup = async () => {
    try {
      const res = await axios.post(`${API_BASE_URL}/settings/backup-now`, {}, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      if (res.data.success) {
        fetchSettings();
        fetchActivities();
        alert('Manuel yedekleme başarıyla tamamlandı!');
      }
    } catch (e) { alert('Hata!'); }
  };

  const handleUpload = async (file) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      await axios.post(`${API_BASE_URL}/upload?folder=${currentPath}`, formData, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'multipart/form-data' } });
      fetchItems(); fetchActivities();
    } catch (error) { alert('Hata!'); }
    finally { setIsUploading(false); }
  };

  const onDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => { setIsDragging(false); };
  const onDrop = (e) => { e.preventDefault(); setIsDragging(false); const files = e.dataTransfer.files; if (files.length > 0) handleUpload(files[0]); };

  const handleDownload = (name, gen) => { window.open(`${API_BASE_URL}/download?name=${encodeURIComponent(name)}${gen ? `&generation=${gen}` : ''}&token=${localStorage.getItem('token')}`, '_blank'); };

  const handleDelete = async (name, purge = false) => {
    if (!window.confirm(purge ? 'Kalıcı olarak silinecek, emin misiniz?' : 'Çöp kutusuna taşınacak, emin misiniz?')) return;
    try { await axios.delete(`${API_BASE_URL}/files?name=${name}&purge=${purge}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }); fetchItems(); fetchTrash(); fetchActivities(); } catch (e) { }
  };

  const handleRestore = async (name) => {
    try { await axios.post(`${API_BASE_URL}/files/restore?name=${name}`, {}, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }); fetchItems(); fetchTrash(); fetchActivities(); } catch (e) { alert('Hata!'); }
  };

  const fetchVersions = async (name) => {
    try { const res = await axios.get(`${API_BASE_URL}/files/versions?name=${name}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }); setSelectedFileVersions({ name, versions: res.data.versions || [] }); } catch (e) { alert('Sürüm bilgisi alınamadı'); }
  };

  const isImage = (name) => { const ext = name.split('.').pop().toLowerCase(); return ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext); };

  const filteredItems = useMemo(() => items.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase())), [items, searchTerm]);
  const filteredTrash = useMemo(() => trashFiles.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase())), [trashFiles, searchTerm]);

  const storageUsagePercent = Math.min(100, (stats.total_size_bytes / (settings.storage_limit_mb * 1024 * 1024)) * 100);
  const storageColor = storageUsagePercent > 90 ? '#ef4444' : storageUsagePercent > 70 ? '#f59e0b' : theme.primary;

  const StorageCircle = ({ percent, color }) => {
    const radius = 35;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percent / 100) * circumference;
    return (
      <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="40" cy="40" r={radius} stroke={theme.border} strokeWidth="6" fill="transparent" />
        <circle cx="40" cy="40" r={radius} stroke={color} strokeWidth="6" fill="transparent" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease-in-out' }} />
      </svg>
    );
  };

  const Breadcrumbs = () => {
    const parts = currentPath.split('/').filter(p => p);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.9rem', color: theme.subText }}>
        <span onClick={() => setCurrentPath('')} style={{ cursor: 'pointer', fontWeight: currentPath === '' ? '800' : '500', color: currentPath === '' ? theme.primary : theme.subText }}>Root</span>
        {parts.map((p, idx) => {
          const path = parts.slice(0, idx + 1).join('/') + '/';
          return (
            <React.Fragment key={idx}><Lucide.ChevronRight size={14} /><span onClick={() => setCurrentPath(path)} style={{ cursor: 'pointer', fontWeight: currentPath === path ? '800' : '500', color: currentPath === path ? theme.primary : theme.subText }}>{p}</span></React.Fragment>
          );
        })}
      </div>
    );
  };

  const parseActivity = (details) => {
    const emailMatch = details.match(/\(Kullanıcı: (.*?)\)/);
    const email = emailMatch ? emailMatch[1] : null;
    const cleanDetails = details.replace(/\(Kullanıcı: (.*?)\)/, '').trim();
    return { email, cleanDetails };
  };

  if (isCheckingAuth) return <div style={{ height: '100vh', background: theme.bg, color: theme.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Yükleniyor...</div>;

  if (!isAuthenticated) {
    return (
      <div style={{ height: '100vh', background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '380px', padding: '3rem', borderRadius: '1.5rem', background: theme.card, border: `1px solid ${theme.border}`, textAlign: 'center' }}>
          <Lucide.Shield color={theme.primary} size={48} style={{ marginBottom: '1.5rem' }} />
          <h2 style={{ color: theme.text, fontSize: '1.5rem', fontWeight: 700, marginBottom: '2rem' }}>CloudGuard</h2>
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {!isLoginView && <input type="text" placeholder="Ad Soyad" style={{ padding: '0.8rem', border: `1px solid ${theme.border}`, borderRadius: '0.5rem', background: 'transparent', color: theme.text }} value={authForm.full_name} onChange={e => setAuthForm({ ...authForm, full_name: e.target.value })} />}
            <input type="email" placeholder="Email" style={{ padding: '0.8rem', border: `1px solid ${theme.border}`, borderRadius: '0.5rem', background: 'transparent', color: theme.text }} value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} />
            <input type="password" placeholder="Şifre" style={{ padding: '0.8rem', border: `1px solid ${theme.border}`, borderRadius: '0.5rem', background: 'transparent', color: theme.text }} value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} />
            <button type="submit" style={{ padding: '0.8rem', background: theme.primary, color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 'bold', cursor: 'pointer' }}>Giriş</button>
          </form>
          <p onClick={() => setIsLoginView(!isLoginView)} style={{ marginTop: '1.5rem', color: theme.subText, cursor: 'pointer', fontSize: '0.9rem' }}>{isLoginView ? 'Hesap oluştur' : 'Giriş yap'}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: theme.bg, color: theme.text, fontFamily: 'Inter, system-ui, sans-serif', position: 'relative' }} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      {isDragging && (
        <div style={{ position: 'fixed', inset: 0, background: `${theme.primary}15`, backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `4px dashed ${theme.primary}`, margin: '1rem', borderRadius: '2rem', pointerEvents: 'none' }}>
          <div style={{ textAlign: 'center', color: theme.primary }}><Lucide.UploadCloud size={80} style={{ marginBottom: '1rem' }} /><h2 style={{ fontSize: '2rem', fontWeight: 800 }}>Dosyaları Buraya Bırak</h2><p style={{ fontWeight: '600' }}>{currentPath ? `${currentPath} klasörüne yüklenecek` : 'Root dizinine yüklenecek'}</p></div>
        </div>
      )}

      <aside style={{ width: '280px', background: theme.sidebar, borderRight: `1px solid ${theme.border}`, padding: '2rem', display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '3rem' }}><Lucide.Cloud color={theme.primary} size={24} /><span style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.5px' }}>CloudGuard</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          {['Dashboard', 'Yedekler', 'Çöp Kutusu', 'Analiz', 'Günlük', 'Ayarlar'].map(id => (
            <div key={id} onClick={() => { setActiveTab(id); setSearchTerm(''); if (id === 'Yedekler') setCurrentPath(''); }} style={{ padding: '0.8rem 1rem', borderRadius: '0.75rem', cursor: 'pointer', background: activeTab === id ? `${theme.primary}15` : 'transparent', color: activeTab === id ? theme.primary : theme.subText, display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: '600', transition: '0.2s' }}>
              {id === 'Dashboard' && <Lucide.Layout size={18} />}{id === 'Yedekler' && <Lucide.Database size={18} />}{id === 'Çöp Kutusu' && <Lucide.Trash2 size={18} />}{id === 'Analiz' && <Lucide.BarChart2 size={18} />}{id === 'Günlük' && <Lucide.Activity size={18} />}{id === 'Ayarlar' && <Lucide.Settings size={18} />}
              {id}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <button onClick={() => setIsDarkMode(!isDarkMode)} style={{ width: '100%', padding: '0.7rem', borderRadius: '0.75rem', border: `1px solid ${theme.border}`, background: 'transparent', color: theme.text, cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}>{isDarkMode ? 'Aydınlık Mod' : 'Karanlık Mod'}</button>
          <div style={{ padding: '1.25rem', background: theme.surface, borderRadius: '1.25rem', border: `1px solid ${theme.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: theme.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{currentUser?.first_name?.[0]}{currentUser?.last_name?.[0]}</div>
              <div style={{ overflow: 'hidden' }}><p style={{ fontWeight: '700', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser?.first_name} {currentUser?.last_name}</p><p style={{ fontSize: '0.75rem', color: theme.subText, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser?.email}</p></div>
            </div>
            <button onClick={() => { localStorage.removeItem('token'); window.location.reload(); }} style={{ width: '100%', padding: '0.6rem', borderRadius: '0.75rem', background: 'transparent', border: `1px solid ${theme.border}`, color: '#ef4444', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}><Lucide.LogOut size={14} /> Çıkış Yap</button>
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, padding: '4rem', maxWidth: '1100px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3.5rem' }}>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-1px' }}>{activeTab}</h1>
          {(activeTab === 'Yedekler' || activeTab === 'Çöp Kutusu') && (
            <div style={{ position: 'relative' }}><Lucide.Search size={18} color={theme.subText} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} /><input type="text" placeholder="Dosyalarda ara..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ padding: '0.75rem 1rem 0.75rem 3rem', borderRadius: '0.75rem', border: `1px solid ${theme.border}`, background: theme.card, color: theme.text, width: '300px', fontSize: '0.9rem', outline: 'none' }} /></div>
          )}
        </div>

        {activeTab === 'Dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem' }}>
              <div style={{ padding: '1.5rem', background: theme.card, borderRadius: '1.5rem', border: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><StorageCircle percent={storageUsagePercent} color={storageColor} /><span style={{ position: 'absolute', fontWeight: '800', fontSize: '0.7rem' }}>%{Math.round(storageUsagePercent)}</span></div>
                <div style={{ textAlign: 'right' }}><p style={{ color: theme.subText, fontSize: '0.65rem', fontWeight: '800' }}>DEPOLAMA</p><p style={{ fontSize: '1rem', fontWeight: 800 }}>{(stats.total_size_bytes / (1024 * 1024)).toFixed(1)} MB</p></div>
              </div>
              <div style={{ padding: '1.5rem', background: theme.card, borderRadius: '1.5rem', border: `1px solid ${theme.border}` }}><p style={{ color: theme.subText, fontSize: '0.75rem', fontWeight: '800', marginBottom: '0.5rem' }}>DOSYALAR</p><h2 style={{ fontSize: '2rem', fontWeight: 800 }}>{stats.total_count || 0}</h2></div>
              <div style={{ padding: '1.5rem', background: theme.card, borderRadius: '1.5rem', border: `1px solid ${theme.border}` }}><p style={{ color: theme.subText, fontSize: '0.75rem', fontWeight: '800', marginBottom: '0.5rem' }}>AKTİVİTE</p><h2 style={{ fontSize: '2rem', fontWeight: 800 }}>{activities.length}</h2></div>
              <div style={{ padding: '1.5rem', background: `linear-gradient(135deg, ${theme.primary}, #6366f1)`, borderRadius: '1.5rem', color: 'white', border: 'none', boxShadow: `0 10px 20px -5px ${theme.primary}40` }}>
                <p style={{ opacity: 0.8, fontSize: '0.7rem', fontWeight: '800', marginBottom: '0.5rem' }}>OTOMATİK YEDEKLEME</p>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{countdown}</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.4rem', opacity: 0.7, fontSize: '0.65rem' }}>
                  <p>{settings.last_backup_at ? `Son: ${new Date(settings.last_backup_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Henüz yedek yok'}</p>
                  <p style={{ fontWeight: '800' }}>Sunucu: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            </div>
            <div style={{ padding: '5rem 2rem', background: theme.card, border: `2px dashed ${theme.border}`, borderRadius: '2rem', textAlign: 'center' }}>
              <Lucide.UploadCloud size={48} color={theme.primary} style={{ marginBottom: '1.5rem' }} /><h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Yeni Dosya Ekle</h3><p style={{ color: theme.subText, marginBottom: '2rem' }}>Dosyaları sürükleyip bırakabilir veya butona basabilirsiniz.</p>
              <label style={{ padding: '1rem 3rem', background: theme.primary, color: 'white', borderRadius: '0.75rem', fontWeight: '800', cursor: 'pointer', display: 'inline-block', boxShadow: `0 10px 15px -3px ${theme.primary}40` }}>
                {isUploading ? 'Yükleniyor...' : 'Bilgisayardan Seç'}<input type="file" style={{ display: 'none' }} onChange={e => e.target.files[0] && handleUpload(e.target.files[0])} disabled={isUploading} />
              </label>
            </div>
          </div>
        )}

        {activeTab === 'Analiz' && analyticsData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
              <div style={{ padding: '2rem', background: theme.card, borderRadius: '1.5rem', border: `1px solid ${theme.border}` }}>
                <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}><Lucide.PieChart size={20} color={theme.primary} /> Dosya Türü Dağılımı</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {Object.entries(analyticsData.distribution.sizes).map(([type, size]) => {
                    const percent = analyticsData.total_active_size > 0 ? (size / analyticsData.total_active_size) * 100 : 0;
                    return (
                      <div key={type}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                          <span style={{ fontWeight: '700' }}>{type}</span>
                          <span style={{ color: theme.subText }}>{(size / 1024).toFixed(1)} KB (%{Math.round(percent)})</span>
                        </div>
                        <div style={{ height: '8px', background: theme.surface, borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${percent}%`, background: theme.primary, borderRadius: '4px' }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ padding: '2rem', background: theme.card, borderRadius: '1.5rem', border: `1px solid ${theme.border}` }}>
                <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}><Lucide.ArrowUpRight size={20} color={theme.primary} /> En Büyük 5 Dosya</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {analyticsData.top_files.map((f, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: theme.surface, borderRadius: '0.75rem', fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>{f.name}</span>
                      <span style={{ fontWeight: '800', color: theme.primary }}>{(f.size / 1024).toFixed(1)} KB</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Ayarlar' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ padding: '2.5rem', background: theme.card, borderRadius: '2rem', border: `1px solid ${theme.border}` }}>
              <h3 style={{ fontWeight: 800, fontSize: '1.25rem', marginBottom: '2.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}><Lucide.ShieldCheck size={24} color={theme.primary} /> Güvenlik ve Profil</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}><label style={{ fontSize: '0.85rem', fontWeight: '700', color: theme.subText }}>Email Adresi</label><input type="text" value={currentUser?.email} disabled style={{ padding: '0.8rem', borderRadius: '0.75rem', border: `1px solid ${theme.border}`, background: theme.surface, color: theme.subText }} /></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}><label style={{ fontSize: '0.85rem', fontWeight: '700', color: theme.subText }}>Yeni Şifre</label><input type="password" placeholder="********" style={{ padding: '0.8rem', borderRadius: '0.75rem', border: `1px solid ${theme.border}`, background: 'transparent', color: theme.text }} /></div>
              </div>
              <button onClick={() => alert('Şifre güncelleme özelliği bir sonraki güvenlik paketinde aktif edilecek!')} style={{ padding: '0.8rem 2rem', background: theme.primary, color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: '800', cursor: 'pointer', boxShadow: `0 10px 15px -3px ${theme.primary}30` }}>Profili Güncelle</button>
            </div>

            <div style={{ padding: '2.5rem', background: theme.card, borderRadius: '2rem', border: `1px solid ${theme.border}` }}>
              <h3 style={{ fontWeight: 800, fontSize: '1.25rem', marginBottom: '2.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}><Lucide.Clock size={24} color={theme.primary} /> Otomatik Yedekleme Ayarları</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem', background: theme.surface, borderRadius: '1.25rem' }}>
                  <div><p style={{ fontWeight: '800', marginBottom: '0.25rem' }}>Yedekleme Durumu</p><p style={{ fontSize: '0.85rem', color: theme.subText }}>Her gün otomatik snapshot alınır.</p></div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={() => triggerManualBackup()} style={{ padding: '0.6rem 1.25rem', borderRadius: '0.75rem', border: `1px solid ${theme.primary}`, background: 'transparent', color: theme.primary, fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Lucide.Zap size={16} /> Şimdi Yedekle</button>
                    <button onClick={() => setSettings({ ...settings, backup_enabled: !settings.backup_enabled })} style={{ padding: '0.6rem 1.5rem', borderRadius: '0.75rem', border: 'none', background: settings.backup_enabled ? '#10b981' : theme.subText, color: 'white', fontWeight: '800', cursor: 'pointer' }}>{settings.backup_enabled ? 'Aktif' : 'Pasif'}</button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}><label style={{ fontSize: '0.85rem', fontWeight: '700', color: theme.subText }}>Yedekleme Saati</label><input type="time" value={settings.backup_time} onChange={e => setSettings({ ...settings, backup_time: e.target.value })} style={{ padding: '0.8rem', borderRadius: '0.75rem', border: `1px solid ${theme.border}`, background: 'transparent', color: theme.text }} /></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}><label style={{ fontSize: '0.85rem', fontWeight: '700', color: theme.subText }}>Depolama Limiti (MB)</label><input type="number" value={settings.storage_limit_mb} onChange={e => setSettings({ ...settings, storage_limit_mb: parseInt(e.target.value) })} style={{ padding: '0.8rem', borderRadius: '0.75rem', border: `1px solid ${theme.border}`, background: 'transparent', color: theme.text }} /></div>
                </div>
                <button onClick={() => updateSettings(settings)} style={{ alignSelf: 'flex-start', padding: '0.8rem 2rem', background: theme.primary, color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: `0 10px 15px -3px ${theme.primary}30` }}><Lucide.Save size={18} /> Ayarları Kaydet</button>
              </div>
            </div>
            <p style={{ textAlign: 'center', color: theme.subText, fontSize: '0.8rem' }}>Değişiklikler anında bulut sunucularına iletilir.</p>
          </div>
        )}

        {activeTab === 'Yedekler' && (
          <><Breadcrumbs /><div style={{ background: theme.card, borderRadius: '1.5rem', border: `1px solid ${theme.border}`, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: theme.surface, color: theme.subText, fontSize: '0.85rem', textAlign: 'left' }}><tr><th style={{ padding: '1.25rem' }}>AD</th><th style={{ padding: '1.25rem' }}>BOYUT</th><th style={{ padding: '1.25rem', textAlign: 'right' }}>İŞLEM</th></tr></thead>
              <tbody>{filteredItems.length === 0 ? <tr><td colSpan="3" style={{ padding: '4rem', textAlign: 'center', color: theme.subText }}>Liste boş.</td></tr> : filteredItems.map((f, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${theme.border}`, cursor: f.is_folder ? 'pointer' : 'default' }} onClick={() => f.is_folder && setCurrentPath(f.full_path)}>
                  <td style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    {f.is_folder ? (<div style={{ width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${theme.primary}15` }}><Lucide.Folder size={24} color={theme.primary} fill={theme.primary} /></div>) : isImage(f.name) ? (<div style={{ width: '48px', height: '48px', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${theme.border}`, background: theme.surface }}><img src={`${API_BASE_URL}/download?name=${encodeURIComponent(f.full_path)}&token=${localStorage.getItem('token')}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="preview" /></div>) : (<div style={{ width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme.surface }}><Lucide.File size={24} color={theme.subText} /></div>)}
                    <span style={{ fontWeight: '600' }}>{f.name}</span>
                  </td>
                  <td style={{ padding: '1.25rem', color: theme.subText }}>{f.is_folder ? '--' : `${(f.size / 1024).toFixed(2)} KB`}</td>
                  <td style={{ padding: '1.25rem', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }} onClick={e => e.stopPropagation()}>{!f.is_folder && (<><button onClick={() => fetchVersions(f.full_path)} style={{ padding: '0.5rem', border: `1px solid ${theme.border}`, background: 'transparent', borderRadius: '0.5rem', cursor: 'pointer', color: theme.text }}><Lucide.History size={16} /></button><button onClick={() => handleDownload(f.full_path)} style={{ padding: '0.5rem', border: `1px solid ${theme.border}`, background: 'transparent', borderRadius: '0.5rem', cursor: 'pointer', color: theme.text }}><Lucide.Download size={16} /></button><button onClick={() => handleDelete(f.full_path)} style={{ padding: '0.5rem', border: `1px solid ${theme.border}`, background: 'transparent', borderRadius: '0.5rem', cursor: 'pointer', color: '#ef4444' }}><Lucide.Trash2 size={16} /></button></>)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div></>
        )}

        {activeTab === 'Çöp Kutusu' && (
          <div style={{ background: theme.card, borderRadius: '1.5rem', border: `1px solid ${theme.border}`, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: theme.surface, color: theme.subText, fontSize: '0.85rem', textAlign: 'left' }}><tr><th style={{ padding: '1.25rem' }}>DOSYA</th><th style={{ padding: '1.25rem' }}>BOYUT</th><th style={{ padding: '1.25rem', textAlign: 'right' }}>İŞLEM</th></tr></thead>
              <tbody>{filteredTrash.length === 0 ? <tr><td colSpan="3" style={{ padding: '4rem', textAlign: 'center', color: theme.subText }}>Çöp kutusu boş.</td></tr> : filteredTrash.map((f, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${theme.border}` }}>
                  <td style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}><div style={{ width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme.surface }}><Lucide.FileMinus size={24} color={theme.subText} /></div><span style={{ fontWeight: '600' }}>{f.name}</span></td>
                  <td style={{ padding: '1.25rem', color: theme.subText }}>{(f.size / 1024).toFixed(2)} KB</td>
                  <td style={{ padding: '1.25rem', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}><button onClick={() => handleRestore(f.name)} style={{ padding: '0.5rem 1rem', border: `1px solid ${theme.border}`, background: theme.primary, color: 'white', borderRadius: '0.6rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>Kurtar</button><button onClick={() => handleDelete(f.full_path, true)} style={{ padding: '0.5rem', border: `1px solid ${theme.border}`, background: 'transparent', borderRadius: '0.5rem', cursor: 'pointer', color: '#ef4444' }}><Lucide.XCircle size={16} /></button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {activeTab === 'Günlük' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {activities.map((a, i) => {
              const { email, cleanDetails } = parseActivity(a.details);
              const isDelete = a.action.toLowerCase().includes('delete');
              const isUpload = a.action.toLowerCase().includes('upload');
              const badgeColor = isDelete ? '#ef4444' : isUpload ? theme.primary : '#10b981';
              return (
                <div key={i} style={{ padding: '1.25rem', background: theme.card, borderRadius: '1.5rem', border: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: '0.2s' }}>
                  <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: `${badgeColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: badgeColor, fontWeight: '800', fontSize: '0.9rem', border: `1px solid ${badgeColor}25` }}>{email ? email[0].toUpperCase() : 'S'}</div>
                    <div><div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}><span style={{ padding: '0.2rem 0.6rem', borderRadius: '6px', background: `${badgeColor}15`, color: badgeColor, fontSize: '0.7rem', fontWeight: '800', letterSpacing: '0.5px' }}>{a.action.toUpperCase()}</span>{email && <span style={{ fontSize: '0.85rem', fontWeight: '700', color: theme.text }}>{email}</span>}</div><p style={{ color: theme.subText, fontSize: '0.85rem' }}>{cleanDetails}</p></div>
                  </div>
                  <div style={{ textAlign: 'right' }}><p style={{ fontSize: '0.8rem', fontWeight: '700', color: theme.text }}>{new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p><p style={{ fontSize: '0.7rem', color: theme.subText }}>{new Date(a.timestamp).toLocaleDateString()}</p></div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {selectedFileVersions && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: theme.card, padding: '2.5rem', borderRadius: '2rem', width: '500px', border: `1px solid ${theme.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}><div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}><Lucide.GitBranch size={24} color={theme.primary} /><h3 style={{ fontWeight: 800, fontSize: '1.25rem' }}>Sürüm Geçmişi</h3></div><Lucide.X style={{ cursor: 'pointer' }} onClick={() => setSelectedFileVersions(null)} /></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', maxHeight: '450px', overflowY: 'auto' }}>
              {selectedFileVersions.versions.length === 0 ? <p style={{ color: theme.subText, textAlign: 'center', padding: '3rem' }}>Henüz sürüm kaydı bulunamadı.</p> : selectedFileVersions.versions.map((v, i) => (
                <div key={i} style={{ display: 'flex', gap: '1.5rem', position: 'relative' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}><div style={{ width: '12px', height: '12px', borderRadius: '50%', background: i === 0 ? theme.primary : theme.border, zIndex: 1, marginTop: '5px' }}></div>{i !== selectedFileVersions.versions.length - 1 && <div style={{ width: '2px', flex: 1, background: theme.border }}></div>}</div>
                  <div style={{ flex: 1, paddingBottom: '2rem' }}>
                    <div style={{ padding: '1.25rem', background: theme.surface, borderRadius: '1.25rem', border: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}><div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Lucide.User size={14} color={theme.primary} /><p style={{ fontSize: '0.9rem', fontWeight: 700 }}>{v.uploader || 'System'}</p></div><p style={{ fontSize: '0.8rem', color: theme.subText, display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Lucide.Clock size={12} /> {new Date(v.updated).toLocaleString()}</p><p style={{ fontSize: '0.7rem', color: theme.subText, fontFamily: 'monospace', opacity: 0.7 }}>SHA: {String(v.generation).slice(-8)}</p></div>
                      <button onClick={() => handleDownload(selectedFileVersions.name, v.generation)} style={{ padding: '0.6rem 1.25rem', background: theme.card, border: `1px solid ${theme.border}`, borderRadius: '0.8rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Lucide.RotateCcw size={14} /> Geri Yükle</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', fontSize: '0.75rem', color: theme.subText, fontWeight: '700', opacity: 0.5 }}>{VERSION}</div>
    </div>
  );
}

export default App;
