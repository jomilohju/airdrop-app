import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Store connected devices
  // Room based on IP address (or a shared code if IP is not reliable behind proxies)
  // For this demo, we'll use a global room or let users enter a room code, 
  // but since we want "automatic discovery", we can group them by their public IP.
  // In a real environment behind a proxy, req.ip might be the proxy's IP.
  // We'll use a simple global discovery for now, or group by a derived network ID.
  const devices = new Map();

  io.on("connection", (socket) => {
    console.log("Device connected:", socket.id);

    socket.on("register", (deviceInfo) => {
      // deviceInfo: { id, name, deviceType }
      devices.set(socket.id, { ...deviceInfo, socketId: socket.id });
      
      // Broadcast to all other devices
      socket.broadcast.emit("device-joined", devices.get(socket.id));
      
      // Send current devices to the new device
      const otherDevices = Array.from(devices.values()).filter(d => d.socketId !== socket.id);
      socket.emit("current-devices", otherDevices);
    });

    socket.on("unregister", () => {
      devices.delete(socket.id);
      socket.broadcast.emit("device-left", socket.id);
    });

    // WebRTC Signaling
    socket.on("offer", ({ target, offer, caller }) => {
      io.to(target).emit("offer", { offer, caller });
    });

    socket.on("answer", ({ target, answer }) => {
      io.to(target).emit("answer", { answer });
    });

    socket.on("ice-candidate", ({ target, candidate }) => {
      io.to(target).emit("ice-candidate", { candidate, sender: socket.id });
    });

    socket.on("disconnect", () => {
      console.log("Device disconnected:", socket.id);
      devices.delete(socket.id);
      io.emit("device-left", socket.id);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
