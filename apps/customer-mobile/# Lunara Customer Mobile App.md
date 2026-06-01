# Lunara Customer Mobile App

## Product Requirements Document (PRD)

---

# Overview

The **Lunara Customer Mobile App** is the primary customer-facing application that allows users to book laundry services, schedule pickups, track laundry status, monitor riders, make payments, earn rewards, and manage their laundry needs from a single platform.

The platform follows a **Managed Laundry Network Model** where customers book through Lunara and the Lunara Dispatch Team assigns the most suitable partner laundry shop.

Customers focus on convenience while Lunara handles logistics, dispatching, and coordination.

---

# Core Value Proposition

## Laundry In 4 Simple Steps

```text
Book Laundry
     ↓
Schedule Pickup
     ↓
Track Progress
     ↓
Receive Clean Laundry
```

---

# Primary Goals

## Customer Goals

- Easy booking process
- Door-to-door pickup and delivery
- Real-time tracking
- Transparent pricing
- Secure payments
- Convenient reordering

## Business Goals

- Increase bookings
- Improve retention
- Reduce customer support requests
- Increase repeat orders
- Improve customer satisfaction

---

# User Roles

## Customer

### Permissions

- Register Account
- Login
- Manage Profile
- Manage Addresses
- Create Bookings
- Track Orders
- Make Payments
- Earn Loyalty Points
- Submit Reviews
- Contact Support

---

# App Navigation

## Bottom Navigation

```text
Home
Orders
Rewards
Notifications
Profile
```

---

# Authentication Module

## Login Methods

- Mobile Number + OTP
- Email + Password
- Google Login
- Facebook Login
- Apple Login (iOS)

---

# Screens

## Splash Screen

### Purpose

- Brand introduction
- Auto-login validation

---

## Onboarding

### Screen 1

Book Laundry Anytime

### Screen 2

Door-to-Door Pickup

### Screen 3

Track Every Step

### Screen 4

Get Laundry Delivered

---

## Login Screen

### Fields

- Mobile Number
- Password

### Actions

- Login
- Sign Up
- Forgot Password

---

## OTP Verification

### Fields

- OTP Code

### Actions

- Verify
- Resend OTP

---

## Registration Screen

### Fields

- Full Name
- Mobile Number
- Email
- Password

---

# Home Dashboard

## Welcome Banner

Example:

```text
Good Morning, John!
Ready for your next laundry service?
```

---

## Quick Actions

```text
Book Laundry
Track Order
Order History
Rewards
```

---

## Promotional Banners

Examples:

- Free Delivery Promo
- First Order Discount
- Referral Program

---

## Active Orders

Displays:

- Order Number
- Current Status
- Estimated Delivery Date

### Action

```text
Track Order
```

---

## Recommended Services

```text
Wash & Fold
Wash & Dry
Wash, Dry & Fold
Wash, Dry, Fold & Iron
Dry Cleaning
Comforters
Curtains
Shoes
Uniforms
```

---

# Address Management

## Address List

Customer can save:

- Home
- Work
- Apartment
- Custom

---

## Add Address

### Fields

- Address Name
- Complete Address
- Landmark
- Notes

### Location

- GPS Pin
- Google Maps

---

# Laundry Booking Module

## Step 1 — Select Service

Options:

```text
Wash & Fold
Wash & Dry
Wash, Dry & Fold
Wash, Dry, Fold & Iron
Dry Cleaning
Comforters
Curtains
Shoes
Uniforms
```

---

## Step 2 — Pickup Address

Select saved address.

---

## Step 3 — Pickup Schedule

### Options

- Today
- Tomorrow
- Custom Date

### Time Slots

```text
8AM - 10AM
10AM - 12PM
1PM - 3PM
3PM - 5PM
```

---

## Step 4 — Laundry Information

### Fields

- Estimated Weight
- Special Instructions

Examples:

```text
Handle Delicates Carefully
No Bleach
Separate White Clothes
```

---

## Step 5 — Review Booking

Displays:

- Services
- Pickup Schedule
- Estimated Cost
- Address

---

## Step 6 — Payment Selection

### Methods

- GCash
- Maya
- Credit Card
- Debit Card
- Cash on Delivery
- Lunara Wallet

---

## Step 7 — Booking Confirmation

Status:

```text
PENDING_DISPATCH
```

---

# Order Tracking Module

## Order Timeline

```text
Booking Created
     ↓
Pending Dispatch
     ↓
Shop Assigned
     ↓
Rider Assigned
     ↓
Rider En Route
     ↓
Laundry Picked Up
     ↓
Delivered To Shop
     ↓
Sorting
     ↓
Washing
     ↓
Drying
     ↓
Folding
     ↓
Ironing
     ↓
Quality Check
     ↓
Ready For Delivery
     ↓
Out For Delivery
     ↓
Delivered
     ↓
Completed
```

---

## Live Rider Tracking

Displays:

- Rider Name
- Rider Photo
- Mobile Number
- Live Map Location
- Estimated Arrival

### Actions

- Call Rider
- Message Rider

---

