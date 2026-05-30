import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import * as Lucide from 'lucide-react';

const VERSION = "v1.2.0";
const API_BASE_URL = 'http://127.0.0.1:8000';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true); // Default to dark mode for rich aesthetics
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
  const [isGridView, setIsGridView] = useState(true); // Default to beautiful grid card views
  const [monitoringData, setMonitoringData] = useState(null);
  const [isMonitoringLoading, setIsMonitoringLoading] = useState(false);
  const [backupNote, setBackupNote] = useState('');

  // Settings State
  const [settings, setSettings] = useState({
    backup_time: "00:00",
    storage_limit_mb: 100,
    backup_enabled: true
  });

  // 1. STABLE CALLBACKS FOR API INTEGRATION (Resolves eslint hoisting and exhaustive-deps)
  const initAuth = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (token && token !== "undefined") {
      try {
        const response = await axios.get(`${API_BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        setCurrentUser(response.data);
        setIsAuthenticated(true);
      } catch (err) {
        console.error("Auth check failed:", err);
        localStorage.removeItem('token');
      }
    }
    setIsCheckingAuth(false);
  }, []);

  const fetchItems = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/files?prefix=${currentPath}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      if (res.data.success) {
        setItems(res.data.items || []);
        setStats(res.data.stats || { total_size_bytes: 0, total_count: 0 });
      }
    } catch (err) {
      console.error("Fetch items failed:", err);
    }
  }, [currentPath]);

  const fetchTrash = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/files/trash`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      if (res.data.success) {
        setTrashFiles(res.data.files || []);
      }
    } catch (err) {
      console.error("Fetch trash failed:", err);
    }
  }, []);

  const fetchActivities = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/activities`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setActivities(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Fetch activities failed:", err);
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/analytics`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      if (res.data.success) {
        setAnalyticsData(res.data);
      }
    } catch (err) {
      console.error("Fetch analytics failed:", err);
    }
  }, []);

  const fetchMonitoring = useCallback(async () => {
    setIsMonitoringLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/analytics/monitoring`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      if (res.data.success) {
        setMonitoringData(res.data);
      }
    } catch (err) {
      console.error("Fetch monitoring failed:", err);
    } finally {
      setIsMonitoringLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/settings`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setSettings(res.data);
    } catch (err) {
      console.error("Fetch settings failed:", err);
    }
  }, []);

  // 2. HELPER RENDER FUNCTIONS (Declaring outside render scope or as pure layout functions resolves react-hooks/static-components)
  const renderStorageCircle = (percent, color) => {
    const radius = 35;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percent / 100) * circumference;
    return (
      <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="40" cy="40" r={radius} stroke={isDarkMode ? '#1e293b' : '#e2e8f0'} strokeWidth="5" fill="transparent" />
        <circle 
          cx="40" 
          cy="40" 
          r={radius} 
          stroke={color} 
          strokeWidth="6" 
          fill="transparent" 
          strokeDasharray={circumference} 
          strokeDashoffset={offset} 
          strokeLinecap="round" 
          style={{ transition: 'stroke-dashoffset 1s ease-in-out', filter: 'drop-shadow(0 0 4px ' + color + '50)' }} 
        />
      </svg>
    );
  };

  const renderBreadcrumbs = () => {
    const parts = currentPath.split('/').filter(p => p);
    return (
      <div className="flex items-center gap-2 mb-6 text-sm font-semibold text-slate-500 dark:text-slate-400">
        <span 
          onClick={() => setCurrentPath('')} 
          className={`cursor-pointer hover:text-blue-500 transition-colors flex items-center gap-1.5 ${currentPath === '' ? 'text-blue-500' : ''}`}
        >
          <Lucide.Home size={15} /> Root
        </span>
        {parts.map((p, idx) => {
          const path = parts.slice(0, idx + 1).join('/') + '/';
          return (
            <React.Fragment key={idx}>
              <Lucide.ChevronRight size={14} className="text-slate-450 dark:text-slate-600" />
              <span 
                onClick={() => setCurrentPath(path)} 
                className={`cursor-pointer hover:text-blue-500 transition-colors ${currentPath === path ? 'text-blue-500' : ''}`}
              >
                {p}
              </span>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  // 3. ACTION EVENT HANDLERS
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
    } catch (err) {
      console.error(err);
      alert('Hata! Bilgileri kontrol ediniz.');
    }
  };

  const updateSettings = async (newSettings) => {
    try {
      const res = await axios.post(`${API_BASE_URL}/settings`, newSettings, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      if (res.data.success) { setSettings(res.data.settings); alert('Ayarlar Kaydedildi'); }
    } catch (err) {
      console.error(err);
      alert('Hata!');
    }
  };

  const triggerManualBackup = async () => {
    try {
      const res = await axios.post(
        `${API_BASE_URL}/settings/backup-now`, 
        { note: backupNote.trim() }, 
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      if (res.data.success) {
        setBackupNote('');
        fetchSettings();
        fetchActivities();
        alert('Manuel yedekleme başarıyla tamamlandı!');
      }
    } catch (err) {
      console.error(err);
      alert('Hata!');
    }
  };

  const handleUpload = async (file) => {
    const note = window.prompt(`"${file.name}" dosyasını yüklemek için bir not ekleyin (Opsiyonel):`, "");
    if (note === null) return; // User cancelled
    
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      await axios.post(`${API_BASE_URL}/upload?folder=${currentPath}&note=${encodeURIComponent(note.trim())}`, formData, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'multipart/form-data' } });
      fetchItems(); fetchActivities();
    } catch (err) {
      console.error(err);
      alert('Hata!');
    } finally {
      setIsUploading(false);
    }
  };

  const onDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => { setIsDragging(false); };
  const onDrop = (e) => { e.preventDefault(); setIsDragging(false); const files = e.dataTransfer.files; if (files.length > 0) handleUpload(files[0]); };

  const handleDownload = (name, gen) => { window.open(`${API_BASE_URL}/download?name=${encodeURIComponent(name)}${gen ? `&generation=${gen}` : ''}&token=${localStorage.getItem('token')}`, '_blank'); };

  const handleDelete = async (name, purge = false) => {
    if (!window.confirm(purge ? 'Kalıcı olarak silinecek, emin misiniz?' : 'Çöp kutusuna taşınacak, emin misiniz?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/files?name=${name}&purge=${purge}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      fetchItems(); fetchTrash(); fetchActivities();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRestore = async (name) => {
    try {
      await axios.post(`${API_BASE_URL}/files/restore?name=${name}`, {}, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      fetchItems(); fetchTrash(); fetchActivities();
    } catch (err) {
      console.error(err);
      alert('Hata!');
    }
  };

  const fetchVersions = async (name) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/files/versions?name=${name}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setSelectedFileVersions({ name, versions: res.data.versions || [] });
    } catch (err) {
      console.error(err);
      alert('Sürüm bilgisi alınamadı');
    }
  };

  const isImage = (name) => { const ext = name.split('.').pop().toLowerCase(); return ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext); };

  const filteredItems = useMemo(() => items.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase())), [items, searchTerm]);
  const filteredTrash = useMemo(() => trashFiles.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase())), [trashFiles, searchTerm]);

  const chartData = useMemo(() => {
    if (!monitoringData || !monitoringData.data) return [];
    return monitoringData.data.map(d => {
      const total = d.total_requests || 0;
      return {
        ...d,
        client_error_rate: total > 0 ? (d.client_errors / total) * 100 : 0,
        server_error_rate: total > 0 ? (d.server_errors / total) * 100 : 0
      };
    });
  }, [monitoringData]);

  const storageUsagePercent = Math.min(100, (stats.total_size_bytes / (settings.storage_limit_mb * 1024 * 1024)) * 100);
  const storageColor = storageUsagePercent > 90 ? '#ef4444' : storageUsagePercent > 70 ? '#f59e0b' : '#3b82f6';

  const parseActivity = (details) => {
    const emailMatch = details.match(/\(Kullanıcı: (.*?)\)/);
    const email = emailMatch ? emailMatch[1] : null;
    const cleanDetails = details.replace(/\(Kullanıcı: (.*?)\)/, '').trim();
    return { email, cleanDetails };
  };

  // 4. REACT LIFE-CYCLE HOOKS (Placed at the bottom to ensure all dependency functions are initialized)
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchItems();
      fetchActivities();
      fetchSettings();
      if (activeTab === 'Çöp Kutusu') fetchTrash();
      if (activeTab === 'Analiz') {
        fetchAnalytics();
        fetchMonitoring();
      }
    }
  }, [isAuthenticated, activeTab, currentPath, fetchItems, fetchTrash, fetchActivities, fetchAnalytics, fetchSettings, fetchMonitoring]);
  /* eslint-enable react-hooks/set-state-in-effect */

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

  // 5. CONDITIONAL RENDER FOR LOADING AND AUTHENTICATION
  if (isCheckingAuth) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col gap-4 items-center justify-center text-slate-200">
        <Lucide.Loader2 className="w-10 h-10 animate-spin text-blue-500" />
        <span className="font-semibold text-lg tracking-wide">CloudGuard yükleniyor...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4 bg-[#030712] overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px] animate-pulse"></div>

        <div className="w-full max-w-md p-8 rounded-3xl bg-slate-900/40 backdrop-blur-xl border border-white/5 shadow-2xl relative z-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-blue-500/10 text-blue-500 mb-4 shadow-inner">
              <Lucide.ShieldCheck size={36} />
            </div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">CloudGuard Pro</h2>
            <p className="text-sm text-slate-450 mt-2">Akıllı Veri Yedekleme ve Kurtarma Sistemi</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {!isLoginView && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ad Soyad</label>
                <div className="relative">
                  <Lucide.User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-555" />
                  <input 
                    type="text" 
                    placeholder="Ad Soyad" 
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-white/5 bg-slate-950/40 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-550/20 focus:border-blue-500 transition-all text-sm"
                    value={authForm.full_name} 
                    onChange={e => setAuthForm({ ...authForm, full_name: e.target.value })} 
                    required={!isLoginView}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">E-posta Adresi</label>
              <div className="relative">
                <Lucide.Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-555" />
                <input 
                  type="email" 
                  placeholder="name@example.com" 
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-white/5 bg-slate-950/40 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-550/20 focus:border-blue-500 transition-all text-sm" 
                  value={authForm.email} 
                  onChange={e => setAuthForm({ ...authForm, email: e.target.value })} 
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Şifre</label>
              <div className="relative">
                <Lucide.Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-555" />
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-white/5 bg-slate-950/40 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-550/20 focus:border-blue-500 transition-all text-sm" 
                  value={authForm.password} 
                  onChange={e => setAuthForm({ ...authForm, password: e.target.value })} 
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-550 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all duration-200 active:scale-[0.98] cursor-pointer text-sm"
            >
              {isLoginView ? 'Giriş Yap' : 'Kayıt Ol'}
            </button>
          </form>

          <div className="mt-6 text-center border-t border-white/5 pt-4">
            <span className="text-sm text-slate-450">
              {isLoginView ? 'Hesabınız yok mu?' : 'Zaten üye misiniz?'}
            </span>{' '}
            <button 
              onClick={() => setIsLoginView(!isLoginView)} 
              className="text-sm font-bold text-blue-500 hover:text-blue-400 hover:underline cursor-pointer transition-colors"
            >
              {isLoginView ? 'Yeni Hesap Oluştur' : 'Giriş Yap'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="flex min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans transition-colors duration-300 relative grid-bg" 
      onDragOver={onDragOver} 
      onDragLeave={onDragLeave} 
      onDrop={onDrop}
    >
      {/* Background Decorative Ambient glowing lights */}
      <div className="absolute top-[10%] right-[-10%] w-[450px] h-[450px] rounded-full bg-blue-500/5 dark:bg-blue-600/5 blur-[120px] pointer-events-none -z-10 animate-pulse-slow"></div>
      <div className="absolute bottom-[10%] left-[-10%] w-[450px] h-[450px] rounded-full bg-indigo-500/5 dark:bg-indigo-600/5 blur-[120px] pointer-events-none -z-10 animate-float-slow"></div>

      {isDragging && (
        <div className="fixed inset-0 bg-blue-500/10 backdrop-blur-md z-[9999] flex items-center justify-center border-4 border-dashed border-blue-500 m-6 rounded-3xl pointer-events-none transition-all duration-300">
          <div className="text-center text-blue-500 bg-white dark:bg-slate-900 p-10 rounded-3xl shadow-2xl border border-blue-500/10">
            <Lucide.UploadCloud size={64} className="mx-auto mb-4 animate-bounce" />
            <h2 className="text-2xl font-extrabold tracking-tight">Dosyaları Buraya Bırak</h2>
            <p className="font-semibold text-slate-500 dark:text-slate-400 mt-1.5 text-sm">
              {currentPath ? `"${currentPath}" klasörüne yüklenecek` : 'Root dizinine yedeklenecek'}
            </p>
          </div>
        </div>
      )}

      {/* SIDEBAR (Sticky, in-flow side-by-side flex layout to prevent overlap) */}
      <aside className="w-72 h-screen sticky top-0 shrink-0 glass-sidebar p-6 flex flex-col z-40 transition-colors duration-300">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="p-2 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-500">
            <Lucide.Cloud size={22} className="dark:filter dark:drop-shadow-[0_0_4px_rgba(59,130,246,0.5)]" />
          </div>
          <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-350 bg-clip-text text-transparent">
            CloudGuard
          </span>
        </div>

        <nav className="flex-1 space-y-1">
          {[
            { id: 'Dashboard', label: 'Dashboard', icon: Lucide.Layout },
            { id: 'Yedekler', label: 'Yedekler', icon: Lucide.Database },
            { id: 'Çöp Kutusu', label: 'Çöp Kutusu', icon: Lucide.Trash2 },
            { id: 'Analiz', label: 'Analiz', icon: Lucide.BarChart2 },
            { id: 'Günlük', label: 'Günlük', icon: Lucide.Activity },
            { id: 'Ayarlar', label: 'Ayarlar', icon: Lucide.Settings }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <div 
                key={tab.id} 
                onClick={() => { 
                  setActiveTab(tab.id); 
                  setSearchTerm(''); 
                  if (tab.id === 'Yedekler') setCurrentPath(''); 
                }} 
                className={`relative flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer font-semibold text-sm transition-all duration-200 group ${
                  isActive 
                    ? 'bg-blue-500/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/20 shadow-sm' 
                    : 'text-slate-500 dark:text-slate-450 hover:bg-slate-200/50 dark:hover:bg-slate-900/40 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {isActive && (
                  <span className="absolute left-[-6px] top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-r-md bg-blue-500 shadow-[0_0_8px_#3b82f6]"></span>
                )}
                <Icon size={18} className={`transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-blue-500' : 'text-slate-400 dark:text-slate-500'}`} />
                <span>{tab.label}</span>
              </div>
            );
          })}
        </nav>

        <div className="mt-auto space-y-4 pt-4 border-t border-slate-200/50 dark:border-white/5">
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)} 
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/20 hover:bg-slate-200 dark:hover:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700 transition-all font-bold text-xs cursor-pointer text-slate-600 dark:text-slate-300"
          >
            {isDarkMode ? (
              <><Lucide.Sun size={14} className="text-yellow-500" /> Aydınlık Mod</>
            ) : (
              <><Lucide.Moon size={14} className="text-blue-500" /> Karanlık Mod</>
            )}
          </button>

          <div className="p-4 rounded-2xl bg-slate-100/50 dark:bg-slate-900/25 border border-slate-200/50 dark:border-white/5 shadow-inner">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/10">
                {currentUser?.first_name?.[0]?.toUpperCase()}{currentUser?.last_name?.[0]?.toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="font-extrabold text-sm text-slate-800 dark:text-slate-100 truncate">{currentUser?.first_name} {currentUser?.last_name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-450 truncate">{currentUser?.email}</p>
              </div>
            </div>
            <button 
              onClick={() => { localStorage.removeItem('token'); window.location.reload(); }} 
              className="w-full py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500 hover:text-white border border-red-500/20 text-red-500 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Lucide.LogOut size={13} /> Çıkış Yap
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 min-w-0 p-8 md:p-12 max-w-7xl min-h-screen transition-colors duration-300">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">{activeTab}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Sistem durumunu kontrol edin ve verilerinizi yönetin</p>
          </div>
          
          {(activeTab === 'Yedekler' || activeTab === 'Çöp Kutusu') && (
            <div className="flex items-center gap-3 w-full md:w-auto">
              {activeTab === 'Yedekler' && (
                <button 
                  onClick={() => setIsGridView(!isGridView)} 
                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-sm cursor-pointer"
                  title={isGridView ? "Liste Görünümü" : "Izgara Görünümü"}
                >
                  {isGridView ? <Lucide.List size={18} /> : <Lucide.LayoutGrid size={18} />}
                </button>
              )}
              <div className="relative w-full md:w-80">
                <Lucide.Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Dosyalarda ara..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* TAB CONTENTS */}
        {activeTab === 'Dashboard' && (
          <div className="space-y-8">
            {/* Stat Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Storage Stat Card */}
              <div className="glass-card-premium rounded-2xl p-5 flex items-center justify-between shadow-sm interactive-card glow-blue">
                <div className="relative flex items-center justify-center">
                  {renderStorageCircle(storageUsagePercent, storageColor)}
                  <span className="absolute font-extrabold text-xs text-slate-800 dark:text-slate-100">
                    %{Math.round(storageUsagePercent)}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-450 uppercase tracking-wider">Kullanım</p>
                  <p className="text-sm font-extrabold text-slate-800 dark:text-white mt-1">
                    {(stats.total_size_bytes / (1024 * 1024)).toFixed(2)} MB <span className="text-[10px] text-slate-400 font-medium">(Aktif)</span>
                  </p>
                  <p className="text-xs font-bold text-blue-500 dark:text-blue-400 mt-0.5">
                    {((stats.total_versions_size_bytes || 0) / (1024 * 1024)).toFixed(2)} MB <span className="text-[9px] text-slate-550 font-medium">(Toplam)</span>
                  </p>
                  <p className="text-[10px] text-slate-550 dark:text-slate-450 mt-1">Limit: {settings.storage_limit_mb} MB</p>
                </div>
              </div>

              {/* Files Stat Card */}
              <div className="glass-card-premium rounded-2xl p-5 flex items-center gap-4 shadow-sm interactive-card glow-blue">
                <div className="p-3.5 rounded-xl bg-blue-500/10 text-blue-500 shadow-inner dark:bg-blue-550/20 dark:text-blue-400">
                  <Lucide.FileText size={22} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-450 uppercase tracking-wider">Aktif Dosyalar</p>
                  <h2 className="text-2xl font-extrabold text-slate-850 dark:text-white mt-1">{stats.total_count || 0}</h2>
                  <p className="text-[10px] text-slate-500 dark:text-slate-450 mt-0.5">Bulutta saklanan</p>
                </div>
              </div>

              {/* Activity Stat Card */}
              <div className="glass-card-premium rounded-2xl p-5 flex items-center gap-4 shadow-sm interactive-card glow-emerald">
                <div className="p-3.5 rounded-xl bg-emerald-500/10 text-emerald-500 shadow-inner dark:bg-emerald-550/20 dark:text-emerald-400">
                  <Lucide.History size={22} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-450 uppercase tracking-wider">Aktivite Sayısı</p>
                  <h2 className="text-2xl font-extrabold text-slate-850 dark:text-white mt-1">{activities.length}</h2>
                  <p className="text-[10px] text-slate-500 dark:text-slate-450 mt-0.5">Son işlemler</p>
                </div>
              </div>

              {/* Auto Backup Stat Card */}
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl p-5 shadow-lg shadow-blue-500/20 interactive-card relative overflow-hidden glow-blue">
                <div className="absolute right-[-10px] bottom-[-10px] opacity-10 text-white pointer-events-none">
                  <Lucide.Clock size={110} />
                </div>
                <p className="text-xs font-bold text-white/80 uppercase tracking-wider">Otomatik Yedekleme</p>
                <h2 className="text-xl font-extrabold mt-1 tracking-tight">{countdown}</h2>
                <div className="mt-3 space-y-0.5 text-[10px] text-white/70">
                  <p>{settings.last_backup_at ? `Son Yedek: ${new Date(settings.last_backup_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Henüz yedek alınmadı'}</p>
                  <p className="font-semibold text-white/90">Hedef Saat: {settings.backup_time}</p>
                </div>
              </div>
            </div>

            {/* Drag & Drop Area */}
            <div className="p-16 bg-white/40 dark:bg-slate-900/10 border-2 border-dashed border-slate-200 dark:border-slate-800/80 rounded-3xl text-center backdrop-blur-sm transition-all duration-300 hover:border-blue-500/40 hover:bg-blue-500/[0.015] group">
              <div className="max-w-md mx-auto">
                <div className="inline-flex items-center justify-center p-4.5 rounded-2xl bg-blue-500/10 text-blue-500 mb-6 transition-transform duration-300 group-hover:scale-110 shadow-inner dark:bg-blue-550/20 dark:text-blue-400">
                  <Lucide.UploadCloud size={38} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1.5 tracking-tight">Yeni Dosya Yükle</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                  Dosyalarınızı bu alana sürükleyip bırakabilir veya bilgisayarınızdan seçebilirsiniz.
                </p>
                <label className="inline-flex items-center gap-2 py-3 px-6 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-xl font-bold text-sm cursor-pointer shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all duration-200 active:scale-[0.98]">
                  {isUploading ? (
                    <><Lucide.Loader2 size={16} className="animate-spin" /> Yükleniyor...</>
                  ) : (
                    <><Lucide.FolderPlus size={16} /> Bilgisayardan Seç</>
                  )}
                  <input 
                    type="file" 
                    className="hidden" 
                    onChange={e => e.target.files[0] && handleUpload(e.target.files[0])} 
                    disabled={isUploading} 
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Analiz' && analyticsData && (
          <div className="space-y-8 animate-fade-in">
            {/* File Distribution and Top 5 Files Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* File Distribution Card */}
              <div className="p-6 bg-white dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/40 rounded-2xl shadow-sm backdrop-blur-md">
                <h3 className="font-extrabold text-base text-slate-800 dark:text-white mb-6 flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800/40">
                  <Lucide.PieChart size={18} className="text-blue-500" /> Dosya Türü Dağılımı
                </h3>
                <div className="space-y-5">
                  {Object.entries(analyticsData.distribution.sizes).map(([type, size]) => {
                    const percent = analyticsData.total_active_size > 0 ? (size / analyticsData.total_active_size) * 100 : 0;
                    return (
                      <div key={type} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-slate-700 dark:text-slate-300">{type}</span>
                          <span className="text-slate-500 dark:text-slate-400">
                            {(size / 1024).toFixed(1)} KB ({Math.round(percent)}%)
                          </span>
                        </div>
                        <div className="h-2.5 bg-slate-105 dark:bg-slate-800/80 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-1000"
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top 5 Files Card */}
              <div className="p-6 bg-white dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/40 rounded-2xl shadow-sm backdrop-blur-md">
                <h3 className="font-extrabold text-base text-slate-800 dark:text-white mb-6 flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800/40">
                  <Lucide.TrendingUp size={18} className="text-blue-500" /> En Büyük 5 Dosya
                </h3>
                <div className="space-y-3">
                  {analyticsData.top_files.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-10">Büyük dosya bulunamadı.</p>
                  ) : (
                    analyticsData.top_files.map((f, i) => (
                      <div key={i} className="flex justify-between items-center p-3.5 bg-slate-50 dark:bg-slate-900/20 border border-slate-200/30 dark:border-slate-800/30 rounded-xl interactive-card">
                        <div className="flex items-center gap-3 overflow-hidden pr-2">
                          <span className="text-xs font-bold text-slate-400 w-5 text-center">#{i+1}</span>
                          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-450 flex-shrink-0">
                            {isImage(f.name) ? <Lucide.Image size={16} /> : <Lucide.File size={16} />}
                          </div>
                          <span className="font-semibold text-sm truncate text-slate-800 dark:text-slate-200">{f.name}</span>
                        </div>
                        <span className="font-bold text-xs text-blue-500 flex-shrink-0 bg-blue-500/10 px-2.5 py-1 rounded-lg">
                          {(f.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Google Cloud Storage Monitoring Graphs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {isMonitoringLoading ? (
                <div className="lg:col-span-2 p-12 bg-white dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/40 rounded-2xl flex flex-col items-center justify-center gap-3 backdrop-blur-md min-h-[300px]">
                  <Lucide.Loader2 size={32} className="animate-spin text-blue-500" />
                  <p className="text-sm font-bold text-slate-500 dark:text-slate-400">GCS Altyapı İzleme Verileri Yükleniyor...</p>
                </div>
              ) : monitoringData ? (
                <>
                  <MonitoringChartCard 
                    title="Okuma ve Yazma İstek Sayıları"
                    data={monitoringData.data}
                    dataKeys={["read_requests", "write_requests"]}
                    colors={["#06b6d4", "#8b5cf6"]}
                    labels={["Okuma İstekleri", "Yazma İstekleri"]}
                    isMock={monitoringData.is_mock}
                    isDarkMode={isDarkMode}
                  />
                  <MonitoringChartCard 
                    title="Sunucu ve İstemci Hata Oranları"
                    data={chartData}
                    dataKeys={["client_error_rate", "server_error_rate"]}
                    colors={["#f97316", "#ef4444"]}
                    labels={["İstemci Hatası (4xx)", "Sunucu Hatası (5xx)"]}
                    isMock={monitoringData.is_mock}
                    isErrorChart={true}
                    formatter={(v) => `${v.toFixed(2)}%`}
                    isDarkMode={isDarkMode}
                  />
                </>
              ) : (
                <div className="lg:col-span-2 p-12 bg-white dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/40 rounded-2xl flex flex-col items-center justify-center gap-3 backdrop-blur-md">
                  <Lucide.AlertCircle size={32} className="text-amber-500" />
                  <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Altyapı izleme verileri alınamadı.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'Ayarlar' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Profile Settings */}
            <div className="p-6 bg-white dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/40 rounded-2xl shadow-sm backdrop-blur-md">
              <h3 className="font-extrabold text-base text-slate-800 dark:text-white mb-6 flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800/40">
                <Lucide.UserCheck size={18} className="text-blue-500" /> Profil Bilgileri
              </h3>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-455 uppercase tracking-wider">E-posta Adresi</label>
                  <input 
                    type="text" 
                    value={currentUser?.email} 
                    disabled 
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 text-slate-450 text-sm focus:outline-none cursor-not-allowed" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-455 uppercase tracking-wider">Yeni Şifre</label>
                  <input 
                    type="password" 
                    placeholder="••••••••" 
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                  />
                </div>
                <button 
                  onClick={() => alert('Şifre güncelleme özelliği bir sonraki güvenlik paketinde aktif edilecek!')} 
                  className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/10 transition-all cursor-pointer mt-2"
                >
                  Profili Güncelle
                </button>
              </div>
            </div>

            {/* Backup Settings */}
            <div className="p-6 bg-white dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/40 rounded-2xl shadow-sm backdrop-blur-md">
              <h3 className="font-extrabold text-base text-slate-800 dark:text-white mb-6 flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800/40">
                <Lucide.Settings2 size={18} className="text-blue-500" /> Otomatik Yedekleme Ayarları
              </h3>
              <div className="space-y-5">
                {/* Otomatik Snapshot */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-slate-50 dark:bg-slate-900/30 border border-slate-200/30 dark:border-slate-800/30 rounded-xl gap-4">
                  <div>
                    <p className="font-extrabold text-sm text-slate-800 dark:text-slate-200">Otomatik Snapshot</p>
                    <p className="text-xs text-slate-500 dark:text-slate-450 mt-0.5">Her gün belirlenen saatte yedek oluşturur.</p>
                  </div>
                  <div className="w-full sm:w-auto">
                    <button 
                      onClick={() => setSettings({ ...settings, backup_enabled: !settings.backup_enabled })} 
                      className={`w-full sm:w-auto py-1.5 px-4 rounded-lg font-bold text-xs text-white cursor-pointer transition-colors ${
                        settings.backup_enabled ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-500 hover:bg-slate-650'
                      }`}
                    >
                      {settings.backup_enabled ? 'Aktif' : 'Pasif'}
                    </button>
                  </div>
                </div>

                {/* Manuel Snapshot */}
                <div className="flex flex-col gap-3.5 p-4 bg-slate-50 dark:bg-slate-900/30 border border-slate-200/30 dark:border-slate-800/30 rounded-xl">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <p className="font-extrabold text-sm text-slate-800 dark:text-slate-200">Manuel Snapshot</p>
                      <p className="text-xs text-slate-500 dark:text-slate-450 mt-0.5">Sistemdeki dosyaların anlık arşiv yedeğini oluşturur.</p>
                    </div>
                    <div className="w-full sm:w-auto">
                      <button 
                        onClick={() => triggerManualBackup()} 
                        className="w-full sm:w-auto flex items-center justify-center gap-1.5 py-1.5 px-4 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors text-xs font-bold cursor-pointer shadow-md shadow-blue-500/10"
                      >
                        <Lucide.Zap size={13} /> Şimdi Yedekle
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-550 dark:text-slate-450 uppercase tracking-wider">Yedekleme Notu (Opsiyonel)</label>
                    <input 
                      type="text" 
                      placeholder="Örn: v1.0 stabil sürüm, final sunum yedeği..."
                      value={backupNote}
                      onChange={e => setBackupNote(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-455 uppercase tracking-wider">Yedekleme Saati</label>
                    <input 
                      type="time" 
                      value={settings.backup_time} 
                      onChange={e => setSettings({ ...settings, backup_time: e.target.value })} 
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-455 uppercase tracking-wider">Depolama Limiti (MB)</label>
                    <input 
                      type="number" 
                      value={settings.storage_limit_mb} 
                      onChange={e => setSettings({ ...settings, storage_limit_mb: parseInt(e.target.value) })} 
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                    />
                  </div>
                </div>
                <button 
                  onClick={() => updateSettings(settings)} 
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/10 transition-all cursor-pointer mt-2"
                >
                  <Lucide.Save size={16} /> Ayarları Kaydet
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Yedekler' && (
          <div className="space-y-4">
            {renderBreadcrumbs()}

            {isGridView ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {filteredItems.length === 0 ? (
                  <div className="col-span-full p-16 text-center text-slate-500 dark:text-slate-400 font-medium glass-card-premium rounded-2xl">
                    <Lucide.FolderOpen size={48} className="mx-auto mb-4 text-slate-400/30" />
                    Bulutta yedeklenmiş dosya veya klasör bulunamadı.
                  </div>
                ) : (
                  filteredItems.map((f, i) => (
                    <div 
                      key={i}
                      onClick={() => f.is_folder && setCurrentPath(f.full_path)}
                      className={`glass-card-premium rounded-2xl p-5 flex flex-col justify-between group relative cursor-pointer min-h-[140px] ${
                        f.is_folder ? 'hover:border-blue-500/40' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        {f.is_folder ? (
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-blue-550/10 text-blue-500 shadow-inner dark:bg-blue-550/20 dark:text-blue-400">
                            <Lucide.Folder size={24} fill="#3b82f6" />
                          </div>
                        ) : isImage(f.name) ? (
                          <div className="w-12 h-12 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm flex-shrink-0 relative">
                            <img 
                              src={`${API_BASE_URL}/download?name=${encodeURIComponent(f.full_path)}&token=${localStorage.getItem('token')}`} 
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" 
                              alt="preview" 
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-slate-100 dark:bg-slate-900/60 text-slate-450 shadow-inner">
                            <Lucide.FileText size={24} />
                          </div>
                        )}
                        
                        {/* Hover Actions */}
                        {!f.is_folder && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                            <button 
                              onClick={() => fetchVersions(f.full_path)} 
                              className="p-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-450 hover:text-blue-500 rounded-lg cursor-pointer transition-colors"
                              title="Sürüm Geçmişi"
                            >
                              <Lucide.History size={14} />
                            </button>
                            <button 
                              onClick={() => handleDownload(f.full_path)} 
                              className="p-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-450 hover:text-blue-500 rounded-lg cursor-pointer transition-colors"
                              title="İndir"
                            >
                              <Lucide.Download size={14} />
                            </button>
                            <button 
                              onClick={() => handleDelete(f.full_path)} 
                              className="p-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-455 hover:text-red-500 rounded-lg cursor-pointer transition-colors"
                              title="Sil"
                            >
                              <Lucide.Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors" title={f.name}>
                          {f.name}
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-1 font-medium">
                          {f.is_folder ? 'Klasör' : `${(f.size / 1024).toFixed(2)} KB`}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/40 rounded-2xl shadow-sm overflow-hidden backdrop-blur-md">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200/50 dark:border-slate-800/40 text-xs font-bold uppercase tracking-wider text-slate-400">
                        <th className="p-4 pl-6">Ad</th>
                        <th className="p-4">Boyut</th>
                        <th className="p-4 pr-6 text-right">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/50 dark:divide-slate-800/30 text-sm">
                      {filteredItems.length === 0 ? (
                        <tr>
                          <td colSpan="3" className="p-12 text-center text-slate-500 dark:text-slate-400 font-medium">
                            <Lucide.FolderOpen size={36} className="mx-auto mb-3 opacity-40 text-slate-400" />
                            Bu klasör boş.
                          </td>
                        </tr>
                      ) : (
                        filteredItems.map((f, i) => (
                          <tr 
                            key={i} 
                            className={`row-interactive border-b border-slate-100 dark:border-slate-800/30 ${f.is_folder ? 'cursor-pointer' : ''}`}
                            onClick={() => f.is_folder && setCurrentPath(f.full_path)}
                          >
                            <td className="p-4 pl-6 flex items-center gap-4">
                              {f.is_folder ? (
                                <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-blue-500/10 text-blue-500 shadow-inner">
                                  <Lucide.Folder size={20} fill="#3b82f6" />
                                </div>
                              ) : isImage(f.name) ? (
                                <div className="w-11 h-11 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm flex-shrink-0 group">
                                  <img 
                                    src={`${API_BASE_URL}/download?name=${encodeURIComponent(f.full_path)}&token=${localStorage.getItem('token')}`} 
                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" 
                                    alt="preview" 
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                  />
                                </div>
                              ) : (
                                <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 shadow-inner">
                                  <Lucide.FileText size={20} />
                                </div>
                              )}
                              <span className="font-semibold text-slate-700 dark:text-slate-200">{f.name}</span>
                            </td>
                            <td className="p-4 text-slate-500 dark:text-slate-400 font-medium">
                              {f.is_folder ? '--' : `${(f.size / 1024).toFixed(2)} KB`}
                            </td>
                            <td className="p-4 pr-6 text-right" onClick={e => e.stopPropagation()}>
                              {!f.is_folder && (
                                <div className="flex justify-end gap-1.5">
                                  <button 
                                    onClick={() => fetchVersions(f.full_path)} 
                                    className="p-2 border border-slate-200 dark:border-slate-850 hover:border-blue-500/30 hover:bg-blue-500/10 text-slate-500 dark:text-slate-400 hover:text-blue-500 rounded-lg cursor-pointer transition-all"
                                    title="Sürüm Geçmişi"
                                  >
                                    <Lucide.History size={15} />
                                  </button>
                                  <button 
                                    onClick={() => handleDownload(f.full_path)} 
                                    className="p-2 border border-slate-200 dark:border-slate-855 hover:border-blue-500/30 hover:bg-blue-500/10 text-slate-500 dark:text-slate-400 hover:text-blue-500 rounded-lg cursor-pointer transition-all"
                                    title="İndir"
                                  >
                                    <Lucide.Download size={15} />
                                  </button>
                                  <button 
                                    onClick={() => handleDelete(f.full_path)} 
                                    className="p-2 border border-slate-200 dark:border-slate-855 hover:border-red-500/30 hover:bg-red-500/10 text-slate-550 dark:text-slate-400 hover:text-red-500 rounded-lg cursor-pointer transition-all"
                                    title="Sil"
                                  >
                                    <Lucide.Trash2 size={15} />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'Çöp Kutusu' && (
          <div className="bg-white dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/40 rounded-2xl shadow-sm overflow-hidden backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200/50 dark:border-slate-800/40 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <th className="p-4 pl-6">Dosya Adı</th>
                    <th className="p-4">Boyut</th>
                    <th className="p-4 pr-6 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/50 dark:divide-slate-800/30 text-sm">
                  {filteredTrash.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="p-12 text-center text-slate-500 dark:text-slate-400 font-medium">
                        <Lucide.Trash size={36} className="mx-auto mb-3 opacity-40 text-slate-400" />
                        Çöp kutusu boş.
                      </td>
                    </tr>
                  ) : (
                    filteredTrash.map((f, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                        <td className="p-4 pl-6 flex items-center gap-4">
                          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 shadow-inner">
                            <Lucide.FileMinus size={20} />
                          </div>
                          <span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-xs md:max-w-md">{f.name}</span>
                        </td>
                        <td className="p-4 text-slate-500 dark:text-slate-400 font-medium">{(f.size / 1024).toFixed(2)} KB</td>
                        <td className="p-4 pr-6 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => handleRestore(f.name)} 
                              className="py-1.5 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg cursor-pointer text-xs font-bold transition-all"
                            >
                              Kurtar
                            </button>
                            <button 
                              onClick={() => handleDelete(f.full_path, true)} 
                              className="p-2 border border-slate-200 dark:border-slate-855 hover:border-red-500/30 hover:bg-red-500/10 text-slate-400 hover:text-red-500 rounded-lg cursor-pointer transition-all"
                              title="Kalıcı Olarak Sil"
                            >
                              <Lucide.XCircle size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'Günlük' && (
          <div className="space-y-4">
            {activities.length === 0 ? (
              <div className="bg-white dark:bg-slate-900/40 p-12 text-center text-slate-500 dark:text-slate-400 rounded-2xl border border-slate-200/50 dark:border-slate-800/40">
                Aktivite kaydı bulunamadı.
              </div>
            ) : (
              activities.map((a, i) => {
                const { email, cleanDetails } = parseActivity(a.details);
                const isDelete = a.action.toLowerCase().includes('delete');
                const isUpload = a.action.toLowerCase().includes('upload');
                const isError = a.action.toLowerCase().includes('error');
                const badgeColorClass = isDelete 
                  ? 'bg-red-500/10 text-red-500 border-red-500/20' 
                  : isUpload 
                  ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' 
                  : isError
                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';

                return (
                  <div key={i} className="p-4 bg-white dark:bg-slate-900/40 border border-slate-200/40 dark:border-slate-800/30 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm interactive-card">
                    <div className="flex gap-4 items-center">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shadow-inner ${badgeColorClass.split(' ')[0]} ${badgeColorClass.split(' ')[1]}`}>
                        {email ? email[0].toUpperCase() : 'S'}
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 border rounded-md tracking-wider uppercase ${badgeColorClass}`}>
                            {a.action}
                          </span>
                          {email && <span className="text-sm font-extrabold text-slate-700 dark:text-slate-200">{email}</span>}
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{cleanDetails}</p>
                        {a.note && (
                          <div className="mt-1 px-2.5 py-1 bg-slate-50 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/40 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 italic inline-block">
                            Not: {a.note}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-left sm:text-right border-t sm:border-t-0 border-slate-100 dark:border-slate-800/30 pt-2 sm:pt-0 w-full sm:w-auto flex sm:flex-col justify-between sm:justify-center items-center sm:items-end">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      <p className="text-[10px] text-slate-450 dark:text-slate-500 mt-0.5">{new Date(a.timestamp).toLocaleDateString()}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>

      {/* VERSION HISTORY MODAL */}
      {selectedFileVersions && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[1000] p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl w-full max-w-lg shadow-2xl relative">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                  <Lucide.GitBranch size={20} />
                </div>
                <h3 className="font-extrabold text-lg text-slate-800 dark:text-slate-100">Sürüm Geçmişi</h3>
              </div>
              <button 
                onClick={() => setSelectedFileVersions(null)} 
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <Lucide.X size={18} />
              </button>
            </div>

            <div className="max-h-[350px] overflow-y-auto pr-1 space-y-4">
              {selectedFileVersions.versions.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400 text-center py-10 text-sm">Sürüm kaydı bulunamadı.</p>
              ) : (
                selectedFileVersions.versions.map((v, i) => (
                  <div key={i} className="flex gap-4 relative">
                    <div className="flex flex-col items-center">
                      <div className={`w-3.5 h-3.5 rounded-full z-10 ${i === 0 ? 'bg-blue-500 ring-4 ring-blue-500/20' : 'bg-slate-350 dark:bg-slate-700'}`}></div>
                      {i !== selectedFileVersions.versions.length - 1 && (
                        <div className="w-0.5 flex-1 bg-slate-200 dark:bg-slate-855 my-1"></div>
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-800/30 rounded-2xl flex justify-between items-center gap-4">
                        <div className="space-y-1 overflow-hidden pr-2">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                            <Lucide.User size={13} className="text-blue-500" />
                            <span className="truncate">{v.uploader || 'System'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-450 dark:text-slate-500">
                            <Lucide.Clock size={11} />
                            <span>{new Date(v.updated).toLocaleString()}</span>
                          </div>
                          <p className="text-[10px] font-mono text-slate-400 dark:text-slate-550 truncate">Gen ID: {v.generation}</p>
                          {v.note && (
                            <p className="text-xs text-slate-500 dark:text-slate-450 font-semibold italic mt-1.5 border-t border-slate-100 dark:border-slate-800/40 pt-1">
                              Not: {v.note}
                            </p>
                          )}
                        </div>
                        <button 
                          onClick={() => handleDownload(selectedFileVersions.name, v.generation)} 
                          className="py-1.5 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:text-blue-500 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 flex-shrink-0"
                        >
                          <Lucide.RotateCcw size={12} /> Geri Yükle
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

      {/* Footer Version */}
      <div className="fixed bottom-4 right-4 text-[10px] text-slate-400 dark:text-slate-600 font-bold pointer-events-none opacity-40 bg-white/40 dark:bg-slate-950/40 px-2 py-0.5 rounded backdrop-blur-sm">
        {VERSION}
      </div>
    </div>
  );
}

export default App;

function MonitoringChartCard({ title, data, dataKeys, colors, labels, formatter, isErrorChart = false, isMock = false, isDarkMode = true }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const svgRef = React.useRef(null);

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-500 dark:text-slate-450 bg-white dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/40 rounded-2xl p-6">
        <div className="text-center">
          <Lucide.AlertCircle size={24} className="mx-auto text-slate-400 mb-2 animate-pulse" />
          <p className="text-sm font-semibold">Gösterilecek izleme verisi yok</p>
        </div>
      </div>
    );
  }

  const width = 600;
  const height = 240;
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Find max value in data for the keys
  let maxVal = 0;
  data.forEach(d => {
    dataKeys.forEach(k => {
      const v = Number(d[k] || 0);
      if (v > maxVal) maxVal = v;
    });
  });
  
  if (maxVal === 0) maxVal = 10;
  
  // Make maxVal nice
  const magnitude = Math.pow(10, Math.max(0, Math.log10(maxVal)));
  const step = magnitude / 2 || 1;
  const niceMax = Math.ceil(maxVal / step) * step;

  // Y axis ticks (4 ticks)
  const yTicks = [0, niceMax * 0.25, niceMax * 0.5, niceMax * 0.75, niceMax];

  const getX = (index) => paddingLeft + (index / (data.length - 1)) * chartWidth;
  const getY = (val) => (height - paddingBottom) - (val / niceMax) * chartHeight;

  // Handle Mouse Move for Tooltip and Line Indicator
  const handleMouseMove = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Scale from actual client width to coordinate space (600px width)
    const relativeX = (mouseX / rect.width) * width;
    
    // Find closest index
    let idx = Math.round(((relativeX - paddingLeft) / chartWidth) * (data.length - 1));
    idx = Math.max(0, Math.min(data.length - 1, idx));
    
    setHoveredIndex(idx);
    
    // Calculate tooltip coordinates inside container
    setTooltipPos({
      x: Math.min(rect.width - 150, Math.max(10, mouseX - 75)),
      y: Math.max(10, mouseY - 70)
    });
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  // Generate date labels for X axis
  const xLabelIndices = [0, 7, 14, 21, 29].filter(idx => idx < data.length);

  // Format date to short string like DD.MM
  const formatShortDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
    } catch {
      return dateStr;
    }
  };

  // Format date to long Turkish string
  const formatLongDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      const months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/40 rounded-2xl shadow-sm backdrop-blur-md relative overflow-hidden group">
      {/* Glow Effects at corner */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 dark:bg-blue-500/3 blur-3xl pointer-events-none"></div>
      
      <div className="flex justify-between items-center mb-6 pb-3 border-b border-slate-100 dark:border-slate-800/40">
        <h3 className="font-extrabold text-base text-slate-800 dark:text-white flex items-center gap-2">
          {isErrorChart ? (
            <Lucide.Activity size={18} className="text-red-500 animate-pulse" />
          ) : (
            <Lucide.LineChart size={18} className="text-blue-500" />
          )}
          {title}
        </h3>
        <div className="flex items-center gap-3">
          {/* Legend */}
          <div className="flex gap-3 text-[11px] font-bold">
            {dataKeys.map((key, i) => (
              <span key={key} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors[i] }}></span>
                {labels[i]}
              </span>
            ))}
          </div>
          {/* Status Badge */}
          {isMock ? (
            <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/10">
              Demo Modu
            </span>
          ) : (
            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/10 animate-pulse">
              GCP Canlı
            </span>
          )}
        </div>
      </div>

      <div className="relative w-full">
        <svg 
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`} 
          className="w-full h-auto overflow-visible select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Define Gradients & Filters */}
          <defs>
            {dataKeys.map((key, i) => (
              <React.Fragment key={key}>
                <linearGradient id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors[i]} stopOpacity="0.25" />
                  <stop offset="100%" stopColor={colors[i]} stopOpacity="0.00" />
                </linearGradient>
                <filter id={`glow-${key}`} x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </React.Fragment>
            ))}
          </defs>

          {/* Grid lines */}
          {yTicks.map((tick, i) => {
            const y = getY(tick);
            return (
              <g key={i} className="opacity-40 dark:opacity-20">
                <line 
                  x1={paddingLeft} 
                  y1={y} 
                  x2={width - paddingRight} 
                  y2={y} 
                  stroke={isDarkMode ? '#334155' : '#cbd5e1'} 
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text 
                  x={paddingLeft - 8} 
                  y={y + 4} 
                  textAnchor="end" 
                  className="fill-slate-400 dark:fill-slate-500 font-bold text-[10px]"
                >
                  {formatter ? formatter(tick) : tick}
                </text>
              </g>
            );
          })}

          {/* X axis ticks & labels */}
          {xLabelIndices.map((idx) => {
            const x = getX(idx);
            const d = data[idx];
            return (
              <g key={idx} className="opacity-60">
                <line 
                  x1={x} 
                  y1={height - paddingBottom} 
                  x2={x} 
                  y2={height - paddingBottom + 5} 
                  stroke={isDarkMode ? '#475569' : '#94a3b8'} 
                  strokeWidth="1"
                />
                <text 
                  x={x} 
                  y={height - paddingBottom + 18} 
                  textAnchor="middle" 
                  className="fill-slate-400 dark:fill-slate-500 font-bold text-[10px]"
                >
                  {formatShortDate(d.date)}
                </text>
              </g>
            );
          })}

          {/* Area under curves */}
          {dataKeys.map((key) => {
            let areaPath = `M ${getX(0)} ${height - paddingBottom}`;
            data.forEach((d, i) => {
              areaPath += ` L ${getX(i)} ${getY(d[key])}`;
            });
            areaPath += ` L ${getX(data.length - 1)} ${height - paddingBottom} Z`;

            return (
              <path 
                key={`area-${key}`}
                d={areaPath} 
                fill={`url(#grad-${key})`}
                className="transition-all duration-300 pointer-events-none"
              />
            );
          })}

          {/* Lines */}
          {dataKeys.map((key, keyIndex) => {
            let linePath = "";
            data.forEach((d, i) => {
              const x = getX(i);
              const y = getY(d[key]);
              if (i === 0) linePath += `M ${x} ${y}`;
              else linePath += ` L ${x} ${y}`;
            });

            return (
              <path 
                key={`line-${key}`}
                d={linePath} 
                fill="none" 
                stroke={colors[keyIndex]} 
                strokeWidth="2.5" 
                strokeLinecap="round"
                strokeLinejoin="round"
                filter={`url(#glow-${key})`}
                className="transition-all duration-300 pointer-events-none"
              />
            );
          })}

          {/* Hover Vertical Guide Line & Hover Circles */}
          {hoveredIndex !== null && (
            <g className="pointer-events-none">
              <line 
                x1={getX(hoveredIndex)} 
                y1={paddingTop} 
                x2={getX(hoveredIndex)} 
                y2={height - paddingBottom} 
                stroke={isDarkMode ? '#475569' : '#cbd5e1'} 
                strokeWidth="1.5"
                strokeDasharray="2 2"
              />
              
              {dataKeys.map((key, keyIndex) => {
                const val = data[hoveredIndex][key];
                return (
                  <g key={`hover-circle-${key}`}>
                    <circle 
                      cx={getX(hoveredIndex)} 
                      cy={getY(val)} 
                      r="7" 
                      fill={colors[keyIndex]} 
                      opacity="0.3" 
                    />
                    <circle 
                      cx={getX(hoveredIndex)} 
                      cy={getY(val)} 
                      r="4.5" 
                      fill={isDarkMode ? '#0f172a' : '#ffffff'} 
                      stroke={colors[keyIndex]} 
                      strokeWidth="2.5" 
                    />
                  </g>
                );
              })}
            </g>
          )}

          {/* Transparent Rect for mouse interaction */}
          <rect 
            x={paddingLeft}
            y={paddingTop}
            width={chartWidth}
            height={chartHeight}
            fill="transparent"
            className="cursor-crosshair pointer-events-auto"
          />
        </svg>

        {/* HTML Tooltip overlay */}
        {hoveredIndex !== null && (
          <div 
            className="absolute z-30 p-3 bg-slate-950/90 text-white border border-slate-800 rounded-xl shadow-2xl backdrop-blur-md text-xs space-y-1.5 pointer-events-none transition-all duration-100 ease-out"
            style={{ 
              left: `${tooltipPos.x}px`, 
              top: `${tooltipPos.y}px`
            }}
          >
            <div className="font-bold text-slate-400 pb-1 border-b border-slate-850">
              {formatLongDate(data[hoveredIndex].date)}
            </div>
            <div className="space-y-1 pt-1 font-bold">
              {dataKeys.map((key, keyIndex) => {
                const val = data[hoveredIndex][key];
                return (
                  <div key={key} className="flex justify-between gap-5 items-center">
                    <span className="flex items-center gap-1 text-slate-400">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors[keyIndex] }}></span>
                      {labels[keyIndex]}:
                    </span>
                    <span style={{ color: colors[keyIndex] }}>
                      {formatter ? formatter(val) : val}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
