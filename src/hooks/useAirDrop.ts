import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { Device as CapacitorDevice } from '@capacitor/device';

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

export function useAirDrop() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [myDevice, setMyDevice] = useState<Device | null>(null);
  const [isDiscoverable, setIsDiscoverable] = useState(true);
  const [transferState, setTransferState] = useState<TransferState>({ status: 'idle', progress: 0 });
  const [incomingOffer, setIncomingOffer] = useState<{ caller: Device, offer: RTCSessionDescriptionInit } | null>(null);
  
  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const fileBufferRef = useRef<ArrayBuffer[]>([]);
  const receivedSizeRef = useRef<number>(0);
  const expectedSizeRef = useRef<number>(0);
  const expectedNameRef = useRef<string>('');

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
        // Fallback for standard web
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

      // Connect to signaling server
      const socket = io();
      socketRef.current = socket;

      socket.on('connect', () => {
        device.socketId = socket.id!;
        setMyDevice({ ...device });
        // Only register if discoverable
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

      // WebRTC Signaling
      socket.on('offer', async ({ offer, caller }) => {
        setIncomingOffer({ caller, offer });
      });

      socket.on('answer', async ({ answer }) => {
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        }
      });

      socket.on('ice-candidate', async ({ candidate }) => {
        if (peerConnectionRef.current) {
          try {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.error('Error adding received ice candidate', e);
          }
        }
      });
    };

    initDevice();

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (peerConnectionRef.current) peerConnectionRef.current.close();
    };
  }, [isDiscoverable]); // Re-run if discoverability changes initially, though we handle toggles separately

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
    // Re-register to broadcast name change if discoverable
    if (isDiscoverable) {
      socketRef.current.emit('register', updatedDevice);
    }
  }, [myDevice, isDiscoverable]);

  const createPeerConnection = useCallback((targetSocketId: string) => {
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

  const setupDataChannel = useCallback((channel: RTCDataChannel) => {
    channel.binaryType = 'arraybuffer';
    
    channel.onmessage = (event) => {
      if (typeof event.data === 'string') {
        const msg = JSON.parse(event.data);
        if (msg.type === 'file-start') {
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
        // File chunk
        fileBufferRef.current.push(event.data);
        receivedSizeRef.current += event.data.byteLength;
        
        const progress = Math.round((receivedSizeRef.current / expectedSizeRef.current) * 100);
        setTransferState(prev => ({ ...prev, progress }));

        if (receivedSizeRef.current === expectedSizeRef.current) {
          // Download this file
          const blob = new Blob(fileBufferRef.current);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = expectedNameRef.current;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
    };

    dataChannelRef.current = channel;
  }, []);

  const sendFiles = useCallback(async (targetDevice: Device, files: File[]) => {
    if (!socketRef.current || !myDevice || files.length === 0) return;

    setTransferState({ status: 'connecting', progress: 0, totalFiles: files.length, currentFileIndex: 0 });

    const pc = createPeerConnection(targetDevice.socketId);
    peerConnectionRef.current = pc;

    const channel = pc.createDataChannel('file-transfer');
    setupDataChannel(channel);

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
        
        // Send file header
        channel.send(JSON.stringify({ 
          type: 'file-start', 
          name: file.name, 
          size: file.size, 
          mimeType: file.type,
          index: i,
          total: files.length
        }));

        // Send chunks
        await new Promise<void>((resolve) => {
          const chunkSize = 16384; // 16KB chunks
          let offset = 0;

          const readSlice = (o: number) => {
            const slice = file.slice(offset, o + chunkSize);
            const reader = new FileReader();
            reader.onload = (e) => {
              if (channel.readyState === 'open') {
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
                  resolve();
                }
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
  }, [createPeerConnection, setupDataChannel, myDevice]);

  const acceptOffer = useCallback(async () => {
    if (!incomingOffer || !socketRef.current) return;

    setTransferState({ status: 'connecting', progress: 0 });

    const pc = createPeerConnection(incomingOffer.caller.socketId);
    peerConnectionRef.current = pc;

    pc.ondatachannel = (event) => {
      setupDataChannel(event.channel);
    };

    await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socketRef.current.emit('answer', {
      target: incomingOffer.caller.socketId,
      answer
    });

    setIncomingOffer(null);
  }, [incomingOffer, createPeerConnection, setupDataChannel]);

  const rejectOffer = useCallback(() => {
    setIncomingOffer(null);
  }, []);

  return {
    devices,
    myDevice,
    transferState,
    incomingOffer,
    sendFiles,
    acceptOffer,
    rejectOffer,
    updateMyName,
    isDiscoverable,
    toggleDiscoverable
  };
}
