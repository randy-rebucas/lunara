# Lunara Rider Mobile App

## Product Requirements Document (PRD)

---

# Overview

The Lunara Rider App is a dedicated mobile application for pickup and delivery personnel responsible for transporting laundry between customers and partner laundry shops.

The application follows a dispatcher-managed workflow where all tasks originate from the Lunara Dispatch Team.

Riders do not freely browse available jobs. Instead, assignments are dispatched and tracked through the Lunara platform.

---

# Objectives

## Rider Objectives

- Receive assigned pickup and delivery tasks
- Navigate efficiently
- Complete tasks with proof of completion
- Monitor earnings and performance

## Admin Objectives

- Track rider activity
- Assign and monitor tasks
- Optimize delivery operations
- Ensure SLA compliance

## Customer Objectives

- Reliable pickups
- Reliable deliveries
- Real-time order tracking

---

# User Role

## Rider

### Permissions

- View assigned tasks
- Accept assignments
- Reject assignments
- Navigate to destinations
- Update task status
- Upload photos and proof of delivery
- View earnings
- Update profile

### Restrictions

- Cannot assign tasks
- Cannot reassign tasks
- Cannot change order details
- Cannot modify pricing

---

# Navigation Structure

```text
Home
Tasks
Profile
```

Additional Modules

```text
Notifications
QR Scanner
Earnings
Wallet
Support
```

---

# Authentication

## Login Screen

### Fields

- Mobile Number
- Password

### Actions

- Login
- Forgot Password

---

## OTP Verification

### Fields

- OTP Code

### Actions

- Verify OTP
- Resend OTP

---

# Home Dashboard

## Earnings Summary

Display:

- Today
- This Week
- This Month
- Lifetime

Example:

```text
Today: ₱500
Week: ₱3,500
Month: ₱12,000
```

---

## Shift Status

States:

```text
ONLINE
OFFLINE
BREAK
```

Actions:

```text
START SHIFT
END SHIFT
```

---

## Active Assignment Card

Displays:

- Order Number
- Customer Name
- Service Type
- Distance
- ETA

Actions:

- View Task
- Navigate

---

## Route Progress

```text
Task 3 of 5
```

---

# Task Management

## Task Types

### Pickup Task

```text
Customer → Laundry Shop
```

### Delivery Task

```text
Laundry Shop → Customer
```

---

# Task List Screen

## Filters

```text
Assigned
Accepted
In Progress
Completed
Cancelled
```

---

# Task Details

## Customer Information

- Name
- Mobile Number
- Address

## Shop Information

- Shop Name
- Branch
- Address

## Order Information

- Order Number
- Service Type
- Estimated Weight
- Special Instructions

### Available Actions

- Accept Task
- Reject Task
- Navigate
- Call Customer
- Call Shop

---

# Pickup Workflow

## Step 1 — Receive Assignment

Push Notification:

```text
New Pickup Assignment
```

Status:

```text
ASSIGNED
```

---

## Step 2 — Accept Assignment

Status:

```text
ACCEPTED
```

---

## Step 3 — Navigate To Customer

Supported Maps:

- Google Maps
- Waze

Status:

```text
EN_ROUTE_TO_CUSTOMER
```

---

## Step 4 — Arrive At Customer

Status:

```text
ARRIVED
```

---

## Step 5 — Verify Customer

Methods:

### Option 1

OTP Verification

### Option 2

QR Code Scan

---

## Step 6 — Collect Laundry

Capture:

- Laundry Photos
- Pickup Notes
- Estimated Weight

---

## Step 7 — Generate Pickup Proof

Stores:

- Timestamp
- Rider Information
- Customer Information
- GPS Coordinates
- Photos

Status:

```text
PICKED_UP
```

---

## Step 8 — Deliver To Assigned Shop

Status:

```text
IN_TRANSIT_TO_SHOP
```

---

## Step 9 — Shop Confirmation

Verification:

- QR Scan
- OTP Verification

Status:

```text
DELIVERED_TO_SHOP
```

---

# Delivery Workflow

## Step 1 — Receive Delivery Assignment

Push Notification:

```text
Laundry Ready For Delivery
```

Status:

```text
DELIVERY_ASSIGNED
```

---

## Step 2 — Collect Laundry From Shop

Verify:

- Package
- Order Number
- Customer Details

Status:

```text
PICKED_UP_FROM_SHOP
```

---

## Step 3 — Navigate To Customer

