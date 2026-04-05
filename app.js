const express = require('express')
const app = express()
const cors = require('cors')

app.use(express.json())
app.use(cors())
app.use(express.urlencoded({ extended: true }));

require('dotenv').config()

const DBconnection = require('./src/utils/DBconnection')
DBconnection()

const { startAuctionScheduler } = require("./src/schedulers/AuctionScheduler")  // ← ADD THIS
startAuctionScheduler()  

const userRoute = require("./src/routes/UserRoutes")
app.use("/user",userRoute)

const productRoutes = require("./src/routes/ProductRoutes")
app.use("/prod",productRoutes)

const categoryRoutes = require("./src/routes/CategoryRoutes")
app.use("/cate",categoryRoutes)

const bidRoutes = require("./src/routes/BidRoutes")
app.use("/bid",bidRoutes)

const auctionRoutes = require("./src/routes/AuctionRoutes")
app.use("/auction", auctionRoutes)

const auctionResultRoutes = require("./src/routes/AuctionResultRoutes")
app.use("/auctionresult",auctionResultRoutes)

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

const PORT = process.env.PORT
app.listen(PORT,()=>{
    console.log(`server started on port ${PORT}`)
})