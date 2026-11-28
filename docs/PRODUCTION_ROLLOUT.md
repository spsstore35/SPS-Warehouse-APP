# Production rollout (nothing here has been run on production)

Production project ref: tvlfxyfbyhotqgigurec. TEST project ref starts with "jykl". Never mix them.

## The one SQL file
`supabase/migrations/20261202_auth_rls_v3.sql` is the FINAL file. It is already ONE ordered file with everything from all commits (it was applied to the TEST project; later commits were app-only). Safe to run more than once. Undo: `20261202_auth_rls_v3_ROLLBACK.sql`. Read-only pre-check: `supabase/preflight_schema_check.sql`.

### What each part does (in file order)
| # | Part | Type | What it does |
|---|---|---|---|
| 0 | preflight_schema_check.sql (separate file) | READ-ONLY | Lists missing tables/columns. Empty result = fine. |
| 1 | Part 1, lines 1-60: schema `private`, tables `teams`, `user_teams`, `security_events` | WRITE (adds only) | New tables. Nothing existing is changed. |
| 2 | Role helper functions (`app_role`, `app_is_full_admin`, `app_is_team_admin` ...) | WRITE (adds only) | Functions the rules use. |
| 3 | `admin_set_user_teams`, `admin_set_team_role` | WRITE (adds only) | Team/role changes, never your own. |
| 4 | `apply_stock_change` | WRITE (adds only) | The only checked way to change stock (deposit takes stock, batch adds, manual count). Allocates and records owed. |
| 5 | `stock_reserved_all`, `stock_adjust_preview`, `batch_receive_preview`, `list_order_shortages` | READ-ONLY functions | Show Reserved/Free, preview a count, preview a stock-in, list waiting orders. |
| 6 | `private.sync_profiles_to_auth`, `sync_user_teams_from_profiles`, `make_full_admin`, `create_first_admin` | WRITE (data) | Copies existing accounts into Supabase Auth with the same passwords; teams copied. Only runs when called/at the switch. |
| 7 | `order_stock_owed` table, `record_order_shortfall`, `mark_booking_ready` | WRITE (adds only) | Remembers pieces still owed per paid order. |
| 8 | `production_batches.extra_booking_ids`, `variant_qty` columns | WRITE (adds columns, default empty) | Merged batches and per-size batches. Old rows unaffected. |
| 9 | `receive_batch_stock` | WRITE (adds only) | Stock-in: pays owed first, leftover to other waiting orders by deposit order. |
| 10 | Guard triggers: profile, request decision, product, booking, booking items, booking delete, `guard_batch_min_quantity`, `guard_booking_delivery` (Delivered locked while owed > 0), `throttle_insert` | WRITE (adds rules) | Only act for signed-in API users. The old site (public key) is not affected until the switch. |
| 11 | View `leader_product_variants` | WRITE (adds only) | Leaders see sizes/colors/prices, no quantities. |
| 12 | Part 2 "the switch" (needs allow_lockdown = yes) | WRITE, BIG | Saves old password hashes privately, links profiles to Auth, drops the old open policies, turns on RLS everywhere, creates the new policies. The old site stops working. |

Production touches only on his explicit yes. Step 12 needs its own, separate yes.

## Rollout checklist (for the owner)
1. Say GO to start. (Nothing happens before.)
2. BACKUP first. Supabase free plan has no automatic restore, so: Supabase > Database > Backups, or on your PC run `pg_dump` with the connection string (I can give the exact command). Also export the `profiles` table to CSV. Keep the file.
3. Production credentials ONLY through a vault link I send. Never paste a password or key in chat. Ask: "GO for production vault link".
4. Confirm the project: the link's ref must be tvlfxyfbyhotqgigurec (production), not jykl... (test). Check the ref out loud before every step.
5. Run `preflight_schema_check.sql` (read-only). Empty = go on. Anything listed = stop and tell me.
6. Run `20261202_auth_rls_v3.sql` (Part 1 only runs, the switch is off). Old site still works. YOUR YES NEEDED.
7. Make yourself full_admin: `select private.make_full_admin('your-email-or-username');`
8. Deploy the 3 Edge Functions: `auth-gate` (Verify JWT OFF), `admin-users`, `notify-push`. Set secret `ALLOWED_ORIGIN` = the real site address (https://...). Optional: `TURNSTILE_SECRET_KEY`. Check the CLI is linked to tvlf, not jykl: `supabase projects list` / the linked ref.
9. Supabase Auth settings: turn OFF "Allow new users to sign up", set rate limits.
10. Vercel (production project): env `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must be the PRODUCTION values. Test values stay only on the preview. Also `BUDGETING_PASSCODE` where server.ts runs.
11. Open the new site (preview built against production, or after merge) and test with REAL accounts: full_admin, team_admin, staff, leader (see the table in docs/AUTH_RLS_SETUP.md). Users with old non-bcrypt passwords need a password reset (Accounts screen).
12. Merge PR #4 into main (Vercel deploys). YOUR YES NEEDED. I do not merge.
13. THE SWITCH right after the merge: `insert into private.app_settings(key,value) values ('allow_lockdown','yes') on conflict (key) do update set value='yes';` then run the SQL file again. It stops by itself if there is no active full_admin. YOUR YES NEEDED.
14. Password resets for everyone who cannot log in. Run the role tests once more with real accounts (leader must see no quantities; delivered is blocked while pieces are owed).
15. If something is badly broken: run `20261202_auth_rls_v3_ROLLBACK.sql`, redeploy the old main build, run `20261128_login_username_phone_rls.sql`.
16. A few days later: delete `private.legacy_password_hashes`. Last: fix the budgeting passcode (parked).

## Known caveats to know before going live
- Fera2 admins cannot read vendors or create batches. Budgeting admin cannot see requests scoped to troops.
- Merged batch extra order numbers are not stored (the label may show only the first after reload).
- Old unpaid-order tasks stay until the order is touched. Count requests made before the Physical/Reserved change were stored in free-stock terms.
- Older migrations 20261128/20261129 fail on a brand new empty DB (production already has them applied, so no impact).
- UI is not click-tested.