Status:

```text
OUT_FOR_DELIVERY
```

---

## Step 4 — Verify Customer

Methods:

- OTP Verification
- QR Code Scan

---

## Step 5 — Complete Delivery

Capture:

- Delivery Photo
- Customer Signature
- Recipient Name

Status:

```text
DELIVERED
```

---

# QR Scanner Module

## Purpose

Fast verification and handover.

### Customer Pickup

```text
Scan Customer QR
```

### Shop Handover

```text
Scan Order QR
```

### Delivery Completion

```text
Scan Customer QR
```

---

# Real-Time GPS Tracking

## Frequency

```text
Every 15 Seconds
```

### Payload

```json
{
  "latitude": "",
  "longitude": "",
  "speed": "",
  "heading": "",
  "timestamp": ""
}
```

---

# Earnings Module

## Dashboard

Display:

- Today
- This Week
- This Month
- Lifetime

---

## Earnings Breakdown

Per Task

```text
Pickup Fee
Delivery Fee
Bonus
Adjustment
```

---

# Wallet Module

## Displays

- Current Balance
- Pending Earnings
- Withdrawable Earnings

### Withdrawal Methods

- GCash
- Maya
- Bank Transfer

---

# Performance Module

## Metrics

### Completion Rate

```text
98%
```

### Acceptance Rate

```text
95%
```

### On-Time Delivery

```text
97%
```

### Customer Rating

```text
4.9 / 5.0
```

---

# Notifications

## Assignment

```text
New Pickup Assigned
```

## Reminder

```text
Pickup Overdue
```

## Earnings

```text
Earnings Credited
```

## System

```text
Platform Announcement
```

---

# Profile Module

## Rider Information

- Full Name
- Mobile Number
- Email Address
- Home Address

---

## Vehicle Information

Vehicle Types:

```text
Motorcycle
Bicycle
Car
Van
```

Fields:

- Plate Number
- OR/CR Number

---

# Documents Module

Required Uploads:

- Driver's License
- OR/CR
- NBI Clearance
- Selfie Verification

---

# SOS Emergency Module

## Actions

- Notify Dispatcher
- Share Live Location
- Call Emergency Contact

---

# Rider Statuses

```text
OFFLINE

ONLINE

ASSIGNED

PICKUP

IN_TRANSIT_TO_CUSTOMER

IN_TRANSIT_TO_SHOP

AT_SHOP

DELIVERY

BREAK
```

---

# Push Notifications

Provider:

```text
Firebase Cloud Messaging (FCM)
```

Examples:

```text
New Pickup Assignment

Laundry Ready For Delivery

Customer Waiting

Task Completed

Shift Reminder
```

---

# Offline Support

When offline:

Store locally:

- GPS Logs
- Photos
- Status Updates
- Delivery Proof

Auto-sync when internet returns.

---

# Future Enhancements

## Smart Route Optimization

Suggest fastest routes.

## Auto Dispatch Recommendation

Recommend nearest rider.

## Rider Performance Insights

Predict SLA risks.

## Earnings Forecast

Estimate weekly and monthly income.

---

# MVP Screens

## Authentication

- Login
- OTP Verification

## Home

- Dashboard

## Tasks

- Task List
- Task Details
- Active Assignment

## Operations

- QR Scanner
- Pickup Workflow
- Delivery Workflow

## Financial

- Earnings
- Wallet

## User

- Notifications
- Profile
- Documents

## Support

- Help Center
- SOS Emergency

---

# MVP Screen Count

```text
18–22 Screens
```

---

# Platform Integrations

The Rider App integrates with:

- Customer Mobile App
- Partner Laundry Portal
- Lunara Admin Dashboard
- Dispatch Control Tower
- GPS Tracking Services
- Firebase Notifications
- Wallet & Payment Services

---

# Success Metrics

## Rider Metrics

- Acceptance Rate > 95%
- Completion Rate > 98%
- On-Time Delivery > 95%

## Platform Metrics

- Average Pickup Time
- Average Delivery Time
- Customer Satisfaction Score
- Rider Utilization Rate

---

# Architecture Summary

```text
Customer
    ↓
Lunara Admin Dispatch
    ↓
Rider App
    ↓
Laundry Partner Shop
    ↓
Rider App
    ↓
Customer
```

The Rider App serves as the logistics layer connecting customers, dispatchers, and partner laundry shops within the Lunara ecosystem.