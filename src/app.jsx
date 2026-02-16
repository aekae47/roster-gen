import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calendar, UserPlus, Lock, Unlock, Sun, Moon, 
  ChevronLeft, ChevronRight, Download, FileText, 
  Image as ImageIcon, Trash2, Check, X, Eraser 
} from 'lucide-react';
import { initializeApp } from "firebase/app";
import { getFirestore, doc, onSnapshot, setDoc } from "firebase/firestore";
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utilities ---
const cn = (...inputs) => twMerge(clsx(inputs));

const PASTEL_COLORS = [
  '#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF', 
  '#E2F0CB', '#FFDAC1', '#E0BBE4', '#957DAD', '#D291BC', 
  '#FEC8D8', '#FF9AA2', '#C7CEEA', '#B5EAD7', '#FF9CEE'
];

const CATEGORIES = {
  faculty: { label: 'Faculty', rank: 1, color: '#FFB3BA' },
  senior_pg: { label: 'Senior PG', rank: 2, color: '#BAFFC9' },
  junior_pg: { label: 'Junior PG', rank: 3, color: '#BAE1FF' }
};

// --- Firebase Config ---
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
  // --- State ---
  const [currentDate, setCurrentDate] = useState(new Date());
  const [doctors, setDoctors] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [notes, setNotes] = useState({});
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLocked, setIsLocked] = useState(true);
  const [selectedTool, setSelectedTool] = useState(null); // 'eraser' or docId
  const [editingDay, setEditingDay] = useState(null); // {dateKey, dateObj}
  const [showDocManager, setShowDocManager] = useState(false);
  const [syncStatus, setSyncStatus] = useState('Starting...');

  const exportRef = useRef(null);

  // --- Firebase Sync ---
  useEffect(() => {
    const rosterRef = doc(db, "rosters", "main_roster");
    const unsubscribe = onSnapshot(rosterRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setDoctors(data.doctors || []);
        setAssignments(data.assignments || {});
        setNotes(data.notes || {});
        setSyncStatus('Live');
      }
    });
    return () => unsubscribe();
  }, []);

  const saveToCloud = async (newData) => {
    setSyncStatus('Saving...');
    try {
      const rosterRef = doc(db, "rosters", "main_roster");
      await setDoc(rosterRef, {
        doctors: newData.doctors || doctors,
        assignments: newData.assignments || assignments,
        notes: newData.notes || notes,
        startDay: 26,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
      setTimeout(() => setSyncStatus('Live'), 1000);
    } catch (e) {
      console.error(e);
      setSyncStatus('Error');
    }
  };

  // --- Logic ---
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
    const diffWeeks = Math.floor(Math.ceil((date - ref) / (86400000)) / 7);
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
    } else {
      setEditingDay({ dateKey, dateObj });
    }
  };

  const toggleLock = () => {
    if (!isLocked) {
      setIsLocked(true);
      setSelectedTool(null);
    } else {
      const code = prompt("Enter passcode:");
      if (code === "2613") setIsLocked(false);
      else alert("Wrong code");
    }
  };

  // --- Export Functions ---
  const exportImage = async () => {
    const canvas = await html2canvas(exportRef.current, { scale: 2 });
    const link = document.createElement('a');
    link.download = `roster-${currentDate.getMonth()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  // --- Render Helpers ---
  const renderCalendarGrid = (isExport = false) => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    let offset = cycle.dates[0].getDay() - 1;
    if (offset < 0) offset = 6;

    return (
      <div className="grid grid-cols-7 gap-1">
        {days.map(d => (
          <div key={d} className="text-center text-[10px] font-bold uppercase text-gray-400 py-2">{d}</div>
        ))}
        {Array(offset).fill(0).map((_, i) => <div key={`off-${i}`} />)}
        {cycle.dates.map(date => {
          const dateKey = date.toISOString().split('T')[0];
          const isSun = date.getDay() === 0;
          const isToday = date.toDateString() === new Date().toDateString();
          const assignedIds = assignments[dateKey] || [];
          const assignedDocs = assignedIds.map(id => doctors.find(d => d.id === id)).filter(Boolean)
            .sort((a, b) => CATEGORIES[a.category].rank - CATEGORIES[b.category].rank);
          const note = notes[dateKey] ?? getSundayUnit(date);

          return (
            <div 
              key={dateKey}
              onClick={() => !isExport && handleCellClick(date, dateKey)}
              className={cn(
                "min-h-[100px] border rounded-lg p-1 transition-all cursor-pointer flex flex-col items-center",
                isSun ? "bg-red-50/50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30" : "bg-white dark:bg-darkcard border-gray-100 dark:border-gray-800",
                isToday && "ring-2 ring-amber-500 ring-inset",
                !isLocked && "hover:border-blue-400"
              )}
            >
              <span className={cn("font-mono text-sm mb-1", isSun ? "text-red-500" : "text-gray-500")}>
                {date.getDate()}
              </span>
              <div className="flex flex-col gap-0.5 w-full">
                {assignedDocs.map(doc => (
                  <div 
                    key={doc.id} 
                    style={{ backgroundColor: doc.color }}
                    className="text-[9px] font-bold text-gray-800 px-1 py-0.5 rounded text-center truncate leading-tight"
                  >
                    {doc.name}
                  </div>
                ))}
              </div>
              {note && <div className="mt-auto text-[8px] text-gray-400 font-sans italic truncate w-full text-center">{note}</div>}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={cn("min-h-screen transition-colors", isDarkMode ? "dark bg-darkbg text-gray-200" : "bg-gray-50 text-gray-800")}>
      
      {/* Header */}
      <header className="fixed top-0 w-full z-40 bg-white/80 dark:bg-darkcard/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-black bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">RosterGen</h1>
          <button 
            onClick={toggleLock}
            className={cn(
              "flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold transition-all",
              isLocked ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
            )}
          >
            {isLocked ? <Lock size={14}/> : <Unlock size={14}/>}
            {isLocked ? "View Only" : "Unlocked"}
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 mr-2">{syncStatus}</span>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            {isDarkMode ? <Sun size={18} className="text-yellow-400"/> : <Moon size={18}/>}
          </button>
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button onClick={() => {
                const d = new Date(currentDate); d.setMonth(d.getMonth()-1); setCurrentDate(d);
            }} className="p-1"><ChevronLeft size={18}/></button>
            <button onClick={() => {
                const d = new Date(currentDate); d.setMonth(d.getMonth()+1); setCurrentDate(d);
            }} className="p-1"><ChevronRight size={18}/></button>
          </div>
        </div>
      </header>

      <main className="pt-24 pb-32 px-4 max-w-5xl mx-auto space-y-6">
        
        {/* Calendar Section */}
        <section className="bg-white dark:bg-darkcard rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white text-center">
            <h2 className="text-2xl font-bold tracking-tight">
              {cycle.startDate.toLocaleString('default', { month: 'short' })} - {cycle.endDate.toLocaleString('default', { month: 'short' })} {cycle.endDate.getFullYear()}
            </h2>
          </div>
          <div className="p-2 md:p-4">
            {renderCalendarGrid()}
          </div>
        </section>

        {/* Edit Palette */}
        {!isLocked && (
          <div className="flex gap-2 overflow-x-auto py-2">
             <button 
              onClick={() => setSelectedTool(selectedTool === 'eraser' ? null : 'eraser')}
              className={cn("flex-shrink-0 w-16 h-16 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all", 
                selectedTool === 'eraser' ? "border-red-500 bg-red-50 dark:bg-red-900/20" : "border-transparent bg-white dark:bg-gray-800")}
            >
              <Eraser size={20} className="text-red-500"/>
              <span className="text-[10px] font-bold text-red-500">Eraser</span>
            </button>
            {doctors.map(doc => (
              <button 
                key={doc.id}
                onClick={() => setSelectedTool(selectedTool === doc.id ? null : doc.id)}
                style={{ backgroundColor: doc.color }}
                className={cn(
                  "flex-shrink-0 w-16 h-16 rounded-xl border-2 flex flex-col items-center justify-center p-1 transition-all shadow-sm",
                  selectedTool === doc.id ? "border-blue-600 scale-105" : "border-transparent"
                )}
              >
                <span className="text-[10px] font-bold text-gray-800 leading-tight line-clamp-2">{doc.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Stats Table */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-darkcard p-5 rounded-2xl border border-gray-200 dark:border-gray-800">
            <h3 className="text-xs font-black uppercase text-gray-400 mb-4 tracking-widest">Duty Statistics</h3>
            <div className="space-y-2">
              {Object.keys(CATEGORIES).map(catKey => {
                const catDocs = doctors.filter(d => d.category === catKey);
                return (
                  <div key={catKey} className="space-y-1">
                    <p className="text-[10px] font-bold text-blue-500 uppercase">{CATEGORIES[catKey].label}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {catDocs.map(doc => {
                        const count = Object.values(assignments).filter(a => a.includes(doc.id)).length;
                        const suns = Object.entries(assignments).filter(([date, ids]) => ids.includes(doc.id) && new Date(date).getDay() === 0).length;
                        return (
                          <div key={doc.id} className="flex justify-between items-center text-xs bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg">
                            <span className="truncate mr-2">{doc.name}</span>
                            <span className="font-mono font-bold">{count} <small className="text-red-400">{suns > 0 && `(${suns}S)`}</small></span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-darkcard p-5 rounded-2xl border border-gray-200 dark:border-gray-800">
            <h3 className="text-xs font-black uppercase text-gray-400 mb-4 tracking-widest">Faculty Summary</h3>
            <div className="space-y-1">
              {doctors.filter(d => d.category === 'faculty').map(doc => {
                const dates = cycle.dates.filter(d => assignments[d.toISOString().split('T')[0]]?.includes(doc.id)).map(d => d.getDate());
                if (dates.length === 0) return null;
                return (
                  <div key={doc.id} className="text-xs py-1 border-b border-gray-100 dark:border-gray-800 flex gap-2">
                    <span className="font-bold min-w-[80px]">{doc.name}:</span>
                    <span className="text-gray-500 font-mono">{dates.join(', ')}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Bar */}
      <nav className="fixed bottom-0 w-full bg-white dark:bg-darkcard border-t border-gray-200 dark:border-gray-800 p-4 flex justify-around items-center safe-area-pb">
        <button onClick={() => !isLocked && setShowDocManager(true)} className="flex flex-col items-center gap-1 text-gray-400">
          <UserPlus size={20} />
          <span className="text-[10px] font-bold">Staff</span>
        </button>
        <div className="h-8 w-px bg-gray-200 dark:bg-gray-800" />
        <button onClick={exportImage} className="flex flex-col items-center gap-1 text-blue-500">
          <ImageIcon size={20} />
          <span className="text-[10px] font-bold">Image</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-pink-500">
          <FileText size={20} />
          <span className="text-[10px] font-bold">PDF</span>
        </button>
      </nav>

      {/* Day Editor Modal */}
      {editingDay && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-4">
          <div className="bg-white dark:bg-darkcard w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
              <div>
                <h3 className="font-bold">{editingDay.dateObj.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</h3>
                <p className="text-xs text-gray-500">{editingDay.dateObj.toLocaleDateString(undefined, { weekday: 'long' })}</p>
              </div>
              <button onClick={() => setEditingDay(null)} className="p-2"><X size={20}/></button>
            </div>
            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Custom Note / Unit</label>
                <input 
                  type="text" 
                  value={notes[editingDay.dateKey] || ''}
                  onChange={(e) => {
                    const newNotes = { ...notes, [editingDay.dateKey]: e.target.value };
                    setNotes(newNotes);
                  }}
                  className="w-full bg-gray-100 dark:bg-gray-900 border-none rounded-lg px-4 py-2 text-sm focus:ring-2 ring-blue-500"
                  placeholder={getSundayUnit(editingDay.dateObj) || "Enter note..."}
                />
              </div>
              {Object.entries(CATEGORIES).map(([catKey, cat]) => (
                <div key={catKey}>
                  <p className="text-[10px] font-bold uppercase text-gray-400 mb-2">{cat.label}</p>
                  <div className="space-y-1">
                    {doctors.filter(d => d.category === catKey).map(doc => {
                      const isSelected = assignments[editingDay.dateKey]?.includes(doc.id);
                      return (
                        <button 
                          key={doc.id}
                          onClick={() => {
                            let current = assignments[editingDay.dateKey] || [];
                            if (isSelected) current = current.filter(id => id !== doc.id);
                            else if (current.length < 3) current = [...current, doc.id];
                            const newAssigns = { ...assignments, [editingDay.dateKey]: current };
                            setAssignments(newAssigns);
                          }}
                          className={cn(
                            "w-full flex justify-between items-center p-2 rounded-lg border transition-all",
                            isSelected ? "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-900/50" : "bg-white dark:bg-gray-800 border-transparent hover:bg-gray-50 dark:hover:bg-gray-700"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: doc.color }} />
                            <span className="text-sm">{doc.name}</span>
                          </div>
                          {isSelected && <Check size={16} className="text-blue-500" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex justify-end">
              <button 
                onClick={() => { saveToCloud(); setEditingDay(null); }}
                className="bg-blue-600 text-white px-8 py-2 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/30"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Export Grid */}
      <div className="fixed -left-[2000px] top-0 w-[1200px] bg-white text-black p-10" ref={exportRef}>
        <h1 className="text-4xl font-black text-center mb-8 uppercase tracking-widest border-b-4 border-black pb-4">
          Duty Roster: {cycle.startDate.toLocaleString('default', { month: 'short' })} - {cycle.endDate.toLocaleString('default', { month: 'short' })}
        </h1>
        {renderCalendarGrid(true)}
      </div>

    </div>
  );
}
