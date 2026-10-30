# tipón Federation — Smart Queuing System (v4)

**Live website:** https://jericknoelsabang-hue.github.io/tipon-queuing-system/  
**QR registration page:** https://jericknoelsabang-hue.github.io/tipon-queuing-system/join.html  
**Official branding reference:** https://tipon.coop/

TIPON Federation-wide recruitment and member-concerns queuing system, hosted on GitHub Pages and synchronized using Google Apps Script + Google Sheets.

## Features

- **TV Display:** Local QR generation using vendored QRCode.js, current windows, waiting queue, voice/chime, and full screen.
- **Standalone mobile registration:** TV QR links to \`join.html\`, **not** the TV dashboard.
- **Applicant pre-screening:** Recruitment candidates complete a self-checklist and submit a **PC-### pre-check reference**. This is *not* a queue number. Staff review actual documents in the Staff Console and **Approve** to issue the real NH / RH / TR ticket, or **Incomplete** with a reason.
- **Member Concerns:** MC tickets for COE, payout, membership/records, and other concerns. These bypass the recruitment document checklist and route to a dedicated Member Concerns service window.
- **Window routing:** Window 3 defaults to **Member Concerns**; other windows default to Recruitment. Staff can change any window to Recruitment, Member Concerns, or All Services.
- **Staff Console:** Document verification, Call Next, Recall, Complete, Add Window, Add Transaction Type, edit TV Announcement.
- **Setup only:** Apps Script connection errors, Refresh Queue and Enable / Test Sound controls. No technical errors are shown in the public TV Display.
- **Central Sheets:** Queue history is preserved and the Federation mode does not require MPC selection.
- **Duplicate name behavior:** Same normalized first and last name uses the same active queue number on the same day.

## From the October 30, 2026 IE meeting recap

The recruitment process was reported to have 3–4 hour waits, incomplete requirements discovered too late, and separate member concerns competing for recruiters' time.

| Proposal | Current implementation |
|---|---|
| Pre-check applicant documents before issuing recruitment tickets | **Implemented:** self-declaration plus staff verification and approval. |
| Dedicated Member Concerns service window | **Implemented:** MC transaction and configurable dedicated routing. |
| OCR / AI document extraction | **Not implemented:** future phase requiring document access, field-validation rules, privacy review, and a supported scanner/integration. |
| Measure and compare automated vs. manual window processing time | **Not yet implemented:** data already contains ticket timestamps, but analytical reporting is a separate task. |

> Document checklist contents are generic and must be validated against the official recruitment requirements for each transaction/site. Staff must inspect the original documents; checkbox self-declaration is not proof of eligibility.

## CRITICAL: backend redeployment is required

**A GitHub push updates the frontend only. The live Apps Script \`/exec\` URL continues to run its old version until the owner redeploys it.** The reported error **“Announcement not saved: Unknown action”** indicates that the deployed backend does not recognize the latest endpoint.

1. Open your existing TIPON Queuing Google Apps Script project.
2. Replace its complete \`Code.gs\` with the [current apps-script/Code.gs](apps-script/Code.gs).
3. Click Save and run \`setupTiponQueueSystem\` once; authorize Google if prompted. This initializes the \`PRECHECK\` and \`SETTINGS\` sheets without erasing existing \`QUEUE\` history.
4. Choose **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**. Reuse the existing deployment URL instead of creating a different one.
5. Open the live app **Setup**, paste the deployed Google Apps Script **/exec** URL if needed, then click **Save Connection** and **Test Connection**.
6. Verify status **Federation v4** and test registration from a **second device**.
7. On the TV computer only, go to **Setup → Enable / Test Sound**, then **TV Display → Full Screen**.

If “Unknown action” or “backend outdated” persists, the Apps Script deployment was not successfully updated. Saving Code.gs without **Manage deployments → New version** is not sufficient.

## End-to-end test

1. On a phone, scan TV QR. It must open **/join.html?api=...** (dedicated Get Queue).
2. Select **Recruitment**; complete the document self-check and submit. Phone shows **PC-001**, *not* NH-001.
3. Staff Console → Document Pre-screening → verify physical ID and documents → **Approve**.
4. Phone status changes to real ticket **NH-001**; Staff Console Window 1 (Recruitment) → **Call Next**.
5. On another phone, select **Member Concerns** → choose COE or payout issue → receive **MC-001**.
6. Window 3 (Member Concerns) → **Call Next**. Check TV sound and announcement.
7. In Staff Console, edit the Announcement. Verify it appears on TV. In **Setup**, test Refresh and Sound.
8. Verify no other existing ticket or historical sheet rows were removed.

## Google Sheet

[Open TIPON Queuing Database](https://docs.google.com/spreadsheets/d/1S8qIM1Iw4WxHQovO5T4RaD1bzr_C36fFBX4O3Udjdik/edit)

| Tab | Purpose |
|---|---|
| \`QUEUE\` | NH, RH, TR, MC ticket history; queue status and timestamps |
| \`WINDOWS\` | Active ticket per service window |
| \`TRANSACTION_TYPES\` | User-defined categories; new MC transaction added by setup |
| \`SETTINGS\` | TV announcement, per-window routing |
| \`PRECHECK\` | Self-check and staff document verification / approval |
| \`MPC_CONFIG\` | Legacy sheet retained for compatibility, not used by current queue logic |

## Accessibility, privacy and security

- The live app uses a no-PIN Staff Console **at the user's explicit request**. **This is not appropriate for unrestricted public operations without server-side staff authentication**: anyone who learns the /exec URL may invoke staff actions, and the current state endpoint exposes queue and precheck names. Restrict operations to approved staff/devices and implement authorization before handling real applicant data in production.
- QRCode.js ([MIT](vendor/qrcodejs/LICENSE)) is included locally in the repository; QR rendering does not need the previous external QR-image API.
- Audio must be enabled with a real user click on each TV browser.
- The official TIPON promotional brand image is loaded from https://tipon.coop/ and the UI has a local vector fallback if the image is inaccessible.
- The Google Apps Script JSONP endpoint transmits applicant data in request URLs. For production use, replace this with an authenticated API design using HTTPS POST and suitable access controls.

## Validation

Frontend JS parsed successfully and core Apps Script workflows (setup, duplicate prevention, pre-check submission, approval/rejection, recruitment/MC tickets, routing, announcements and recall) passed simulated Google Sheets tests. **Live Apps Script deployment and cross-device behavior remain unverified until the updated Apps Script web app is deployed and tested.**
