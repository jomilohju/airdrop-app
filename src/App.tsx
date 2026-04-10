import { useState, useRef, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAirDrop, Device } from './hooks/useAirDrop';
import { Laptop, Smartphone, Monitor, File, CheckCircle, XCircle, Loader2, Send, Edit2, Check, Eye, EyeOff } from 'lucide-react';

export default function App() {
  const { devices, myDevice, transferState, incomingOffer, sendFiles, acceptOffer, rejectOffer, updateMyName, isDiscoverable, toggleDiscoverable } = useAirDrop();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');

  const handleDeviceClick = (device: Device) => {
    setSelectedDevice(device);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && selectedDevice) {
      sendFiles(selectedDevice, Array.from(files));
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
    <div className="min-h-screen bg-mesh text-[#1d1d1f] font-sans flex flex-col items-center justify-center p-4 overflow-hidden relative">
      
      {/* Background Orbs for Liquid Glass effect */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-blue-400/30 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-purple-400/30 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[20%] right-[10%] w-[30vw] h-[30vw] bg-pink-400/20 rounded-full blur-[90px] pointer-events-none" />

      <input 
        type="file" 
        multiple
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
      />

      <div className="max-w-2xl w-full bg-white/40 backdrop-blur-3xl rounded-[40px] shadow-[0_8px_32px_rgba(0,0,0,0.08)] border border-white/50 p-8 md:p-12 relative z-10">
        
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-semibold tracking-tight mb-4">AirDrop</h1>
          
          <div className="flex flex-col items-center justify-center gap-4 text-sm">
            
            {/* Visibility Toggle */}
            <div className="flex items-center gap-3 bg-white/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/60 shadow-sm">
              <span className="text-[#86868b] font-medium flex items-center gap-1.5">
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
                <span className="text-[#86868b]">Discoverable as</span>
                {isEditingName ? (
                  <div className="flex items-center gap-2 bg-white/50 rounded-full px-3 py-1 border border-white/60">
                    <input 
                      type="text" 
                      value={editNameValue}
                      onChange={(e) => setEditNameValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveName()}
                      className="bg-transparent outline-none font-medium w-32 text-center"
                      autoFocus
                    />
                    <button onClick={saveName} className="text-blue-500 hover:text-blue-600">
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group cursor-pointer" onClick={startEditingName}>
                    <span className="font-medium bg-white/30 px-3 py-1 rounded-full border border-white/40 shadow-sm transition-all group-hover:bg-white/50">
                      "{myDevice?.name || 'Initializing...'}"
                    </span>
                    <Edit2 className="w-3 h-3 text-[#86868b] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                )}
              </div>
            ) : (
              <div className="text-[#86868b] italic">You are currently hidden from others.</div>
            )}
          </div>
        </div>

        {/* Radar / Devices Area */}
        <div className="relative h-72 flex items-center justify-center mb-8">
          {/* Radar Circles */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <motion.div 
              animate={{ scale: [1, 2], opacity: [0.5, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="absolute w-32 h-32 rounded-full border border-blue-300/40"
            />
            <motion.div 
              animate={{ scale: [1, 2.5], opacity: [0.3, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear", delay: 1 }}
              className="absolute w-48 h-48 rounded-full border border-blue-300/30"
            />
            <motion.div 
              animate={{ scale: [1, 3], opacity: [0.1, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear", delay: 2 }}
              className="absolute w-64 h-64 rounded-full border border-blue-300/20"
            />
            
            {/* Center User */}
            <div className="w-16 h-16 bg-white/60 backdrop-blur-md rounded-full flex items-center justify-center z-10 shadow-sm border border-white/80">
              {myDevice && getDeviceIcon(myDevice.deviceType)}
            </div>
          </div>

          {/* Discovered Devices */}
          <div className="absolute inset-0">
            <AnimatePresence>
              {devices.map((device, index) => {
                const angle = (index / Math.max(devices.length, 1)) * Math.PI * 2;
                const radius = 110;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;

                return (
                  <motion.button
                    key={device.id}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1, x, y }}
                    exit={{ opacity: 0, scale: 0 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleDeviceClick(device)}
                    className="absolute top-1/2 left-1/2 -ml-10 -mt-10 w-20 flex flex-col items-center gap-2 group"
                  >
                    <div className="w-16 h-16 bg-white/70 backdrop-blur-xl rounded-full flex items-center justify-center shadow-lg border border-white/80 group-hover:border-blue-400 group-hover:shadow-blue-500/20 transition-all">
                      {getDeviceIcon(device.deviceType)}
                    </div>
                    <span className="text-xs font-medium text-center truncate w-full px-2 py-1 bg-white/40 backdrop-blur-sm rounded-full border border-white/30">
                      {device.name.split(' ')[0]}
                    </span>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
          
          {devices.length === 0 && (
            <div className="absolute bottom-[-20px] text-sm text-[#86868b] font-medium bg-white/30 px-4 py-1.5 rounded-full border border-white/40">
              Looking for nearby devices...
            </div>
          )}
        </div>

        {/* Transfer Status */}
        <AnimatePresence>
          {transferState.status !== 'idle' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white/60 backdrop-blur-xl rounded-3xl p-5 flex items-center gap-4 border border-white/70 shadow-sm"
            >
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0">
                {transferState.status === 'completed' ? (
                  <CheckCircle className="w-6 h-6 text-green-500" />
                ) : transferState.status === 'error' ? (
                  <XCircle className="w-6 h-6 text-red-500" />
                ) : (
                  <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-[#1d1d1f]">
                  {transferState.status === 'connecting' && 'Connecting...'}
                  {transferState.status === 'transferring' && (
                    transferState.totalFiles && transferState.totalFiles > 1 
                      ? `Sending file ${((transferState.currentFileIndex || 0) + 1)} of ${transferState.totalFiles}`
                      : `Sending ${transferState.fileName}`
                  )}
                  {transferState.status === 'completed' && 'Transfer Complete'}
                  {transferState.status === 'error' && 'Transfer Failed'}
                </p>
                {transferState.status === 'transferring' && (
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex-1 h-2 bg-black/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-300 ease-out rounded-full"
                        style={{ width: `${transferState.progress}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-[#86868b] w-8 text-right">
                      {transferState.progress}%
                    </span>
                  </div>
                )}
              </div>
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
              className="absolute inset-0 bg-white/20 backdrop-blur-xl z-50 flex items-center justify-center p-6 rounded-[40px]"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white/80 backdrop-blur-2xl rounded-[32px] shadow-2xl p-8 max-w-sm w-full text-center border border-white"
              >
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
                  {getDeviceIcon(incomingOffer.caller.deviceType)}
                </div>
                <h3 className="text-2xl font-semibold mb-2 text-[#1d1d1f]">
                  {incomingOffer.caller.name}
                </h3>
                <p className="text-[#86868b] text-sm mb-8 font-medium">
                  would like to share files with you
                </p>
                <div className="flex gap-4">
                  <button 
                    onClick={rejectOffer}
                    className="flex-1 py-3.5 px-4 rounded-2xl font-semibold bg-black/5 text-[#1d1d1f] hover:bg-black/10 transition-colors"
                  >
                    Decline
                  </button>
                  <button 
                    onClick={acceptOffer}
                    className="flex-1 py-3.5 px-4 rounded-2xl font-semibold bg-blue-500 text-white hover:bg-blue-600 shadow-md shadow-blue-500/20 transition-all"
                  >
                    Accept
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
      
      <p className="mt-8 text-sm text-[#86868b] text-center max-w-md font-medium z-10">
        Tap a device to share files. Transfers happen directly peer-to-peer over your local network.
      </p>
    </div>
  );
}
