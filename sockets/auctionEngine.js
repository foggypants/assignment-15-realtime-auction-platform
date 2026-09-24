// Authoritative Live Auction Engine with Outbid alerts and Anti-Snipe Protection
const { startAuctionTimer } = require("./timerManager");

module.exports = function (io, socket, auctions) {

  // Bidder joins an auction room
  socket.on("auction:join", (data) => {
    const { auctionId, username } = data || {};
    const auction = auctions[auctionId];

    if (!auction) {
      return socket.emit("auction:error", { message: "Auction room not found." });
    }

    socket.join(auctionId);
    socket.auctionId = auctionId;
    socket.username = username ? username.trim() : "Anonymous Bidder";

    // Track room viewers
    auction.viewers.add(socket.id);

    // Start timer on first active join if not already running
    if (auction.status === "active" && !auction.timerInterval) {
      startAuctionTimer(io, auction);
    }

    // Send initial snapshot to newly joined user
    socket.emit("auction:init", {
      item: {
        id: auction.id,
        title: auction.title,
        description: auction.description,
        imageUrl: auction.imageUrl,
        startingPrice: auction.startingPrice,
        minIncrement: auction.minIncrement
      },
      currentBid: auction.currentBid,
      highestBidder: auction.highestBidder ? auction.highestBidder.username : null,
      bidHistory: auction.bidHistory,
      timeRemaining: auction.timeRemainingSeconds,
      status: auction.status,
      totalViewers: auction.viewers.size
    });

    // Broadcast updated live viewers count to room
    io.to(auctionId).emit("user:joined", {
      username: socket.username,
      totalViewers: auction.viewers.size
    });
  });

  // Handle new bid placement
  socket.on("bid:place", (data) => {
    const { auctionId, amount } = data || {};
    const auction = auctions[auctionId];
    const username = socket.username || "Anonymous";
    const bidAmount = parseInt(amount, 10);

    if (!auction) {
      return socket.emit("bid:rejected", { reason: "Auction not found." });
    }

    // 1. Check if auction is active
    if (auction.status !== "active" || auction.timeRemainingSeconds <= 0) {
      return socket.emit("bid:rejected", { reason: "Auction is closed." });
    }

    // 2. Check if bidder is already the highest bidder
    if (auction.highestBidder && auction.highestBidder.socketId === socket.id) {
      return socket.emit("bid:rejected", { reason: "You are already the highest bidder!" });
    }

    // 3. Validate minimum required increment
    const minimumRequired = auction.currentBid + auction.minIncrement;
    if (isNaN(bidAmount) || bidAmount < minimumRequired) {
      return socket.emit("bid:rejected", {
        reason: `Bid too low. Minimum required bid is ₹${minimumRequired.toLocaleString()}`
      });
    }

    // 4. Capture previous highest bidder for targeted outbid notification
    const previousBidder = auction.highestBidder;

    // 5. Update auction room state
    auction.currentBid = bidAmount;
    auction.highestBidder = {
      socketId: socket.id,
      username: username
    };

    const newBidRecord = {
      bidder: username,
      amount: bidAmount,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    };

    auction.bidHistory.unshift(newBidRecord);

    // 6. Anti-Snipe Rule: If bid arrives in final 15 seconds, extend clock back to 20s
    if (auction.timeRemainingSeconds < 15) {
      auction.timeRemainingSeconds = 20;
      io.to(auction.id).emit("auction:extended", {
        timeRemaining: 20,
        message: "Anti-snipe triggered: +20 seconds added to clock!"
      });
    }

    // 7. Broadcast new top bid and updated history to all participants
    io.to(auction.id).emit("bid:success", {
      currentBid: auction.currentBid,
      highestBidder: username,
      bidHistory: auction.bidHistory,
      timeRemaining: auction.timeRemainingSeconds
    });

    // 8. Send targeted private outbid alert strictly to previous top bidder
    if (previousBidder && previousBidder.socketId !== socket.id) {
      io.to(previousBidder.socketId).emit("bid:outbid", {
        message: `You have been outbid by ${username} at ₹${bidAmount.toLocaleString()}!`
      });
    }
  });

  // Handle client disconnect
  socket.on("disconnect", () => {
    const auctionId = socket.auctionId;
    if (auctionId && auctions[auctionId]) {
      auctions[auctionId].viewers.delete(socket.id);

      io.to(auctionId).emit("user:joined", {
        username: socket.username || "User",
        totalViewers: auctions[auctionId].viewers.size
      });
    }
  });
};
