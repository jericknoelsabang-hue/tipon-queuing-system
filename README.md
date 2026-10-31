# tipón TAWAG — Applicant & Member Queuing System

**Bawat tawag, may malasakit.** A friendly queue experience for applicants and cooperative members.

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
5. Staff use Call Next, Recall, and the green Complete action. Serving tickets and queue history are stored in Google Sheets; the same normalized first + last name **and transaction** receive a single ticket on the same Philippine calendar day, including after completion.
6. TV Display shows the scan code, NOW SERVING windows, UP NEXT, and a scrolling announcement with a fixed **ANNOUNCEMENT** label. The call banner is removed. On supported browsers, each Call/Recall speaks the **ticket number first**, without the word "Queue," three times after sound is enabled on the device.

### Setup

- **Get Queue Page** link lives in Setup, not the TV navigation or below the QR code.
- Manage service windows, assigned transaction, recruiter, and active windows.
- Manage transaction types with Edit or direct Delete, without confirmation popup. Deleted types disappear immediately from active Setup lists, are hidden from public registration, and keep their historical records in Google Sheets. Restore is not shown in the interface. The **Add Transaction Type** button on the right opens an inline form.
- TV Announcement can store up to **2,500 characters** once the Federation v8 Apps Script backend is deployed. Longer messages are transmitted to Apps Script in smaller chunks, then committed together.
- Refresh Queue, Enable/Test Sound, Save Connection, and Test Connection are in Setup.
- The Waiting and Completed Queue tables show 10 rows per page, with row counts underneath.

## IMPORTANT: Deploy the Google Apps Script backend separately

**Pushing to GitHub changes the GitHub Pages frontend only. It does not deploy the Apps Script web app.** The latest backend source reports `federation-v10`.

1. Open the **existing** Google Apps Script project linked to your TIPON Queuing Database.
2. Back up the current `Code.gs`, then replace it with the entire [latest Code.gs](apps-script/Code.gs).
3. Save the project, select `setupTiponQueueSystem` and run it once. Grant the required authorization. This initializes sheet headers/defaults without deleting the existing queue.
4. Select **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy** to update the existing `/exec` deployment.
5. In the web app, go to **Setup → Test Connection** and confirm **Federation v10**.
6. Test registrations and staff actions using test accounts before real applicants or members.

**Compatibility:** The frontend retains compatibility with Federation v7–v9, but **daily name + transaction deduplication and four-digit numbers require Federation v10 to be deployed**. Federation v10 includes improved Complete writes, source-level sheet header styling, and the existing short-lived queue-state cache.

## Minimum functional acceptance checks

- **Recruitment:** Select transaction, enter position, generate a ticket on mobile, and verify the same record in `QUEUE`.
- **Member Concern:** Enter a free-text concern and confirm an MC ticket is created.
- **Duplicate:** Register the same name and transaction multiple times (WAITING, SERVING, and COMPLETED). It must return the same ticket for that day. Change the transaction and verify a different number. Change the Philippine date and verify the series restarts at `0001`. Historical ticket numbers must not be rewritten.
- **Done:** Verify script-opened tabs close where allowed; QR/camera tabs should display the finished fallback without losing the queue number.
- **Staff:** Call/recall/complete a test ticket; verify TV Display and Google Sheets reflect the change. The Staff Console must stay open even if a request times out; it must not redirect to Setup.
- **Configuration:** Edit a window's assigned transaction/recruiter; confirm the value persists after refresh.
- **History:** Delete a test transaction type without any dialog, confirm it disappears from Setup and new registration choices, and verify the Sheet retains previous records (inactive type is retained, but hidden from UI).
- **TV Announcement:** Save a message over 280 characters (up to 2,500), then confirm it appears on the TV and remains after refresh. Test three clear voice calls on devices where sound has been enabled.
- **Display:** Verify buttons, window centering, fixed announcement label, branded title/favicon, and mobile/tablet layout. Refresh on Staff Console and Setup to ensure the same page is restored.


