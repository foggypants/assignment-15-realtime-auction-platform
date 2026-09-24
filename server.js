require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");

const auctionEngine = require("./sockets/auctionEngine");

const app = express();
const server = http.createServer(app);

// Socket.io initialization
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// In-Memory Auction Store
const auctions = {
  AUC_VINTAGE_99: {
    id: "AUC_VINTAGE_99",
    title: "1967 Vintage Fender Stratocaster",
    description: "Original condition rare electric guitar with vintage single-coil pickups, original sunburst finish and case.",
    imageUrl: "https://images.unsplash.com/photo-1550291652-6ea9114a47b1?w=800&auto=format&fit=crop&q=80",
    startingPrice: 50000,
    currentBid: 50000,
    highestBidder: null, // { socketId, username }
    minIncrement: 2000,
    timeRemainingSeconds: 60,
    status: "active", // "active" | "ended"
    bidHistory: [],
    viewers: new Set(),
    timerInterval: null
  },
  AUC_ROLEX_01: {
    id: "AUC_ROLEX_01",
    title: "1972 Rolex Submariner Ref. 1680",
    description: "Iconic vintage luxury diver wristwatch with original tritium dial, red Submariner lettering and steel oyster bracelet.",
    imageUrl: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&auto=format&fit=crop&q=80",
    startingPrice: 120000,
    currentBid: 120000,
    highestBidder: null,
    minIncrement: 5000,
    timeRemainingSeconds: 90,
    status: "active",
    bidHistory: [],
    viewers: new Set(),
    timerInterval: null
  }
};

// Socket Connection Handler
io.on("connection", (socket) => {
  console.log(`Bidder connected: ${socket.id}`);
  auctionEngine(io, socket, auctions);
});

// API Routes
app.get("/api/auctions", (req, res) => {
  const list = Object.values(auctions).map((a) => ({
    id: a.id,
    title: a.title,
    currentBid: a.currentBid,
    minIncrement: a.minIncrement,
    timeRemainingSeconds: a.timeRemainingSeconds,
    status: a.status,
    totalBids: a.bidHistory.length,
    activeViewers: a.viewers.size
  }));
  res.json({ success: true, data: list });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    activeAuctions: Object.keys(auctions).length,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Live Auction Server running on http://localhost:${PORT}`);
});
