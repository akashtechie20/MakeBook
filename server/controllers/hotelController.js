// server/controllers/hotelController.js
import Hotel from "../models/Hotel.js";
import User from "../models/User.js";

export const registerHotel = async (req, res) => {
  try {
    const { name, address, contact, city } = req.body;

    // Defensive: get owner from req.user or fall back to Clerk auth
    const owner = (req.user && req.user._id) || (req.auth && req.auth.userId);
    if (!owner) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    // Check if user already has a hotel
    const existing = await Hotel.findOne({ owner });
    if (existing) {
      return res.json({ success: false, message: "Hotel Already Registered" });
    }

    // Create hotel
    await Hotel.create({ name, address, contact, city, owner });

    // Upgrade role if user doc exists
    await User.findByIdAndUpdate(owner, { role: "hotelOwner" });

    return res.json({ success: true, message: "Hotel Registered Successfully" });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};
