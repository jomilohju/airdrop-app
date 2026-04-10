import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAirDrop, Device } from './hooks/useAirDrop';
import { 
  Laptop, Smartphone, Monitor, File, CheckCircle, XCircle, 
  Loader2, Send, Edit2, Check, Eye, EyeOff, Settings, 
  History, Trash2, Clock, ChevronRight, X, Shield, ShieldCheck,
  Moon, Sun, Monitor as MonitorIcon, Volume2, VolumeX,
  Download, Share2, RefreshCw
} from 'lucide-react';

export default function App() {
  const { 
    devices, myDevice, transferState, incomingOffer, 
    sendFiles, acceptOffer, rejectOffer, refreshDevices, updateMyName, 
    isDiscoverable, toggleDiscoverable, autoAccept, 
    toggleAutoAccept, soundEnabled, toggleSound, 
    theme, updateTheme, history, clearHistory 
  } = useAirDrop();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
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
    setSelectedDevice(device);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && selectedDevice) {
      sendFiles(selectedDevice, Array.from(files));
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    setSelectedDevice(null);
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

  const getDeviceIcon = (type: string) => {
    if (type === 'iOS' || type === 'Android') return <Smartphone className="w-8 h-8 text-blue-500" />;
    if (type === 'Mac') return <Laptop className="w-8 h-8 text-blue-500" />;
    return <Monitor className="w-8 h-8 text-blue-500" />;
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

      <div className="max-w-2xl w-full bg-[var(--glass-bg)] backdrop-blur-3xl rounded-[40px] shadow-[0_8px_32px_rgba(0,0,0,0.15)] border border-[var(--glass-border)] p-8 md:p-12 relative z-10">
        
        {/* App Title */}
        <h1 className="absolute top-8 left-8 text-2xl font-bold tracking-tight text-[var(--text-color)] flex items-center gap-2">
          <Share2 className="w-6 h-6 text-blue-500" />
          DropTop
        </h1>

        {/* Top Actions */}
        <div className="absolute top-8 right-8 flex gap-3">
          <button 
            onClick={handleRefresh}
            title="Refresh Devices"
            className="p-2 rounded-full bg-[var(--glass-bg)] hover:bg-[var(--glass-border)] transition-colors border border-[var(--glass-border)] shadow-sm"
          >
            <RefreshCw className={`w-5 h-5 text-[var(--text-color)] ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={() => setShowHistory(true)}
            title="History"
            className="p-2 rounded-full bg-[var(--glass-bg)] hover:bg-[var(--glass-border)] transition-colors border border-[var(--glass-border)] shadow-sm"
          >
            <History className="w-5 h-5 text-[var(--text-color)]" />
          </button>
          <button 
            onClick={() => setShowSettings(true)}
            title="Settings"
            className="p-2 rounded-full bg-[var(--glass-bg)] hover:bg-[var(--glass-border)] transition-colors border border-[var(--glass-border)] shadow-sm"
          >
            <Settings className="w-5 h-5 text-[var(--text-color)]" />
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-12 mt-12">
          <div className="flex flex-col items-center justify-center gap-4 text-sm">
            
            {/* Visibility Toggle */}
            <div className="flex items-center gap-3 bg-[var(--glass-bg)] backdrop-blur-md px-4 py-2 rounded-full border border-[var(--glass-border)] shadow-sm">
              <span className="text-[var(--secondary-text)] font-medium flex items-center gap-1.5">
                {isDiscoverable ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                Visibility
              </span>
              <button 
                onClick={() => toggleDiscoverable(!isDiscoverable)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none ${isDiscoverable ? 'bg-blue-500' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${isDiscoverable ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Name Editor */}
            {isDiscoverable ? (
              <div className="flex items-center gap-2">
                <span className="text-[var(--secondary-text)]">Discoverable as</span>
                {isEditingName ? (
                  <div className="flex items-center gap-2 bg-[var(--glass-bg)] rounded-full px-3 py-1 border border-[var(--glass-border)]">
                    <input 
                      type="text" 
                      value={editNameValue}
                      onChange={(e) => setEditNameValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveName()}
                      className="bg-transparent outline-none font-medium w-32 text-center text-[var(--text-color)]"
                      autoFocus
                    />
                    <button onClick={saveName} className="text-blue-500 hover:text-blue-600">
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group cursor-pointer" onClick={startEditingName}>
                    <span className="font-medium bg-[var(--glass-bg)] px-3 py-1 rounded-full border border-[var(--glass-border)] shadow-sm transition-all group-hover:bg-[var(--glass-border)]">
                      "{myDevice?.name || 'Initializing...'}"
                    </span>
                    <Edit2 className="w-3 h-3 text-[var(--secondary-text)] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                )}
              </div>
            ) : (
              <div className="text-[var(--secondary-text)] italic">You are currently hidden from others.</div>
            )}
          </div>
        </div>

        {/* Radar / Device List */}
        <div className="relative aspect-square max-w-[300px] mx-auto mb-12 flex items-center justify-center">
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

          {/* My Device (Center) */}
          <div className="relative z-10 bg-[var(--glass-bg)] backdrop-blur-md p-4 rounded-full shadow-lg border border-[var(--glass-border)]">
            {myDevice ? getDeviceIcon(myDevice.deviceType) : <Loader2 className="w-8 h-8 animate-spin text-blue-500" />}
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
                  className="absolute p-3 bg-[var(--glass-bg)] backdrop-blur-md rounded-2xl shadow-md border border-[var(--glass-border)] flex flex-col items-center gap-1 group"
                >
                  {getDeviceIcon(device.deviceType)}
                  <span className="text-[10px] font-medium max-w-[60px] truncate text-[var(--text-color)]">{device.name}</span>
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

        {/* Transfer Status */}
        <AnimatePresence>
          {transferState.status !== 'idle' && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="mt-8 p-6 bg-[var(--glass-bg)] backdrop-blur-xl rounded-3xl border border-[var(--glass-border)] shadow-lg"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-blue-500/10 rounded-2xl">
                  {transferState.status === 'transferring' ? (
                    <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                  ) : transferState.status === 'completed' ? (
                    <CheckCircle className="w-6 h-6 text-green-500" />
                  ) : transferState.status === 'error' ? (
                    <XCircle className="w-6 h-6 text-red-500" />
                  ) : (
                    <Send className="w-6 h-6 text-blue-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate text-[var(--text-color)]">
                    {transferState.status === 'connecting' && 'Connecting...'}
                    {transferState.status === 'transferring' && `Sending ${transferState.fileName}`}
                    {transferState.status === 'completed' && 'Transfer Complete'}
                    {transferState.status === 'error' && 'Transfer Failed'}
                  </h3>
                  <p className="text-xs text-[var(--secondary-text)]">
                    {transferState.status === 'transferring' && (
                      transferState.totalFiles && transferState.totalFiles > 1 
                        ? `File ${transferState.currentFileIndex! + 1} of ${transferState.totalFiles}`
                        : formatBytes(transferState.fileSize || 0)
                    )}
                    {transferState.status === 'completed' && 'Files saved to downloads'}
                  </p>
                </div>
              </div>

              <div className="relative h-2 bg-gray-200/50 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${transferState.progress}%` }}
                  className="absolute inset-y-0 left-0 bg-blue-500 rounded-full"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[var(--glass-bg)] backdrop-blur-3xl rounded-[32px] p-8 max-w-md w-full shadow-2xl border border-[var(--glass-border)]"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-semibold text-[var(--text-color)]">Settings</h2>
                <button onClick={() => setShowSettings(false)} className="p-2 rounded-full hover:bg-gray-100/20 transition-colors text-[var(--text-color)]">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
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
                      <p className="text-xs text-[var(--secondary-text)]">Receive files without prompt</p>
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
                      <p className="font-medium text-[var(--text-color)]">Sound Effects</p>
                      <p className="text-xs text-[var(--secondary-text)]">Play sounds on transfer</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => toggleSound(!soundEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${soundEnabled ? 'bg-blue-500' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${soundEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
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
                        <File className={`w-5 h-5 ${item.type === 'sent' ? 'text-blue-500' : 'text-green-500'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate text-[var(--text-color)]">{item.name}</p>
                        <p className="text-[10px] text-[var(--secondary-text)]">
                          {item.type === 'sent' ? `Sent to ${item.deviceName}` : `Received from ${item.deviceName}`} • {formatBytes(item.size)}
                        </p>
                      </div>
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

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(150,150,150,0.2); border-radius: 10px; }
      `}</style>
    </div>
  );
}
