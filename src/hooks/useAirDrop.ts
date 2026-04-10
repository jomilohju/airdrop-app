import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { Device as CapacitorDevice } from '@capacitor/device';
import { Capacitor } from '@capacitor/core';

// Use the current window origin for web, or the production URL for native apps
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (Capacitor.isNativePlatform() 
  ? 'https://ais-pre-agdlszchovxizrfnymytsj-260210615413.europe-west2.run.app' 
  : window.location.origin);

export interface Device {
  id: string;
  name: string;
  deviceType: string;
  socketId: string;
}

export interface TransferState {
  status: 'idle' | 'connecting' | 'transferring' | 'completed' | 'error';
  progress: number;
  fileName?: string;
  fileSize?: number;
  currentFileIndex?: number;
  totalFiles?: number;
}

export interface HistoryItem {
  id: string;
  name: string;
  size: number;
  timestamp: number;
  type: 'sent' | 'received';
  deviceName: string;
  dataType?: 'file' | 'text';
  textContent?: string;
}

export function useAirDrop() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [myDevice, setMyDevice] = useState<Device | null>(null);
  const [isDiscoverable, setIsDiscoverable] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    const saved = localStorage.getItem('airdrop_theme');
    return (saved as 'light' | 'dark' | 'system') || 'system';
  });
  const [autoAccept, setAutoAccept] = useState(() => localStorage.getItem('airdrop_auto_accept') === 'true');
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('airdrop_sound_enabled') !== 'false');

  const playSound = useCallback((type: 'notify' | 'success') => {
    if (!soundEnabled) return;
    const sounds = {
      notify: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
      success: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3'
    };
    const audio = new Audio(sounds[type]);
    audio.play().catch(e => console.log('Audio play blocked:', e));
  }, [soundEnabled]);

  useEffect(() => {
    const root = window.document.documentElement;
    const applyTheme = (t: 'light' | 'dark' | 'system') => {
      root.classList.remove('light', 'dark');
      if (t === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        root.classList.add(systemTheme);
      } else {
        root.classList.add(t);
      }
    };

    applyTheme(theme);

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  const updateTheme = useCallback((newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    localStorage.setItem('airdrop_theme', newTheme);
  }, []);
  const [isConnected, setIsConnected] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const saved = localStorage.getItem('airdrop_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [transferState, setTransferState] = useState<TransferState>({ status: 'idle', progress: 0 });
  const [incomingOffer, setIncomingOffer] = useState<{ caller: Device, offer: RTCSessionDescriptionInit } | null>(null);
  const [incomingText, setIncomingText] = useState<{ text: string, sender: string } | null>(null);

  useEffect(() => {
    if (incomingOffer && !autoAccept) {
      playSound('notify');
    }
  }, [incomingOffer, autoAccept, playSound]);

  useEffect(() => {
    if (transferState.status === 'completed') {
      playSound('success');
    }
  }, [transferState.status, playSound]);
  
  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const fileBufferRef = useRef<ArrayBuffer[]>([]);
  const receivedSizeRef = useRef<number>(0);
  const expectedSizeRef = useRef<number>(0);
  const expectedNameRef = useRef<string>('');

  const addToHistory = useCallback((item: Omit<HistoryItem, 'id' | 'timestamp'>) => {
    const newItem: HistoryItem = {
      ...item,
      id: uuidv4(),
      timestamp: Date.now()
    };
    setHistory(prev => {
      const updated = [newItem, ...prev].slice(0, 20); // Keep last 20
      localStorage.setItem('airdrop_history', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem('airdrop_history');
  }, []);

  const toggleAutoAccept = useCallback((val: boolean) => {
    setAutoAccept(val);
    localStorage.setItem('airdrop_auto_accept', String(val));
  }, []);

  const toggleSound = useCallback((val: boolean) => {
    setSoundEnabled(val);
    localStorage.setItem('airdrop_sound_enabled', String(val));
  }, []);

  useEffect(() => {
    const initDevice = async () => {
      const id = uuidv4();
      let deviceType = 'Desktop';
      let defaultName = '';

      try {
        const info = await CapacitorDevice.getInfo();
        deviceType = info.operatingSystem === 'ios' ? 'iOS' : 
                     info.operatingSystem === 'android' ? 'Android' : 
                     info.operatingSystem === 'mac' ? 'Mac' : 
                     info.operatingSystem === 'windows' ? 'Windows' : 'Desktop';
        defaultName = info.name || '';
      } catch (e) {
        const userAgent = navigator.userAgent;
        if (/android/i.test(userAgent)) deviceType = 'Android';
        else if (/iPad|iPhone|iPod/.test(userAgent)) deviceType = 'iOS';
        else if (/Mac/.test(userAgent)) deviceType = 'Mac';
        else if (/Windows/.test(userAgent)) deviceType = 'Windows';
      }

      if (!defaultName) {
        const adjectives = ['Swift', 'Silent', 'Clever', 'Brave', 'Mighty', 'Cool'];
        const nouns = ['Fox', 'Bear', 'Eagle', 'Shark', 'Wolf', 'Lion'];
        defaultName = `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;
      }

      const savedName = localStorage.getItem('airdrop_custom_name');
      const name = savedName || defaultName;
      
      const device = { id, name, deviceType, socketId: '' };
      setMyDevice(device);

      const socket = io(SOCKET_URL);
      socketRef.current = socket;

      socket.on('connect', () => {
        device.socketId = socket.id!;
        setMyDevice({ ...device });
        if (isDiscoverable) {
          socket.emit('register', device);
        }
      });

      socket.on('current-devices', (currentDevices: Device[]) => {
        setDevices(currentDevices);
      });

      socket.on('device-joined', (newDevice: Device) => {
        setDevices(prev => {
          if (prev.find(d => d.id === newDevice.id)) return prev;
          return [...prev, newDevice];
        });
      });

      socket.on('device-left', (socketId: string) => {
        setDevices(prev => prev.filter(d => d.socketId !== socketId));
      });

      socket.on('offer', async ({ offer, caller }) => {
        if (autoAccept) {
          // We can't easily call acceptOffer here because it depends on state
          // but we can set the offer and let a useEffect handle it
          setIncomingOffer({ caller, offer });
        } else {
          setIncomingOffer({ caller, offer });
        }
      });

      socket.on('answer', async ({ answer }) => {
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          for (const candidate of pendingCandidatesRef.current) {
            try {
              await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
              console.error('Error adding pending ice candidate', e);
            }
          }
          pendingCandidatesRef.current = [];
        }
      });

      socket.on('ice-candidate', async ({ candidate }) => {
        if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
          try {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.error('Error adding received ice candidate', e);
          }
        } else {
          pendingCandidatesRef.current.push(candidate);
        }
      });
    };

    initDevice();

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (peerConnectionRef.current) peerConnectionRef.current.close();
    };
  }, [isDiscoverable, autoAccept]);

  const toggleDiscoverable = useCallback((discoverable: boolean) => {
    setIsDiscoverable(discoverable);
    if (!socketRef.current || !myDevice) return;
    
    if (discoverable) {
      socketRef.current.emit('register', myDevice);
    } else {
      socketRef.current.emit('unregister');
    }
  }, [myDevice]);

  const updateMyName = useCallback((newName: string) => {
    if (!myDevice || !socketRef.current) return;
    const updatedDevice = { ...myDevice, name: newName };
    setMyDevice(updatedDevice);
    localStorage.setItem('airdrop_custom_name', newName);
    if (isDiscoverable) {
      socketRef.current.emit('register', updatedDevice);
    }
  }, [myDevice, isDiscoverable]);

  const createPeerConnection = useCallback((targetSocketId: string) => {
    pendingCandidatesRef.current = []; // Clear any stale candidates
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', {
          target: targetSocketId,
          candidate: event.candidate
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setTransferState({ status: 'error', progress: 0 });
      }
    };

    return pc;
  }, []);

  const setupDataChannel = useCallback((channel: RTCDataChannel, remoteDeviceName: string) => {
    channel.binaryType = 'arraybuffer';
    
    channel.onmessage = (event) => {
      if (typeof event.data === 'string') {
        const msg = JSON.parse(event.data);
        if (msg.type === 'text') {
          setIncomingText({ text: msg.text, sender: remoteDeviceName });
          addToHistory({
            name: msg.text.length > 20 ? msg.text.substring(0, 20) + '...' : msg.text,
            size: msg.text.length,
            type: 'received',
            deviceName: remoteDeviceName,
            dataType: 'text',
            textContent: msg.text
          });
          setTransferState({ status: 'completed', progress: 100 });
          setTimeout(() => setTransferState({ status: 'idle', progress: 0 }), 3000);
        } else if (msg.type === 'file-start') {
          expectedSizeRef.current = msg.size;
          expectedNameRef.current = msg.name;
          fileBufferRef.current = [];
          receivedSizeRef.current = 0;
          setTransferState(prev => ({ 
            ...prev, 
            status: 'transferring', 
            progress: 0, 
            fileName: msg.name,
            fileSize: msg.size,
            currentFileIndex: msg.index,
            totalFiles: msg.total
          }));
        } else if (msg.type === 'transfer-complete') {
          setTransferState({ status: 'completed', progress: 100 });
          setTimeout(() => setTransferState({ status: 'idle', progress: 0 }), 3000);
        }
      } else {
        fileBufferRef.current.push(event.data);
        receivedSizeRef.current += event.data.byteLength;
        
        const progress = Math.round((receivedSizeRef.current / expectedSizeRef.current) * 100);
        setTransferState(prev => ({ ...prev, progress }));

        if (receivedSizeRef.current === expectedSizeRef.current) {
          const blob = new Blob(fileBufferRef.current);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = expectedNameRef.current;
          a.click();
          URL.revokeObjectURL(url);
          
          addToHistory({
            name: expectedNameRef.current,
            size: expectedSizeRef.current,
            type: 'received',
            deviceName: remoteDeviceName,
            dataType: 'file'
          });
        }
      }
    };

    dataChannelRef.current = channel;
  }, [addToHistory]);

  const sendFiles = useCallback(async (targetDevice: Device, files: File[]) => {
    if (!socketRef.current || !myDevice || files.length === 0) return;

    setTransferState({ status: 'connecting', progress: 0, totalFiles: files.length, currentFileIndex: 0 });

    const pc = createPeerConnection(targetDevice.socketId);
    peerConnectionRef.current = pc;

    const channel = pc.createDataChannel('file-transfer');
    setupDataChannel(channel, targetDevice.name);

    channel.onopen = async () => {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setTransferState(prev => ({ 
          ...prev, 
          status: 'transferring', 
          progress: 0, 
          fileName: file.name, 
          fileSize: file.size,
          currentFileIndex: i,
          totalFiles: files.length
        }));
        
        channel.send(JSON.stringify({ 
          type: 'file-start', 
          name: file.name, 
          size: file.size, 
          mimeType: file.type,
          index: i,
          total: files.length
        }));

        await new Promise<void>((resolve, reject) => {
          // Increased chunk size to 128KB for much faster transfers
          const chunkSize = 131072; 
          // Set a higher buffer threshold (1MB) to keep the network saturated
          channel.bufferedAmountLowThreshold = 1048576;
          let offset = 0;

          const readSlice = (o: number) => {
            const slice = file.slice(offset, o + chunkSize);
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('File read error'));
            reader.onload = (e) => {
              if (channel.readyState === 'open') {
                try {
                  channel.send(e.target?.result as ArrayBuffer);
                  offset += chunkSize;
                  
                  const progress = Math.round((offset / file.size) * 100);
                  setTransferState(prev => ({ ...prev, progress: Math.min(progress, 100) }));

                  if (offset < file.size) {
                    if (channel.bufferedAmount > channel.bufferedAmountLowThreshold) {
                      channel.onbufferedamountlow = () => {
                        channel.onbufferedamountlow = null;
                        readSlice(offset);
                      };
                    } else {
                      readSlice(offset);
                    }
                  } else {
                    addToHistory({
                      name: file.name,
                      size: file.size,
                      type: 'sent',
                      deviceName: targetDevice.name,
                      dataType: 'file'
                    });
                    resolve();
                  }
                } catch (err) {
                  reject(err);
                }
              } else {
                reject(new Error('Channel closed during transfer'));
              }
            };
            reader.readAsArrayBuffer(slice);
          };
          readSlice(0);
        });
      }

      channel.send(JSON.stringify({ type: 'transfer-complete' }));
      setTransferState({ status: 'completed', progress: 100 });
      setTimeout(() => setTransferState({ status: 'idle', progress: 0 }), 3000);
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socketRef.current.emit('offer', {
      target: targetDevice.socketId,
      offer,
      caller: myDevice
    });
  }, [createPeerConnection, setupDataChannel, myDevice, addToHistory]);

  const sendText = useCallback(async (targetDevice: Device, text: string) => {
    if (!socketRef.current || !myDevice || !text) return;

    setTransferState({ status: 'connecting', progress: 0 });

    const pc = createPeerConnection(targetDevice.socketId);
    peerConnectionRef.current = pc;

    const channel = pc.createDataChannel('file-transfer');
    setupDataChannel(channel, targetDevice.name);

    channel.onopen = () => {
      channel.send(JSON.stringify({ type: 'text', text }));
      addToHistory({
        name: text.length > 20 ? text.substring(0, 20) + '...' : text,
        size: text.length,
        type: 'sent',
        deviceName: targetDevice.name,
        dataType: 'text',
        textContent: text
      });
      setTransferState({ status: 'completed', progress: 100 });
      setTimeout(() => setTransferState({ status: 'idle', progress: 0 }), 3000);
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socketRef.current.emit('offer', {
      target: targetDevice.socketId,
      offer,
      caller: myDevice
    });
  }, [createPeerConnection, setupDataChannel, myDevice, addToHistory]);

  const acceptOffer = useCallback(async () => {
    if (!incomingOffer || !socketRef.current) return;

    setTransferState({ status: 'connecting', progress: 0 });

    const pc = createPeerConnection(incomingOffer.caller.socketId);
    peerConnectionRef.current = pc;

    pc.ondatachannel = (event) => {
      setupDataChannel(event.channel, incomingOffer.caller.name);
    };

    await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer.offer));
    
    for (const candidate of pendingCandidatesRef.current) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('Error adding pending ice candidate', e);
      }
    }
    pendingCandidatesRef.current = [];

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socketRef.current.emit('answer', {
      target: incomingOffer.caller.socketId,
      answer
    });

    setIncomingOffer(null);
  }, [incomingOffer, createPeerConnection, setupDataChannel]);

  // Auto-accept effect
  useEffect(() => {
    if (autoAccept && incomingOffer && transferState.status === 'idle') {
      acceptOffer();
    }
  }, [autoAccept, incomingOffer, transferState.status, acceptOffer]);

  const rejectOffer = useCallback(() => {
    setIncomingOffer(null);
  }, []);

  const refreshDevices = useCallback(() => {
    if (!socketRef.current || !myDevice || !isDiscoverable) return;
    setDevices([]); // Clear current devices to trigger the scanning animation
    socketRef.current.emit('register', myDevice);
  }, [myDevice, isDiscoverable]);

  const clearIncomingText = useCallback(() => {
    setIncomingText(null);
  }, []);

  return {
    devices,
    myDevice,
    transferState,
    incomingOffer,
    incomingText,
    sendFiles,
    sendText,
    acceptOffer,
    rejectOffer,
    refreshDevices,
    clearIncomingText,
    updateMyName,
    isDiscoverable,
    toggleDiscoverable,
    autoAccept,
    toggleAutoAccept,
    soundEnabled,
    toggleSound,
    theme,
    updateTheme,
    history,
    clearHistory
  };
}
