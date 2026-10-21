require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const Project = require("./models/Project");

const app = express();
const server = http.createServer(app);

const allowedOrigin = process.env.CLIENT_URL || "http://localhost:5173";

app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: "100kb" }));

const io = new Server(server, {
  cors: { origin: allowedOrigin, methods: ["GET", "POST", "PATCH", "DELETE"] }
});

app.set("io", io);

// Authenticate WebSocket connections
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));

    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

// Only project members can join a project room
io.on("connection", socket => {
  socket.on("project:join", async projectId => {
    try {
      if (typeof projectId !== "string" ||
          !mongoose.isValidObjectId(projectId)) return;

      const allowed = await Project.exists({
        _id: projectId,
        members: socket.user.id
      });

      if (allowed) socket.join(`project:${projectId}`);
    } catch (error) {
      console.error("Project room join failed:", error.message);
    }
  });

  socket.on("project:leave", projectId => {
    if (typeof projectId === "string") {
      socket.leave(`project:${projectId}`);
    }
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/projects", require("./routes/projects"));
app.use("/api/tasks", require("./routes/tasks"));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });