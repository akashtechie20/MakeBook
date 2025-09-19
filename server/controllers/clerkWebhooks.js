// server/controllers/clerkWebhooks.js
import User from "../models/User.js";
import { Webhook } from "svix";

const clerkWebhooks = async (req, res) => {
  try {
    // Verify Svix signature
    const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET);

    // With express.raw, req.body is a Buffer
    const payload = req.body.toString("utf8");
    const headers = {
      "svix-id": req.headers["svix-id"],
      "svix-timestamp": req.headers["svix-timestamp"],
      "svix-signature": req.headers["svix-signature"],
    };

    const evt = wh.verify(payload, headers);
    const { type, data } = evt;

    const firstEmail = data?.email_addresses?.[0]?.email_address || "";
    const fullName =
      [data?.first_name, data?.last_name].filter(Boolean).join(" ") ||
      data?.username ||
      firstEmail ||
      "User";

   

    if (type === "user.created") {
       const userData = {
      _id: data.id,
      username: fullName,
      email: firstEmail,
      image: data?.image_url || "",
      // role defaults to "user" by schema
      recentSearchedCities: [],
    };
      await User.findByIdAndUpdate(data.id, userData, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      });
    } else if (type === "user.updated") {
       const userData = {
      _id: data.id,
      username: fullName,
      email: firstEmail,
      image: data?.image_url || "",
      // role defaults to "user" by schema
      recentSearchedCities: [],
    };
      await User.findByIdAndUpdate(data.id, userData);
    } else if (type === "user.deleted") {
      await User.findByIdAndDelete(data.id);
    }

    return res.json({ success: true, message: "Webhook received" });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

export default clerkWebhooks;
