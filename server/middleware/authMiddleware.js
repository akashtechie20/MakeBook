// server/middleware/authMiddleware.js
import User from "../models/User.js";
import { clerkClient } from "@clerk/express";

// Middleware to check if user is authenticated and attach a User doc
export const protect = async (req, res, next) => {
  try {
    const { userId } = req.auth || {};
    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    // Try to find the user in Mongo
    let user = await User.findById(userId);

    // If not there yet, fetch from Clerk and create it
    if (!user) {
      try {
        const cu = await clerkClient.users.getUser(userId);

        const primaryEmail =
          cu.emailAddresses?.find(e => e.id === cu.primaryEmailAddressId)?.emailAddress ||
          cu.emailAddresses?.[0]?.emailAddress ||
          "";

        const username =
          [cu.firstName, cu.lastName].filter(Boolean).join(" ") ||
          cu.username ||
          primaryEmail ||
          "User";

        user = await User.create({
          _id: cu.id,
          username,
          email: primaryEmail,
          image: cu.imageUrl || "",
          role: "user",
          recentSearchedCities: [],
        });
      } catch (e) {
        return res.status(401).json({ success: false, message: "User not found" });
      }
    }

    req.user = user;
    next();
  } catch (err) {
    console.error(err);
    return res.status(401).json({ success: false, message: "Auth error" });
  }
};
