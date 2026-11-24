# Invited staff identity review — 2026-11-25

## Report and findings

The user reported an HR invitation landing on Forbidden then displaying Admin, a repeated email being invited as Manager, and password setup apparently changing the original admin account's password.

Read-only inspection of Supabase project qowirmiicsrglehiaoil confirms the supplied account is an Admin. The existing HR invitation inspected remains HR in the profile, membership, and Auth metadata and has no recorded sign-in. This does not establish a live role promotion or password mutation. No live passwords, roles, invitations, or sessions were changed during this review.

Concrete code defects identified:

- Reset links were remembered only as consumed strings. A later visit could reuse any current session. Submission also checked only whether a session existed, allowing an account change between link verification and password submission to target another identity.
- Account details used a shared React Query key across users; invalidation retained the previous account's profile while fetching the next one. Authentication changes cleared list caches but retained other account/permission query caches.
- SMB login routing treated every member of an SMB tenant as an SMB owner, directing HR and Manager users toward Launch Pad.
- Several membership and pending-invitation lookups ignored database errors. Current duplicate checks already reject an existing tenant member, but lookup errors must not allow provisioning to continue.
- Password setup completion could locate invitations by email and overwrite their bound Auth identity.

## Changes

Reset verification now uses the identity returned directly by the link exchange. Strict Mode exchanges are shared, and reuse requires the same Auth user and session ID. Before submission the current session must still match. The password mutation uses an isolated, non-persistent Auth client pinned to the verified recovery session, preventing shared-cookie changes from changing its target. Completion sends that session's bearer token; the server validates it without falling back to another account's cookies. The page does not sign out an unrelated account that became active during submission.

Account profiles are cached by user ID and rejected if fetched for a different identity. Account changes/sign-out clear React Query caches. HR/Manager/Recruiter logins in SMB tenants go to staff home while Admin retains Launch Pad routing. Invitation eligibility fails closed on lookup errors. Setup completion accepts only invitations already bound to that Auth ID and no longer claims invitations by email.

## Verification

- Full suite: 3,364 passed, one policy-audit timeout, 22 skipped (3,387 total). The policy-audit file passed all eight tests when rerun alone. No functional assertion failure remains from that run.
- Initial focused identity tests: 21 passed. Additional final focused routing/reset/account/completion checks: 22 passed. Completion-specific tests: five passed.
- Regression scenarios include opening an invitation while Admin is signed in, switching to Admin before submitting, switching shared cookies during the mutation, revisiting an old consumed link, preserving HR identity while its profile loads, rejecting a repeated HR email invited as Manager, failed eligibility lookups, and bearer identity overriding unrelated cookies.
- TypeScript passed after all runtime changes. ESLint passed for changed files; landing-routing lint also passed.
- No schema change or database mutation was required. Advisor/log reads were reviewed; existing project findings are not represented as resolved by this patch.

## Remaining live QA

Tracked as BUG-205 through BUG-207, In Progress until deployed verification. Use separate Admin and invitee browser profiles with a real readable inbox. Verify HR and Manager each retain their assigned role, land on an authorized page, and receive only configured permissions. Reinvite an existing tenant email with different case and role and confirm 409 with no role/password change. Open a reset link with an existing Admin session, switch accounts in another tab, and confirm submission refuses the changed session. Confirm both users can still sign in with their own credentials afterward. No passwords or active reset links should be added to the tracker.

Development/staging merges remain pending the earlier all-verified release condition. This review branch is not a deployed fix.
