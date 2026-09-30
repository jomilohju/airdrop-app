import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAirDrop, Device } from './hooks/useAirDrop';
import { 
  Laptop, Smartphone, Monitor, File, CheckCircle, XCircle, 
  Loader2, Send, Edit2, Check, Eye, EyeOff, Settings, 
  History, Trash2, Clock, ChevronRight, X, Shield, ShieldCheck,
  Moon, Sun, Monitor as MonitorIcon, Volume2, VolumeX,
  Download, Share2, RefreshCw, MessageSquare, Copy, Activity, Sparkles,
  FileText, Film, Music, Archive, Plus, Play
} from 'lucide-react';

export interface QueuedFileItem {
  id: string;
  file: File;
  previewUrl?: string;
  category: 'image' | 'video' | 'audio' | 'pdf' | 'archive' | 'document' | 'file';
}

export default function App() {
  const { 
    devices, myDevice, transferState, incomingOffer, incomingText,
    sendFiles, sendText, acceptOffer, rejectOffer, refreshDevices, clearIncomingText, updateMyName, 
    isDiscoverable, toggleDiscoverable, autoAccept, 
    toggleAutoAccept, soundEnabled, toggleSound, 
    theme, updateTheme, history, clearHistory,
    isConnected, runDiagnostics, diagnosticResult, isDiagnosing, serverUrl
  } = useAirDrop();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [actionModalDevice, setActionModalDevice] = useState<Device | null>(null);
  const [fileQueue, setFileQueue] = useState<QueuedFileItem[]>([]);
  const [queueTargetDevice, setQueueTargetDevice] = useState<Device | null>(null);
  const [textToSend, setTextToSend] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    refreshDevices();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const handleDeviceClick = (device: Device) => {
    setActionModalDevice(device);
  };

  const handleSendFileClick = () => {
    if (actionModalDevice) {
      setSelectedDevice(actionModalDevice);
      fileInputRef.current?.click();
      setActionModalDevice(null);
    }
  };

  const handleSendTextClick = () => {
    if (actionModalDevice && textToSend.trim()) {
      sendText(actionModalDevice, textToSend.trim());
      setTextToSend('');
      setActionModalDevice(null);
    }
  };

  const getFileCategory = (file: File): QueuedFileItem['category'] => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    if (file.type.includes('pdf') || file.name.endsWith('.pdf')) return 'pdf';
    if (file.type.includes('zip') || file.type.includes('tar') || file.name.endsWith('.zip') || file.name.endsWith('.rar')) return 'archive';
    if (file.type.includes('text') || file.name.endsWith('.txt') || file.name.endsWith('.md') || file.name.endsWith('.docx')) return 'document';
    return 'file';
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    const target = selectedDevice || queueTargetDevice;
    if (files && files.length > 0 && target) {
      const fileList = Array.from(files) as File[];
      const newItems: QueuedFileItem[] = fileList.map((file: File) => {
        const category = getFileCategory(file);
        let previewUrl: string | undefined;
        if (category === 'image') {
          previewUrl = URL.createObjectURL(file);
        }
        return {
          id: Math.random().toString(36).substring(2, 9),
          file,
          previewUrl,
          category
        };
      });

      setFileQueue(prev => [...prev, ...newItems]);
      setQueueTargetDevice(target);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    setSelectedDevice(null);
  };

  const removeQueuedFile = (id: string) => {
    setFileQueue(prev => {
      const itemToRemove = prev.find(item => item.id === id);
      if (itemToRemove?.previewUrl) {
        URL.revokeObjectURL(itemToRemove.previewUrl);
      }
      const updated = prev.filter(item => item.id !== id);
      if (updated.length === 0) {
        setQueueTargetDevice(null);
      }
      return updated;
    });
  };

  const cancelQueue = () => {
    fileQueue.forEach(item => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setFileQueue([]);
    setQueueTargetDevice(null);
  };

  const startBatchTransfer = () => {
    if (queueTargetDevice && fileQueue.length > 0) {
      const filesToSend = fileQueue.map(item => item.file);
      sendFiles(queueTargetDevice, filesToSend);
      cancelQueue();
    }
  };

  const startEditingName = () => {
    if (myDevice) {
      setEditNameValue(myDevice.name);
      setIsEditingName(true);
    }
  };

  const saveName = () => {
    if (editNameValue.trim()) {
      updateMyName(editNameValue.trim());
    }
    setIsEditingName(false);
  };

  const getInitials = (name?: string) => {
    if (!name) return 'DT';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getDeviceIcon = (type: string, className = "w-8 h-8 text-blue-500") => {
    if (type === 'iOS' || type === 'Android') return <Smartphone className={className} />;
    if (type === 'Mac') return <Laptop className={className} />;
    return <Monitor className={className} />;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-mesh text-[var(--text-color)] font-sans flex flex-col items-center justify-center p-4 overflow-hidden relative pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      
      {/* Background Orbs */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          x: [0, 50, 0],
          y: [0, -30, 0]
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-blue-400/30 rounded-full blur-[100px] pointer-events-none" 
      />
      <motion.div 
        animate={{ 
          scale: [1, 1.1, 1],
          x: [0, -40, 0],
          y: [0, 60, 0]
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-purple-400/30 rounded-full blur-[120px] pointer-events-none" 
      />

      <input 
        type="file" 
        multiple
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
      />

      {/* Top Brand Header outside the wedge */}
      <header className="max-w-2xl w-full mb-3 px-3 flex items-center justify-between z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 backdrop-blur-md flex items-center justify-center text-blue-500 shadow-sm">
            <Share2 className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-color)]">
            DropTop
          </h1>
        </div>
      </header>

      <div className="max-w-2xl w-full bg-[var(--glass-bg)] backdrop-blur-3xl rounded-[40px] shadow-[0_8px_32px_rgba(0,0,0,0.15)] border border-[var(--glass-border)] p-6 md:p-10 relative z-10">
        
        {/* Header inside card */}
        <div className="text-center mb-8 mt-1 flex flex-col items-center gap-3">
          {/* Scaled-down Compact Visibility Wedge */}
          <div className="flex items-center gap-2 bg-[var(--card-bg)] backdrop-blur-md px-3 py-1 rounded-full border border-[var(--glass-border)] shadow-xs text-xs">
            <span className="text-[var(--secondary-text)] font-medium flex items-center gap-1 text-[11px]">
              {isDiscoverable ? <Eye className="w-3.5 h-3.5 text-blue-500" /> : <EyeOff className="w-3.5 h-3.5" />}
              Visibility
            </span>
            <button 
              onClick={() => toggleDiscoverable(!isDiscoverable)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 focus:outline-none cursor-pointer ${isDiscoverable ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-700'}`}
              title="Toggle visibility"
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform duration-300 ${isDiscoverable ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Display Name & Avatar Badge (Changeable only on select) */}
          {isDiscoverable ? (
            <div className="flex flex-col items-center gap-1.5">
              {isEditingName ? (
                <div className="flex items-center gap-2 bg-[var(--card-bg)] rounded-2xl p-1.5 pl-3 border-2 border-blue-500 shadow-lg">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {getInitials(editNameValue || myDevice?.name)}
                  </div>
                  <input 
                    type="text" 
                    value={editNameValue}
                    onChange={(e) => setEditNameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveName();
                      if (e.key === 'Escape') setIsEditingName(false);
                    }}
                    placeholder="Enter display name"
                    className="bg-transparent outline-none font-semibold text-sm w-36 text-[var(--text-color)]"
                    autoFocus
                  />
                  <button 
                    onClick={saveName} 
                    className="p-1.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white transition-colors cursor-pointer"
                    title="Save name"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setIsEditingName(false)} 
                    className="p-1.5 rounded-xl hover:bg-gray-200/40 text-[var(--secondary-text)] transition-colors cursor-pointer"
                    title="Cancel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={startEditingName}
                  title="Click to select and change display name"
                  className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-[var(--card-bg)] hover:bg-[var(--glass-border)] border border-[var(--glass-border)] hover:border-blue-500/40 transition-all cursor-pointer shadow-sm group"
                >
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-500 to-sky-400 text-white text-xs font-bold flex items-center justify-center shadow-xs">
                      {getInitials(myDevice?.name)}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-[var(--card-bg)] rounded-full" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] text-[var(--secondary-text)] uppercase tracking-wider font-semibold">Your Device</p>
                    <p className="font-semibold text-sm text-[var(--text-color)] leading-tight">
                      {myDevice?.name || 'Initializing...'}
                    </p>
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors ml-1">
                    Edit
                  </span>
                </button>
              )}
            </div>
          ) : (
            <div className="text-[var(--secondary-text)] italic text-xs">You are currently hidden from others.</div>
          )}
        </div>

        {/* Radar / Device List */}
        <div className="relative aspect-square max-w-[300px] mx-auto mb-10 flex items-center justify-center">
          {/* Radar Rings */}
          <div className="absolute inset-0 border border-blue-500/10 rounded-full" />
          <div className="absolute inset-[20%] border border-blue-500/10 rounded-full" />
          <div className="absolute inset-[40%] border border-blue-500/10 rounded-full" />
          
          {/* Scanning Animation */}
          {isDiscoverable && (
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 to-transparent rounded-full pointer-events-none"
              style={{ filter: 'blur(4px)' }}
            />
          )}

          {/* My Device Display Avatar Badge (Center DP) */}
          <div className="relative z-10 flex flex-col items-center">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-500 to-sky-400 p-[2.5px] shadow-xl">
                <div className="w-full h-full rounded-full bg-[var(--card-bg)] flex items-center justify-center font-bold text-lg text-[var(--text-color)]">
                  {myDevice ? getInitials(myDevice.name) : <Loader2 className="w-6 h-6 animate-spin text-blue-500" />}
                </div>
              </div>

              {/* Floating Device Micro-Badge */}
              <div className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-[var(--card-bg)] border border-[var(--glass-border)] shadow-md flex items-center justify-center">
                {myDevice ? getDeviceIcon(myDevice.deviceType, "w-3.5 h-3.5 text-blue-500") : null}
              </div>

              {/* Online Pulse Indicator */}
              {isDiscoverable && (
                <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-black rounded-full shadow-xs animate-pulse" />
              )}
            </div>

            <div className="mt-2 text-center max-w-[100px]">
              <span className="text-[11px] font-semibold text-[var(--text-color)] block truncate px-2.5 py-0.5 rounded-full bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-xs">
                {myDevice?.name || 'You'}
              </span>
            </div>
          </div>

          {/* Other Devices */}
          <AnimatePresence>
            {isDiscoverable && devices.map((device, index) => {
              const angle = (index / devices.length) * 2 * Math.PI;
              const radius = 120;
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;

              return (
                <motion.button
                  key={device.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1, x, y }}
                  exit={{ scale: 0, opacity: 0 }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleDeviceClick(device)}
                  className="absolute p-2.5 bg-[var(--glass-bg)] backdrop-blur-md rounded-2xl shadow-md border border-[var(--glass-border)] flex flex-col items-center gap-1.5 group cursor-pointer"
                >
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 via-teal-500 to-blue-500 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                      {getInitials(device.name)}
                    </div>
                    <div className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-[var(--card-bg)] border border-[var(--glass-border)]">
                      {getDeviceIcon(device.deviceType, "w-2.5 h-2.5 text-emerald-500")}
                    </div>
                  </div>
                  <span className="text-[10px] font-medium max-w-[65px] truncate text-[var(--text-color)]">{device.name}</span>
                </motion.button>
              );
            })}
          </AnimatePresence>

          {/* Empty State */}
          {isDiscoverable && devices.length === 0 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute bottom-[-40px] text-center w-full"
            >
              <p className="text-xs text-[var(--secondary-text)] animate-pulse">Searching for nearby devices...</p>
            </motion.div>
          )}
        </div>

        {/* Transfer Status & Unified Progress Bar */}
        <AnimatePresence>
          {transferState.status !== 'idle' && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="mt-6 p-6 bg-[var(--glass-bg)] backdrop-blur-xl rounded-3xl border border-[var(--glass-border)] shadow-xl"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-blue-500/10 rounded-2xl shrink-0">
                  {transferState.status === 'transferring' ? (
                    <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                  ) : transferState.status === 'completed' ? (
                    <CheckCircle className="w-6 h-6 text-emerald-500" />
                  ) : transferState.status === 'error' ? (
                    <XCircle className="w-6 h-6 text-rose-500" />
                  ) : (
                    <Send className="w-6 h-6 text-blue-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm truncate text-[var(--text-color)]">
                      {transferState.status === 'connecting' && 'Connecting to device...'}
                      {transferState.status === 'transferring' && (
                        transferState.totalFiles && transferState.totalFiles > 1 
                          ? `Transferring Batch (${(transferState.currentFileIndex || 0) + 1} of ${transferState.totalFiles})`
                          : `Transferring ${transferState.fileName}`
                      )}
                      {transferState.status === 'completed' && 'Transfer Complete!'}
                      {transferState.status === 'error' && 'Transfer Failed'}
                    </h3>
                    {transferState.status === 'transferring' && (
                      <span className="font-mono tabular-nums text-xs font-bold text-blue-500 ml-2">
                        {transferState.batchProgress ?? transferState.progress}%
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[var(--secondary-text)] mt-0.5 truncate">
                    {transferState.status === 'transferring' ? (
                      transferState.totalFiles && transferState.totalFiles > 1 ? (
                        <>
                          <span className="font-mono tabular-nums">{formatBytes(transferState.totalBytesTransferred || 0)}</span> of <span className="font-mono tabular-nums">{formatBytes(transferState.totalBatchSize || 0)}</span> • Current: {transferState.fileName}
                        </>
                      ) : (
                        `${formatBytes(transferState.fileSize || 0)} • Lossless (Original Quality)`
                      )
                    ) : transferState.status === 'completed' ? (
                      'All files delivered in 100% original uncompressed quality'
                    ) : (
                      'Preparing peer-to-peer data channel...'
                    )}
                  </p>
                </div>
              </div>

              {/* Unified Batch Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] text-[var(--secondary-text)] font-medium">
                  <span>Total Batch Progress</span>
                  <span className="font-mono tabular-nums font-semibold text-[var(--text-color)]">
                    {transferState.batchProgress ?? transferState.progress}%
                  </span>
                </div>
                <div className="relative h-2.5 bg-gray-200/50 dark:bg-gray-800/50 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${transferState.batchProgress ?? transferState.progress}%` }}
                    transition={{ ease: "easeOut", duration: 0.2 }}
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 via-indigo-500 to-sky-400 rounded-full"
                  />
                </div>
              </div>

              {/* Individual File Progress (when transferring multiple files) */}
              {transferState.totalFiles && transferState.totalFiles > 1 && transferState.status === 'transferring' && (
                <div className="mt-3 pt-3 border-t border-[var(--glass-border)] space-y-1">
                  <div className="flex justify-between text-[10px] text-[var(--secondary-text)]">
                    <span className="truncate max-w-[220px]">Active file: {transferState.fileName}</span>
                    <span className="font-mono tabular-nums">{transferState.progress}%</span>
                  </div>
                  <div className="relative h-1.5 bg-gray-200/30 dark:bg-gray-800/30 rounded-full overflow-hidden">
                    <motion.div 
                      animate={{ width: `${transferState.progress}%` }}
                      transition={{ ease: "easeOut", duration: 0.15 }}
                      className="absolute inset-y-0 left-0 bg-blue-500/70 rounded-full"
                    />
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action Modal (Send File or Text) */}
      <AnimatePresence>
        {actionModalDevice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActionModalDevice(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--glass-bg)] backdrop-blur-2xl rounded-[32px] p-8 max-w-sm w-full shadow-2xl border border-[var(--glass-border)]"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-[var(--text-color)]">Send to {actionModalDevice.name}</h2>
                <button onClick={() => setActionModalDevice(null)} className="p-2 rounded-full hover:bg-gray-100/20 transition-colors text-[var(--text-color)]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <button 
                  onClick={handleSendFileClick}
                  className="w-full flex flex-col items-center justify-center gap-1 py-4 px-6 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <File className="w-5 h-5" />
                    <span>Send File(s)</span>
                  </div>
                  <span className="text-[11px] font-normal text-blue-100 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Original Quality • 4K & RAW Lossless
                  </span>
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[var(--glass-border)]"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-[var(--glass-bg)] text-[var(--secondary-text)]">or send text</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <textarea
                    value={textToSend}
                    onChange={(e) => setTextToSend(e.target.value)}
                    placeholder="Type a message, link, or snippet..."
                    className="w-full h-24 p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--glass-border)] text-[var(--text-color)] placeholder:text-[var(--secondary-text)] focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <button 
                    onClick={handleSendTextClick}
                    disabled={!textToSend.trim()}
                    className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-2xl bg-gray-100/20 hover:bg-gray-100/30 text-[var(--text-color)] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <MessageSquare className="w-5 h-5" />
                    Send Text
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Incoming Text Modal */}
      <AnimatePresence>
        {incomingText && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[var(--glass-bg)] backdrop-blur-2xl rounded-[32px] p-8 max-w-sm w-full shadow-2xl border border-[var(--glass-border)]"
            >
              <div className="mb-6 flex justify-center">
                <div className="p-5 bg-blue-500/10 rounded-3xl">
                  <MessageSquare className="w-8 h-8 text-blue-500" />
                </div>
              </div>
              <h2 className="text-xl font-semibold mb-2 text-[var(--text-color)] text-center">New Message</h2>
              <p className="text-sm text-[var(--secondary-text)] mb-6 text-center">
                From <span className="font-semibold text-[var(--text-color)]">"{incomingText.sender}"</span>
              </p>
              
              <div className="bg-[var(--card-bg)] border border-[var(--glass-border)] rounded-2xl p-4 mb-6 max-h-48 overflow-y-auto">
                <p className="text-[var(--text-color)] whitespace-pre-wrap break-words text-sm">
                  {incomingText.text}
                </p>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={clearIncomingText}
                  className="flex-1 py-4 px-6 rounded-2xl bg-gray-100/20 hover:bg-gray-100/30 text-[var(--text-color)] font-semibold transition-colors"
                >
                  Close
                </button>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(incomingText.text);
                    clearIncomingText();
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  Copy
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Incoming Offer Modal */}
      <AnimatePresence>
        {incomingOffer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[var(--glass-bg)] backdrop-blur-2xl rounded-[32px] p-8 max-w-sm w-full shadow-2xl border border-[var(--glass-border)] text-center"
            >
              <div className="mb-6 flex justify-center">
                <div className="p-5 bg-blue-500/10 rounded-3xl">
                  {getDeviceIcon(incomingOffer.caller.deviceType)}
                </div>
              </div>
              <h2 className="text-xl font-semibold mb-2 text-[var(--text-color)]">Incoming AirDrop</h2>
              <p className="text-sm text-[var(--secondary-text)] mb-8">
                <span className="font-semibold text-[var(--text-color)]">"{incomingOffer.caller.name}"</span> wants to share files with you.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={rejectOffer}
                  className="flex-1 py-4 px-6 rounded-2xl bg-gray-100/20 hover:bg-gray-100/30 text-[var(--text-color)] font-semibold transition-colors"
                >
                  Decline
                </button>
                <button 
                  onClick={acceptOffer}
                  className="flex-1 py-4 px-6 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-colors"
                >
                  Accept
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSettings(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--glass-bg)] backdrop-blur-3xl rounded-[32px] p-8 max-w-md w-full max-h-[88vh] flex flex-col shadow-2xl border border-[var(--glass-border)]"
            >
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h2 className="text-2xl font-semibold text-[var(--text-color)]">Settings</h2>
                <button onClick={() => setShowSettings(false)} className="p-2 rounded-full hover:bg-gray-100/20 transition-colors text-[var(--text-color)]">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-5 overflow-y-auto pr-1 custom-scrollbar flex-1">
                {/* Theme Toggle */}
                <div className="p-4 bg-[var(--card-bg)] rounded-2xl border border-[var(--glass-border)]">
                  <p className="font-medium mb-3 text-sm text-[var(--text-color)]">Appearance</p>
                  <div className="flex p-1 bg-gray-100/10 rounded-xl border border-[var(--glass-border)]">
                    {[
                      { id: 'light', icon: Sun, label: 'Light' },
                      { id: 'dark', icon: Moon, label: 'Dark' },
                      { id: 'system', icon: MonitorIcon, label: 'System' }
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => updateTheme(item.id as any)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${
                          theme === item.id 
                            ? 'bg-white text-blue-500 shadow-sm' 
                            : 'text-[var(--secondary-text)] hover:text-[var(--text-color)]'
                        }`}
                      >
                        <item.icon className="w-4 h-4" />
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-[var(--card-bg)] rounded-2xl border border-[var(--glass-border)]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      {autoAccept ? <ShieldCheck className="w-5 h-5 text-blue-500" /> : <Shield className="w-5 h-5 text-gray-500" />}
                    </div>
                    <div>
                      <p className="font-medium text-[var(--text-color)]">Auto-Accept</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => toggleAutoAccept(!autoAccept)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoAccept ? 'bg-blue-500' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoAccept ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-[var(--card-bg)] rounded-2xl border border-[var(--glass-border)]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      {soundEnabled ? <Volume2 className="w-5 h-5 text-blue-500" /> : <VolumeX className="w-5 h-5 text-gray-500" />}
                    </div>
                    <div>
                      <p className="font-medium text-[var(--text-color)]">Sound</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => toggleSound(!soundEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${soundEnabled ? 'bg-blue-500' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${soundEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                {/* Transfer Quality Assurance */}
                <div className="p-4 bg-[var(--card-bg)] rounded-2xl border border-[var(--glass-border)] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-lg">
                      <Sparkles className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm text-[var(--text-color)]">Transfer Quality</p>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                          ORIGINAL 4K / RAW
                        </span>
                      </div>
                      <p className="text-xs text-[var(--secondary-text)]">0% compression • Bit-for-bit direct transfer</p>
                    </div>
                  </div>
                </div>

                {/* Network Diagnostics */}
                <div className="p-4 bg-[var(--card-bg)] rounded-2xl border border-[var(--glass-border)] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isConnected ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                        <Activity className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium text-sm text-[var(--text-color)]">Network Diagnostics</p>
                        <p className="text-xs text-[var(--secondary-text)] flex items-center gap-1.5">
                          <span className={`inline-block w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                          {isConnected ? 'Signaling Connected' : 'Connecting to Server...'}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => runDiagnostics()}
                      disabled={isDiagnosing}
                      className="px-3 py-1.5 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                    >
                      {isDiagnosing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Pinging...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>{diagnosticResult ? 'Ping Again' : 'Test Ping'}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Diagnostic Results Card */}
                  {diagnosticResult && (
                    <motion.div 
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-3 pt-3 border-t border-[var(--glass-border)] space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--secondary-text)]">Latency (Round Trip RTT)</span>
                        <div className="flex items-center gap-2">
                          {diagnosticResult.latencyMs !== null ? (
                            <>
                              <span className="font-mono tabular-nums font-semibold text-sm text-[var(--text-color)]">
                                {diagnosticResult.latencyMs} ms
                              </span>
                              <span className={`px-2 py-0.5 rounded-full font-medium text-[10px] ${
                                diagnosticResult.rating === 'excellent' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
                                diagnosticResult.rating === 'good' ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' :
                                diagnosticResult.rating === 'fair' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' :
                                'bg-red-500/15 text-red-600 dark:text-red-400'
                              }`}>
                                {diagnosticResult.rating === 'excellent' ? 'EXCELLENT' :
                                 diagnosticResult.rating === 'good' ? 'GOOD' :
                                 diagnosticResult.rating === 'fair' ? 'MODERATE' : 'HIGH LATENCY'}
                              </span>
                            </>
                          ) : (
                            <span className="text-red-500 font-medium">Offline</span>
                          )}
                        </div>
                      </div>

                      {diagnosticResult.samples.length > 1 && (
                        <div className="flex items-center justify-between text-[11px] text-[var(--secondary-text)]">
                          <span>Samples (Min / Max / Jitter)</span>
                          <span className="font-mono tabular-nums text-[var(--text-color)]">
                            {diagnosticResult.minLatencyMs}ms / {diagnosticResult.maxLatencyMs}ms · ±{diagnosticResult.jitterMs}ms
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[11px] text-[var(--secondary-text)]">
                        <span>Signaling Protocol</span>
                        <span className="font-medium text-[var(--text-color)]">
                          {diagnosticResult.protocol === 'websocket' ? 'WebSocket (Real-Time)' : 
                           diagnosticResult.protocol === 'http-fallback' ? 'HTTP Polling Fallback' : 'None'}
                        </span>
                      </div>

                      <div className="flex flex-col gap-0.5 pt-1 text-[11px] text-[var(--secondary-text)]">
                        <span>Signaling Server Target</span>
                        <span className="font-mono text-[10px] truncate max-w-full text-[var(--text-color)] opacity-85" title={diagnosticResult.serverUrl}>
                          {diagnosticResult.serverUrl}
                        </span>
                      </div>

                      {diagnosticResult.socketId && (
                        <div className="flex items-center justify-between text-[11px] text-[var(--secondary-text)]">
                          <span>Session ID</span>
                          <span className="font-mono text-[10px] text-[var(--text-color)] opacity-75">
                            {diagnosticResult.socketId.slice(0, 12)}...
                          </span>
                        </div>
                      )}

                      {diagnosticResult.error && (
                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[11px] leading-relaxed">
                          {diagnosticResult.error}
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold text-[var(--secondary-text)] uppercase tracking-wider px-1">Native App</p>
                  
                  {installPrompt && (
                    <button 
                      onClick={handleInstall}
                      className="w-full flex items-center justify-between p-4 bg-blue-500/10 hover:bg-blue-500/20 rounded-2xl border border-blue-500/20 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                          <Download className="w-5 h-5 text-blue-500" />
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-blue-600">Install App</p>
                          <p className="text-xs text-blue-500/70">Add to home screen or desktop</p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-blue-300 group-hover:translate-x-1 transition-transform" />
                    </button>
                  )}

                  <div className="p-4 bg-[var(--card-bg)] rounded-2xl border border-[var(--glass-border)] space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-500/10 rounded-lg">
                        <Smartphone className="w-5 h-5 text-purple-500" />
                      </div>
                      <p className="font-medium text-[var(--text-color)]">iOS & Android</p>
                    </div>
                    <p className="text-xs text-[var(--secondary-text)] leading-relaxed">
                      To install on iPhone: Tap <Share2 className="w-3 h-3 inline" /> then <span className="font-semibold text-[var(--text-color)]">"Add to Home Screen"</span>.
                      <br />
                      On Android: Tap the three dots then <span className="font-semibold text-[var(--text-color)]">"Install App"</span>.
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => { clearHistory(); setShowSettings(false); }}
                  className="w-full flex items-center justify-between p-4 bg-red-500/5 hover:bg-red-500/10 rounded-2xl border border-red-500/20 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-500/10 rounded-lg">
                      <Trash2 className="w-5 h-5 text-red-500" />
                    </div>
                    <p className="font-medium text-red-600">Clear History</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-red-300 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowHistory(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--glass-bg)] backdrop-blur-3xl rounded-[32px] p-8 max-w-md w-full h-[80vh] flex flex-col shadow-2xl border border-[var(--glass-border)]"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-semibold text-[var(--text-color)]">History</h2>
                <button onClick={() => setShowHistory(false)} className="p-2 rounded-full hover:bg-gray-100/20 transition-colors text-[var(--text-color)]">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-[var(--secondary-text)] gap-2">
                    <Clock className="w-12 h-12 opacity-20" />
                    <p>No recent transfers</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div key={item.id} className="p-4 bg-[var(--card-bg)] rounded-2xl border border-[var(--glass-border)] flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${item.type === 'sent' ? 'bg-blue-500/10' : 'bg-green-500/10'}`}>
                        {item.dataType === 'text' ? (
                          <MessageSquare className={`w-5 h-5 ${item.type === 'sent' ? 'text-blue-500' : 'text-green-500'}`} />
                        ) : (
                          <File className={`w-5 h-5 ${item.type === 'sent' ? 'text-blue-500' : 'text-green-500'}`} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate text-[var(--text-color)]">{item.name}</p>
                        <p className="text-[10px] text-[var(--secondary-text)]">
                          {item.type === 'sent' ? `Sent to ${item.deviceName}` : `Received from ${item.deviceName}`} 
                          {item.dataType !== 'text' && ` • ${formatBytes(item.size)}`}
                        </p>
                      </div>
                      {item.dataType === 'text' && item.textContent && (
                        <button 
                          onClick={() => navigator.clipboard.writeText(item.textContent!)}
                          className="p-2 bg-gray-100/10 hover:bg-gray-100/20 rounded-lg transition-colors"
                          title="Copy text"
                        >
                          <Copy className="w-4 h-4 text-[var(--text-color)]" />
                        </button>
                      )}
                      <span className="text-[10px] text-[var(--secondary-text)] whitespace-nowrap">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File Queue & Preview Modal (Multi-file selection with thumbnails and document icons) */}
      <AnimatePresence>
        {queueTargetDevice && fileQueue.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={cancelQueue}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--glass-bg)] backdrop-blur-3xl rounded-[32px] p-6 sm:p-8 max-w-lg w-full max-h-[88vh] flex flex-col shadow-2xl border border-[var(--glass-border)]"
            >
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-[var(--glass-border)] shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-[var(--text-color)]">Transfer Queue</h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400">
                      {fileQueue.length} {fileQueue.length === 1 ? 'file' : 'files'}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--secondary-text)] mt-0.5">
                    Sending to <span className="font-semibold text-[var(--text-color)]">"{queueTargetDevice.name}"</span> • {formatBytes(fileQueue.reduce((acc, i) => acc + i.file.size, 0))}
                  </p>
                </div>
                <button 
                  onClick={cancelQueue} 
                  className="p-2 rounded-full hover:bg-gray-100/20 transition-colors text-[var(--text-color)] cursor-pointer"
                  title="Cancel Queue"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable File List with Thumbnails and Icons */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 py-1 custom-scrollbar">
                {fileQueue.map((item) => (
                  <div 
                    key={item.id}
                    className="p-3 bg-[var(--card-bg)] rounded-2xl border border-[var(--glass-border)] flex items-center gap-3 group transition-all hover:border-blue-500/30"
                  >
                    {/* Visual Preview / Thumbnail / Icon */}
                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 flex items-center justify-center border border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-xs">
                      {item.category === 'image' && item.previewUrl ? (
                        <img 
                          src={item.previewUrl} 
                          alt={item.file.name} 
                          className="w-full h-full object-cover"
                        />
                      ) : item.category === 'video' ? (
                        <div className="w-full h-full bg-purple-500/10 flex items-center justify-center">
                          <Film className="w-6 h-6 text-purple-500" />
                        </div>
                      ) : item.category === 'audio' ? (
                        <div className="w-full h-full bg-amber-500/10 flex items-center justify-center">
                          <Music className="w-6 h-6 text-amber-500" />
                        </div>
                      ) : item.category === 'pdf' ? (
                        <div className="w-full h-full bg-rose-500/10 flex items-center justify-center">
                          <FileText className="w-6 h-6 text-rose-500" />
                        </div>
                      ) : item.category === 'archive' ? (
                        <div className="w-full h-full bg-indigo-500/10 flex items-center justify-center">
                          <Archive className="w-6 h-6 text-indigo-500" />
                        </div>
                      ) : item.category === 'document' ? (
                        <div className="w-full h-full bg-blue-500/10 flex items-center justify-center">
                          <FileText className="w-6 h-6 text-blue-500" />
                        </div>
                      ) : (
                        <div className="w-full h-full bg-gray-500/10 flex items-center justify-center">
                          <File className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                    </div>

                    {/* File Details */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs truncate text-[var(--text-color)]" title={item.file.name}>
                        {item.file.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[var(--secondary-text)]">
                        <span className="font-mono tabular-nums">{formatBytes(item.file.size)}</span>
                        <span>•</span>
                        <span className="uppercase font-semibold tracking-wider text-[9px] px-1.5 py-0.5 rounded bg-gray-100/15">
                          {item.file.name.split('.').pop() || item.category}
                        </span>
                      </div>
                    </div>

                    {/* Remove File Button */}
                    <button
                      onClick={() => removeQueuedFile(item.id)}
                      className="p-2 rounded-xl text-[var(--secondary-text)] hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Remove from queue"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add More Files Row */}
              <div className="pt-3 border-t border-[var(--glass-border)] shrink-0 flex items-center justify-between">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100/15 hover:bg-gray-100/25 text-xs font-medium text-[var(--text-color)] transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-blue-500" />
                  <span>Add More Files</span>
                </button>

                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> 100% Lossless (4K / RAW)
                </span>
              </div>

              {/* Modal Actions */}
              <div className="flex gap-3 pt-3 shrink-0">
                <button
                  onClick={cancelQueue}
                  className="flex-1 py-3 px-4 rounded-2xl bg-gray-200/20 hover:bg-gray-200/30 text-xs font-semibold text-[var(--text-color)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={startBatchTransfer}
                  className="flex-[2] py-3 px-4 rounded-2xl bg-blue-500 hover:bg-blue-600 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
                >
                  <Send className="w-4 h-4" />
                  <span>Send {fileQueue.length} {fileQueue.length === 1 ? 'File' : 'Files'} ({formatBytes(fileQueue.reduce((acc, i) => acc + i.file.size, 0))})</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Bottom Dock (Refresh, History, Settings mashed together) */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <div className="flex items-center gap-1 p-1.5 bg-[var(--glass-bg)] backdrop-blur-2xl rounded-full border border-[var(--glass-border)] shadow-2xl">
          <button 
            onClick={handleRefresh}
            title="Scan Nearby Devices"
            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-medium text-[var(--text-color)] hover:bg-[var(--glass-border)] transition-all group cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 text-blue-500 ${isRefreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
            <span className="hidden sm:inline">Scan</span>
          </button>

          <div className="w-[1px] h-4 bg-[var(--glass-border)]" />

          <button 
            onClick={() => setShowHistory(true)}
            title="Transfer History"
            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-medium text-[var(--text-color)] hover:bg-[var(--glass-border)] transition-all cursor-pointer relative"
          >
            <History className="w-4 h-4 text-[var(--text-color)]" />
            <span className="hidden sm:inline">History</span>
            {history.length > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            )}
          </button>

          <div className="w-[1px] h-4 bg-[var(--glass-border)]" />

          <button 
            onClick={() => setShowSettings(true)}
            title="Settings"
            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-medium text-[var(--text-color)] hover:bg-[var(--glass-border)] transition-all cursor-pointer"
          >
            <Settings className="w-4 h-4 text-[var(--text-color)]" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(150,150,150,0.2); border-radius: 10px; }
      `}</style>
    </div>
  );
}
