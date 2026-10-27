# Demo developer profiles

From the backend folder, run:

```sh
node scripts/seed-demo-users.js
```

The script uses `MONGODB_URI` from the backend `.env` and inserts these fictional accounts:

| Name | Email | Experience |
| --- | --- | --- |
| Alex Morgan | alex.morgan@demo.skillconnect.test | Intermediate |
| Priya Sharma | priya.sharma@demo.skillconnect.test | Advanced |
| Sam Patel | sam.patel@demo.skillconnect.test | Beginner |
| Maya Chen | maya.chen@demo.skillconnect.test | Intermediate |
| Jordan Brooks | jordan.brooks@demo.skillconnect.test | Advanced |

Their shared demo password is `SkillConnectDemo123!`. Set `DEMO_SEED_PASSWORD` in your environment before the first run if you want a different one. Each account stores its own salted bcrypt hash; the script never prints passwords or hashes.

These placeholder addresses have no inbox. The trusted script marks the demo accounts verified without sending emails. Normal signup still requires email OTP verification. Forgot-password email delivery cannot be used for these placeholder addresses.

Profiles include original, embedded SVG avatars, bios, skills, interests and adult dates of birth. They are free members. No frontend image hosting, real people, external image requests, payment activity or email delivery is involved.

Rerunning keeps existing seeded profiles, passwords and timestamps unchanged. A hidden immutable `demoSeed` marker and unique email index prevent the script from updating unrelated accounts, even if an email matches. There are no deletion operations, resets of existing relationships, new dependencies or npm scripts.

The profiles appear in Discover unless the signed-in user already has a connection/request with them or has passed them. Log in as a different demo account in a separate browser profile to try requests and chat.
