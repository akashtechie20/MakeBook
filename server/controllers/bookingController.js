// server/controllers/bookingController.js
import Booking from "../models/Booking.js";
import Hotel from "../models/Hotel.js";
import Room from "../models/Room.js";
import User from "../models/User.js";
import transporter from "../configs/nodemailer.js";
import Stripe from "stripe";

/**
 * NOTE:
 * - Ensure STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are set in env.
 * - The webhook route must use express.raw({ type: 'application/json' }) middleware
 *   so Stripe signature verification works.
 *
 * Example route:
 * router.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhook);
 */

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2022-11-15",
});

/**
 * checkAvailability helper - returns true if room is free for the given date range
 */
const checkAvailability = async ({ checkInDate, checkOutDate, room }) => {
  try {
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    // Find bookings for same room that overlap requested range
    const overlapping = await Booking.find({
      room,
      $or: [
        {
          // existing booking starts before or on requested checkout and ends after or on requested checkin
          checkInDate: { $lte: checkOut },
          checkOutDate: { $gte: checkIn },
        },
      ],
    });

    return overlapping.length === 0;
  } catch (error) {
    console.error("checkAvailability error:", error);
    throw error;
  }
};

// POST /api/bookings/check-availability
export const checkAvailabilityAPI = async (req, res) => {
  try {
    const { room, checkInDate, checkOutDate } = req.body;
    if (!room || !checkInDate || !checkOutDate) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    const isAvailable = await checkAvailability({ checkInDate, checkOutDate, room });
    return res.json({ success: true, isAvailable });
  } catch (error) {
    console.error("checkAvailabilityAPI error:", error);
    return res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};

// POST /api/bookings/book
export const createBooking = async (req, res) => {
  try {
    const { room, checkInDate, checkOutDate, guests } = req.body;
    // req.user should be set by auth middleware
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (!room || !checkInDate || !checkOutDate) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Availability check
    const isAvailable = await checkAvailability({ checkInDate, checkOutDate, room });
    if (!isAvailable) {
      return res.status(400).json({ success: false, message: "Room is not available" });
    }

    // Get room & hotel info
    const roomData = await Room.findById(room).populate("hotel");
    if (!roomData) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    // Calculate nights (ensure at least 1 night)
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    const msPerDay = 1000 * 60 * 60 * 24;
    let nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / msPerDay);
    if (nights < 1) nights = 1;

    const pricePerNight = Number(roomData.pricePerNight || 0);
    const totalPrice = pricePerNight * nights;

    const booking = await Booking.create({
      user: req.user._id,
      room,
      hotel: roomData.hotel._id,
      guests: guests || 1,
      checkInDate,
      checkOutDate,
      totalPrice,
      isPaid: false,
    });

    // Send confirmation email (best-effort)
    try {
      const mailOptions = {
        from: process.env.SENDER_EMAIL,
        to: req.user.email,
        subject: "Hotel Booking Details",
        html: `
          <h2>Your Booking Details</h2>
          <p>Dear ${req.user.username || "Guest"},</p>
          <p>Thank you for your booking! Here are your details:</p>
          <ul>
            <li><strong>Booking ID:</strong> ${booking._id}</li>
            <li><strong>Hotel Name:</strong> ${roomData.hotel.name}</li>
            <li><strong>Location:</strong> ${roomData.hotel.address || "N/A"}</li>
            <li><strong>Check-In:</strong> ${new Date(booking.checkInDate).toDateString()}</li>
            <li><strong>Check-Out:</strong> ${new Date(booking.checkOutDate).toDateString()}</li>
            <li><strong>Booking Amount:</strong> ${process.env.CURRENCY || "$"} ${booking.totalPrice}</li>
          </ul>
          <p>We look forward to welcoming you!</p>
        `,
      };
      await transporter.sendMail(mailOptions);
    } catch (mailErr) {
      console.error("Booking confirmation email failed:", mailErr);
      // don't fail the booking due to email error
    }

    return res.status(201).json({ success: true, message: "Booking created successfully", booking });
  } catch (error) {
    console.error("createBooking error:", error);
    return res.status(500).json({ success: false, message: "Failed to create booking" });
  }
};

// GET /api/bookings/user
export const getUserBookings = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const userId = req.user._id;
    const bookings = await Booking.find({ user: userId }).populate("room hotel").sort({ createdAt: -1 });
    return res.json({ success: true, bookings });
  } catch (error) {
    console.error("getUserBookings error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch bookings" });
  }
};

