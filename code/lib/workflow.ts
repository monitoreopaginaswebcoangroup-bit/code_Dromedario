import type { OrderStatus, UserRole } from "@/types/domain";

export type TransitionKind = "approval" | "rejection" | "invoice" | "remission" | "dispatch" | "delivery" | "novelty" | "cancel" | "retry";

export interface TransitionDefinition {
  action: string;
  label: string;
  from: OrderStatus[];
  to: OrderStatus;
  roles: UserRole[];
  kind: TransitionKind;
  requiresNote?: boolean;
  preserveStatus?: boolean;
}

export interface OrderVisibilityFacts {
  status: OrderStatus;
  role: UserRole;
  isCreatedOrAssigned?: boolean;
  adminApproved?: boolean;
  hasInvoice?: boolean;
  hasRemission?: boolean;
  hasDispatch?: boolean;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin/Gerencia",
  comercial: "Comercial",
  facturacion: "Facturacion",
  despacho: "Despacho / envios",
  digitador: "Digitador"
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: "Autoriza pedidos, administra datos y supervisa la operacion.",
  comercial: "Registra pedidos y gestiona clientes asignados.",
  facturacion: "Factura, adjunta documentos y libera pedidos para despacho.",
  despacho: "Prepara pedidos, registra el envio y reporta entrega o novedad.",
  digitador: "Registra y actualiza clientes y contactos. Sin acceso a pedidos, productos ni reportes."
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  registered: "Registrado",
  pending_approval: "Pendiente aprobacion",
  rejected: "Rechazado",
  pending_invoicing: "Pendiente facturacion",
  invoiced: "Facturado",
  remitted_pending_invoice: "Remitido pendiente factura",
  pending_dispatch: "Pendiente despacho",
  dispatched: "Despachado",
  delivered: "Entregado",
  novelty: "Novedad",
  cancelled: "Anulado"
};

export const STATUS_TONES: Record<OrderStatus, "green" | "red" | "yellow" | "blue" | "neutral"> = {
  registered: "neutral",
  pending_approval: "yellow",
  rejected: "red",
  pending_invoicing: "yellow",
  invoiced: "blue",
  remitted_pending_invoice: "red",
  pending_dispatch: "yellow",
  dispatched: "blue",
  delivered: "green",
  novelty: "red",
  cancelled: "red"
};

export const ACTIVE_STATUSES: OrderStatus[] = [
  "registered",
  "pending_approval",
  "pending_invoicing",
  "invoiced",
  "remitted_pending_invoice",
  "pending_dispatch",
  "dispatched"
];

export const TERMINAL_STATUSES: OrderStatus[] = ["delivered", "rejected", "novelty", "cancelled"];

export const TRANSITIONS: TransitionDefinition[] = [
  {
    action: "submit_for_approval",
    label: "Enviar a aprobacion",
    from: ["registered"],
    to: "pending_approval",
    roles: ["admin", "comercial"],
    kind: "approval"
  },
  {
    action: "approve",
    label: "Aprobar",
    from: ["pending_approval"],
    to: "pending_invoicing",
    roles: ["admin"],
    kind: "approval"
  },
  {
    action: "reject",
    label: "Rechazar",
    from: ["pending_approval"],
    to: "rejected",
    roles: ["admin"],
    kind: "rejection",
    requiresNote: true
  },
  {
    action: "invoice",
    label: "Marcar facturado",
    from: ["pending_invoicing", "remitted_pending_invoice"],
    to: "pending_dispatch",
    roles: ["admin", "facturacion"],
    kind: "invoice"
  },
  {
    action: "invoice_after_dispatch",
    label: "Registrar factura pendiente",
    from: ["dispatched", "delivered", "novelty"],
    to: "dispatched",
    roles: ["admin", "facturacion"],
    kind: "invoice",
    preserveStatus: true
  },
  {
    action: "remit",
    label: "Remitir pendiente de factura",
    from: ["pending_invoicing"],
    to: "remitted_pending_invoice",
    roles: ["admin", "facturacion"],
    kind: "remission",
    requiresNote: true
  },
  {
    action: "dispatch",
    label: "Preparar y enviar",
    from: ["pending_dispatch", "remitted_pending_invoice"],
    to: "dispatched",
    roles: ["admin", "despacho"],
    kind: "dispatch"
  },
  {
    action: "deliver",
    label: "Marcar entregado",
    from: ["dispatched"],
    to: "delivered",
    roles: ["admin", "despacho"],
    kind: "delivery"
  },
  {
    action: "novelty",
    label: "Registrar novedad",
    from: ["pending_dispatch", "dispatched"],
    to: "novelty",
    roles: ["admin", "despacho"],
    kind: "novelty",
    requiresNote: true
  },
  {
    action: "retry_dispatch",
    label: "Reintentar despacho",
    from: ["novelty"],
    to: "pending_dispatch",
    roles: ["admin", "despacho"],
    kind: "retry"
  },
  {
    action: "cancel",
    label: "Anular",
    from: ["registered", "pending_approval", "pending_invoicing", "remitted_pending_invoice", "pending_dispatch", "dispatched", "novelty"],
    to: "cancelled",
    roles: ["admin"],
    kind: "cancel",
    requiresNote: true
  }
];

export function getAvailableTransitions(status: OrderStatus, role: UserRole) {
  return TRANSITIONS.filter((transition) => transition.from.includes(status) && transition.roles.includes(role));
}

export function canTransition(status: OrderStatus, role: UserRole, action: string) {
  return getAvailableTransitions(status, role).some((transition) => transition.action === action);
}

export function isActiveStatus(status: OrderStatus) {
  return ACTIVE_STATUSES.includes(status);
}

export function canCreateOrderForRole(role: UserRole) {
  return role === "admin" || role === "comercial";
}

export function canManageProductsForRole(role: UserRole) {
  return role === "admin";
}

export function isOrderVisibleForRole({
  status,
  role,
  isCreatedOrAssigned = false,
  adminApproved = false,
  hasInvoice = false,
  hasRemission = false,
  hasDispatch = false
}: OrderVisibilityFacts) {
  if (role === "admin") {
    return true;
  }

  if (role === "comercial" && isCreatedOrAssigned) {
    return true;
  }

  if (role === "facturacion") {
    return status === "pending_invoicing" || status === "remitted_pending_invoice" || hasInvoice || hasRemission;
  }

  if (role === "despacho") {
    return status === "remitted_pending_invoice"
      || status === "pending_dispatch"
      || status === "dispatched"
      || status === "delivered"
      || status === "novelty"
      || hasDispatch;
  }

  return false;
}

export function estimateMinutesSaved(orderCount: number) {
  return orderCount * 10;
}
