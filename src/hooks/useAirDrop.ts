import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { Device as CapacitorDevice } from '@capacitor/device';
import { Capacitor } from '@capacitor/core';
import { 
  sanitizeFileName, 
  sanitizeDeviceName, 
  sanitizeText, 
  validateIncomingMessage, 
  isDangerousFile 
} from '../utils/securityAudit';

// Use custom env var, or current origin for web, or production URL for native apps
const rawSocketUrl = (import.meta.env.VITE_SOCKET_URL as string) || 
  (import.meta.env.VITE_DropTop as string) || 
  (Capacitor.isNativePlatform() 
    ? 'https://ais-pre-agdlszchovxizrfnymytsj-260210615413.europe-west2.run.app' 
    : window.location.origin);
export const SOCKET_URL = rawSocketUrl ? rawSocketUrl.replace(/\/+$/, '') : window.location.origin;

export interface DiagnosticResult {
  latencyMs: number | null;
  minLatencyMs: number | null;
  maxLatencyMs: number | null;
  jitterMs: number | null;
  serverUrl: string;
  socketConnected: boolean;
  socketId: string | null;
  rating: 'excellent' | 'good' | 'fair' | 'poor' | 'offline';
  timestamp: number;
  samples: number[];
  protocol: 'websocket' | 'http-fallback' | 'none';
  error?: string;
}

export interface Device {
  id: string;
  name: string;
  deviceType: string;
  socketId: string;
}

