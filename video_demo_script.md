# Video Demonstration Script: Reimbursement Management System

This script is designed for a 3-5 minute video demonstrating the core capabilities of the Reimbursement Management System.

## Pre-Requisites Before Recording
1. Ensure the backend FastAPI server and frontend Vite server are running.
2. Ensure you have the PostgreSQL database running with the seed data loaded (`sql/03_seed_data.sql`).
3. Have a sample receipt image ready on your desktop to demonstrate the OCR feature.

---

## 🎬 Scene 1: Introduction & Admin Overview (0:00 - 1:00)

**Visuals:**
- Start with a screen recording of the Login Page (`http://localhost:5173/login`).
- Log in using the Admin credentials (`admin@acme.com` / `Admin@123`).
- Navigate to the **User Management** screen.
- Show the list of seeded users (Admin, Manager, Employee).
- Click on an Employee to show how they report to a specific Manager.

**Narration / Voiceover:**
> "Welcome to a demonstration of our full-stack Reimbursement Management System built with React, FastAPI, and PostgreSQL. Today, we'll walk through the entire lifecycle of an expense claim.
> 
> We're starting off logged in as the Company Admin. Our first step is managing the organization structure. Under the User Management dashboard, administrators can create employee profiles and assign them to specific managers, dynamically defining the reporting hierarchy for approvals."

---

## 🎬 Scene 2: Configuring Dynamic Approval Rules (1:00 - 1:45)

**Visuals:**
- Navigate to the **Approval Rules** section in the Admin dashboard.
- Open the modal to clearly show the different Rule Types available in the dropdown (Sequential, Percentage, Specific Approver, Hybrid).
- Select "Sequential" and show adding two steps (e.g., Step 1: Employee's Direct Manager, Step 2: Key Approver/Finance Head).

**Narration / Voiceover:**
> "A standout feature of this system is its completely configurable, dynamic Approval Rules engine. Instead of hard-coding workflows, administrators can build rules on the fly. 
> 
> Using the dashboard, we can configure rules that are Sequential, Percentage-based, or rely on Specific Key Approvers. Here, we're setting up a sequential rule where an expense must first be approved by the employee's direct manager, and then by the Finance Head."

---

## 🎬 Scene 3: Submitting an Expense & AI Features (1:45 - 2:45)

**Visuals:**
- Log out of the Admin account.
- Log in as the Employee (`employee@acme.com` / `Employee@123`).
- Click on **Submit New Expense**.
- Fill out the initial details, but focus heavily on the **receipt upload**.
- Select the sample receipt image from your computer. 
- *Crucial Moment:* Pause to highlight the fields automatically populating (Amount, Date, Merchant) via Tesseract OCR parsing.
- Show selecting a foreign currency (e.g., EUR or JPY) and the UI displaying the **live converted amount** based on the company's default currency.
- Click **Submit**.

**Narration / Voiceover:**
> "Let's switch roles and log in as an Employee. Submitting an expense report is designed to be frictionless, powered by automated tools.
>
> When the employee uploads a picture of their receipt, our backend utilizes Tesseract OCR to automatically read the image and extract the Date, Merchant Name, and total Amount—saving time and reducing manual entry errors. 
>
> Furthermore, if an expense is incurred during international travel, the system leverages live currency exchange rate APIs to automatically convert the uploaded foreign currency into the company's default currency, ensuring managers have standard global figures for approval."

---

## 🎬 Scene 4: Manager Approval Workflow (2:45 - 3:30)

**Visuals:**
- Log out of the Employee account.
- Log in as the Manager (`manager@acme.com` / `Manager@123`).
- Navigate to **Pending Approvals**.
- Open the newly submitted expense from the employee.
- Highlight the split view: On one side, the extracted receipt details and currency conversion; on the other side, the image of the receipt for visual verification.
- Click **Approve**.

**Narration / Voiceover:**
> "Now, logging in as the assigned Manager, we can see the expense immediately pops up in the Pending Approvals queue. 
>
> The manager is presented with all the details they need: the original receipt image alongside the OCR-extracted data and the standardized currency conversion. Reviewing is seamless. With a single click, the manager approves the expense, moving it along our previously defined sequential workflow."

---

## 🎬 Scene 5: Audit Trail & Conclusion (3:30 - 4:15)

**Visuals:**
- Log back in as the Admin (or stay on the Manager view if history is visible there).
- Open the **Expense Detail / Approval History** for the approved expense.
- Scroll through the detailed timeline showing who approved what and when.
- Return to the main Dashboard to conclude the video.

**Narration / Voiceover:**
> "Finally, accountability is incredibly important for financial applications. Every single action—from the initial OCR scan to currency conversion and every approval step—is logged securely in the database. The system provides a transparent audit trail for every expense claim.
>
> Thank you for watching this brief walkthrough of the Reimbursement Management System."
