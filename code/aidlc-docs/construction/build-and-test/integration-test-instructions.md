# Integration Test Instructions

## Manual MVP Integration Scenario
1. Apply `supabase/schema.sql` in Supabase.
2. Add `dromedario` in Supabase Project Settings, API, Exposed schemas.
3. Create four users and assign roles in `dromedario.profiles`.
4. Login as admin and verify products are visible.
5. Create a customer and contact.
6. Create an order with at least one product.
7. Approve the order as admin.
8. Mark it as invoiced as facturacion, optionally uploading a PDF.
9. Mark it as dispatched and delivered as despacho.
10. Confirm that events appear in traceability and the order moves to historical orders.

## Expected Result
- Every state change is persisted in `orders` and creates an `order_events` row.
- Uploaded files appear in Supabase Storage under `order-documents/{order_id}/...`.
