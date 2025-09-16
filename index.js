import express from "express";
import cors from "cors";
import routs from "./src/api/routes/index.js";
import config from "./config.js";
import cookieParser from "cookie-parser";
import "./src/db/connection.js";
// import "./src/middleware/cronJobs.js";

import http from "http";
import { Server } from "socket.io"
const app = express();
let { PRODUCTION_PORT } = config;
const PORT = PRODUCTION_PORT || 9000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  maxHttpBufferSize: 50 * 1024 * 1024,
  pingInterval: 60000, // send ping every 60s
  pingTimeout: 30000,  // wait 30s for pong before disconnecting
});
app.set("io", io);

io.on("connection", (socket) => {
  // console.log("A client connected:", socket.id);

  // Example: Receive userId from client on connection
  socket.on("register-user", (userId) => {
    socket.join(userId);
    // console.log(`User ${userId} joined room ${userId}`);
  });

  socket.on("disconnect", () => {
    // console.log("Client disconnected:", socket.id);
  });
});


server.listen(PORT, () => {
  console.log('Socket.IO server running on '+PORT);
});

app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.get("/api/testing", async (req, res) => {
  res.send("Working 0.1");
});
server.setTimeout(10 * 60 * 1000); 
app.use("/api", routs);

app.use("/public", express.static("./public"));
app.use("/uploads", express.static("./uploads"))

