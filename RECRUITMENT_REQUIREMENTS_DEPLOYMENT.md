# TIPON TAWAG — Production Integration Checklist (Nov 2026)

## Status of GitHub / Google Sheets / Apps Script

- GitHub frontend: editable source on `main` after merge.
- Google Sheets: the existing **TIPON Queuing System Database** is updated in place:
  https://docs.google.com/spreadsheets/d/1S8qIM1Iw4WxHQovO5T4RaD1bzr_C36fFBX4O3Udjdik/edit
- The `REQUIREMENT_SCANS` tab is the new destination for provisional document-check results (one row per configured requirement, linked to a QUEUE ticket).
- `PRECHECK` and `APPLICANT_EXTRACTIONS` were verified header-only/empty and deleted. The updated backend no longer recreates them.
- `QUEUE`, `WINDOWS`, `TRANSACTION_TYPES`, `SETTINGS`, `REQUIREMENTS_CONFIG`, `REQUIREMENT_SCANS`, `APPLICANT DATABASE`, and `APPLICANT_INTAKE_INDEX` are retained and formatted.
- **No applicant document photo is uploaded to Google Drive or Google Sheets.** Only preliminary scan statuses and photo count may be stored after a queue ticket is issued.
- The old 145-field applicant database is preserved, but document OCR no longer displays a lengthy personal-information review form or fills those 145 fields automatically.

## Required deployment in existing Google Apps Script

Project:
https://script.google.com/u/0/home/projects/1140JUpc5DcZ8I5zgFhXWyX-Pje0wGcde1zWEEo1Ervm0uVVCjzkwgrt5/edit

1. Back up the current Apps Script project and Google Sheet.
2. Replace **Code.gs** using `apps-script/Code.gs` from GitHub `main`.
3. Add/update a `IntakeDatabase.gs` script file from `apps-script/IntakeDatabase.gs`.
4. Add a new `ScanReports.gs` script file from `apps-script/ScanReports.gs`.
5. Save the project and run `setupTiponQueueSystem()` once. Authorize access to the existing Google Sheet.
6. Go to **Deploy → Manage deployments → Edit existing web app → New version → Deploy**. Reuse its current `/exec` link.
7. In TIPON TAWAG **Setup**, click **Reconnect Using Default**, then **Test Connection**.
8. With fabricated sample documents and an approved test account, generate a Recruitment queue number after choosing Yes, accepting consent, capturing images and completing OCR. Confirm the new `REQUIREMENT_SCANS` rows have matching Ticket ID, Queue No, Requirement Name, Scan Status, photo count note, and Recruiter Review = PENDING. **No photo URLs or raw OCR text should appear.**
9. Test OCR success, OCR-network failure, No/skip, Member Concern, duplicate same-day names, expired tokens, multiple pictures and iPhone camera. Confirm no sheet row is inserted when the backend did not acknowledge the POST.
10. **Do not process actual applicant identification documents until appropriate privacy, access controls and retention policies are approved.**

If a QR ticket is issued but the scan results are not stored, the receipt will tell the applicant to have the recruiter check original requirements. Inspect Apps Script execution logs and confirm that the deployed version includes the new POST action. A GitHub push by itself does not deploy Apps Script.

## Document scanning technology

The browser uses **Tesseract.js OCR**, with a second CDN/worker option for cases where the first worker is blocked. This reads visible text **on the applicant's device** and compares it to the recruiter-defined Recognition Search Terms.

This does **not** use Be My Eyes or Be My AI: there is no confirmed, generally available consumer Be My AI document-scanning API for direct embedding in this project. Be My Eyes business integration would require a separate commercial agreement and approved integration. Browser OCR is not an authenticity test; results are only preliminary and always require recruiter verification.

For failed OCR, statuses must say `SCANNER_UNAVAILABLE`, not `POSSIBLE_MATCH` or `COMPLETE`.

## How to play the TV queue instructions

A separate `QUEUE_GUIDE` message is initialized in the SETTINGS tab. It does not replace the scrolling TV announcement.

1. On the physical TV computer, open TIPON TAWAG and click **Enable / Test Sound** once (browser audio needs a user gesture). Keep the TV Display page open.
2. On the staff/setup device, use **Setup → TV Controls → Play Queue Instructions on TV**. The new backend `playQueueGuide` action adds a rate-limited cue in SETTINGS.
3. The TV polls state and plays the instruction script using the TV browser's installed speech-synthesis voice. Some browsers may lack a natural Filipino voice; verify local pronunciation.
4. Use **Edit Instructions** to change the message, then Save. Google Sheets synchronizes it after Apps Script deployment.

The old scrolling announcement remains editable under **TV Announcement**. Voice announcements only reach a different TV device when both devices are connected to the updated Apps Script backend. Test actual audio on the TV.

## Known security and production limitations

The legacy staff-control API still uses anonymous GET/JSONP. New TV guidance actions are rate-limited but are not a substitute for proper staff authentication. The new scan-report POST requires a short-lived ticket-linked token and consent, but the entire app still requires a security review.

The current code has been checked at source level, not end-to-end against the user's live Apps Script environment. Until Apps Script deployment, the new Google Sheets scan synchronization and remote TV speech features remain **pending activation**. The local OCR scan and UI changes can be tested immediately after GitHub Pages deploys.
