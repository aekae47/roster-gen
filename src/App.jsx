import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  UserPlus, Lock, Unlock, Sun, Moon, 
  ChevronLeft, ChevronRight, FileText, 
  Trash2, Check, X, Eraser, BarChart3, PieChart, Palette, Copy
} from 'lucide-react';
import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, onSnapshot, setDoc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

const PASTEL_COLORS = [
  '#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF', 
  '#E2F0CB', '#FFDAC1', '#E0BBE4', '#957DAD', '#D291BC', 
  '#FEC8D8', '#FF9AA2', '#C7CEEA', '#B5EAD7', '#FF9CEE'
];

const CATEGORIES = {
  faculty: { label: 'Faculty', rank: 1, color: 'text-rose-500' },
  senior_pg: { label: 'Senior PG', rank: 2, color: 'text-emerald-500' },
  junior_pg: { label: 'Junior PG', rank: 3, color: 'text-blue-500' }
};

const firebaseConfig = {
    apiKey: "AIza" + "SyCwPvJoEU4P7hsTjMOnjFdjirlOXUg1FTA",
    authDomain: "dutyroster1-92765.firebaseapp.com",
    projectId: "dutyroster1-92765",
    storageBucket: "dutyroster1-92765.firebasestorage.app",
    messagingSenderId: "80624615508",
    appId: "1:80624615508:web:39e018bb5ef0debac82dc1",
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
const auth = getAuth(app);

export default function RosterGen() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [doctors, setDoctors] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [notes, setNotes] = useState({});
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  const [user, setUser] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [isLocked, setIsLocked] = useState(true);
  const [selectedTool, setSelectedTool] = useState(null);
  const [editingDay, setEditingDay] = useState(null);
  const [showDocManager, setShowDocManager] = useState(false);
  const [pickingColorFor, setPickingColorFor] = useState(null); 

  const todayDocs = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().split('T')[0];
    const ids = assignments[key] || [];
    return ids.map(id => doctors.find(doc => doc.id === id)).filter(Boolean)
      .sort((a, b) => CATEGORIES[a.category].rank - CATEGORIES[b.category].rank);
  }, [assignments, doctors]);

  // Refs for "Click Outside" logic
  const docManagerRef = useRef(null);
  const dateEditorRef = useRef(null);
  const loginModalRef = useRef(null);

  // 1. Initial Load from Cache (Immediate)
  useEffect(() => {
    const cached = localStorage.getItem('roster_cache');
    if (cached) {
      const { doctors: d, assignments: a, notes: n, lastUpdated: lu } = JSON.parse(cached);
      setDoctors(d || []);
      setAssignments(a || {});
      setNotes(n || {});
      setLastUpdated(lu || null);
    }
  }, []);

  // 2. Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLocked(!currentUser);
      if (currentUser) setShowLoginModal(false);
    });
    return () => unsubscribe();
  }, []);

  // 3. Live Sync and Update Cache
  useEffect(() => {
    const rosterRef = doc(db, "rosters", "main_roster");
    return onSnapshot(rosterRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setDoctors(data.doctors || []);
        setAssignments(data.assignments || {});
        setNotes(data.notes || {});
        setLastUpdated(data.lastUpdated || null);
        // Save to LocalStorage for next visit
        localStorage.setItem('roster_cache', JSON.stringify(data));
      }
    });
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setEmail(''); setPassword('');
    } catch (err) { setAuthError('Invalid credentials.'); }
  };

  const handleLogout = () => signOut(auth);

  const saveToCloud = async (updates = {}) => {
    if (!user) return;
    try {
      const rosterRef = doc(db, "rosters", "main_roster");
      const payload = {
        doctors: updates.doctors || doctors,
        assignments: updates.assignments || assignments,
        notes: updates.notes || notes,
        startDay: 26,
        lastUpdated: new Date().toISOString()
      };
      await setDoc(rosterRef, payload, { merge: true });
    } catch (e) { console.error("Error saving data: ", e); }
  };

  const cycle = useMemo(() => {
    let startMonth = currentDate.getMonth();
    let startYear = currentDate.getFullYear();
    if (currentDate.getDate() < 26) {
      startMonth--;
      if (startMonth < 0) { startMonth = 11; startYear--; }
    }
    const startDate = new Date(startYear, startMonth, 26);
    const endDate = new Date(startYear, startMonth + 1, 25);
    const dates = [];
    let curr = new Date(startDate);
    while (curr <= endDate) {
      dates.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }
    return { startDate, endDate, dates };
  }, [currentDate]);

  const exportCSV = () => {
    let csv = "Date,Day,Note,Assigned Doctors\n";
    cycle.dates.forEach(date => {
      const dateKey = date.toISOString().split('T')[0];
      const dateStr = date.toLocaleDateString();
      const dayStr = date.toLocaleString('default', { weekday: 'short' });
      const noteStr = notes[dateKey] || getSundayUnit(date) || "";
      const docs = (assignments[dateKey] || [])
        .map(id => doctors.find(d => d.id === id)?.name)
        .filter(Boolean)
        .join(" & ");
      csv += `"${dateStr}","${dayStr}","${noteStr}","${docs}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Duty_Roster_${cycle.startDate.toLocaleString('default', {month:'short'})}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getDocStatsInCycle = (docId) => {
    let count = 0, suns = 0;
    cycle.dates.forEach(date => {
      const key = date.toISOString().split('T')[0];
      if ((assignments[key] || []).includes(docId)) {
        count++;
        if (date.getDay() === 0) suns++;
      }
    });
    return { count, suns };
  };

  const getSundayUnit = (date) => {
    if (date.getDay() !== 0) return "";
    const ref = new Date(2026, 1, 1);
    const diffWeeks = Math.floor(Math.ceil((date - ref) / 86400000) / 7);
    return (Math.abs(diffWeeks) % 2 === 0) ? "Unit 2" : "Unit 1";
  };

  const handleCellClick = (dateObj, dateKey) => {
    if (isLocked) return;
    if (selectedTool === 'eraser') {
      const newAssigns = { ...assignments };
      delete newAssigns[dateKey];
      setAssignments(newAssigns);
      saveToCloud({ assignments: newAssigns });
    } else if (selectedTool) {
      const current = assignments[dateKey] || [];
      if (!current.includes(selectedTool) && current.length < 3) {
        const newAssigns = { ...assignments, [dateKey]: [...current, selectedTool] };
        setAssignments(newAssigns);
        saveToCloud({ assignments: newAssigns });
      }
    } else { setEditingDay({ dateKey, dateObj }); }
  };

  const toggleDocAssignment = (docId) => {
    if (!editingDay) return;
    const dateKey = editingDay.dateKey;
    let current = assignments[dateKey] || [];
    current = current.includes(docId) ? current.filter(id => id !== docId) : (current.length < 3 ? [...current, docId] : current);
    setAssignments({ ...assignments, [dateKey]: current });
  };

  const renderCalendarGrid = () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    let offset = cycle.dates[0].getDay() - 1;
    if (offset < 0) offset = 6;
    const todayStr = new Date().toDateString();

    return (
      <div className="grid grid-cols-7 gap-px md:gap-0.5 bg-white/10 dark:bg-black/10">
        {days.map(d => (
          <div key={d} className="text-center text-[10px] font-bold uppercase text-gray-500 py-1 bg-white/80 dark:bg-gray-800/80">{d}</div>
        ))}
        {Array(offset).fill(0).map((_, i) => <div key={`off-${i}`} className="bg-white/50 dark:bg-gray-800/50"/>)}
        {cycle.dates.map(date => {
          const dateKey = date.toISOString().split('T')[0];
          const isSun = date.getDay() === 0;
          const isMWF = [1, 3, 5].includes(date.getDay());
          const isToday = date.toDateString() === todayStr;
          const assignedDocs = (assignments[dateKey] || [])
            .map(id => doctors.find(d => d.id === id)).filter(Boolean)
            .sort((a, b) => CATEGORIES[a.category].rank - CATEGORIES[b.category].rank);
          const note = notes[dateKey] ?? getSundayUnit(date);

          let cellBg = "bg-white/90 dark:bg-gray-900/80";
          if (isSun) cellBg = "bg-red-50/70 dark:bg-red-900/20";
          else if (isMWF) cellBg = "bg-indigo-50/40 dark:bg-indigo-900/20";

          return (
            <div key={dateKey} onClick={() => handleCellClick(date, dateKey)}
              className={cn("min-h-[85px] p-0.5 flex flex-col items-center relative transition-all", cellBg, !isLocked && "cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30", isToday && "ring-2 ring-amber-400 z-10 shadow-lg")}>
              <span className={cn("text-[15px] leading-none mb-0.5 select-none", isSun ? "text-red-500" : "text-gray-700 dark:text-gray-300")} style={{ fontFamily: '"Archivo Black", sans-serif' }}>
                {date.getDate()}
              </span>
              <div className="flex flex-col gap-px w-full">
                {assignedDocs.map(doc => (
                  <div key={doc.id} style={{ backgroundColor: doc.color + '99', fontFamily: '"PT Sans Narrow", sans-serif', fontWeight: 700 }} className="text-[10px] text-gray-900 px-0.5 py-px rounded-[2px] text-center leading-[1.1] break-words shadow-sm backdrop-blur-sm">
                    {doc.name}
                  </div>
                ))}
              </div>
              {note && <div className="mt-auto text-[8px] text-gray-400 font-medium truncate w-full text-center pb-0.5">{note}</div>}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={cn("min-h-screen transition-all duration-300 font-sans", isDarkMode ? "dark bg-gray-900 text-gray-100" : "bg-slate-50 text-gray-800")}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=PT+Sans+Narrow:wght@400;700&family=Source+Code+Pro:wght@600&display=swap');
        .custom-scrollbar::-webkit-scrollbar { height: 4px; width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-down { animation: fadeInDown 0.7s ease-out forwards; }
      `}</style>
      
      <header className="fixed top-0 w-full z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-white/20 dark:border-gray-700 shadow-sm px-3 py-2 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-blue-600 to-purple-600 text-white p-1.5 rounded-lg shadow-lg"><BarChart3 size={18} /></div>
          <h1 className="text-xl font-black tracking-tighter bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">RosterGen</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => user ? handleLogout() : setShowLoginModal(true)} 
             className={cn("px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 transition-all shadow-sm border", isLocked ? "bg-red-50 text-red-600 border-red-100" : "bg-emerald-50 text-emerald-600 border-emerald-100")}>
            {isLocked ? <Lock size={12}/> : <Unlock size={12}/>} {isLocked ? "Admin Login" : "Logout"}
          </button>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
            {isDarkMode ? <Sun size={18} className="text-amber-400"/> : <Moon size={18}/>}
          </button>
        </div>
      </header>

      <main className="relative z-10 pt-16 pb-24 px-2 max-w-5xl mx-auto">
        {todayDocs.length > 0 && (
          <div className="mb-6 animate-fade-in-down">
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">On Duty Today</h2>
            </div>
            <div className="flex flex-wrap gap-3 px-1">
              {todayDocs.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 bg-white/60 dark:bg-gray-800/60 backdrop-blur-md border border-white/20 dark:border-gray-700 rounded-2xl px-4 py-2 shadow-sm hover:shadow-md transition-all">
                  <div className="w-1 h-6 rounded-full" style={{ backgroundColor: doc.color }} />
                  <div className="flex flex-col">
                    <span className={cn("text-[7px] font-black uppercase leading-none mb-0.5", CATEGORIES[doc.category].color)}>{CATEGORIES[doc.category].label}</span>
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-200" style={{ fontFamily: '"PT Sans Narrow"', fontWeight: 700 }}>{doc.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-between items-end mb-4 px-1">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1">Current Cycle</span>
            <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{cycle.startDate.toLocaleString('default', { month: 'short', year: 'numeric' })}</span>
          </div>
          <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-full p-1 shadow-sm border border-gray-200 dark:border-gray-700">
             <button onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth()-1); setCurrentDate(d); }} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronLeft size={16}/></button>
             <button onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth()+1); setCurrentDate(d); }} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronRight size={16}/></button>
          </div>
        </div>

        <div className="bg-white/40 dark:bg-gray-900/40 backdrop-blur-xl border border-white/50 dark:border-gray-700 rounded-2xl overflow-hidden shadow-2xl">
            <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 py-3 text-center shadow-md">
               <h2 className="text-white font-bold text-lg tracking-wide">{cycle.startDate.toLocaleString('default', { month: 'long' })} / {cycle.endDate.toLocaleString('default', { month: 'long' })}</h2>
               <p className="text-[10px] text-white/80 font-mono">{cycle.endDate.getFullYear()}</p>
            </div>
            {renderCalendarGrid()}
        </div>

        {!isLocked && (
          <div className="mt-6 bg-white/80 dark:bg-gray-800/80 rounded-2xl p-4 shadow-lg border border-white/20 dark:border-gray-700">
            <div className="flex justify-between items-center mb-3">
               <div className="text-[10px] font-bold uppercase text-gray-400">Quick Assign</div>
               <button onClick={() => setSelectedTool(selectedTool === 'eraser' ? null : 'eraser')} className={cn("px-2 py-1 rounded-md border flex items-center gap-1 text-[9px] font-bold transition-all", selectedTool === 'eraser' ? "bg-red-100 border-red-500 text-red-600" : "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500")}><Eraser size={12} /> CLEAR</button>
            </div>
            <div className="space-y-4">
              {Object.keys(CATEGORIES).map(catKey => {
                const catDocs = doctors.filter(d => d.category === catKey);
                if (catDocs.length === 0) return null;
                return (
                  <div key={catKey}>
                    <div className={cn("text-[9px] font-black uppercase mb-1.5", CATEGORIES[catKey].color)}>{CATEGORIES[catKey].label}</div>
                    <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                      {catDocs.map(doc => (
                        <button key={doc.id} onClick={() => setSelectedTool(selectedTool === doc.id ? null : doc.id)} style={{ backgroundColor: doc.color + '99' }} className={cn("h-8 min-w-[70px] px-2 rounded-lg border transition-all flex items-center justify-center flex-shrink-0", selectedTool === doc.id ? "border-blue-600 shadow-md transform scale-105" : "border-transparent opacity-90 hover:opacity-100")}>
                          <span className="text-[10px] text-gray-900 line-clamp-1 break-all" style={{ fontFamily: '"PT Sans Narrow", sans-serif', fontWeight: 700 }}>{doc.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 px-1">
          <div className="bg-white/80 dark:bg-gray-800/80 rounded-2xl p-4 shadow-lg border border-white/20 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700"><BarChart3 size={16} className="text-purple-500" /><h3 className="text-xs font-black uppercase text-gray-500 tracking-widest">Total Counts</h3></div>
            <div className="space-y-3">
              {Object.entries(CATEGORIES).map(([catKey, cat]) => (
                <div key={catKey}><div className={cn("text-[9px] font-bold uppercase mb-1", cat.color)}>{cat.label}</div><div className="grid grid-cols-4 gap-2">{doctors.filter(d => d.category === catKey).map(doc => { const { count, suns } = getDocStatsInCycle(doc.id); if (count === 0) return null; return ( <div key={doc.id} className="flex flex-col items-center bg-gray-50 dark:bg-gray-700/50 rounded p-1 border border-gray-100 dark:border-gray-700"><span className="text-[9px] truncate w-full text-center font-bold" style={{ fontFamily: '"PT Sans Narrow"', fontWeight: 700 }}>{doc.name}</span><span className="text-[10px] font-mono text-gray-600 dark:text-gray-300">{count} {suns > 0 && <span className="text-red-400 text-[8px]">({suns}S)</span>}</span></div> ); })}</div></div>
              ))}
            </div>
          </div>

          <div className="bg-white/80 dark:bg-gray-800/80 rounded-2xl p-4 shadow-lg border border-white/20 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700"><PieChart size={16} className="text-pink-500" /><h3 className="text-xs font-black uppercase text-gray-500 tracking-widest">Faculty Log</h3></div>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {doctors.filter(d => d.category === 'faculty').map(doc => {
                 const dates = cycle.dates.filter(d => (assignments[d.toISOString().split('T')[0]] || []).includes(doc.id)).map(d => d.getDate());
                 if(dates.length === 0) return null;
                 const dateString = dates.join(', ');
                 return (
                   <div key={doc.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 p-1.5 rounded-lg text-xs border border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-2 overflow-hidden w-full pr-2">
                        <span className="font-bold truncate w-24 flex-shrink-0 text-gray-700 dark:text-gray-300" style={{ fontFamily: '"PT Sans Narrow"', fontWeight: 700 }}>{doc.name}</span>
                        <span className="text-[10px] font-mono text-gray-500 truncate">{dateString}</span>
                      </div>
                      <button onClick={() => navigator.clipboard.writeText(`${doc.name}: ${dateString}`)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md text-gray-400 hover:text-blue-500 transition-colors flex-shrink-0"><Copy size={14} /></button>
                   </div>
                 )
              })}
            </div>
          </div>
        </div>

        {lastUpdated && (
           <div className="text-center mt-8 text-[9px] font-mono uppercase tracking-widest text-gray-400">
              Last Updated: {new Date(lastUpdated).toLocaleString()}
           </div>
        )}
      </main>

      {/* MODALS */}
      
      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowLoginModal(false)}>
          <div ref={loginModalRef} onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-2xl shadow-2xl p-6 border border-gray-100 dark:border-gray-800 relative">
            <button onClick={() => setShowLoginModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>
            <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-gray-100">Admin Login</h3>
            <form onSubmit={handleLogin} className="space-y-4">
              <div><label className="block text-xs font-bold text-gray-500 mb-1">Email</label><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none text-gray-800 dark:text-gray-200"/></div>
              <div><label className="block text-xs font-bold text-gray-500 mb-1">Password</label><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none text-gray-800 dark:text-gray-200"/></div>
              {authError && <p className="text-xs text-red-500 font-bold">{authError}</p>}<button type="submit" className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors">Sign In</button>
            </form>
          </div>
        </div>
      )}

      {/* Staff Manager */}
      {showDocManager && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowDocManager(false)}>
          <div ref={docManagerRef} onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-2xl shadow-2xl flex flex-col max-h-[85vh] border border-gray-100 dark:border-gray-800 relative">
            {pickingColorFor && (
               <div className="absolute inset-0 z-[70] bg-white/95 dark:bg-gray-900/95 rounded-2xl flex flex-col items-center justify-center p-6"><h3 className="text-sm font-bold uppercase mb-4 text-gray-500">Select Color</h3><div className="grid grid-cols-5 gap-3">{PASTEL_COLORS.map(c => ( <button key={c} style={{backgroundColor: c}} className="w-10 h-10 rounded-full border-2 border-transparent hover:scale-110 shadow-sm transition-all" onClick={() => { setDoctors(doctors.map(d => d.id === pickingColorFor ? {...d, color: c} : d)); setPickingColorFor(null); }} /> ))}</div><button onClick={() => setPickingColorFor(null)} className="mt-6 text-xs font-bold text-gray-400 underline">Cancel</button></div>
            )}
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50 rounded-t-2xl"><h3 className="font-bold text-sm uppercase text-gray-600 dark:text-gray-300">Staff List</h3><button onClick={() => setShowDocManager(false)} className="p-1 hover:bg-gray-200 rounded-full"><X size={18}/></button></div>
            <div className="p-4 overflow-y-auto space-y-6 custom-scrollbar">
              {Object.keys(CATEGORIES).map(catKey => (
                <div key={catKey} className="space-y-2"><div className="flex justify-between items-end border-b border-gray-100 dark:border-gray-800 pb-1"><span className={cn("text-[10px] font-black uppercase tracking-widest", CATEGORIES[catKey].color)}>{CATEGORIES[catKey].label}</span><button onClick={() => setDoctors([...doctors, { id: Date.now().toString(), name: "Dr. Name", category: catKey, color: PASTEL_COLORS[doctors.length % PASTEL_COLORS.length] }])} className="text-blue-500 text-[10px] font-bold bg-blue-50 px-2 py-0.5 rounded">+ ADD</button></div>
                  <div className="grid grid-cols-2 gap-2">
                    {doctors.filter(d => d.category === catKey).map(doc => (
                      <div key={doc.id} className="relative flex items-center bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700 overflow-hidden pr-8"><button onClick={() => setPickingColorFor(doc.id)} className="ml-1.5 w-5 h-5 rounded-full shadow-sm border border-black/10 flex-shrink-0" style={{ backgroundColor: doc.color }}></button><input className="w-full bg-transparent text-[11px] p-2 outline-none font-bold" style={{ fontFamily: '"PT Sans Narrow"', fontWeight: 700 }} value={doc.name} onChange={(e) => setDoctors(doctors.map(d => d.id === doc.id ? {...d, name: e.target.value} : d))} /><button onClick={() => setDoctors(doctors.filter(d => d.id !== doc.id))} className="absolute right-2 text-red-400 hover:text-red-600"><Trash2 size={12}/></button></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-gray-800"><button onClick={() => { saveToCloud({ doctors }); setShowDocManager(false); }} className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-bold text-xs uppercase">Save Changes</button></div>
          </div>
        </div>
      )}

      {/* Date Editor */}
      {editingDay && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => {saveToCloud(); setEditingDay(null);}}>
          <div ref={dateEditorRef} onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 flex flex-col max-h-[90vh]">
             <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50 rounded-t-2xl"><div><h4 className="font-bold text-lg">{editingDay.dateObj.getDate()} {editingDay.dateObj.toLocaleString('default',{month:'short'})}</h4><p className="text-xs text-gray-400 font-bold uppercase">{editingDay.dateObj.toLocaleString('default',{weekday:'long'})}</p></div><button onClick={() => {saveToCloud(); setEditingDay(null);}} className="bg-gray-100 dark:bg-gray-700 p-1 rounded-full"><Check size={18} className="text-green-600"/></button></div>
             <div className="p-4 overflow-y-auto space-y-4">
                <input className="w-full p-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-700 rounded-lg text-sm outline-none" placeholder={getSundayUnit(editingDay.dateObj) || "Add a note..."} value={notes[editingDay.dateKey] || ''} onChange={(e) => setNotes({...notes, [editingDay.dateKey]: e.target.value})} />
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(CATEGORIES).map(([catKey, cat]) => (
                    <div key={catKey} className="space-y-1"><div className={cn("text-[10px] font-black uppercase mb-1", cat.color)}>{cat.label}</div><div className="flex flex-col gap-1">{doctors.filter(d => d.category === catKey).map(doc => { const isSelected = (assignments[editingDay.dateKey] || []).includes(doc.id); return ( <button key={doc.id} onClick={() => toggleDocAssignment(doc.id)} className={cn("w-full flex items-center justify-between p-1.5 rounded-lg border transition-all", isSelected ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800" : "bg-white dark:bg-gray-800 border-transparent")}><div className="flex items-center gap-1.5 overflow-hidden"><div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{backgroundColor: doc.color}}/><span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 truncate" style={{ fontFamily: '"PT Sans Narrow"', fontWeight: 700 }}>{doc.name}</span></div>{isSelected && <Check size={12} className="text-blue-600"/>}</button> )})}</div></div>
                  ))}
                </div>
             </div>
             <div className="p-3 border-t border-gray-100 dark:border-gray-800"><button onClick={() => { saveToCloud(); setEditingDay(null); }} className="w-full bg-black dark:bg-white text-white dark:text-black py-2 rounded-lg font-bold text-xs uppercase">Done</button></div>
          </div>
        </div>
      )}

      {/* Footer Nav */}
      <nav className="fixed bottom-0 w-full bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border-t border-gray-200 dark:border-gray-800 p-3 z-50 flex justify-around items-center">
        <button onClick={() => !isLocked && setShowDocManager(true)} className="flex flex-col items-center gap-1 text-gray-400 hover:text-blue-600">
           <div className="p-1.5 rounded-full hover:bg-blue-50 transition-colors"><UserPlus size={20} /></div>
           <span className="text-[9px] font-bold">Staff</span>
        </button>
        <button onClick={exportCSV} className="flex flex-col items-center gap-1 text-gray-400 hover:text-green-600">
           <div className="p-1.5 rounded-full hover:bg-green-50 transition-colors"><FileText size={20} /></div>
           <span className="text-[9px] font-bold">CSV</span>
        </button>
      </nav>
    </div>
  );
}
