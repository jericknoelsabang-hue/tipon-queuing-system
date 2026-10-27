# TIPON Queuing System

QR-based recruitment/member-service queuing system for GitHub Pages + Google Sheets.

## Features
- QR registration from phone
- MPC selection
- Default transactions: **NH - New Hire**, **RH - Rehire**, **TR - Transfer**
- Staff can add new transaction types
- Same normalized **First Name + Last Name** reuses the same active queue number on the same day
- Dynamic service windows with **Add Window**
- Call Next / Recall / Complete
- TV display with waiting queue
- Ding + browser voice announcement
- Central Google Sheet database

## Google Sheet
`TIPON Queuing System Database`

https://docs.google.com/spreadsheets/d/1S8qIM1Iw4WxHQovO5T4RaD1bzr_C36fFBX4O3Udjdik/edit

Tabs:
- `QUEUE`
- `WINDOWS`
- `TRANSACTION_TYPES`
- `MPC_CONFIG`
- `SETTINGS`

## Required one-time Apps Script setup
1. Open https://script.google.com and create a new project named **TIPON Queuing Backend**.
2. Replace `Code.gs` with the complete file in `apps-script/Code.gs` from this repository.
3. Run `setupTiponQueueSystem` once and approve Google authorization.
4. Change the default staff PIN by running `setTiponStaffPin` from a bound copy or temporarily change `TIPON_STAFF_PIN` through Script Properties. If using the standalone project, the default PIN is `1234` until changed.
5. Deploy -> New deployment -> Web app.
   - Execute as: **Me**
   - Who has access: **Anyone** (or the widest option permitted by the Workspace)
6. Copy the deployed URL ending in `/exec`.
7. Open the GitHub Pages app -> **Setup** -> paste the `/exec` URL -> **Save on This Laptop** -> **Test Connection**.
8. On the TV/laptop display, click **Enable / Test Sound** once so browser audio announcements are allowed.

The display QR automatically includes the saved backend URL, so applicants who scan the QR use the same central Google Sheet without needing their own setup.

## GitHub Pages
Repository: https://github.com/jericknoelsabang-hue/tipon-queuing-system

Enable: **Settings -> Pages -> Deploy from a branch -> main -> /(root) -> Save**.

Expected URL:
https://jericknoelsabang-hue.github.io/tipon-queuing-system/

## MPC logos
Put a public HTTPS image URL in `MPC_CONFIG` -> `Logo URL`. If blank, the app shows an MPC code badge instead of pretending a placeholder is the official logo.
