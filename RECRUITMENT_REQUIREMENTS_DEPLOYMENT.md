# TIPON TAWAG — Setup, Connectivity and Applicant Database Deployment

## Verified repository and Google Sheet configuration

**GitHub Pages:** https://jericknoelsabang-hue.github.io/tipon-queuing-system/

**Apps Script project:** https://script.google.com/u/0/home/projects/1140JUpc5DcZ8I5zgFhXWyX-Pje0wGcde1zWEEo1Ervm0uVVCjzkwgrt5/edit

**Existing Google Sheet:** https://docs.google.com/spreadsheets/d/1S8qIM1Iw4WxHQovO5T4RaD1bzr_C36fFBX4O3Udjdik/edit

Created tabs in the **existing** workbook:
- `APPLICANT DATABASE`: 145 approved applicant fields, including repeat header labels that were supplied by the requester. Empty until actual verified applicant submissions.
- `APPLICANT_INTAKE_INDEX`: maps ticket ID to applicant reference number and database row. Empty initially.
- Existing `QUEUE`, `TRANSACTION_TYPES`, `REQUIREMENTS_CONFIG`, etc. are preserved.

The live web app is NOT fully deployed until the existing Apps Script project is updated. A GitHub push only changes the web frontend.

## Step 1 — Repair “Cannot connect to Apps Script”

1. Open the **existing** Apps Script project above. Back up the current Code.gs and any deployments.
2. Replace the existing `Code.gs` with `main/apps-script/Code.gs`.
3. Add a new script file named `IntakeDatabase`; paste the exact code from `main/apps-script/IntakeDatabase.gs`.
4. Keep other files required by the original project. The old staff-only HTML editor is no longer needed for the GitHub frontend requirement editor.
5. Run `setupTiponQueueSystem()` inside the editor and approve access to the exact workbook.
6. In **Deploy → Manage deployments**, edit the existing web app deployment. Select **New version** and Deploy; keep the existing public `/exec` URL. Do not create a different URL for the public QR pages.
7. Confirm `/exec?action=health&callback=tiponProbe` gives a JavaScript result with `ok:true`.
8. On the TIPON TAWAG **Setup** tab, test the connection. If you previously saved an incorrect URL, clear it and restore the existing deployment URL.
9. Confirm that the Staff Console shows the real waiting, active and completed records, not fallback zeros. Staff action buttons are intentionally disabled while disconnected.

**Security:** Current queue actions are exposed through the legacy public Apps Script GET/JSONP endpoint. This is not equivalent to secure staff authentication. Do not call this production-secure until access control is reviewed.

## Step 2 — Requirements Setup without management key or extra staff-only URL

The GitHub Setup has a collapsed **Recruitment Transactions** dropdown with multi-select checkboxes. The recruiter may freely choose any active recruitment transaction when entering a requirement name. The old visible `Recruiter Management Key` and `Recruiter Setup Connection (staff-only /exec)` fields are removed.

Two data modes exist:

- **LOCAL TEST MODE:** Add, Edit and Delete work on the *same browser*, saved in localStorage. These changes do **not** synchronize to Google Sheets or other devices. The seven sample requirements remain visible from the static fallback if the Apps Script requirements endpoint is outdated.
- **SHARED GOOGLE SHEETS MODE:** Sign in with Google once. The editor then directly reads/writes `REQUIREMENTS_CONFIG` through the Google Sheets API under the *recruiter's own Google account*. The Google account needs edit permission on the workbook.

To activate shared editing, the Google Workspace/Cloud administrator must:
1. Enable **Google Sheets API** in an approved Google Cloud project.
2. Configure the **OAuth consent screen** and required application verification, if applicable.
3. Create an **OAuth client ID → Web application**, adding the authorized JavaScript origin `https://jericknoelsabang-hue.github.io` and adding approved test users if the consent screen is in testing mode.
4. Copy the **public OAuth client ID** (not a secret or API key) into `googleOAuthClientId` in GitHub `config.js` and publish. No private token should be committed.
5. Sign in using **Sign in with Google to sync** in Setup. Test Add, Edit, Delete and verify the underlying Sheet values. If the Google account does not have edit rights, Sheets API returns a permission error.

**Do not interpret LOCAL TEST MODE as Google Sheets synchronization.**

## Step 3 — Applicant capture, extraction, database intake

1. Applicant selects Recruitment → selects New Hire/Rehire/other configured transaction → enters name and position.
2. **No** → ordinary queue number. **Yes** → consent, camera capture (repeatable), on-device OCR and visible requirement check.
3. Applicant reviews and confirms any legible extracted fields. Missing fields remain empty; the system must never invent birthdates or government numbers.
4. The queue backend issues the ticket number and a short-lived, one-time intake capability only for a consented recruitment transaction.
5. The frontend submits **only confirmed fields**, not images or raw OCR text, using an HTTPS form POST to the existing Apps Script deployment. This operation does not send applicant fields over JSONP query parameters.
6. Apps Script validates the ticket-bound token and writes into `APPLICANT DATABASE`. The index tab prevents duplicates for the same ticket.
7. If the backend does not return an intake token or if POST fails, the receipt must **explicitly state that applicant data was not synchronized**.

Pilot extraction covers only carefully labeled fields such as Date of Birth, Gender, Civil Status, Nationality, SSS No., PhilHealth No., Pag-IBIG No. and TIN. Other columns remain blank until supplied and verified. **No camera image or document scan is stored in Google Drive.**

## Current technical limitations

- Apps Script deployment and Google OAuth client configuration require manual project-owner actions. ChatGPT's connected GitHub/Google Drive tools cannot redeploy this Apps Script project.
- The online browser OCR recognizer is **not equivalent to an official document authenticity check** and can misread small/blurred text or document numbers.
- A live end-to-end test with synthetic documents and approved Google accounts is required to confirm Apps Script form-POST response behavior, camera permission, Google Sheets writes, long-running kiosks, Google OAuth popup, and queue deduplication.
- Do not upload genuine documents until privacy notice, role restrictions, retention, deletion and incident response are approved. The `APPLICANT DATABASE` tab contains sensitive identifiers, so its sharing must be restricted to approved recruiters.
- Neither Be My Eyes nor a paid OpenAI Vision API is connected in this change. Browser OCR does **not** incur OpenAI API charges.

**Operational gate:** Not yet approved for production. Do not describe it as fully functioning until deployment and integration QA pass.
