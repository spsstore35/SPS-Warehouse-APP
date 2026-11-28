# Auth + RLS setup (for the owner, step by step)

Goal: real logins (Supabase Auth), and every rule enforced inside the database.
The OLD site keeps working until Step 8 (the "switch"). Steps 1-7 are safe.

## What changed (files)
- `supabase/migrations/20261202_auth_rls_v3.sql` : ONE file, two parts (see below)
- `supabase/migrations/20261202_auth_rls_v3_ROLLBACK.sql` : undo
- `supabase/functions/auth-gate/` : login + signup with rate limits, captcha, logging
- `supabase/functions/admin-users/` : full_admin creates / resets / deletes accounts
- `supabase/functions/notify-push/` : now checks the caller's role
- `src/services/authService.ts`, `src/components/Captcha.tsx`, `AuthScreens.tsx`, `ChangePasswordModal.tsx`, `App.tsx`, `supabaseService.ts`, `utils/security.ts`
- `server.ts` : push endpoints now need a signed-in admin
- Seed migration 20261127: placeholder admin removed. No passwords or hashes in the repo.

## Where the rules live (in the database)
- Nobody changes their own role or teams: trigger `guard_profile_update` + only `full_admin` can write `user_teams` (function `admin_set_user_teams` refuses your own id).
- Self-approval: full_admin, and the team_admin of THAT team, may approve their own requests. Enforced by guard triggers on `team_change_requests` / `adjustment_requests`.
- Leaders never see quantities: they cannot read `product_variants` at all. They read the view `leader_product_variants` (no quantity column).
- Default deny: RLS is on for every table; `anon` has no access.
- Role names: `admin` = team_admin, `worker` = staff (no enum change needed).

## Names are NOT changed
The migration only ADDS: tables `teams`, `user_teams`, `security_events`, view `leader_product_variants`, helper functions. It does not rename, drop or retype any existing table or column (checked by comparing the column list before and after on a copy built from the repo schema). Old `profiles.password_hash` stays as a column (emptied at the switch, old values saved in `private.legacy_password_hashes`). `profiles.assigned_teams` stays and is kept in sync from `user_teams`.
New in the database after the switch: `profiles.id` must match a Supabase Auth user (foreign key). Existing rows and data are kept.

## Steps
0. FIRST (read-only, safe): run `supabase/preflight_schema_check.sql`. Empty result = your database has every table/column the repo expects. Anything listed = tell us before going on. Do the whole process on a staging copy first (Supabase branch or a restored backup), not production.
1. Supabase > SQL editor: paste the whole `20261202_auth_rls_v3.sql` and Run. (Part 1 only: adds tables and functions, copies your users into Supabase Auth. The site still works.)
2. Make yourself full_admin: `select private.make_full_admin('your-email-or-username');`
   (If you have no account yet: `select private.create_first_admin('email','a-long-password','Your Name');`)
3. Deploy the 3 Edge Functions (Supabase > Edge Functions, or CLI `supabase functions deploy auth-gate --no-verify-jwt`, `admin-users`, `notify-push`). `auth-gate` must have "Verify JWT" OFF. Set secret `ALLOWED_ORIGIN` = your site URL. Optional: `TURNSTILE_SECRET_KEY`.
4. Auth dashboard: turn OFF "Allow new users to sign up" (signups go through auth-gate), set rate limits, optionally enable captcha (Cloudflare Turnstile) and put the site key in Vercel as `VITE_TURNSTILE_SITE_KEY`.
5. Open the Vercel PREVIEW of this branch and test every role (table below). The preview needs the switch to be done to show full protection; before the switch, logins already work through Supabase Auth with the same passwords.
6. Users whose old password was stored without a bcrypt hash (old SHA-256 / none) cannot sign in. Reset them as a full admin: Account Approvals > the blue key button on the account row > type a new password (min 8 characters) > Set password. Or use Supabase > Auth > Users. There is no forced change at first login; each person can change their own password from the account menu.
7. Merge the PR when you are happy (Vercel deploys the new frontend).
8. THE SWITCH (do it right after the merge, a few minutes of short outage possible):
   `insert into private.app_settings(key,value) values ('allow_lockdown','yes') on conflict (key) do update set value='yes';`
   then run `20261202_auth_rls_v3.sql` again. It aborts safely if there is no active full_admin. It moves old hashes to a private table, drops the old "public" policies, turns on RLS everywhere.
9. Later: confirm everything works for a few days, then delete `private.legacy_password_hashes`.

## Rollback
Run `20261202_auth_rls_v3_ROLLBACK.sql` (restores old hashes, reopens tables), re-run `20261128`, and redeploy the previous frontend.

