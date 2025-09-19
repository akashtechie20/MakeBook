// server/server.js
import express from "express";
import "dotenv/config";
import cors from "cors";
import connectDB from "./configs/db.js";
import { clerkMiddleware } from "@clerk/express";
import clerkWebhooks from "./controllers/clerkWebhooks.js";
import userRouter from "./routes/userRoutes.js";
import hotelRouter from "./routes/hotelRoutes.js";
import connectCloudinary from "./configs/cloudinary.js";
import roomRouter from "./routes/roomRoutes.js";
import bookingRouter from "./routes/bookingRoutes.js";
import { stripeWebhooks } from "./controllers/stripeWebhooks.js";

connectDB();
connectCloudinary();

const app = express();

app.use(cors());

// API to listen to Stripe Webhooks
app.post('/api/stripe', express.raw({type: "application/json"}), stripeWebhooks)

// IMPORTANT: use json *after* we mount the webhook (which needs raw)
app.post("/api/clerk", express.raw({ type: "application/json" }), clerkWebhooks);

// now json for the rest of the app
app.use(express.json());
app.use(clerkMiddleware());

app.get("/", (req, res) => res.send("API is hale 6e"));

app.use("/api/user", userRouter);
app.use("/api/hotels", hotelRouter);
app.use("/api/rooms", roomRouter);
app.use("/api/bookings", bookingRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
