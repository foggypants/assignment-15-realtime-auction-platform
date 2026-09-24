// Client-side Live Auction & Bidding Engine logic

const socket = io();

// State
const urlParams = new URLSearchParams(window.location.search);
let currentAuctionId = urlParams.get("auction") || "AUC_VINTAGE_99";
let username = urlParams.get("user") || "Bidder_" + Math.floor(1000 + Math.random() * 9000);

let currentBid = 0;
let minIncrement = 2000;
let auctionStatus = "active";

// DOM Elements
const auctionSelector = document.getElementById("auctionSelector");
const userNameDisplay = document.getElementById("userNameDisplay");
const viewerCountEl = document.getElementById("viewerCount");

const lotImageEl = document.getElementById("lotImage");
const lotStatusEl = document.getElementById("lotStatus");
const lotTitleEl = document.getElementById("lotTitle");
const lotDescriptionEl = document.getElementById("lotDescription");

const currentPriceDisplay = document.getElementById("currentPriceDisplay");
const highestBidderDisplay = document.getElementById("highestBidderDisplay");
const countdownDisplay = document.getElementById("countdownDisplay");
const minIncrementText = document.getElementById("minIncrementText");

const biddingControls = document.getElementById("biddingControls");
const quickBid1 = document.getElementById("quickBid1");
const quickBid2 = document.getElementById("quickBid2");
const quickBid3 = document.getElementById("quickBid3");
const customBidForm = document.getElementById("customBidForm");
const customBidInput = document.getElementById("customBidInput");
const placeBidBtn = document.getElementById("placeBidBtn");

const soldBox = document.getElementById("soldBox");
const soldWinnerText = document.getElementById("soldWinnerText");
const bidHistoryList = document.getElementById("bidHistoryList");
const bidCountBadge = document.getElementById("bidCountBadge");
const snipeBanner = document.getElementById("snipeBanner");
const toastContainer = document.getElementById("toastContainer");

// Initialize UI
userNameDisplay.textContent = username;
auctionSelector.value = currentAuctionId;

// Audio Synthesizer (Web Audio API)
function playTone(freq, duration, type = "sine") {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {}
}

function playBidSuccessSound() {
  playTone(523.25, 0.15); // C5
  setTimeout(() => playTone(659.25, 0.2), 150); // E5
}

function playOutbidSound() {
  playTone(330, 0.2, "sawtooth");
  setTimeout(() => playTone(260, 0.3, "sawtooth"), 200);
}

function playSnipeSound() {
  playTone(880, 0.1);
  setTimeout(() => playTone(880, 0.1), 120);
}

