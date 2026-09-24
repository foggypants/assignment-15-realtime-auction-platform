# Assignment 15: Real-Time Live Auction & Bidding Engine (Socket.io)

**Student Name:** Ashish Kumar
**Track:** Backend & Real-Time Web  
**Tech Stack:** Node.js, Express.js, Socket.io, In-Memory State Engine, Timer Synchronizer, CORS, Dotenv  

---

## 📌 1. Project Overview

This project is a high-performance **Real-Time Live Auction & Bidding Platform** built with **Node.js, Express.js, and Socket.io**. It features an authoritative real-time bidding engine that prevents race conditions, enforces minimum bid increments, delivers targeted outbid notifications to outbid bidders, synchronizes server-driven countdown clocks, and implements an **Anti-Snipe Protection Engine** (resetting the clock to 20 seconds when a bid arrives in the final 15 seconds).

---

## ✨ 2. Key Features

- **Authoritative Bid Validation:** Server validates active status, minimum increments ($+\text{₹2,000}$), and prevents self-outbidding.
- **Synchronous 1-Second Timer Engine:** Server-driven countdown clock broadcasts `auction:time_tick` every second to prevent client clock drift.
- **Anti-Snipe Protection:** If a bid is submitted with $<15$ seconds remaining, the clock automatically resets to 20 seconds and broadcasts `auction:extended`.
- **Targeted Outbid Notifications:** Private `bid:outbid` socket alert dispatched strictly to the previous highest bidder.
- **Auditable Live Bid Activity Feed:** Maintains and hydrates full bid history with bidder names, timestamps, and currency formatting.
- **Trading Floor UI with Audio Cues:** Dark trading floor aesthetic with live price ticker, quick bid buttons, and Web Audio API synthesized tones.

---

## 🏷️ 3. Auction Data Model

```javascript
const auctions = {
  "AUC_VINTAGE_99": {
    id: "AUC_VINTAGE_99",
    title: "1967 Vintage Fender Stratocaster",
    description: "Original condition rare electric guitar...",
    startingPrice: 50000,
    currentBid: 50000,
    highestBidder: null, // { socketId, username }
    minIncrement: 2000,
    timeRemainingSeconds: 60,
    status: "active", // "active", "ended"
    bidHistory: [],
    viewers: new Set()
  }
};
```

---

## 📡 4. Real-Time Socket Event Protocol

### 🔄 Room & Stream Events

| Event Name | Direction | Payload Schema | Description |
|---|:---:|---|---|
| `auction:join` | `Client -> Server` | `{ "auctionId": "AUC_VINTAGE_99", "username": "Vikram" }` | Join the live bidding floor room |
| `auction:init` | `Server -> Client` | `{ "item": { ... }, "bidHistory": [...], "timeRemaining": 45 }` | Hydrates current auction status to newly joined bidder |
| `auction:time_tick` | `Server -> Room` | `{ "auctionId": "...", "timeRemaining": 44 }` | Broadcasted every 1 second |
| `user:joined` | `Server -> Room` | `{ "username": "Vikram", "totalViewers": 14 }` | Updates live audience count |

### 💰 Live Bidding Actions

| Event Name | Direction | Payload Schema | Description |
|---|:---:|---|---|
| `bid:place` | `Client -> Server` | `{ "auctionId": "AUC_VINTAGE_99", "amount": 54000 }` | Bidder places a higher bid |
| `bid:success` | `Server -> Room` | `{ "newBid": 54000, "highestBidder": "Vikram", "timeRemaining": 30 }` | Broadcasts new leading price to all participants |
| `bid:outbid` | `Server -> Client` | `{ "message": "You have been outbid by Vikram at ₹54,000!" }` | Targeted alert sent strictly to the previous highest bidder |
| `bid:rejected` | `Server -> Client` | `{ "reason": "Bid must be at least ₹56,000" }` | Rejection error sent to invalid bid attempt |
| `auction:extended` | `Server -> Room` | `{ "message": "Anti-snipe triggered: +20 seconds added!" }` | Emitted when late bid extends the clock |
| `auction:sold` | `Server -> Room` | `{ "winner": "Vikram", "finalPrice": 62000, "status": "sold" }` | Emitted when clock hits 0 |

---

## 📁 5. Directory Structure

```text
Ashish-Kumar-assignment 15/
├── public/
│   ├── index.html           # Live bidding floor UI
│   ├── app.js               # Client socket handlers & bid buttons
│   └── style.css            # Dark trading floor aesthetic & animations
├── sockets/
│   ├── auctionEngine.js     # Bid validation, outbid alerts & anti-snipe logic
│   └── timerManager.js      # Server-side 1s interval countdown clock
├── server.js                # Server setup
├── package.json
├── .env
├── .env.example
├── .gitignore
└── README.md
```

---

## 🚀 6. Setup & Installation

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file (or copy from `.env.example`):
```env
PORT=5001
```

### 3. Start Server
```bash
# Start server with node
npm start

# Or with nodemon in development mode
npm run dev
```

---

## 🧪 7. Testing & Verification Guide

1. Start the server on `http://localhost:5001`.
2. Open three browser tabs on the auction page:
   - Tab 1: `http://localhost:5001?user=Vikram`
   - Tab 2: `http://localhost:5001?user=Ananya`
   - Tab 3: `http://localhost:5001?user=Rohan`
3. Click a Quick Bid button in Tab 1 (Vikram): verify all 3 screens instantly update the current price to ₹52,000.
4. Place a higher bid in Tab 2 (Ananya): verify Vikram receives a private red **"Outbid Alert"** toast.
5. Wait until the timer drops below 15 seconds, then place a bid: verify the clock resets back to 20 seconds (**Anti-Snipe Protection**) with an alert banner.
6. Let the clock hit 0: verify the room emits `auction:sold` and further bids are rejected.
