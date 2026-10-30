# tipón — Applicant & Member Queuing System

**Live app:** https://jericknoelsabang-hue.github.io/tipon-queuing-system/  
**QR page:** https://jericknoelsabang-hue.github.io/tipon-queuing-system/join.html  
**Backend source:** [apps-script/Code.gs](apps-script/Code.gs)  
**Google Sheets database:** [TIPON Queuing Database](https://docs.google.com/spreadsheets/d/1S8qIM1Iw4WxHQovO5T4RaD1bzr_C36fFBX4O3Udjdik/edit)

This is a QR-based queuing system for **recruitment applicants** and **cooperative members with concerns**. The public QR page does not expose TV Display, Staff Console, or Setup navigation.

## Main workflows

1. Scan the TV QR code and select Recruitment or Member Concern.
2. For Recruitment, choose an active transaction type and enter the position. For Member Concern, type the concern.
3. Provide first and last name and select **Get Queue Number**.
4. See the confirmed NH / RH / TR / MC ticket, then choose **Register Another Applicant / Member** or **Done**. Done attempts to close the tab; browsers only allow programmatic closing for tabs that were script-opened. QR-opened tabs usually remain open and show a clear completion message while retaining the ticket.
5. Staff use Call Next, Recall, and the green Complete action. Serving tickets and queue history are stored in Google Sheets; duplicate active first-and-last names receive the same daily ticket.
6. TV Display shows the scan code, NOW SERVING windows, UP NEXT, and a scrolling announcement with a fixed **ANNOUNCEMENT** label. The call banner is removed. On supported browsers, each Call/Recall speaks its queue announcement three times after sound is enabled on the device.

### Setup

- **Get Queue Page** link lives in Setup, not the TV navigation or below the QR code.
- Manage service windows, assigned transaction, recruiter, and active windows.
- Manage transaction types with Edit, Delete (deactivate) and Restore. The **Add Transaction Type** button on the right opens an inline form; the fields are hidden until requested.
- TV Announcement can store up to **2,500 characters** once the Federation v8 Apps Script backend is deployed. Longer messages are transmitted to Apps Script in smaller chunks, then committed together.
- Refresh Queue, Enable/Test Sound, Save Connection, and Test Connection are in Setup.
- The Waiting and Completed Queue tables show 10 rows per page, with row counts underneath.

## IMPORTANT: Deploy the Google Apps Script backend separately

**Pushing to GitHub changes the GitHub Pages frontend only. It does not deploy the Apps Script web app.** The latest optimized backend source reports `federation-v9`.

1. Open the **existing** Google Apps Script project linked to your TIPON Queuing Database.
2. Back up the current `Code.gs`, then replace it with the entire [latest Code.gs](apps-script/Code.gs).
3. Save the project, select `setupTiponQueueSystem` and run it once. Grant the required authorization. This initializes sheet headers/defaults without deleting the existing queue.
4. Select **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy** to update the existing `/exec` deployment.
5. In the web app, go to **Setup → Test Connection** and confirm **Federation v9**.
6. Test registrations and staff actions using test accounts before real applicants or members.

**Compatibility:** The frontend accepts Federation v7 and v8 for basic queue actions, registration, and staff operations. Federation v8 supports long announcements; Federation v9 optimizes ticket creation, stores queue-row references to speed up Complete/Recall, and briefly caches status reads with invalidation on writes.

## Minimum functional acceptance checks

- **Recruitment:** Select transaction, enter position, generate a ticket on mobile, and verify the same record in `QUEUE`.
- **Member Concern:** Enter a free-text concern and confirm an MC ticket is created.
- **Duplicate:** Register the same first and last name again while a queue ticket remains active. Check the same number is returned.
- **Done:** Verify script-opened tabs close where allowed; QR/camera tabs should display the finished fallback without losing the queue number.
- **Staff:** Call/recall/complete a test ticket; verify TV Display and Google Sheets reflect the change. The Staff Console must stay open even if a request times out; it must not redirect to Setup.
- **Configuration:** Edit a window's assigned transaction/recruiter; confirm the value persists after refresh.
- **History:** Deactivate and restore a test transaction type without losing previous queue records.
- **TV Announcement:** Save a message over 280 characters (up to 2,500), then confirm it appears on the TV and remains after refresh. Test three clear voice calls on devices where sound has been enabled.
- **Display:** Verify buttons, window centering, the fixed announcement label, and mobile/tablet layout.

## Google Sheets tabs

| Tab | Role |
|---|---|
| `QUEUE` | Ticket IDs, statuses, names, transaction, queue dates, recruiter, and timestamps |
| `WINDOWS` | Active ticket and service-window information |
| `TRANSACTION_TYPES` | Transaction code, name, active state, and order |
| `SETTINGS` | Announcements, recruiter names, per-window assignments |
| `PRECHECK` | Legacy tab; no pre-screening checklist in new registrations |
| `MPC_CONFIG` | Legacy compatibility tab; no MPC selection in current user flow |

## Security and production readiness

The current setup uses a public GitHub Pages frontend with a JSONP/GET Apps Script endpoint and **no authenticated staff access**, following earlier user requirements. A separate QR page and hidden navigation do not provide authorization. Anyone with the endpoint URL may potentially read queue details or execute staff actions. Do **not** use it for unrestricted sensitive production data until staff authentication, role authorization, HTTPS POST writes, and data-access restrictions are implemented.

The local tests verify source syntax, UI mappings, and simulated Google Sheets operations; they **do not verify** the deployed Apps Script instance, cross-device synchronization, browser behavior, or production performance.
