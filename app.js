require('dotenv').config()

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

// Use system DNS by default. Custom DNS servers can be supplied via .env
// DNS_SERVERS=8.8.8.8,1.1.1.1
if (process.env.DNS_SERVERS) {
  const servers = String(process.env.DNS_SERVERS)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (servers.length) dns.setServers(servers);
}

const express = require('express')
const app = express()
const cors = require('cors')

const normalizeOrigin = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return `${parsed.protocol}//${parsed.host}`.toLowerCase();
  } catch {
    return raw.replace(/\/+$/, "").toLowerCase();
  }
};

const configuredOriginsRaw = String(
  process.env.CORS_ORIGIN ||
    "http://localhost:5173,https://e-auction-e617.vercel.app"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowAllOrigins = configuredOriginsRaw.includes("*");

const allowedOriginSet = new Set(
  configuredOriginsRaw
    .filter((origin) => origin !== "*")
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean)
);

const originRegexSources = String(process.env.CORS_ORIGIN_REGEX || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const defaultOriginRegexes = [
  /^http:\/\/localhost(?::\d+)?$/i,
  /^https:\/\/e-auction-e617.*\.vercel\.app$/i,
  /^https:\/\/e-auction-e617\.vercel\.app$/i,
];

const configuredOriginRegexes = originRegexSources.map((pattern) => {
  try {
    return new RegExp(pattern, "i");
  } catch {
    console.warn(`[cors] Invalid CORS_ORIGIN_REGEX pattern ignored: ${pattern}`);
    return null;
  }
}).filter(Boolean);

const allowedOriginRegexes = [...defaultOriginRegexes, ...configuredOriginRegexes];

const isOriginAllowed = (origin) => {
  if (!origin) return true; // non-browser clients
  if (allowAllOrigins) return true;

  const normalized = normalizeOrigin(origin);
  if (allowedOriginSet.has(normalized)) return true;

  return allowedOriginRegexes.some((regex) => regex.test(normalized));
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.use(express.json())
app.use(cors(corsOptions))
app.options(/.*/, cors(corsOptions));
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