// Show Toast Alerts
function showToast(message, isError = false) {
  const toast = document.createElement("div");
  toast.className = "toast-alert";
  if (isError) {
    toast.style.background = "#e11d48";
  }
  toast.innerHTML = `⚠️ <span>${message}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// Format Seconds to MM:SS
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

// Update Quick Bid Buttons
function updateQuickBidButtons() {
  const nextMin = currentBid + minIncrement;
  quickBid1.textContent = `₹${(currentBid + minIncrement).toLocaleString()}`;
  quickBid1.onclick = () => placeBid(currentBid + minIncrement);

  quickBid2.textContent = `₹${(currentBid + minIncrement * 2).toLocaleString()}`;
  quickBid2.onclick = () => placeBid(currentBid + minIncrement * 2);

  quickBid3.textContent = `₹${(currentBid + minIncrement * 5).toLocaleString()}`;
  quickBid3.onclick = () => placeBid(currentBid + minIncrement * 5);

  customBidInput.min = nextMin;
  customBidInput.placeholder = `Min: ₹${nextMin.toLocaleString()}`;
}

// Join Auction Room
function joinAuction(auctionId) {
  currentAuctionId = auctionId;
  socket.emit("auction:join", {
    auctionId: auctionId,
    username: username
  });
}

// Lot Selector Change
auctionSelector.addEventListener("change", (e) => {
  joinAuction(e.target.value);
});

// Custom Bid Form Submit
customBidForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const amount = parseInt(customBidInput.value, 10);
  if (amount) {
    placeBid(amount);
  }
});

// Place Bid Helper
function placeBid(amount) {
  socket.emit("bid:place", {
    auctionId: currentAuctionId,
    amount: amount
  });
  customBidInput.value = "";
}

// Render Bid History Feed
function renderBidHistory(history) {
  bidHistoryList.innerHTML = "";
  bidCountBadge.textContent = `${history.length} Bids`;

  if (!history || history.length === 0) {
    bidHistoryList.innerHTML = '<li style="color: #6b7280; font-style: italic; padding: 10px;">No bids placed yet</li>';
    return;
  }

  history.forEach((record, index) => {
    const li = document.createElement("li");
    li.className = `history-item ${index === 0 ? "top-bid" : ""}`;
    li.innerHTML = `
      <div>
        <div class="history-bidder">${record.bidder} ${record.bidder === username ? "(You)" : ""}</div>
        <div class="history-time">${record.timestamp}</div>
      </div>
      <div class="history-amount">₹${record.amount.toLocaleString()}</div>
    `;
    bidHistoryList.appendChild(li);
  });
}

// ----------------- Socket.io Event Listeners ----------------- //

// 1. Initial State Hydration
socket.on("auction:init", (data) => {
  const item = data.item;
  lotTitleEl.textContent = item.title;
  lotDescriptionEl.textContent = item.description;
  lotImageEl.src = item.imageUrl;

  currentBid = data.currentBid;
  minIncrement = item.minIncrement;
  auctionStatus = data.status;

  currentPriceDisplay.textContent = `₹${currentBid.toLocaleString()}`;
  minIncrementText.textContent = `Min Inc: ₹${minIncrement.toLocaleString()}`;
  countdownDisplay.textContent = formatTime(data.timeRemaining);

  if (data.highestBidder) {
    highestBidderDisplay.textContent = `Leading: ${data.highestBidder}`;
  } else {
    highestBidderDisplay.textContent = "Opening Reserve: ₹" + item.startingPrice.toLocaleString();
  }

  if (data.status === "ended") {
    biddingControls.style.display = "none";
    soldBox.style.display = "block";
    lotStatusEl.textContent = "ENDED";
    lotStatusEl.style.background = "#6b7280";
  } else {
    biddingControls.style.display = "flex";
    soldBox.style.display = "none";
    lotStatusEl.textContent = "LIVE NOW";
    lotStatusEl.style.background = "#10b981";
  }

  renderBidHistory(data.bidHistory);
  updateQuickBidButtons();
});

// 2. Synchronous 1-Second Time Tick
socket.on("auction:time_tick", (data) => {
  if (data.auctionId === currentAuctionId) {
    countdownDisplay.textContent = formatTime(data.timeRemaining);

    if (data.timeRemaining <= 15) {
      countdownDisplay.classList.add("urgent");
    } else {
      countdownDisplay.classList.remove("urgent");
    }
  }
});

// 3. New Winning Bid Broadcast
socket.on("bid:success", (data) => {
  currentBid = data.currentBid;
  currentPriceDisplay.textContent = `₹${currentBid.toLocaleString()}`;
  highestBidderDisplay.textContent = `Leading: ${data.highestBidder}`;

  renderBidHistory(data.bidHistory);
  updateQuickBidButtons();
  playBidSuccessSound();
});

// 4. Targeted Outbid Alert (Sent strictly to the user who lost the lead)
socket.on("bid:outbid", (data) => {
  showToast(data.message, true);
  playOutbidSound();
});

// 5. Bid Rejected / Error
socket.on("bid:rejected", (data) => {
  showToast(data.reason, true);
});

// 6. Anti-Snipe Rule Extension Event
socket.on("auction:extended", (data) => {
  snipeBanner.textContent = `⚡ ${data.message}`;
  snipeBanner.style.display = "block";
  playSnipeSound();

  setTimeout(() => {
    snipeBanner.style.display = "none";
  }, 4000);
});

// 7. Auction Clock 0 / Item Sold
socket.on("auction:sold", (data) => {
  if (data.auctionId === currentAuctionId) {
    auctionStatus = "ended";
    biddingControls.style.display = "none";
    soldBox.style.display = "block";
    soldWinnerText.textContent = `Sold to ${data.winner} for ₹${data.finalPrice.toLocaleString()}`;
    lotStatusEl.textContent = "SOLD";
    lotStatusEl.style.background = "#ef4444";
    countdownDisplay.textContent = "00:00";
    countdownDisplay.classList.remove("urgent");
  }
});

// 8. Live Viewers Count Update
socket.on("user:joined", (data) => {
  viewerCountEl.textContent = data.totalViewers;
});

// Connect and Join initial room
socket.on("connect", () => {
  joinAuction(currentAuctionId);
});
