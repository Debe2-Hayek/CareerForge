# CareerForge workshops and verifiable certificates (requirement R4)

Migrations `202611250005_certified_workshops.sql` and `202611250006_workshop_save_fix.sql`. No AI.

## Who does what

| Person | Can | Cannot |
| --- | --- | --- |
| Admin (`/admin/workshops`) | Create and edit workshops, assign the trainer by account email, record the trainer agreement reference, record attendance, issue and revoke certificates | Sign agreements for anyone (only a reference to the signed agreement is recorded) |
| Trainer (any account an admin assigns; `/account/certificates` → "Workshops you teach") | See their roster, record attendance and scores once the session starts, issue certificates once it ends | Revoke certificates, edit the workshop, see other workshops' learners |
| Learner (`/account/certificates`) | Enroll before the start (choosing whether their name shows on the public check), leave before the start, see their certificates | Issue, change or see anyone else's records |
| Anyone with a certificate id (`/certificates/<id>`) | See the workshop, certificate type and result, dates, trainer name, issue date, revocation state, and the holder's name only if they agreed | See anything else |

## Rules enforced by the database

- Certificates are issued only after the workshop ends, only with an assigned trainer and a recorded
  agreement reference, only to enrolled learners marked present, and for assessed workshops only at or
  above the pass mark. One certificate per learner, ever (unique per enrollment). Attendance and scores
  are locked once the certificate exists; a mistake is corrected by revoking (admin, with a reason).
- The certificate type and pass mark cannot change once certificates exist.
- The certificate text is fixed: "Attended the full workshop" or "Passed the workshop assessment:
  85/100 (pass mark 70)". Every page shows: "A CareerForge workshop certificate is not an accredited
  qualification, a degree or proof of professional mastery."
- The holder's name is copied onto the certificate at issue time only if they agreed; otherwise the
  public check says the holder chose not to show it.
- Every action is logged in `workshop_events` (created, updated, trainer assigned, enrolled, withdrew,
  completion marked, issued, revoked).
- Clients can only read; every write goes through functions that check the role per workshop. The
  agreement reference is not readable by learners (column grant).
- Valid certificates appear on the holder's checked-profile page (`/v/<id>`) under "CareerForge
  certificates", linked to their public check; revoked ones disappear at once.

## Checks

- Unit: `src/lib/certified-workshops.test.ts` (form rules, who qualifies, all three endpoints).
- Live on development: `scripts/verify-workshop-certificates-live.mjs`. An admin creates an assessed
  workshop (pass mark 70, 3 seats) and assigns a trainer; three learners enroll (one hides their name),
  a fourth is refused (full); an outsider and a learner are refused when marking, issuing, reading the
  roster, inserting certificates or reading the agreement. The session times are then moved into the
  past in the database to simulate the workshop taking place. The trainer records 85, 72 and 50, is
  blocked until the admin records the agreement, then issues 2 certificates (not to the learner with
  50); issuing again gives 0; results are locked. Public checks show the name only with consent; the
  admin revokes one (trainers cannot) and its check says "Revoked" and it leaves the checked-profile
  page. Screenshots in dark, light and phone.
- Fix found by the live test: editing an existing workshop failed (an ambiguous variable name in
  `save_certified_workshop`); migration 0006 fixes it.

## Not yet

- Trainer onboarding requests (trainers are assigned by admins), certificate PDFs, and emails to
  learners. Scheduling reminders and waiting lists.
