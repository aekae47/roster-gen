import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  UserPlus, Lock, Unlock, Sun, Moon, 
  ChevronLeft, ChevronRight, Image as ImageIcon, 
  Trash2, Check, X, Eraser 
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
  faculty: { label: 'Faculty', rank: 1 },
  senior_pg: { label: 'Senior PG', rank: 2 },
  junior_pg: { label: 'Junior PG', rank: 3 }
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
      const finalData = {
        doctors: updates.doctors || doctors,
        assignments: updates.assignments || assignments,
        notes: updates.notes || notes,
        startDay: 26
      };
      await setDoc(rosterRef, finalData, { merge: true });
      setSyncStatus('Live');
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

  const renderCalendarGrid = (isExport = false) => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    let offset = cycle.dates[0].getDay() - 1;
    if (offset < 0) offset = 6;

    return (
      <div className="grid grid-cols-7 gap-px md:gap-0.5 bg-gray-200 dark:bg-gray-800">
        {days.map(d => (
          <div key={d} className="text-center text-[10px] font-bold uppercase text-gray-500 py-1 bg-white dark:bg-darkcard">{d}</div>
        ))}
        {Array(offset).fill(0).map((_, i) => <div key={`off-${i}`} className="bg-white dark:bg-darkcard"/>)}
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
                "min-h-[90px] p-0.5 flex flex-col items-center relative overflow-hidden",
                isSun ? "bg-red-50/30 dark:bg-red-900/10" : "bg-white dark:bg-darkcard",
                !isLocked && "cursor-pointer hover:ring-1 ring-blue-400 z-10"
              )}
            >
              <span className={cn("text-sm leading-none mb-0.5", isSun ? "text-red-500 font-bold" : "text-gray-600 dark:text-gray-400")} style={{ fontFamily: '"Source Code Pro", monospace' }}>
                {date.getDate()}
              </span>
              <div className="flex flex-col gap-0.5 w-full">
                {assignedDocs.map(doc => (
                  <div 
                    key={doc.id} 
                    style={{ backgroundColor: doc.color, fontFamily: '"PT Sans Narrow", sans-serif' }}
                    className="text-[10px] text-gray-900 px-0.5 py-px rounded-sm text-center leading-[1.1] break-words hyphens-auto"
                  >
                    {doc.name}
                  </div>
                ))}
              </div>
              {note && <div className="mt-auto text-[8px] text-gray-400 truncate w-full text-center leading-none pb-0.5">{note}</div>}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={cn("min-h-screen", isDarkMode ? "dark bg-darkbg text-gray-200" : "bg-white text-gray-800")}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=PT+Sans+Narrow&family=Source+Code+Pro:wght@600&display=swap');
        .hyphens-auto { hyphens: auto; }
      `}</style>
      
      <header className="fixed top-0 w-full z-40 bg-white/90 dark:bg-darkcard/90 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 px-2 py-2 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-black tracking-tighter text-blue-600">RosterGen</h1>
          <button onClick={() => {
            if(!isLocked) setIsLocked(true);
            else { if(prompt("Passcode:") === "2613") setIsLocked(false); }
          }} className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1", isLocked ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600")}>
            {isLocked ? <Lock size={10}/> : <Unlock size={10}/>} {isLocked ? "Locked" : "Unlocked"}
          </button>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-mono opacity-50">{syncStatus}</span>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
            {isDarkMode ? <Sun size={16} className="text-yellow-400"/> : <Moon size={16}/>}
          </button>
          <button onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth()-1); setCurrentDate(d); }} className="p-1"><ChevronLeft size={20}/></button>
          <button onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth()+1); setCurrentDate(d); }} className="p-1"><ChevronRight size={20}/></button>
        </div>
      </header>

      <main className="pt-14 pb-20 px-1 max-w-[100vw] overflow-x-hidden">
        <div className="bg-white dark:bg-darkcard border border-gray-200 dark:border-gray-800 rounded-sm overflow-hidden shadow-sm">
            <div className="bg-gray-50 dark:bg-gray-800/50 py-2 text-center border-b border-gray-100 dark:border-gray-800 font-bold uppercase tracking-widest text-sm">
              {cycle.startDate.toLocaleString('default', { month: 'short' })} - {cycle.endDate.toLocaleString('default', { month: 'short' })} {cycle.endDate.getFullYear()}
            </div>
            {renderCalendarGrid()}
        </div>

        {!isLocked && (
          <div className="flex gap-1 overflow-x-auto py-3 px-1">
             <button onClick={() => setSelectedTool(selectedTool === 'eraser' ? null : 'eraser')}
              className={cn("flex-shrink-0 w-12 h-12 rounded border-2 flex flex-col items-center justify-center transition-all", 
                selectedTool === 'eraser' ? "border-red-500 bg-red-50" : "border-gray-100 bg-gray-50 dark:bg-gray-800")}>
              <Eraser size={16} className="text-red-500"/><span className="text-[8px] font-bold text-red-500">CLEAR</span>
            </button>
            {doctors.map(doc => (
              <button key={doc.id} onClick={() => setSelectedTool(selectedTool === doc.id ? null : doc.id)}
                style={{ backgroundColor: doc.color, fontFamily: '"PT Sans Narrow"' }}
                className={cn("flex-shrink-0 w-12 h-12 rounded border-2 p-0.5 transition-all shadow-sm leading-none text-[9px] font-bold",
                  selectedTool === doc.id ? "border-blue-600 scale-105" : "border-transparent")}>
                {doc.name}
              </button>
            ))}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 w-full bg-white dark:bg-darkcard border-t border-gray-100 dark:border-gray-800 p-2 flex justify-around items-center">
        <button onClick={() => !isLocked && setShowDocManager(true)} className="flex flex-col items-center text-gray-400">
          <UserPlus size={18} /><span className="text-[9px] font-bold">STAFF</span>
        </button>
        <button onClick={async () => {
             const canvas = await html2canvas(exportRef.current, { scale: 2 });
             const link = document.createElement('a'); link.download = 'roster.png';
             link.href = canvas.toDataURL(); link.click();
        }} className="flex flex-col items-center text-blue-500">
          <ImageIcon size={18} /><span className="text-[9px] font-bold">PNG</span>
        </button>
      </nav>

      {/* Staff Manager Modal */}
      {showDocManager && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-darkcard w-full max-w-sm rounded-lg shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-3 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <h3 className="font-bold text-sm">Manage Staff</h3>
              <button onClick={() => setShowDocManager(false)}><X size={18}/></button>
            </div>
            <div className="p-3 overflow-y-auto space-y-4">
              {Object.keys(CATEGORIES).map(catKey => (
                <div key={catKey} className="space-y-2">
                  <div className="flex justify-between items-center border-b pb-1">
                    <span className="text-[10px] font-black text-gray-400 uppercase">{catKey}</span>
                    <button onClick={() => {
                        const newDocs = [...doctors, { id: Date.now(), name: "New Doctor", category: catKey, color: PASTEL_COLORS[doctors.length % PASTEL_COLORS.length] }];
                        setDoctors(newDocs);
                    }} className="text-blue-500 text-[10px] font-bold">+ ADD</button>
                  </div>
                  {doctors.filter(d => d.category === catKey).map(doc => (
                    <div key={doc.id} className="flex gap-2 items-center">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: doc.color }} />
                      <input 
                        className="flex-grow text-xs bg-gray-50 dark:bg-gray-900 border-none rounded px-2 py-1"
                        value={doc.name}
                        onChange={(e) => {
                          const updated = doctors.map(d => d.id === doc.id ? {...d, name: e.target.value} : d);
                          setDoctors(updated);
                        }}
                      />
                      <button onClick={() => setDoctors(doctors.filter(d => d.id !== doc.id))} className="text-red-400"><Trash2 size={14}/></button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-gray-100 dark:border-gray-800">
              <button onClick={() => { saveToCloud({ doctors }); setShowDocManager(false); }} className="w-full bg-blue-600 text-white py-2 rounded font-bold text-xs">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Export Container */}
      <div className="fixed -left-[3000px] top-0 w-[1000px] bg-white text-black p-4" ref={exportRef}>
        <div className="text-2xl font-black text-center mb-4 uppercase border-b-2 border-black pb-2">
          Duty Roster: {cycle.startDate.toLocaleString('default', { month: 'short' })} - {cycle.endDate.toLocaleString('default', { month: 'short' })}
        </div>
        {renderCalendarGrid(true)}
      </div>

      {/* Day Edit Modal (Simplified) */}
      {editingDay && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-darkcard w-full max-w-xs rounded-lg p-4">
             <div className="flex justify-between mb-4"><h4 className="font-bold">Edit Entry</h4><button onClick={() => setEditingDay(null)}><X size={18}/></button></div>
             <input 
                className="w-full mb-4 p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm" 
                placeholder="Note..." 
                value={notes[editingDay.dateKey] || ''}
                onChange={(e) => setNotes({...notes, [editingDay.dateKey]: e.target.value})}
             />
             <button onClick={() => { saveToCloud(); setEditingDay(null); }} className="w-full bg-blue-600 text-white py-2 rounded font-bold">Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