export interface TransferState {
  status: 'idle' | 'connecting' | 'transferring' | 'completed' | 'error';
  progress: number;
  batchProgress?: number;
  fileName?: string;
  fileSize?: number;
  currentFileIndex?: number;
  totalFiles?: number;
  totalBatchSize?: number;
  totalBytesTransferred?: number;
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
  const expectedMimeTypeRef = useRef<string>('');
  const totalBatchSizeRef = useRef<number>(0);
  const totalBytesReceivedRef = useRef<number>(0);

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
        setIsConnected(true);
        device.socketId = socket.id!;
        setMyDevice({ ...device });
        if (isDiscoverable) {
          socket.emit('register', device);
        }
      });

      socket.on('disconnect', () => {
        setIsConnected(false);
      });

      socket.on('connect_error', () => {
        setIsConnected(false);
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
    const sanitizedName = sanitizeDeviceName(newName);
    const updatedDevice = { ...myDevice, name: sanitizedName };
    setMyDevice(updatedDevice);
    localStorage.setItem('airdrop_custom_name', sanitizedName);
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

    channel.onerror = (err) => {
      console.warn('DataChannel error:', err);
      fileBufferRef.current = [];
      setTransferState({ status: 'error', progress: 0 });
    };

    channel.onclose = () => {
      fileBufferRef.current = [];
    };

    channel.onmessage = (event) => {
      if (typeof event.data === 'string') {
        const validation = validateIncomingMessage(event.data);
        if (!validation.isValid || !validation.parsed) {
          console.warn('Rejected malformed or unsafe packet:', validation.error);
          return;
        }

        const msg = validation.parsed;

        if (msg.type === 'text') {
          const sanitizedTxt = sanitizeText(msg.text);
          const sanitizedSender = sanitizeDeviceName(remoteDeviceName);
          setIncomingText({ text: sanitizedTxt, sender: sanitizedSender });
          addToHistory({
            name: sanitizedTxt.length > 20 ? sanitizedTxt.substring(0, 20) + '...' : sanitizedTxt,
            size: sanitizedTxt.length,
            type: 'received',
            deviceName: sanitizedSender,
            dataType: 'text',
            textContent: sanitizedTxt
          });
          setTransferState({ status: 'completed', progress: 100, batchProgress: 100 });
          setTimeout(() => setTransferState({ status: 'idle', progress: 0 }), 3000);
        } else if (msg.type === 'batch-start') {
          totalBatchSizeRef.current = typeof msg.totalBatchSize === 'number' ? msg.totalBatchSize : 0;
          totalBytesReceivedRef.current = 0;
          setTransferState(prev => ({
            ...prev,
            status: 'transferring',
            progress: 0,
            batchProgress: 0,
            totalFiles: msg.totalFiles,
            currentFileIndex: 0,
            totalBatchSize: totalBatchSizeRef.current,
            totalBytesTransferred: 0
          }));
        } else if (msg.type === 'file-start') {
          const safeName = sanitizeFileName(msg.name);
          const safeSize = Math.min(typeof msg.size === 'number' ? msg.size : 0, 2147483648);
          expectedSizeRef.current = safeSize;
          expectedNameRef.current = safeName;
          expectedMimeTypeRef.current = typeof msg.mimeType === 'string' ? msg.mimeType : '';
          fileBufferRef.current = [];
          receivedSizeRef.current = 0;

          if (isDangerousFile(safeName)) {
            console.warn(`[SECURITY WARNING] Incoming file "${safeName}" contains executable extension.`);
          }

          setTransferState(prev => ({ 
            ...prev, 
            status: 'transferring', 
            progress: 0, 
            fileName: safeName, 
            fileSize: safeSize, 
            currentFileIndex: typeof msg.index === 'number' ? msg.index : 0,
            totalFiles: typeof msg.total === 'number' ? msg.total : 1,
            totalBatchSize: totalBatchSizeRef.current || safeSize,
            totalBytesTransferred: totalBytesReceivedRef.current
          }));
        } else if (msg.type === 'transfer-complete') {
          setTransferState({ status: 'completed', progress: 100, batchProgress: 100 });
          setTimeout(() => setTransferState({ status: 'idle', progress: 0 }), 3000);
        }
      } else if (event.data instanceof ArrayBuffer) {
        // Chunk boundary attack check
        if (event.data.byteLength > 262144) {
          console.error('[SECURITY REJECTION] Single chunk exceeds 256KB threshold.');
          fileBufferRef.current = [];
          setTransferState({ status: 'error', progress: 0 });
          return;
        }

        // Buffer overflow attack check
        if (receivedSizeRef.current + event.data.byteLength > expectedSizeRef.current + 65536) {
          console.error('[SECURITY REJECTION] Buffer overflow detected: received bytes exceed expected file size.');
          fileBufferRef.current = [];
          setTransferState({ status: 'error', progress: 0 });
          return;
        }

        fileBufferRef.current.push(event.data);
        receivedSizeRef.current += event.data.byteLength;
        totalBytesReceivedRef.current += event.data.byteLength;
        
        const fileProgress = expectedSizeRef.current > 0 
          ? Math.min(100, Math.round((receivedSizeRef.current / expectedSizeRef.current) * 100)) 
          : 0;
        const batchProgress = totalBatchSizeRef.current > 0
          ? Math.min(100, Math.round((totalBytesReceivedRef.current / totalBatchSizeRef.current) * 100))
          : fileProgress;

        setTransferState(prev => ({ 
          ...prev, 
          progress: fileProgress, 
          batchProgress,
          totalBytesTransferred: totalBytesReceivedRef.current,
          totalBatchSize: totalBatchSizeRef.current || expectedSizeRef.current
        }));

        if (receivedSizeRef.current >= expectedSizeRef.current && expectedSizeRef.current > 0) {
          const mimeType = expectedMimeTypeRef.current || 'application/octet-stream';
          const blob = new Blob(fileBufferRef.current, { type: mimeType });
          const url = URL.createObjectURL(blob);
          const safeDownloadName = sanitizeFileName(expectedNameRef.current);
          const a = document.createElement('a');
          a.href = url;
          a.download = safeDownloadName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 10000);
          
          addToHistory({
            name: safeDownloadName,
            size: expectedSizeRef.current,
            type: 'received',
            deviceName: sanitizeDeviceName(remoteDeviceName),
            dataType: 'file'
          });
        }
      }
    };

    dataChannelRef.current = channel;
  }, [addToHistory]);

  const sendFiles = useCallback(async (targetDevice: Device, files: File[]) => {
    if (!socketRef.current || !myDevice || files.length === 0) return;

    const totalBatchBytes = files.reduce((acc, f) => acc + f.size, 0);

    setTransferState({ 
      status: 'connecting', 
      progress: 0, 
      batchProgress: 0,
      totalFiles: files.length, 
      currentFileIndex: 0,
      totalBatchSize: totalBatchBytes,
      totalBytesTransferred: 0
    });

    const pc = createPeerConnection(targetDevice.socketId);
    peerConnectionRef.current = pc;

    const channel = pc.createDataChannel('file-transfer');
    setupDataChannel(channel, targetDevice.name);

    channel.onopen = async () => {
      channel.send(JSON.stringify({ 
        type: 'batch-start', 
        totalFiles: files.length, 
        totalBatchSize: totalBatchBytes 
      }));

      let cumulativeBytesTransferred = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const safeName = sanitizeFileName(file.name);

        setTransferState(prev => ({ 
          ...prev, 
          status: 'transferring', 
          progress: 0, 
          fileName: safeName, 
          fileSize: file.size,
          currentFileIndex: i,
          totalFiles: files.length,
          totalBatchSize: totalBatchBytes,
          totalBytesTransferred: cumulativeBytesTransferred
        }));
        
        channel.send(JSON.stringify({ 
          type: 'file-start', 
          name: safeName, 
          size: file.size, 
          mimeType: file.type,
          index: i,
          total: files.length
        }));

        await new Promise<void>((resolve, reject) => {
          const chunkSize = 131072; 
          channel.bufferedAmountLowThreshold = 1048576;
          let offset = 0;

          const readSlice = (o: number) => {
            const slice = file.slice(offset, o + chunkSize);
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('File read error'));
            reader.onload = (e) => {
              if (channel.readyState === 'open') {
                try {
                  const chunk = e.target?.result as ArrayBuffer;
                  channel.send(chunk);
                  offset += chunkSize;
                  cumulativeBytesTransferred += chunk.byteLength;
                  
                  const fileProgress = Math.min(100, Math.round((offset / file.size) * 100));
                  const batchProgress = totalBatchBytes > 0 
                    ? Math.min(100, Math.round((cumulativeBytesTransferred / totalBatchBytes) * 100))
                    : fileProgress;

                  setTransferState(prev => ({ 
                    ...prev, 
                    progress: fileProgress,
                    batchProgress,
                    totalBytesTransferred: cumulativeBytesTransferred,
                    totalBatchSize: totalBatchBytes
                  }));

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
                      name: safeName,
                      size: file.size,
                      type: 'sent',
                      deviceName: sanitizeDeviceName(targetDevice.name),
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
      setTransferState({ 
        status: 'completed', 
        progress: 100, 
        batchProgress: 100,
        totalBytesTransferred: totalBatchBytes,
        totalBatchSize: totalBatchBytes
      });
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

  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  const runDiagnostics = useCallback(async (): Promise<DiagnosticResult> => {
    setIsDiagnosing(true);
    const serverUrl = SOCKET_URL;
    const socket = socketRef.current;

    // 1. Try WebSocket Ping if connected or socket exists
    if (socket && socket.connected) {
      try {
        const samples: number[] = [];
        for (let i = 0; i < 3; i++) {
          const start = performance.now();
          const rtt = await new Promise<number>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Signaling ping timed out (3s)')), 3000);
            socket.emit('ping-check', Date.now(), () => {
              clearTimeout(timer);
              resolve(Math.max(1, Math.round(performance.now() - start)));
            });
          });
          samples.push(rtt);
          if (i < 2) {
            await new Promise((r) => setTimeout(r, 60));
          }
        }

        const avg = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
        const min = Math.min(...samples);
        const max = Math.max(...samples);
        const jitter = samples.length > 1
          ? Math.round(samples.slice(1).reduce((acc, curr, idx) => acc + Math.abs(curr - samples[idx]), 0) / (samples.length - 1))
          : 0;

        let rating: DiagnosticResult['rating'] = 'excellent';
        if (avg > 300) rating = 'poor';
        else if (avg > 150) rating = 'fair';
        else if (avg > 75) rating = 'good';

        const result: DiagnosticResult = {
          latencyMs: avg,
          minLatencyMs: min,
          maxLatencyMs: max,
          jitterMs: jitter,
          serverUrl,
          socketConnected: true,
          socketId: socket.id || null,
          rating,
          timestamp: Date.now(),
          samples,
          protocol: 'websocket'
        };

        setDiagnosticResult(result);
        setIsDiagnosing(false);
        return result;
      } catch (err) {
        console.warn('Socket ping failed or timed out:', err);
      }
    }

    // 2. Fallback: HTTP /api/ping test
    try {
      const start = performance.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`${serverUrl}/api/ping`, {
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timeout);

      if (res.ok) {
        const rtt = Math.max(1, Math.round(performance.now() - start));
        let rating: DiagnosticResult['rating'] = 'good';
        if (rtt > 300) rating = 'poor';
        else if (rtt > 150) rating = 'fair';
        else if (rtt > 75) rating = 'good';
        else rating = 'excellent';

        const result: DiagnosticResult = {
          latencyMs: rtt,
          minLatencyMs: rtt,
          maxLatencyMs: rtt,
          jitterMs: 0,
          serverUrl,
          socketConnected: socket?.connected ?? false,
          socketId: socket?.id || null,
          rating,
          timestamp: Date.now(),
          samples: [rtt],
          protocol: 'http-fallback',
          error: socket?.connected ? undefined : 'Connected via HTTP, but WebSocket is still establishing or blocked.'
        };
        setDiagnosticResult(result);
        setIsDiagnosing(false);
        return result;
      }
    } catch (httpErr) {
      console.warn('HTTP ping fallback also failed:', httpErr);
    }

    // 3. Offline / Unreachable
    const offlineResult: DiagnosticResult = {
      latencyMs: null,
      minLatencyMs: null,
      maxLatencyMs: null,
      jitterMs: null,
      serverUrl,
      socketConnected: false,
      socketId: null,
      rating: 'offline',
      timestamp: Date.now(),
      samples: [],
      protocol: 'none',
      error: 'Cannot reach signaling server. Check your network or VITE_DropTop / VITE_SOCKET_URL.'
    };
    setDiagnosticResult(offlineResult);
    setIsDiagnosing(false);
    return offlineResult;
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
    clearHistory,
    isConnected,
    runDiagnostics,
    diagnosticResult,
    isDiagnosing,
    serverUrl: SOCKET_URL
  };
}
