# TODO

## Deployment

- [ ] Zero-downtime deployment with blue-green setup
  - Run two identical environments (blue = live, green = idle)
  - Deploy new release to the idle environment; smoke-test before switching
  - Switch traffic at the load balancer / reverse proxy (instant cutover, no downtime)
  - Keep blue warm for fast rollback if the green release misbehaves
- [ ] Database migrations must be backward compatible (expand → migrate → contract) so old and new app versions can run side by side during switchover
- [ ] Health checks (/healthz, /readyz) gate traffic switch — only route to green when healthy
- [ ] Automate rollback path: one command/switch to revert traffic to previous environment
- [ ] Session/auth continuity: JWT-based auth already stateless — verify no in-memory session store breaks on switch
- [ ] Seed/demo data: ensure seed script (`pnpm db:reset`) is never run against production

## Housekeeping

- [ ] Remove or gate demo credentials panel on Login page before production (dev-only convenience)