## Test plan (after the switch; look at blocked attempts with `select * from security_events order by created_at desc;`)
| Role | Should work | Must fail |
|---|---|---|
| full_admin | everything, approve accounts, set teams/roles of others | change own role/teams |
| team_admin (right team) | approve that team's requests, also their own | approve another team's request, change own role |
| team_admin (wrong team) | - | approve requests of other teams |
| staff | view + edit allowed fields, create requests | self-approve, edit price/SKU/quantity directly, change role |
| leader | see products + prices | see any quantity (check network tab: no `quantity`), read product_variants |
| pending user | sign up | log in / read anything |
| wrong password x5 | message "too many attempts" | login keeps working during the lockout window |
| not signed in | - | read any table with the public key (should return nothing/401) |

## Order rules (Client Bookings)
- Create / edit / delete an order directly: full_admin or the team_admin of Scout Fera2 (`troops`). Nobody else.
- ORDER requests (create/edit/delete): ONLY staff of Scout Fera2 (`troops`). DEPOSIT/PAYMENT-check requests: staff of Scout Fera2 AND staff of budgeting. No other staff. Any of the three admins (full_admin, Fera2 admin, budgeting admin) can confirm directly or approve a payment request.
- Approve a staff order request: troops team_admin or full_admin.
- Confirm a deposit/payment (this also takes stock): full_admin, troops team_admin, or budgeting team_admin. Admins of other teams cannot.
- Budgeting members see Orders read-only.
- After a deposit or payment is confirmed, the order details, items and deletion are locked for everyone (enforced in the database, not only the screen). Only status steps (delivered etc.) by a troops admin / full_admin, and stock-ready marking, still work.
- Purchases/inventory admins mark an order ready through `mark_booking_ready()` (they cannot read orders).

## How stock changes work (checked on a test copy)
Stock is taken for an order when the deposit is confirmed (any %), and added when purchased goods arrive. Delivery/handover does not change stock. These steps are done by admins of other teams (budgeting, troops, purchases), who cannot edit `product_variants` directly. So the database function `apply_stock_change` does them with checks:
- `order_deduction`: full_admin, or team_admin of budgeting / troops / inventory. Only reduces stock.
- `batch_stock_in`: full_admin, or team_admin of purchases / inventory, for a real purchase/production batch. Only adds stock.
- Staff, leaders and other teams are refused. Direct edits of quantity stay inventory-admin only.
Run Part 1 BEFORE deploying the new site (the site calls this function).

- Short stock: if an order needs 50 and 30 are in stock, the deposit confirmation takes the 30 and remembers the 20 still owed (`order_stock_owed`). When the purchase batch linked to that order is received (e.g. 100), the app first shows a notice ("20 of these 100 go to order #X, stock goes up by 80") and only then saves. The database takes the 20 from the received goods in the same step (`receive_batch_stock`). Only the batch linked to the order does this; an unlinked batch just adds stock.

- Minimum purchase quantity: a purchase batch linked to an order cannot have a quantity below what that order still needs for that item (checked on the screen AND in the database). 20 or more is fine.

- "Needs action" box: paid orders still waiting for stock are listed on the home screen and the Sourcing screen (`list_order_shortages()`), e.g. "Order #12 (client) needs 20 x Shirt (S)". Only the full admin and the purchases admin get a "Start purchase" button that opens a form with item, size and the quantity prefilled (minimum = amount owed). Other members of troops/budgeting/inventory/purchases see it read-only.

- Low stock in the same box: a variant whose stock is at or below its own minimum (the existing `minThreshold`) is listed, with a "Start purchase" button (any quantity, vendor picker as above) until a purchase for it is running.

- Batch "Steps & costs" (Sourcing screen, button on each batch): per stage start/finish dates, days taken, vendor, notes and cost lines (bought / transport with from-to / other). Shows total cost, finished pieces, cost per piece, total days and a comparison with the previous batch of the same item. Saved inside the batch's existing stage data (no database change). Edit: purchases admin and full admin; others view only.

- Ready-made purchases (Sourcing batch form, items with the ready-made flow): units per box, number of boxes (pieces are calculated) and the supplier's lead time for this order (days, typed each time, sets the target date). Stored on the supplier stage of the batch (no database change). The default ready-made flow is now supplier then stock-in (packaging can still be added per item).

- Delivery estimate: for an order with missing stock, the order page and the Needs action line show "Estimated delivery: ~N days (+safety) = date". N is the slowest earlier finished batch of the same item/size (Steps & costs dates, else batch start to stock-in). No history: "no data yet" and he types his own days. Safety days default 14 and can be changed (remembered on that device).
- Vendors, prices, stages and batches in Sourcing: edited directly only by the purchases admin and the full admin (same as the database). Purchases staff send a request that the purchases admin or full admin approves.

## Known limits
- A multi-row INSERT in one statement bypasses the per-minute throttle count.
- Blocked order attempts are not logged (the error rolls the log row back).
- Per-team roles are supported in the database; the approval screen still assigns one role.
- Approval queues are `team_change_requests` and `adjustment_requests` (no separate approval_requests table).
- A new order's stock is taken just before its items are saved, so the per-order amount check only applies once items exist.
- `/api/budgeting/claim` (first-run passcode) is still unauthenticated: follow-up.
