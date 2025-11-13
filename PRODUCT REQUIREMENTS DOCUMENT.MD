📘 PRODUCT REQUIREMENTS DOCUMENT (PRD)
🧩 Project: Kulmis Pharmacy & Laboratory Management System
Stack: React + TypeScript + TailwindCSS + Shadcn UI + Node.js (Express) + MongoDB Atlas
🎯 1. Project Overview

Kulmis Pharmacy & Laboratory Management System is a modern cloud-based web platform designed to help pharmacies, clinics, and small medical centers efficiently manage:

Medicine inventory and sales

Laboratory tests and reports

Expenses and debts

Real-time analytics and profit tracking

Subscription and user management

The system includes two main portals:

Admin Panel – for super admin and system managers.

User Dashboard – for pharmacy or lab owners (multi-tenant).

⚙️ 2. Core Technologies
Layer	Technology
Frontend	React + TypeScript + TailwindCSS + Shadcn UI
Charts	Recharts / Chart.js
Backend	Node.js (Express.js Framework)
Database	MongoDB Atlas
Authentication	JWT (access + refresh tokens)
File Storage	Cloudinary / AWS S3
Emails & OTP	SendGrid (Email), Twilio / Africa’s Talking (SMS OTP)
PDF/Invoice	jsPDF / react-to-print
Deployment	Vercel (Frontend), Render / Railway (Backend)
🧑‍💻 3. System Roles

Super Admin

Manages all system users and subscriptions.

Adds tutorials, plans, and analytics monitoring.

Pharmacy / Lab User (Owner)

Manages their pharmacy data (medicines, sales, debts, etc.).

Can register patients for lab tests and generate reports.

Technician / Employee

Handles sales or lab test entries under a pharmacy user.

🧱 4. System Modules
🔹 4.1 Authentication Module

Features:

Register new user (Pharmacy Name, Email, Phone, Password)

Login using email/password or phone/OTP

Forgot password (OTP via SMS or email reset link)

JWT-based authentication

Role-based access control (Admin / User / Technician)

🔹 4.2 Dashboard (Home)

Beautiful modern UI built with Shadcn UI + TailwindCSS:

Quick metrics cards:

Total Sales 💰

Total Profit 📈

Total Customers 👥

Out of Stock ⚠️

Total Debts 💵

Total Lab Tests 🔬

Graphs & Charts:

Sales by Month (Bar chart)

Profit vs Expenses (Line chart)

Today’s Summary (Donut chart)

Expiring Medicines Table

Recent Sales / Lab Orders Table

Shortcuts:

Add Medicine

New Sale

Add Lab Test

Generate Report

🔹 4.3 Medicine Management

Functions:

Add/Edit/Delete medicines

Fields:

Name, Batch, Expiry Date, Quantity, Buying Price, Selling Price

Auto-calculate average buying price on restock

Highlight low stock and expired medicines

Filter and search by name, batch, expiry, or category

🔹 4.4 Sales & Invoice System

Features:

Search medicines by name or barcode

Add items to cart → auto-calculate total and profit/loss

Show real-time mini profit/loss summary

Auto-generate invoice after each sale

Download or print invoice (A4 & POS format)

Save sale record to transactions table

Invoice Layout Includes:

Pharmacy logo & details

Customer name & contact (optional)

List of medicines sold

Total amount, discount, and payment method

Profit summary and QR code (optional)

🔹 4.5 Debts (Credit Management)

Features:

Add new debtor (name, phone, WhatsApp, due date)

Record medicines taken and total owed

Partial payments supported

Status: Pending, Partial, Paid, Overdue

Auto alert via WhatsApp/SMS on due date

Admin can see total outstanding debts

🔹 4.6 Expenses

Features:

Record expenses with category (Rent, Utilities, Salary, etc.)

Track daily/weekly/monthly expenses

Add receipt upload (optional)

Filter by date and category

Auto deduct from profit dashboard

🔹 4.7 Reports & Analytics

Beautiful interactive charts & dashboards

Sales vs Expenses chart

Profit & Loss report

Best-selling medicines

Daily / Weekly / Monthly filter

Export as Excel / PDF

Admin summary for all users

🔹 4.8 Subscriptions & Payments

Plans:

Monthly, 3 Months, 6 Months, Yearly, Lifetime

Features:

User chooses plan → enters payment info → pending request created

Admin approves → system activates plan

Countdown of remaining days on user dashboard

Auto lock when expired → “Please renew your plan” alert

Record all payments and receipts



4.10 Tutorials / Help Center

Admin uploads training tutorials (title, link, thumbnail)

Users can browse tutorials easily:

How to Add Medicines

How to Record Sales

How to Generate Reports

How to Register Lab Tests

🔹 4.11 Notifications & Alerts

Alerts for:

Low stock

Expiring medicines

Unpaid debts

Subscription expiry

Delivery methods:

In-app notifications

Optional WhatsApp/SMS integration

💾 5. Database Design (MongoDB Collections)
Collection	Description
users	pharmacy, email, phone, password_hash, role, subscription
medicines	user_id, name, quantity, prices, expiry_date
transactions	user_id, medicine_id, quantity, total_sale, profit
invoices	user_id, invoice_number, items[], total, payment_method
debts	user_id, debtor_name, phone, due_date, balance, status
expenses	user_id, category, amount, date, description
subscriptions	user_id, plan_name, start_date, end_date, status
tutorials	title, description, link, thumbnail_url
🧭 6. UI / UX Requirements
Design Framework

Shadcn UI + TailwindCSS

Theme: Clean white with blue accent (#2563eb)

Fonts: Inter / Poppins

Rounded Corners: rounded-2xl

Shadow: shadow-md shadow-gray-200

Animations: Smooth transitions (hover effects, fade-ins)

Charts: Recharts with gradients

Dark Mode (optional) toggle

UI Layouts

Sidebar Navigation

Icons for Dashboard, Sales, Medicines, Debts, Expenses, Reports, Lab, Tutorials, Settings

Topbar

Search, Notifications, User Profile

Cards

Animated numbers (CountUp.js)

Tables

Sticky headers, pagination, sort/filter

Charts

Line, Bar, Donut, Area

Responsive

Mobile-first grid, collapsible sidebar

🔒 7. Security

JWT authentication with refresh tokens

Bcrypt password hashing

Input validation with Zod/Joi

Rate limiting & CORS policy

File upload sanitization

Data access limited to user scope

⚙️ 8. Performance & Scalability

Server-side pagination

Caching frequently used data

Lazy loading components

MongoDB indexing (user_id, expiry_date, status)

Cloud deployment with autoscaling (Render/Vercel)

🧾 9. Reporting & Export

PDF and Excel export for:

Sales Reports

Expenses

Lab Reports

Invoices

Option to email reports to user or print

🧑‍💼 10. Admin Panel

Features:

Global dashboard (total users, active subs, total income)

Manage user accounts and reset passwords

Approve subscription requests

View analytics for all pharmacies

Manage tutorials and content

View audit logs and activity records

🚀 11. Future Enhancements

Multi-branch pharmacy linking

Mobile App (React Native)

AI-based sales forecasting

Integration with accounting systems

Offline mode (PWA)

✅ 12. Expected Outcome

A sleek, modern, and professional Pharmacy + Laboratory Management System with:

Intuitive UI using Shadcn UI

Real-time analytics & reports

Secure cloud architecture

Fast performance

Easy expansion to multi-branch or enterprise version