# Orders Module

## Tabs

```text
Active
Completed
Cancelled
```

---

## Order Details

### Booking Information

- Order Number
- Service Type
- Schedule

### Payment Information

- Payment Method
- Amount

### Rider Information

- Name
- Contact Number

### Status Timeline

- Complete order history

---

# Notifications Module

## Types

### Booking Updates

```text
Booking Confirmed
```

### Rider Updates

```text
Rider Assigned
```

### Laundry Updates

```text
Laundry In Washing Stage
```

### Promotions

```text
20% Off This Week
```

---

# Rewards Module

## Loyalty Points

Customers earn points for:

- Completed Orders
- Referrals
- Promotional Campaigns

---

## Rewards Catalog

Examples:

```text
Free Pickup
Free Delivery
10% Discount
20% Discount
Free Wash & Fold
```

---

# Referral Program

## Customer Referral

Invite friends.

Reward:

```text
100 Points Per Referral
```

---

# Wallet Module

## Wallet Dashboard

Displays:

- Current Balance
- Pending Credits
- Bonus Credits

---

## Transactions

History of:

- Payments
- Refunds
- Bonuses
- Rewards

---

# Payment Module

## Supported Methods

### Digital Wallets

- GCash
- Maya

### Cards

- Visa
- Mastercard

### Cash

- Cash on Delivery

---

# Review & Rating Module

## Order Rating

### Rating Scale

```text
1 - 5 Stars
```

### Categories

- Service Quality
- Pickup Experience
- Delivery Experience
- Overall Satisfaction

### Comments

Customer feedback and suggestions.

---

# Customer Support Module

## Support Options

- Live Chat
- Ticket System
- Email Support
- Hotline

---

# Help Center

Topics:

- Booking Issues
- Payment Issues
- Lost Items
- Refund Requests
- Delivery Delays

---

# Lost Item Report

## Workflow

```text
Create Report
     ↓
Admin Investigation
     ↓
Partner Verification
     ↓
Resolution
```

---

# Refund Request

## Workflow

```text
Request Refund
     ↓
Admin Review
     ↓
Approve / Reject
     ↓
Refund Processing
```

---

# Profile Module

## Personal Information

- Full Name
- Mobile Number
- Email
- Birthday

---

## Settings

### Notification Settings

### Privacy Settings

### Security Settings

### Language Settings

---

# Security Features

## Account Protection

- OTP Verification
- Device Recognition
- Session Management

---

## Privacy

- Data Encryption
- Secure Payments
- Secure Authentication

---

# Push Notifications

Provider:

```text
Firebase Cloud Messaging (FCM)
```

Examples:

```text
Rider Assigned
Laundry Picked Up
Laundry Being Processed
Ready For Delivery
Delivered Successfully
```

---

# Offline Support

Store locally:

- Recent Orders
- Addresses
- Notifications

Automatically synchronize when internet becomes available.

---

# Future Features

## AI Laundry Assistant

Suggest suitable services.

## Smart Reorder

One-click repeat booking.

## Family Accounts

Shared household laundry management.

## Subscription Plans

Monthly laundry packages.

## Corporate Accounts

Business laundry management.

---

# MVP Screens

## Authentication

- Splash
- Onboarding
- Login
- OTP Verification
- Registration

## Home

- Dashboard

## Booking

- Service Selection
- Address Selection
- Schedule Selection
- Review Booking
- Payment

## Orders

- Orders List
- Order Details
- Live Tracking

## Financial

- Wallet
- Payments

## Rewards

- Loyalty Points
- Referral Program

## User

- Notifications
- Profile
- Settings

## Support

- Help Center
- Live Chat
- Tickets

---

# Estimated MVP Screen Count

```text
25–35 Screens
```

---

# Platform Integrations

The Customer App integrates with:

- Lunara Admin Dispatch Dashboard
- Rider Mobile App
- Partner Laundry Portal
- Payment Gateway
- Google Maps
- Push Notification Services
- CRM System
- Loyalty System

---

# Complete Customer Journey

```text
Customer
    ↓
Book Laundry
    ↓
Admin Dispatch
    ↓
Partner Shop Assigned
    ↓
Rider Pickup
    ↓
Laundry Processing
    ↓
Rider Delivery
    ↓
Customer Receives Laundry
    ↓
Review & Rewards
```

---

# Success Metrics

## Customer Metrics

- Booking Completion Rate
- Repeat Customer Rate
- Average Orders Per Customer
- Customer Satisfaction Score (CSAT)
- Net Promoter Score (NPS)

## Business Metrics

- Daily Active Users (DAU)
- Monthly Active Users (MAU)
- Order Conversion Rate
- Revenue Per Customer
- Retention Rate

---

# Architecture Summary

```text
Customer Mobile App
        ↓
Lunara Dispatch Center
        ↓
Partner Laundry Shop
        ↓
Rider Mobile App
        ↓
Customer Delivery
```

The Customer Mobile App serves as the primary customer experience layer of the Lunara ecosystem, enabling a seamless end-to-end laundry service journey from booking through delivery.