// GET /api/bookings/hotel (for hotel owner dashboard)
export const getHotelBookings = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const ownerId = req.user._id;
    const hotel = await Hotel.findOne({ owner: ownerId });
    if (!hotel) {
      return res.status(404).json({ success: false, message: "No Hotel found" });
    }

    const bookings = await Booking.find({ hotel: hotel._id })
      .populate("room hotel user")
      .sort({ createdAt: -1 });

    const totalBookings = bookings.length;
    const totalRevenue = bookings.reduce((acc, b) => acc + Number(b.totalPrice || 0), 0);

    return res.json({ success: true, dashboardData: { totalBookings, totalRevenue, bookings } });
  } catch (error) {
    console.error("getHotelBookings error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch bookings" });
  }
};

/**
 * Create Stripe Checkout Session for a booking
 * POST /api/bookings/stripe-payment
 * body: { bookingId }
 */
export const stripePayment = async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) {
      return res.status(400).json({ success: false, message: "Missing bookingId" });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    const roomData = await Room.findById(booking.room).populate("hotel");
    const totalPrice = Number(booking.totalPrice || 0);
    if (totalPrice <= 0) {
      return res.status(400).json({ success: false, message: "Invalid booking amount" });
    }

    const currency = (process.env.CURRENCY_CODE || "usd").toLowerCase();
    const origin = req.get("origin") || process.env.CLIENT_URL || "";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `${roomData.hotel?.name || "Hotel Booking"}`,
              description: `Booking ID: ${booking._id}`,
            },
            unit_amount: Math.round(totalPrice * 100), // cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/loader/my-bookings`,
      cancel_url: `${origin}/my-bookings`,
      metadata: {
        bookingId: booking._id.toString(),
      },
    });

    return res.json({ success: true, url: session.url });
  } catch (error) {
    console.error("stripePayment error:", error);
    return res.status(500).json({ success: false, message: "Payment Failed" });
  }
};

/**
 * Stripe Webhook handler to mark booking paid on checkout.session.completed
 * POST /api/bookings/webhook
 * IMPORTANT: this route MUST use raw body parser middleware: express.raw({ type: 'application/json' })
 */
export const stripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
    return res.status(400).send("Webhook not configured");
  }

  // payload must be the raw body string provided by express.raw middleware
  const payload = req.rawBody || (typeof req.body === "string" ? req.body : JSON.stringify(req.body));

  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
  } catch (err) {
    console.error("⚠️  Webhook signature verification failed.", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      // session.metadata.bookingId should exist
      const bookingId = session.metadata?.bookingId;
      if (bookingId) {
        const booking = await Booking.findById(bookingId).populate("user room hotel");
        if (booking) {
          // mark paid and save some payment info
          booking.isPaid = true;
          booking.paymentDetails = {
            stripeSessionId: session.id,
            paymentIntent: session.payment_intent || null,
            paymentStatus: session.payment_status || "paid",
            updatedAt: new Date(),
          };
          await booking.save();

          // send payment receipt email to user (best-effort)
          try {
            const userEmail = booking.user?.email;
            if (userEmail) {
              const mailOptions = {
                from: process.env.SENDER_EMAIL,
                to: userEmail,
                subject: "Payment Received - Booking Confirmed",
                html: `
                  <h3>Payment Received</h3>
                  <p>Hi ${booking.user?.username || "Guest"},</p>
                  <p>We have received your payment for booking <strong>${booking._id}</strong>.</p>
                  <ul>
                    <li><strong>Hotel:</strong> ${booking.hotel?.name || "N/A"}</li>
                    <li><strong>Check-In:</strong> ${new Date(booking.checkInDate).toDateString()}</li>
                    <li><strong>Check-Out:</strong> ${new Date(booking.checkOutDate).toDateString()}</li>
                    <li><strong>Amount:</strong> ${process.env.CURRENCY || "$"} ${booking.totalPrice}</li>
                  </ul>
                  <p>Thank you! Your booking is now confirmed.</p>
                `,
              };
              await transporter.sendMail(mailOptions);
            }
          } catch (mailErr) {
            console.error("Payment confirmation email failed:", mailErr);
          }
        } else {
          console.warn("Booking not found for bookingId in webhook:", bookingId);
        }
      } else {
        console.warn("No bookingId metadata in session:", session.id);
      }
    }

    // Return a 200 response to acknowledge receipt of the event
    res.json({ received: true });
  } catch (err) {
    console.error("Error handling webhook event:", err);
    res.status(500).send("Server error handling webhook");
  }
};

export default {
  checkAvailabilityAPI,
  createBooking,
  getUserBookings,
  getHotelBookings,
  stripePayment,
  stripeWebhook,
};
