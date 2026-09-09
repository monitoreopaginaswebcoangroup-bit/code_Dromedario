# MVP Code Generation Plan

## Unit Context
- **Unit**: mvp
- **Application code location**: workspace root.
- **Documentation location**: `aidlc-docs/` only.
- **Primary stories covered**: order capture, approval, invoicing, dispatch, delivery/novelty, customer/contact base and operational dashboard.

## Plan Steps
- [x] Step 1: Create Next.js project configuration and base app files.
- [x] Step 2: Add Supabase client, type definitions and workflow transition utilities.
- [x] Step 3: Add Supabase SQL schema with RLS policies, storage bucket and seed products.
- [x] Step 4: Implement authentication shell and role-aware session loading.
- [x] Step 5: Implement dashboard with metrics and order lists.
- [x] Step 6: Implement customer, contact, product and order forms.
- [x] Step 7: Implement order state transition actions, event logging and attachment upload.
- [x] Step 8: Add tests for workflow transition rules.
- [x] Step 9: Add README and deployment/build instructions.
- [x] Step 10: Run install, tests and build; fix issues until green or document blockers.
