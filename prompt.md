# Project Overview

Create a production-ready Laundry Management Platform called "Lunara".

The platform should support:

- Customer Mobile App
- Customer Web App
- Admin Dashboard
- Staff Dashboard
- Rider/Delivery App
- Laundry Shop Portal
- Backend API
- Shared UI Components
- Shared Types
- Shared Business Logic

Use modern scalable Monorepo Architecture.

---

# Tech Stack

## Frontend

### Mobile App
- React Native (Expo)
- TypeScript
- React Query
- Zustand
- Expo Router

### Web Applications
- Next.js 15
- React 19
- TypeScript
- TailwindCSS
- Shadcn/UI

---

## Backend

- Node.js
- NestJS
- MongoDB
- Mongoose
- Redis
- JWT Authentication
- Socket.IO

---

## Cloud & Storage

- AWS S3
- Cloudflare CDN
- Cloudinary
- Firebase Push Notifications

---

# Monorepo Structure

Use TurboRepo.

Structure:

/
├── apps
│
├── customer-mobile
│   └── Expo App
│
├── rider-mobile
│   └── Expo App
│
├── customer-web
│   └── NextJS Website
│
├── admin-web
│   └── NextJS Admin Dashboard
│
├── partner-web
│   └── Laundry Shop Portal
│
├── api
│   └── NestJS Backend
│
├── packages
│
├── ui
│   └── Shared Components
│
├── types
│   └── Shared Types
│
├── config
│   └── Shared Config
│
├── utils
│   └── Shared Helpers
│
├── validation
│   └── Zod Schemas
│
├── hooks
│   └── Shared Hooks
│
└── docs
    └── Documentation

---

# User Roles

## Customer

Features:

- Signup/Login
- Mobile OTP
- Email Login
- Social Login
- Profile Management
- Addresses
- Laundry Booking
- Order Tracking
- Wallet
- Loyalty Points
- Reviews
- Notifications
- Order History

---

## Rider

Features:

- Accept Delivery Tasks
- GPS Tracking
- Route Optimization
- Delivery Proof
- Earnings Dashboard
- Rider Wallet

---

## Laundry Shop Partner

Features:

- Manage Orders
- Order Queue
- Laundry Status Updates
- Staff Management
- Inventory Management
- Reports
- Earnings Tracking

---

## Staff

Features:

- Work Assignment
- Order Processing
- Laundry Progress Tracking
- Time Tracking
- Attendance

---

## Admin

Features:

- Dashboard Analytics
- Customer Management
- Partner Management
- Rider Management
- Staff Management
- Revenue Reports
- Promotions
- CMS Management
- System Settings

---

# Laundry Workflow

1. Customer Books Laundry
2. Rider Assigned
3. Rider Picks Up Laundry
4. Laundry Shop Receives Order
5. Washing
6. Drying
7. Folding
8. Ironing
9. Quality Check
10. Ready For Delivery
11. Rider Assigned
12. Delivered
13. Customer Review

---

# Order Status

Pending

Confirmed

Rider Assigned

Picked Up

Received

Washing

Drying

Folding

Ironing

Quality Check

Ready For Delivery

Out For Delivery

Delivered

Completed

Cancelled

Refunded

---

# Booking Types

- Wash & Fold
- Wash & Dry
- Wash, Dry & Fold
- Wash, Dry, Fold & Iron
- Dry Cleaning
- Comforters
- Curtains
- Shoes
- Uniforms

---

# Customer Mobile Screens

- Splash
- Onboarding
- Login
- OTP Verification
- Signup
- Home
- Services
- New Booking
- Pickup Schedule
- Order Tracking
- Wallet
- Loyalty Rewards
- Notifications
- Reviews
- Settings

---

# Partner Dashboard

Modules:

- Dashboard
- Orders
- Customers
- Riders
- Staff
- Inventory
- Reports
- Settings

---

# Admin Dashboard

Modules:

- Overview
- Users
- Laundry Shops
- Riders
- Orders
- Revenue
- Analytics
- Promotions
- Content Management
- Audit Logs

---

# Database Collections

Users

Customers

Partners

Riders

Staff

Orders

OrderItems

Payments

Wallets

Transactions

Addresses

Notifications

Reviews

Coupons

LoyaltyPoints

Inventory

Attendance

AuditLogs

Settings

---

# Integrations

Payments:

- GCash
- Maya
- Stripe

Notifications:

- SMS
- Email
- Push Notifications

Maps:

- Google Maps
- OpenStreetMap

Authentication:

- OTP
- Google
- Facebook

---

# UI Requirements

Theme:

- Modern
- Clean
- Laundry-inspired

Primary Color:
#4F46E5

Secondary Color:
#06B6D4

Accent:
#22C55E

Style:

- Mobile First
- Responsive
- Professional
- Enterprise Grade

---

# Deliverables

Generate:

1. Complete Monorepo Folder Structure
2. Database Schema Design
3. NestJS Architecture
4. API Endpoints
5. Authentication Flow
6. Mobile App Architecture
7. Admin Dashboard Architecture
8. Partner Portal Architecture
9. Rider App Architecture
10. Shared Package Design
11. CI/CD Pipeline
12. Docker Setup
13. Deployment Architecture
14. RBAC Permission System
15. Event-Driven Architecture
16. Real-Time Tracking Architecture
17. Detailed Development Roadmap

Follow enterprise-grade coding standards and scalability best practices.