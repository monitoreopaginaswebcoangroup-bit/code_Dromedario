import { describe, expect, it } from "vitest";
import { canCreateOrderForRole, canTransition, estimateMinutesSaved, getAvailableTransitions, isActiveStatus, isOrderVisibleForRole } from "../lib/workflow";

describe("order workflow", () => {
  it("allows admin to approve pending orders", () => {
    expect(canTransition("pending_approval", "admin", "approve")).toBe(true);
    expect(canTransition("pending_approval", "comercial", "approve")).toBe(false);
  });

  it("allows invoicing role to invoice approved orders", () => {
    const actions = getAvailableTransitions("pending_invoicing", "facturacion").map((transition) => transition.action);
    expect(actions).toContain("invoice");
    expect(actions).toContain("remit");
  });

  it("allows dispatch role to prepare, ship and close dispatched orders", () => {
    expect(canTransition("pending_dispatch", "despacho", "dispatch")).toBe(true);
    expect(canTransition("remitted_pending_invoice", "despacho", "dispatch")).toBe(true);
    expect(canTransition("dispatched", "despacho", "deliver")).toBe(true);
    expect(canTransition("dispatched", "despacho", "novelty")).toBe(true);
    expect(canTransition("pending_invoicing", "despacho", "invoice")).toBe(false);
  });

  it("keeps remitted shipments invoiceable after dispatch", () => {
    expect(canTransition("dispatched", "facturacion", "invoice_after_dispatch")).toBe(true);
    expect(canTransition("delivered", "facturacion", "invoice_after_dispatch")).toBe(true);
    expect(canTransition("novelty", "facturacion", "invoice_after_dispatch")).toBe(true);
  });

  it("does not show billing-stage orders to dispatch", () => {
    expect(isOrderVisibleForRole({ status: "pending_invoicing", role: "facturacion" })).toBe(true);
    expect(isOrderVisibleForRole({ status: "pending_invoicing", role: "despacho" })).toBe(false);
    expect(isOrderVisibleForRole({ status: "pending_invoicing", role: "despacho", isCreatedOrAssigned: true })).toBe(false);
    expect(isOrderVisibleForRole({ status: "pending_invoicing", role: "comercial", isCreatedOrAssigned: true })).toBe(true);
    expect(isOrderVisibleForRole({ status: "remitted_pending_invoice", role: "despacho" })).toBe(true);
    expect(isOrderVisibleForRole({ status: "pending_dispatch", role: "despacho" })).toBe(true);
  });

  it("limits order creation to commercial and admin roles", () => {
    expect(canCreateOrderForRole("admin")).toBe(true);
    expect(canCreateOrderForRole("comercial")).toBe(true);
    expect(canCreateOrderForRole("facturacion")).toBe(false);
    expect(canCreateOrderForRole("despacho")).toBe(false);
  });

  it("classifies active and terminal statuses", () => {
    expect(isActiveStatus("pending_approval")).toBe(true);
    expect(isActiveStatus("dispatched")).toBe(true);
    expect(isActiveStatus("delivered")).toBe(false);
    expect(isActiveStatus("cancelled")).toBe(false);
  });

  it("estimates savings with the MVP assumption of 10 minutes per order", () => {
    expect(estimateMinutesSaved(4)).toBe(40);
  });
});
