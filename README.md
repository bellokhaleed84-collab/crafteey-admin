# Crafteey Admin

Internal admin dashboard for approving/rejecting technician applications.
Shares the same Firebase project and MongoDB database as the technician app
(fixteq-technicians-portal).

## Setup

1. Install dependencies:
   npm install

2. Create your real env file:
   - Copy `.env.local.example` to `.env.local`
   - Fill in the SAME Firebase and MongoDB values used in your
     fixteq-technicians-portal/.env.local
   - Add ADMIN_EMAILS — a comma-separated list of emails allowed to log in
     as admin, e.g. ADMIN_EMAILS=you@example.com

3. Create an admin user in Firebase:
   - Go to Firebase Console -> Authentication -> Users -> Add user
   - Use the same email you put in ADMIN_EMAILS, set a password

4. Run it:
   npm run dev

5. Open http://localhost:3000/login and sign in with the admin account
   you created. You'll land on /dashboard, which lists pending technician
   applications with Approve/Reject buttons pulling live from MongoDB.

## Notes

- If your MongoDB connection needs the non-SRV connection string format
  (some networks block the srv:// DNS lookup), use the same MONGODB_URI
  format you're already using in the technician app.
- Port conflict: if fixteq-technicians-portal is already running on
  port 3000, this app will automatically start on port 3001 instead —
  check the terminal output for the actual URL.
