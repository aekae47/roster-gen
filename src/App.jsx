import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  UserPlus, Lock, Unlock, Sun, Moon, 
  ChevronLeft, ChevronRight, Image as ImageIcon, 
  Trash2, Check, X, Eraser, BarChart3, PieChart, Palette
} from 'lucide-react';
import { initializeApp } from "firebase/app";
import { getFirestore, doc, onSnapshot, setDoc } from "firebase/firestore";
import html2canvas from 'html2canvas';
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
const db = getFirestore(app);

export default function RosterGen() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [doctors, setDoctors] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [notes, setNotes] = useState({});
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLocked, setIsLocked] = useState(true);
  const [selectedTool, setSelectedTool] = useState(null);
  const [editingDay, setEditingDay] = useState(null);
  const [showDocManager, setShowDocManager] = useState(false);
  const [syncStatus, setSyncStatus] = useState('Syncing...');

  const exportRef = useRef(null);

  useEffect(() => {
    const rosterRef = doc(db, "rosters", "main_roster");
    return onSnapshot(rosterRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setDoctors(data.doctors || []);
        setAssignments(data.assignments || {});
        setNotes(data.notes || {});
        setSyncStatus('Live');
      }
    });
  }, []);

  const saveToCloud = async (updates = {}) => {
    setSyncStatus('Saving...');
    try {
      const rosterRef = doc(db, "rosters", "main_roster");
      await setDoc(rosterRef, {
        doctors: updates.doctors || doctors,
        assignments: updates.assignments || assignments,
        notes: updates.notes || notes,
        startDay: 26,
      }, { merge: true });
      setTimeout(() => setSyncStatus('Live'), 800);
    } catch (e) { setSyncStatus('Error'); }
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

  const getSundayUnit = (date) => {
    if (date.getDay() !== 0) return "";
    const ref = new Date(2026, 1, 1);
    const diffWeeks = Math.floor(Math.ceil((date - ref) / 86400000) / 7);
    return (Math.abs(diffWeeks) % 2 === 0) ? "Unit 2" : "Unit 1";
  };

  const handleCellClick = (dateObj, dateKey) => {
    if (isLocked) return;
    if (selectedTool === 'eraser') {
      const newAssigns = { ...assignments, [dateKey]: [] };
      setAssignments(newAssigns);
      saveToCloud({ assignments: newAssigns });
    } else if (selectedTool) {
      const current = assignments[dateKey] || [];
      if (!current.includes(selectedTool) && current.length < 3) {
        const newAssigns = { ...assignments, [dateKey]: [...current, selectedTool] };
        setAssignments(newAssigns);
        saveToCloud({ assignments: newAssigns });
      }
    } else {
      setEditingDay({ dateKey, dateObj });
    }
  };

  const renderCalendarGrid = (isExport = false) => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    let offset = cycle.dates[0].getDay() - 1;
    if (offset < 0) offset = 6;

    return (
      <div className={cn("grid grid-cols-7 gap-px", isExport ? "bg-gray-300" : "bg-gray-200 dark:bg-gray-800")}>
        {days.map(d => (
          <div key={d} className="text-center text-[10px] font-bold uppercase text-gray-500 py-1 bg-white dark:bg-darkcard">{d}</div>
        ))}
        {Array(offset).fill(0).map((_, i) => <div key={`off-${i}`} className="bg-white/50 dark:bg-darkcard/50"/>)}
        {cycle.dates.map(date => {
          const dateKey = date.toISOString().split('T')[0];
          const isSun = date.getDay() === 0;
          const assignedDocs = (assignments[dateKey] || [])
            .map(id => doctors.find(d => d.id === id)).filter(Boolean)
            .sort((a, b) => CATEGORIES[a.category].rank - CATEGORIES[b.category].rank);
          const note = notes[dateKey] ?? getSundayUnit(date);

          return (
            <div 
              key={dateKey}
              onClick={() => !isExport && handleCellClick(date, dateKey)}
              className={cn(
                "min-h-[80px] p-0.5 flex flex-col items-center relative transition-colors",
                isSun ? "bg-red-50/50 dark:bg-red-900/10" : "bg-white dark:bg-gray-900",
                !isExport && !isLocked && "cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20"
              )}
            >
              <span className={cn("text-xs leading-none mb-0.5", isSun ? "text-red-500 font-bold" : "text-gray-500")} style={{ fontFamily: '"Source Code Pro", monospace' }}>
                {date.getDate()}
              </span>
              <div className="flex flex-col gap-px w-full">
                {assignedDocs.map(doc => (
                  <div 
                    key={doc.id} 
                    style={{ backgroundColor: doc.color, fontFamily: '"PT Sans Narrow", sans-serif' }}
                    className="text-[10px] text-gray-900 px-0.5 py-px rounded-sm text-center leading-[1.1] break-words hyphens-auto shadow-sm"
                  >
                    {doc.name}
                  </div>
                ))}
              </div>
              {note && <div className="mt-auto text-[8px] text-gray-400 font-medium truncate w-full text-center leading-none pb-0.5">{note}</div>}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={cn("min-h-screen", isDarkMode ? "dark bg-gray-900 text-gray-100" : "bg-slate-50 text-gray-800")}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=PT+Sans+Narrow&family=Source+Code+Pro:wght@600&display=swap');
        .hyphens-auto { hyphens: auto; }
      `}</style>

      {/* Header */}
      <header className="fixed top-0 w-full z-40 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-3 py-2 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-black bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">RosterGen</h1>
          <button onClick={() => {
            if(!isLocked) setIsLocked(true);
            else { if(prompt("Passcode:") === "2613") setIsLocked(false); }
          }} className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border", isLocked ? "bg-red-50 text-red-600 border-red-100" : "bg-emerald-50 text-emerald-600 border-emerald-100")}>
            {isLocked ? "Locked" : "Unlocked"}
          </button>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-mono opacity-50">{syncStatus}</span>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
            {isDarkMode ? <Sun size={18} className="text-amber-400"/> : <Moon size={18}/>}
          </button>
          <button onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth()-1); setCurrentDate(d); }} className="p-1"><ChevronLeft size={20}/></button>
          <button onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth()+1); setCurrentDate(d); }} className="p-1"><ChevronRight size={20}/></button>
        </div>
      </header>

      <main className="pt-16 pb-24 px-1 max-w-5xl mx-auto">
        {/* Calendar Card */}
        <div className="bg-white dark:bg-darkcard border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-xl mb-6">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 py-2 text-center text-white">
               <h2 className="font-bold text-sm uppercase tracking-widest">
                 {cycle.startDate.toLocaleString('default', { month: 'short' })} - {cycle.endDate.toLocaleString('default', { month: 'short' })} {cycle.endDate.getFullYear()}
               </h2>
            </div>
            {renderCalendarGrid()}
        </div>

        {/* Floating Tools */}
        {!isLocked && (
          <div className="flex gap-2 overflow-x-auto py-2 px-1 mb-6 scrollbar-hide">
             <button onClick={() => setSelectedTool(selectedTool === 'eraser' ? null : 'eraser')}
              className={cn("flex-shrink-0 w-12 h-12 rounded-lg border-2 flex flex-col items-center justify-center transition-all", 
                selectedTool === 'eraser' ? "border-red-500 bg-red-50" : "border-gray-200 bg-white dark:bg-gray-800")}>
              <Eraser size={18} className="text-red-500"/><span className="text-[8px] font-bold text-red-500 uppercase">Clear</span>
            </button>
            {doctors.map(doc => (
              <button key={doc.id} onClick={() => setSelectedTool(selectedTool === doc.id ? null : doc.id)}
                style={{ backgroundColor: doc.color, fontFamily: '"PT Sans Narrow"' }}
                className={cn("flex-shrink-0 w-12 h-12 rounded-lg border-2 p-1 transition-all shadow-sm leading-none text-[9px] font-bold text-gray-800",
                  selectedTool === doc.id ? "border-blue-600 scale-105" : "border-transparent")}>
                {doc.name}
              </button>
            ))}
          </div>
        )}

        {/* Stats Section */}
        <div className="grid md:grid-cols-2 gap-4 px-1">
          <div className="bg-white dark:bg-darkcard p-4 rounded-xl shadow-md border border-gray-100 dark:border-gray-800">
            <h3 className="text-[10px] font-black uppercase text-gray-400 mb-3 tracking-widest flex items-center gap-2"><BarChart3 size={14}/> Duty Stats</h3>
            <div className="space-y-3">
              {Object.entries(CATEGORIES).map(([key, cat]) => (
                <div key={key}>
                  <p className={cn("text-[10px] font-bold uppercase", cat.color)}>{cat.label}</p>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {doctors.filter(d => d.category === key).map(doc => {
                       const count = Object.values(assignments).filter(a => a.includes(doc.id)).length;
                       if(count === 0) return null;
                       return <div key={doc.id} className="text-[10px] bg-gray-50 dark:bg-gray-800 p-1 rounded flex justify-between">
                         <span className="truncate pr-1">{doc.name}</span><b>{count}</b>
                       </div>
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-darkcard p-4 rounded-xl shadow-md border border-gray-100 dark:border-gray-800">
             <h3 className="text-[10px] font-black uppercase text-gray-400 mb-3 tracking-widest flex items-center gap-2"><PieChart size={14}/> Faculty Log</h3>
             <div className="space-y-1">
                {doctors.filter(d => d.category === 'faculty').map(doc => {
                  const dates = cycle.dates.filter(d => assignments[d.toISOString().split('T')[0]]?.includes(doc.id)).map(d => d.getDate());
                  if(dates.length === 0) return null;
                  return <div key={doc.id} className="text-[10px] border-b border-gray-50 dark:border-gray-800 py-1">
                    <b className="mr-2">{doc.name}:</b> <span className="font-mono text-gray-500">{dates.join(', ')}</span>
                  </div>
                })}
             </div>
          </div>
        </div>
      </main>

      {/* Staff Manager Modal */}
      {showDocManager && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-xl shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <h3 className="font-bold text-sm uppercase">Manage Staff</h3>
              <button onClick={() => setShowDocManager(false)}><X size={20}/></button>
            </div>
            <div className="p-4 overflow-y-auto space-y-6">
              {Object.keys(CATEGORIES).map(catKey => (
                <div key={catKey} className="space-y-2">
                  <div className="flex justify-between items-center border-b pb-1">
                    <span className="text-[10px] font-black text-gray-400 uppercase">{catKey}</span>
                    <button onClick={() => setDoctors([...doctors, { id: Date.now(), name: "New Name", category: catKey, color: '#BAE1FF' }])} className="text-blue-500 text-[10px] font-bold">+ ADD</button>
                  </div>
                  {doctors.filter(d => d.category === catKey).map(doc => (
                    <div key={doc.id} className="flex gap-2 items-center">
                      <input type="color" value={doc.color} onChange={(e) => setDoctors(doctors.map(d => d.id === doc.id ? {...d, color: e.target.value} : d))} className="w-6 h-6 rounded-full border-none p-0 overflow-hidden cursor-pointer" />
                      <input className="flex-grow text-xs bg-gray-50 dark:bg-gray-800 rounded px-2 py-1.5" value={doc.name} onChange={(e) => setDoctors(doctors.map(d => d.id === doc.id ? {...d, name: e.target.value} : d))} />
                      <button onClick={() => setDoctors(doctors.filter(d => d.id !== doc.id))} className="text-red-500 p-1 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="p-4 border-t">
              <button onClick={() => { saveToCloud({ doctors }); setShowDocManager(false); }} className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-bold text-xs uppercase tracking-widest">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Date Editor Modal */}
      {editingDay && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b dark:border-gray-800 flex justify-between items-center">
              <div>
                <h4 className="font-bold">{editingDay.dateObj.getDate()} {editingDay.dateObj.toLocaleString('default',{month:'short'})}</h4>
                <p className="text-xs text-gray-500 uppercase">{editingDay.dateObj.toLocaleString('default',{weekday:'long'})}</p>
              </div>
              <button onClick={() => setEditingDay(null)}><X size={24}/></button>
            </div>
            <div className="p-4 overflow-y-auto space-y-4">
              <input 
                className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm" 
                placeholder="Custom Note / Unit..." 
                value={notes[editingDay.dateKey] || ''}
                onChange={(e) => setNotes({...notes, [editingDay.dateKey]: e.target.value})}
              />
              <div className="space-y-4">
                {Object.entries(CATEGORIES).map(([catKey, cat]) => (
                  <div key={catKey}>
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">{cat.label}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {doctors.filter(d => d.category === catKey).map(doc => {
                        const isAssigned = assignments[editingDay.dateKey]?.includes(doc.id);
                        return <button 
                          key={doc.id}
                          onClick={() => {
                            let curr = assignments[editingDay.dateKey] || [];
                            if(isAssigned) curr = curr.filter(id => id !== doc.id);
                            else if(curr.length < 3) curr = [...curr, doc.id];
                            setAssignments({...assignments, [editingDay.dateKey]: curr});
                          }}
                          className={cn("flex items-center gap-2 p-2 rounded-lg border text-left transition-all", isAssigned ? "bg-blue-50 border-blue-200 dark:bg-blue-900/40" : "border-gray-100 dark:border-gray-800")}
                        >
                          <div className="w-2 h-2 rounded-full" style={{backgroundColor: doc.color}}/>
                          <span className="text-xs font-medium truncate">{doc.name}</span>
                          {isAssigned && <Check size={14} className="ml-auto text-blue-600"/>}
                        </button>
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t">
              <button onClick={() => { saveToCloud(); setEditingDay(null); }} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold uppercase tracking-widest text-xs">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 w-full bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 p-2 flex justify-around items-center z-40">
        <button onClick={() => !isLocked && setShowDocManager(true)} className="flex flex-col items-center text-gray-400 hover:text-blue-600">
          <UserPlus size={20} /><span className="text-[9px] font-bold uppercase mt-1">Staff</span>
        </button>
        <button onClick={async () => {
             const canvas = await html2canvas(exportRef.current, { scale: 2 });
             const link = document.createElement('a'); link.download = 'roster.png';
             link.href = canvas.toDataURL(); link.click();
        }} className="flex flex-col items-center text-gray-400 hover:text-pink-600">
          <ImageIcon size={20} /><span className="text-[9px] font-bold uppercase mt-1">PNG</span>
        </button>
      </nav>

      {/* Export Target */}
      <div className="fixed -left-[4000px] top-0 w-[1100px] bg-white text-black p-8" ref={exportRef}>
        <div className="text-3xl font-black text-center mb-6 uppercase border-b-4 border-black pb-2">
          Duty Roster: {cycle.startDate.toLocaleString('default', { month: 'short' })} - {cycle.endDate.toLocaleString('default', { month: 'short' })}
        </div>
        {renderCalendarGrid(true)}
      </div>
    </div>
  );
}
