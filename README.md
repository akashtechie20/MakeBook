# 🏨 MakeBook – Hotel Booking Web App

MakeBook is a full-stack hotel booking platform where users can search for hotels, explore rooms, and make bookings with online payment support.  
It provides role-based features for **users** and **hotel owners**, including booking management, hotel registration, and room uploads with images.

---

## 🚀 Features
- 🔐 **Authentication & Authorization** – User login/signup via Clerk
- 🏨 **Hotel Owner Dashboard** – Register hotels and add rooms
- 🛏 **Room Management** – Upload room details with images (Cloudinary)
- 📅 **Booking System** – Check availability, confirm bookings
- 💳 **Payments** – Stripe Checkout integration (Pay at Hotel / Online Pay)
- 📧 **Email Notifications** – Booking confirmations via Nodemailer (SMTP)
- 🌆 **Search by City** – Find hotels quickly by location

---

## 🛠 Tech Stack
**Frontend:**
- React + Vite  
- Tailwind CSS  
- Clerk (Authentication)  

**Backend:**
- Node.js + Express  
- MongoDB + Mongoose  
- Stripe (Payments)  
- Cloudinary (Image storage)  
- Nodemailer (Emails)  

---

## 🗄 Database Models
- **User** – profile info, role (user / hotelOwner), recent searches  
- **Hotel** – name, city, owner, contact info  
- **Room** – hotel ref, type, price per night, amenities, images, availability  
- **Booking** – user, hotel, room, dates, total price, payment status  

---

## ⚙️ Setup Instructions

### 1. Clone the repo
```bash
git clone https://github.com/akashtechie20/MakeBook.git
cd MakeBook
