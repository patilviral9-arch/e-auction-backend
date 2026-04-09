const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

// Use system DNS by default. Custom public DNS can cause long SMTP stalls
// on networks where those resolvers are blocked.
if (process.env.DNS_SERVERS) {
  const servers = String(process.env.DNS_SERVERS)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (servers.length) dns.setServers(servers);
}

require('dotenv').config()

const express = require('express')
const app = express()
const cors = require('cors')

app.use(express.json())
app.use(cors())
app.use(express.urlencoded({ extended: true }));

const DBconnection = require('./src/utils/DBconnection')
DBconnection()

const { startAuctionScheduler } = require("./src/schedulers/AuctionScheduler")  // ← ADD THIS
startAuctionScheduler()  
const { startPayoutSettlementScheduler } = require("./src/schedulers/PayoutSettlementScheduler")
startPayoutSettlementScheduler()

const cloudinary = require("cloudinary").v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const userRoute = require("./src/routes/UserRoutes")
app.use("/user",userRoute)

const bidRoutes = require("./src/routes/BidRoutes")
app.use("/bid",bidRoutes)

const auctionRoutes = require("./src/routes/AuctionRoutes")
app.use("/auction", auctionRoutes)

const auctionResultRoutes = require("./src/routes/AuctionResultRoutes")
app.use("/auctionres",auctionResultRoutes)

const paymentRoutes = require("./src/routes/PaymentRoutes")
app.use("/payment",paymentRoutes)

const reviewRoutes = require("./src/routes/ReviewRoutes");
app.use("/auction", reviewRoutes)

const wishlistRoutes = require("./src/routes/WishlistRoutes");
app.use("/wish", wishlistRoutes)

const notificationRoutes = require("./src/routes/NotificationRoutes");
app.use("/notification", notificationRoutes);

const payoutRoutes = require("./src/routes/PayoutRoutes");
app.use("/payout", payoutRoutes);

const WalletRoutes = require("./src/routes/WalletRoutes");
app.use("/wallet", WalletRoutes);

const PORT = process.env.PORT
app.listen(PORT,()=>{
    console.log(`server started on port ${PORT}`)
})
