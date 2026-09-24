// Synchronous server-side countdown clock for live auctions

function startAuctionTimer(io, auction) {
  if (auction.timerInterval) {
    clearInterval(auction.timerInterval);
  }

  auction.timerInterval = setInterval(() => {
    if (auction.status !== "active") {
      clearInterval(auction.timerInterval);
      return;
    }

    auction.timeRemainingSeconds -= 1;

    // Broadcast 1-second time tick to all participants in the auction room
    io.to(auction.id).emit("auction:time_tick", {
      auctionId: auction.id,
      timeRemaining: auction.timeRemainingSeconds
    });

    // Auction clock hits 0 -> Final sale
    if (auction.timeRemainingSeconds <= 0) {
      clearInterval(auction.timerInterval);
      auction.status = "ended";
      auction.timeRemainingSeconds = 0;

      const winnerName = auction.highestBidder ? auction.highestBidder.username : "No Winner (Reserve Not Met)";

      io.to(auction.id).emit("auction:sold", {
        auctionId: auction.id,
        winner: winnerName,
        finalPrice: auction.currentBid,
        status: "sold"
      });
    }
  }, 1000);
}

function stopAuctionTimer(auction) {
  if (auction.timerInterval) {
    clearInterval(auction.timerInterval);
    auction.timerInterval = null;
  }
}

module.exports = {
  startAuctionTimer,
  stopAuctionTimer
};