## October 31 release: Cooperative-centered polish

- New presentation identity: **tipón TAWAG**, tagline **“Bawat tawag, may malasakit.”** The name is a product concept derived from tipón's member-centered and concern-for-others values, not an official new Federation brand.
- Updated header, registration screen, multi-color accents, scalable favicon, and high-resolution wordmark asset.
- Active workspace persists across browser refresh through the URL `?view=staff` or `?view=setup` and sessionStorage.
- Voice calls begin with the number (e.g., MC-0001) and continue to repeat three times. No spoken "Queue" prefix.
- Queue codes now use `NH-0001`, `RH-0001`, `MC-0001`, etc. Sequences reset **per transaction, per Philippine calendar day**. Old three-digit numbers are preserved.
- The native Google Sheet has improved column widths, a frozen header, readable date-time formats, status highlighting, and a documented deduplication rule under SETTINGS.
- To activate the new numbering, name/transaction duplicate rule, and Complete changes, **deploy the latest Apps Script source** to the existing `/exec` deployment.

## Google Sheets tabs

| Tab | Role |
|---|---|
| `QUEUE` | Ticket IDs, statuses, names, transaction, queue dates, recruiter, and timestamps |
| `WINDOWS` | Active ticket and service-window information |
| `TRANSACTION_TYPES` | Transaction code, name, active state, and order |
| `SETTINGS` | Announcements, recruiter names, per-window assignments |
| `PRECHECK` | Legacy tab; no pre-screening checklist in new registrations |
| `MPC_CONFIG` | Legacy compatibility tab; no MPC selection in current user flow |

## Fullscreen QR and synchronization (October 30 polish)

- The fullscreen TV QR dynamically fills its white panel, leaving moderate side gutters and a scan-friendly white quiet zone. The QR bitmap is rendered at 640×640 source resolution and scaled with CSS for high-DPI displays; applicant/member instructions are larger on the TV.
- **Near-real-time polling:** while visible, TV fullscreen requests queue state approximately every **2 seconds**, standard TV and Staff Console every **2.5 seconds**, and Setup approximately every **6.5 seconds**. Requests are serialized, older responses after navigation/writes are discarded, background tabs pause polling, and errors retry with backoff.
- **Google Apps Script source improvement:** the latest `Code.gs` keeps a **2-second** server-side cache for state snapshots (instead of 4), clearing it on successful writes. On longer queue histories, TV/Setup reads only the necessary current-day queue rows rather than every column of all historical tickets. The Staff Console still includes historical completed tickets.
- **Deployment:** the frontend improvements ship through GitHub Pages. To activate the backend cache improvement, deploy a **new version of the existing Apps Script web app** using the latest `Code.gs` while retaining its `/exec` URL. The API version remains `federation-v9`; no schema reset or migration is needed.
- **Expectation:** Google Apps Script and Google Sheets do **not** provide websocket-style push notifications. Updates will appear on subsequent polls, normally within a few seconds when connected, depending on Apps Script latency and quotas. This is not guaranteed subsecond realtime.
- **Branch cleanup:** `queue-visual-fixes-20261030-v7` has already been fully included in `main`. It is safe to remove from **GitHub → Branches** when no longer needed; its recent-push banner is GitHub UI and is not part of the queuing app.

## Security and production readiness

The current setup uses a public GitHub Pages frontend with a JSONP/GET Apps Script endpoint and **no authenticated staff access**, following earlier user requirements. A separate QR page and hidden navigation do not provide authorization. Anyone with the endpoint URL may potentially read queue details or execute staff actions. Do **not** use it for unrestricted sensitive production data until staff authentication, role authorization, HTTPS POST writes, and data-access restrictions are implemented.

The local tests verify source syntax, UI mappings, and simulated Google Sheets operations; they **do not verify** the deployed Apps Script instance, cross-device synchronization, browser behavior, or production performance.
