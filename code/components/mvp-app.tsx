"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { Session } from "@supabase/supabase-js";
import { usePathname } from "next/navigation";
import { formatDate, formatDateTime, formatMoney, sanitizeFileName } from "@/lib/format";
import { getSupabaseClient, isSupabaseConfigured, type DromedarioSupabaseClient } from "@/lib/supabase";
import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  STATUS_LABELS,
  TRANSITIONS,
  canCreateOrderForRole,
  estimateMinutesSaved,
  getAvailableTransitions,
  isActiveStatus,
  isOrderVisibleForRole,
  type TransitionDefinition
} from "@/lib/workflow";
import type { AppData, Contact, Customer, CustomerProductPrice, Order, OrderEvent, OrderItem, Product, Profile, SalesChannel, UserRole } from "@/types/domain";

type View = "dashboard" | "orders" | "new-order" | "customers" | "products" | "reports" | "settings";

interface Feedback {
  type: "success" | "error" | "info";
  text: string;
}

interface OrderDraftItem {
  product_id: string;
  quantity: number;
  unit_price: number;
}

interface OrderDraft {
  customer_id: string;
  contact_id: string | null;
  channel: SalesChannel;
  assigned_salesperson_id: string | null;
  delivery_address: string;
  requested_delivery_date: string | null;
  source_message: string;
  notes: string;
  items: OrderDraftItem[];
}

interface TransitionExtras {
  note: string;
  invoiceNumber: string;
  remissionNumber: string;
  dispatchGuide: string;
  file: File | null;
}

interface CreateUserDraft {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
}

interface SectionMeta {
  title: string;
  eyebrow: string;
  searchPlaceholder: string;
}

interface StageAttachment {
  key: string;
  stage: string;
  label: string;
  fileName: string;
  path: string;
  createdAt: string;
  notes: string | null;
}

const EMPTY_DATA: AppData = {
  profiles: [],
  customers: [],
  contacts: [],
  products: [],
  customerProductPrices: [],
  orders: [],
  orderItems: [],
  events: []
};

const PAGE_SIZE = 8;
const ROLE_OPTIONS: UserRole[] = ["admin", "comercial", "facturacion", "despacho"];
const VIEW_PATHS: Record<View, string> = {
  dashboard: "/resumen",
  orders: "/pedidos",
  "new-order": "/pedidos/nuevo",
  customers: "/clientes",
  products: "/productos",
  reports: "/reportes",
  settings: "/configuracion"
};

const ORDER_FLOW_STEPS: Array<{
  key: string;
  label: string;
  owner: string;
  description: string;
  statuses: Order["status"][];
}> = [
  {
    key: "capture",
    label: "Registro",
    owner: "Comercial",
    description: "Pedido creado con cliente, contacto, productos y direccion.",
    statuses: ["registered"]
  },
  {
    key: "approval",
    label: "Aprobacion",
    owner: "Gerencia",
    description: "Validacion interna antes de pasar a facturacion.",
    statuses: ["pending_approval"]
  },
  {
    key: "billing",
    label: "Facturacion",
    owner: "Facturacion",
    description: "Factura o remision registrada con soporte documental.",
    statuses: ["pending_invoicing", "invoiced", "remitted_pending_invoice"]
  },
  {
    key: "preparation",
    label: "Preparacion",
    owner: "Despacho",
    description: "Despacho prepara el pedido y define soporte de envio.",
    statuses: ["pending_dispatch"]
  },
  {
    key: "shipment",
    label: "Envio",
    owner: "Despacho",
    description: "Pedido enviado o despachado con guia/soporte.",
    statuses: ["dispatched"]
  },
  {
    key: "close",
    label: "Entrega",
    owner: "Despacho",
    description: "Entrega confirmada y flujo cerrado.",
    statuses: ["delivered"]
  }
];

const TERMINAL_FLOW_DETAILS: Partial<Record<Order["status"], { label: string; owner: string; description: string }>> = {
  rejected: {
    label: "Rechazado",
    owner: "Gerencia",
    description: "Pedido detenido por decision de aprobacion."
  },
  novelty: {
    label: "Novedad",
    owner: "Despacho",
    description: "Despacho reporto una novedad antes de cerrar el envio."
  },
  cancelled: {
    label: "Anulado",
    owner: "Admin/Gerencia",
    description: "Pedido anulado y fuera del flujo operativo."
  }
};

export function MvpApp() {
  const pathname = usePathname();
  const [routePath, setRoutePath] = useState(pathname ?? "/");
  const supabase = useMemo(() => (isSupabaseConfigured ? getSupabaseClient() : null), []);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [searchQuery, setSearchQuery] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [ordersQuickFilter, setOrdersQuickFilter] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data: authData }) => {
      if (!mounted) return;
      setSession(authData.session ?? null);
      if (authData.session) {
        void bootstrapUser(supabase, authData.session).then(({ profile: loadedProfile, appData }) => {
          if (!mounted) return;
          setBootstrapError(null);
          setProfile(loadedProfile);
          setData(appData);
          setLoading(false);
        }).catch((error: unknown) => {
          if (!mounted) return;
          setBootstrapError(getErrorMessage(error));
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        setLoading(true);
        void bootstrapUser(supabase, nextSession).then(({ profile: loadedProfile, appData }) => {
          setBootstrapError(null);
          setProfile(loadedProfile);
          setData(appData);
          setLoading(false);
        }).catch((error: unknown) => {
          setBootstrapError(getErrorMessage(error));
          setLoading(false);
        });
      } else {
        setProfile(null);
        setData(EMPTY_DATA);
        setBootstrapError(null);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    setRoutePath(pathname ?? "/");
  }, [pathname]);

  useEffect(() => {
    function handlePopState() {
      setRoutePath(window.location.pathname);
      setFeedback(null);
      setSearchQuery("");
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const maps = useMemo(() => createLookups(data), [data]);
  const view = getViewFromPathname(routePath);
  const sectionMeta = getSectionMeta(view);
  const canCreateOrders = profile ? canCreateOrderForRole(profile.role) : false;

  async function refresh() {
    if (!supabase || !session) return;
    const { profile: loadedProfile, appData } = await bootstrapUser(supabase, session);
    setProfile(loadedProfile);
    setData(appData);
  }

  function retryBootstrap() {
    if (!supabase || !session) return;
    setBootstrapError(null);
    setLoading(true);
    void bootstrapUser(supabase, session)
      .then(({ profile: loadedProfile, appData }) => {
        setProfile(loadedProfile);
        setData(appData);
        setLoading(false);
      })
      .catch((error: unknown) => {
        setBootstrapError(getErrorMessage(error));
        setLoading(false);
      });
  }

  function runMutation(action: () => Promise<void>, successText: string) {
    setFeedback(null);
    startTransition(() => {
      void action()
        .then(refresh)
        .then(() => setFeedback({ type: "success", text: successText }))
        .catch((error: unknown) => setFeedback({ type: "error", text: getErrorMessage(error) }));
    });
  }

  async function createCustomer(payload: Partial<Customer>) {
    if (!supabase || !profile) return;
    const { error } = await supabase.from("dromedario_customers").insert({ ...payload, created_by: profile.id });
    if (error) throw error;
  }

  async function createContact(payload: Partial<Contact>) {
    if (!supabase || !profile) return;
    const { error } = await supabase.from("dromedario_contacts").insert({ ...payload, created_by: profile.id });
    if (error) throw error;
  }

  async function updateContact(id: string, payload: Partial<Contact>) {
    if (!supabase || !profile) return;
    const { error } = await supabase.from("dromedario_contacts").update(payload).eq("id", id);
    if (error) throw error;
  }

  async function createProduct(payload: Partial<Product>) {
    if (!supabase || !profile) return;
    const { error } = await supabase.from("dromedario_products").insert({ ...payload, created_by: profile.id });
    if (error) throw error;
  }

  async function updateProduct(id: string, payload: Partial<Product>) {
    if (!supabase || !profile) return;
    const { error } = await supabase.from("dromedario_products").update(payload).eq("id", id);
    if (error) throw error;
  }

  async function setCustomerProductPrice(customerId: string, productId: string, price: number) {
    if (!supabase || !profile) return;
    const { error } = await supabase
      .from("dromedario_customer_product_prices")
      .upsert({ customer_id: customerId, product_id: productId, price, created_by: profile.id }, { onConflict: "customer_id,product_id" });
    if (error) throw error;
  }

  async function createUser(payload: CreateUserDraft) {
    if (!supabase || !session) return;

    const { error } = await supabase.functions.invoke("admin-create-user", {
      body: payload,
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });

    if (error) {
      const context = "context" in error ? (error as { context?: unknown }).context : null;
      const response = context instanceof Response ? context : null;
      const result = await response?.json().catch(() => null) as { error?: string } | null | undefined;
      throw new Error(result?.error ?? error.message ?? "No se pudo crear el usuario.");
    }
  }

  async function createOrder(draft: OrderDraft) {
    if (!supabase || !profile) return;
    if (!canCreateOrderForRole(profile.role)) throw new Error("Tu rol no puede crear pedidos.");

    const { data: order, error: orderError } = await supabase
      .from("dromedario_orders")
      .insert({
        status: "pending_approval",
        customer_id: draft.customer_id,
        contact_id: draft.contact_id,
        channel: draft.channel,
        assigned_salesperson_id: draft.assigned_salesperson_id,
        created_by: profile.id,
        delivery_address: draft.delivery_address || null,
        requested_delivery_date: draft.requested_delivery_date || null,
        source_message: draft.source_message || null,
        notes: draft.notes || null
      })
      .select("*")
      .single();

    if (orderError) throw orderError;

    const items = draft.items.map((item) => {
      const product = data.products.find((candidate) => candidate.id === item.product_id);
      return {
        order_id: order.id,
        product_id: product?.id ?? null,
        product_name: product?.name ?? "Producto no definido",
        quantity: item.quantity,
        unit_price: item.unit_price
      };
    });

    const { error: itemsError } = await supabase.from("dromedario_order_items").insert(items);
    if (itemsError) throw itemsError;

    const { error: eventError } = await supabase.from("dromedario_order_events").insert({
      order_id: order.id,
      from_status: null,
      to_status: "pending_approval",
      action: "created",
      notes: "Pedido registrado desde el MVP.",
      metadata: { item_count: items.length },
      created_by: profile.id
    });
    if (eventError) throw eventError;
  }

  async function uploadOrderFile(orderId: string, file: File) {
    if (!supabase) return null;
    const path = `${orderId}/${Date.now()}-${sanitizeFileName(file.name)}`;
    const { error } = await supabase.storage.from("dromedario-order-documents").upload(path, file, {
      cacheControl: "3600",
      upsert: false
    });
    if (error) throw error;
    return path;
  }

  async function transitionOrder(order: Order, transition: TransitionDefinition, extras: TransitionExtras) {
    if (!supabase || !profile) return;

    const now = new Date().toISOString();
    const filePath = extras.file ? await uploadOrderFile(order.id, extras.file) : null;
    const update: Partial<Order> = { status: transition.preserveStatus ? order.status : transition.to };
    const metadata: Record<string, unknown> = { transition: transition.action };

    if (filePath) metadata.file_path = filePath;

    if (transition.kind === "approval") {
      update.admin_approved_by = profile.id;
      update.admin_approved_at = now;
    }

    if (transition.kind === "rejection") {
      update.rejection_reason = extras.note;
      metadata.reason = extras.note;
    }

    if (transition.kind === "invoice") {
      update.invoice_number = extras.invoiceNumber || order.invoice_number;
      update.invoice_file_path = filePath ?? order.invoice_file_path;
      update.invoiced_at = now;
      metadata.invoice_number = update.invoice_number;
    }

    if (transition.kind === "remission") {
      update.remission_number = extras.remissionNumber || order.remission_number;
      update.invoice_file_path = filePath ?? order.invoice_file_path;
      update.remitted_at = now;
      metadata.remission_number = update.remission_number;
    }

    if (transition.kind === "dispatch") {
      update.dispatch_guide = extras.dispatchGuide || order.dispatch_guide;
      update.dispatch_file_path = filePath ?? order.dispatch_file_path;
      update.dispatched_at = now;
      metadata.dispatch_guide = update.dispatch_guide;
    }

    if (transition.kind === "delivery") {
      update.delivered_at = now;
    }

    if (transition.kind === "novelty") {
      update.novelty_reason = extras.note;
      metadata.reason = extras.note;
    }

    if (transition.kind === "cancel") {
      update.cancelled_reason = extras.note;
      metadata.reason = extras.note;
    }

    const { error: updateError } = await supabase.from("dromedario_orders").update(update).eq("id", order.id);
    if (updateError) throw updateError;

    const { error: eventError } = await supabase.from("dromedario_order_events").insert({
      order_id: order.id,
      from_status: order.status,
      to_status: update.status ?? transition.to,
      action: transition.action,
      notes: extras.note || transition.label,
      metadata,
      created_by: profile.id
    });
    if (eventError) throw eventError;
  }

  async function openAttachment(path: string) {
    if (!supabase) return;
    const { data: signed, error } = await supabase.storage.from("dromedario-order-documents").createSignedUrl(path, 120);
    if (error) {
      setFeedback({ type: "error", text: error.message });
      return;
    }
    window.open(signed.signedUrl, "_blank", "noopener,noreferrer");
  }

  function navigate(nextView: View, options?: { ordersQuickFilter?: string }) {
    const nextPath = VIEW_PATHS[nextView];
    setMobileSidebarOpen(false);
    setFeedback(null);
    setSearchQuery("");
    setOrdersQuickFilter(options?.ordersQuickFilter ?? null);
    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, "", nextPath);
    }
    setRoutePath(nextPath);
  }

  function goToOrdersWithFilter(quickFilter: string) {
    navigate("orders", { ordersQuickFilter: quickFilter });
  }

  if (!isSupabaseConfigured) {
    return <SetupRequired />;
  }

  if (loading) {
    return <FullPageMessage title="Cargando Dromedario" text="Preparando la informacion operativa." />;
  }

  if (supabase && session && bootstrapError) {
    return (
      <BootstrapErrorPanel
        error={bootstrapError}
        onRetry={retryBootstrap}
        onSignOut={() => void supabase.auth.signOut()}
      />
    );
  }

  if (!supabase || !session || !profile) {
    return <AuthPanel supabase={supabase} />;
  }

  return (
    <AppShell
      view={view}
      profile={profile}
      collapsed={sidebarCollapsed}
      mobileOpen={mobileSidebarOpen}
      onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
      onToggleMobile={() => setMobileSidebarOpen((current) => !current)}
      onCloseMobile={() => setMobileSidebarOpen(false)}
      onNavigate={navigate}
      onSignOut={() => void supabase.auth.signOut()}
    >
      <Topbar
        title={sectionMeta.title}
        eyebrow={sectionMeta.eyebrow}
        searchQuery={searchQuery}
        searchPlaceholder={sectionMeta.searchPlaceholder}
        profile={profile}
        isPending={isPending}
        canCreateOrder={canCreateOrders}
        onSearchChange={setSearchQuery}
        onNewOrder={() => navigate("new-order")}
        onRefresh={() => void refresh()}
        onToggleMobile={() => setMobileSidebarOpen((current) => !current)}
      />

      <main className="content-area">
        {feedback && <div className={`notice ${feedback.type}`}>{feedback.text}</div>}

        {view === "dashboard" && (
          <Dashboard
            data={data}
            profile={profile}
            maps={maps}
            searchQuery={searchQuery}
            isPending={isPending}
            onTransition={(order, transition, extras) =>
              runMutation(() => transitionOrder(order, transition, extras), `Pedido ${order.id.slice(0, 8)} actualizado.`)
            }
            onOpenAttachment={(path) => void openAttachment(path)}
            onNavigateToOrders={goToOrdersWithFilter}
          />
        )}

        {view === "orders" && (
          <OrdersPage
            data={data}
            profile={profile}
            maps={maps}
            searchQuery={searchQuery}
            isPending={isPending}
            initialQuickFilter={ordersQuickFilter}
            onTransition={(order, transition, extras) =>
              runMutation(() => transitionOrder(order, transition, extras), `Pedido ${order.id.slice(0, 8)} actualizado.`)
            }
            onOpenAttachment={(path) => void openAttachment(path)}
          />
        )}

        {view === "new-order" && (
          canCreateOrders ? (
            <OrderForm
              data={data}
              profile={profile}
              onCreate={(draft) => runMutation(() => createOrder(draft), "Pedido registrado y enviado a aprobacion.")}
              onCancel={() => navigate("dashboard")}
              isPending={isPending}
            />
          ) : (
            <RoleBlockedPage
              title="Nuevo pedido no disponible"
              text="Tu rol puede consultar o gestionar pedidos en su etapa, pero la creacion esta reservada para Comercial y Admin/Gerencia."
              actionLabel="Volver a pedidos"
              onAction={() => navigate("orders")}
            />
          )
        )}

        {view === "customers" && (
          <CustomerPanel
            data={data}
            profile={profile}
            searchQuery={searchQuery}
            onCreateCustomer={(payload) => runMutation(() => createCustomer(payload), "Cliente creado.")}
            onCreateContact={(payload) => runMutation(() => createContact(payload), "Contacto creado.")}
            onUpdateContact={(id, payload) => runMutation(() => updateContact(id, payload), "Contacto actualizado.")}
            onSetCustomerPrice={(customerId, productId, price) =>
              runMutation(() => setCustomerProductPrice(customerId, productId, price), "Precio de cliente actualizado.")
            }
            isPending={isPending}
          />
        )}

        {view === "products" && (
          <ProductPanel
            products={data.products}
            searchQuery={searchQuery}
            onCreateProduct={(payload) => runMutation(() => createProduct(payload), "Producto creado.")}
            onUpdateProduct={(id, payload) => runMutation(() => updateProduct(id, payload), "Producto actualizado.")}
            isPending={isPending}
          />
        )}

        {view === "reports" && (
          <ReportsPage data={data} onNavigateToOrders={goToOrdersWithFilter} />
        )}

        {view === "settings" && (
          <SettingsPage
            data={data}
            profile={profile}
            searchQuery={searchQuery}
            onCreateUser={(payload) => runMutation(() => createUser(payload), "Usuario creado y perfil asignado.")}
            isPending={isPending}
          />
        )}
      </main>
    </AppShell>
  );
}

function AppShell({
  view,
  profile,
  collapsed,
  mobileOpen,
  onToggleCollapsed,
  onToggleMobile,
  onCloseMobile,
  onNavigate,
  onSignOut,
  children
}: {
  view: View;
  profile: Profile;
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  onToggleMobile: () => void;
  onCloseMobile: () => void;
  onNavigate: (view: View) => void;
  onSignOut: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`workspace-shell ${collapsed ? "sidebar-collapsed" : ""} ${mobileOpen ? "sidebar-open" : ""}`}>
      <button className="sidebar-scrim" type="button" aria-label="Cerrar navegacion" onClick={onCloseMobile} />
      <Sidebar
        view={view}
        profile={profile}
        collapsed={collapsed}
        onToggleCollapsed={onToggleCollapsed}
        onToggleMobile={onToggleMobile}
        onNavigate={onNavigate}
        onSignOut={onSignOut}
      />
      <div className="shell-main">{children}</div>
    </div>
  );
}

function Sidebar({
  view,
  profile,
  collapsed,
  onToggleCollapsed,
  onToggleMobile,
  onNavigate,
  onSignOut
}: {
  view: View;
  profile: Profile;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onToggleMobile: () => void;
  onNavigate: (view: View) => void;
  onSignOut: () => void;
}) {
  const navItems: Array<{ label: string; view: View; short: string }> = [
    { label: "Resumen", view: "dashboard", short: "RS" },
    { label: "Pedidos", view: "orders", short: "PD" },
    { label: "Nuevo pedido", view: "new-order", short: "NP" },
    { label: "Clientes", view: "customers", short: "CL" },
    { label: "Productos", view: "products", short: "PR" }
  ];
  const visibleNavItems = navItems.filter((item) => item.view !== "new-order" || canCreateOrderForRole(profile.role));
  const secondaryItems: Array<{ label: string; view: View; short: string }> = [
    { label: "Reportes / metricas", view: "reports", short: "RM" },
    { label: "Configuracion", view: "settings", short: "CF" }
  ];

  return (
    <aside className="sidebar" aria-label="Navegacion principal">
      <div className="sidebar-top">
        <div className="brand-lockup">
          <span className="brand-mark">D</span>
          <div className="brand-copy">
            <strong>Dromedario</strong>
            <span>Pedidos MVP</span>
          </div>
        </div>
        <button className="icon-button sidebar-toggle" type="button" onClick={onToggleCollapsed} aria-label="Colapsar barra lateral">
          {collapsed ? ">" : "<"}
        </button>
        <button className="icon-button mobile-close" type="button" onClick={onToggleMobile} aria-label="Cerrar menu">
          x
        </button>
      </div>

      <nav className="sidebar-nav">
        {visibleNavItems.map((item) => (
          <button
            key={item.view}
            className={`sidebar-link ${view === item.view ? "is-active" : ""}`}
            type="button"
            onClick={() => onNavigate(item.view)}
            title={item.label}
          >
            <span className="nav-token">{item.short}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-section">
        {secondaryItems.map((item) => (
          <button
            key={item.view}
            className={`sidebar-link ${view === item.view ? "is-active" : ""}`}
            type="button"
            onClick={() => onNavigate(item.view)}
            title={item.label}
          >
            <span className="nav-token">{item.short}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </div>

      <div className="sidebar-footer">
        <div className="user-block">
          <span className="avatar">{initials(profile.full_name)}</span>
          <div className="user-copy">
            <strong>{profile.full_name}</strong>
            <span>{ROLE_LABELS[profile.role]}</span>
            <span>{ROLE_DESCRIPTIONS[profile.role]}</span>
          </div>
        </div>
        <button className="button-ghost sidebar-signout" data-testid="session-sign-out-button" type="button" onClick={onSignOut}>
          Cerrar sesion
        </button>
      </div>
    </aside>
  );
}

function Topbar({
  title,
  eyebrow,
  searchQuery,
  searchPlaceholder,
  profile,
  isPending,
  canCreateOrder,
  onSearchChange,
  onNewOrder,
  onRefresh,
  onToggleMobile
}: {
  title: string;
  eyebrow: string;
  searchQuery: string;
  searchPlaceholder: string;
  profile: Profile;
  isPending: boolean;
  canCreateOrder: boolean;
  onSearchChange: (value: string) => void;
  onNewOrder: () => void;
  onRefresh: () => void;
  onToggleMobile: () => void;
}) {
  return (
    <header className="topbar">
      <div className="topbar-title">
        <button className="icon-button mobile-menu" type="button" onClick={onToggleMobile} aria-label="Abrir menu">
          =
        </button>
        <div>
          <span className="breadcrumb">Dromedario / {eyebrow}</span>
          <h1>{title}</h1>
        </div>
      </div>
      <div className="topbar-actions">
        <SearchInput value={searchQuery} onChange={onSearchChange} placeholder={searchPlaceholder} />
        <button className="button-ghost" data-testid="data-refresh-button" type="button" onClick={onRefresh} disabled={isPending}>
          Actualizar
        </button>
        {canCreateOrder && (
          <button className="button" type="button" onClick={onNewOrder}>
            + Nuevo pedido
          </button>
        )}
        <span className="topbar-avatar" title={`${profile.full_name} - ${ROLE_LABELS[profile.role]}: ${ROLE_DESCRIPTIONS[profile.role]}`}>{initials(profile.full_name)}</span>
      </div>
    </header>
  );
}

function SetupRequired() {
  return (
    <main className="auth-wrap setup-wrap">
      <section className="auth-card setup-card">
        <p className="eyebrow">Configuracion requerida</p>
        <h1>Conecta Supabase para activar el sistema.</h1>
        <p className="muted">Crea `.env.local` con las variables publicas del proyecto y ejecuta el SQL incluido.</p>
        <pre className="notice code-block">NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co{"\n"}NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key</pre>
        <p className="muted">Despues corre `supabase/schema.sql` en el SQL Editor de tu proyecto Supabase.</p>
      </section>
    </main>
  );
}

function FullPageMessage({ title, text }: { title: string; text: string }) {
  return (
    <main className="auth-wrap setup-wrap">
      <section className="auth-card setup-card">
        <p className="eyebrow">Dromedario</p>
        <h1>{title}</h1>
        <p className="muted">{text}</p>
      </section>
    </main>
  );
}

function BootstrapErrorPanel({
  error,
  onRetry,
  onSignOut
}: {
  error: string;
  onRetry: () => void;
  onSignOut: () => void;
}) {
  return (
    <main className="auth-wrap setup-wrap">
      <section className="auth-card setup-card">
        <p className="eyebrow">Dromedario</p>
        <h1>No se pudo cargar tu informacion</h1>
        <p className="muted">
          Iniciaste sesion correctamente, pero no se pudo cargar tu perfil ni los datos de la operacion. Esto suele pasar
          cuando la base de datos de Supabase no tiene aplicado el ultimo `supabase/schema.sql`, o cuando tu perfil no
          tiene un rol activo asignado.
        </p>
        <pre className="notice error code-block">{error}</pre>
        <div className="drawer-actions">
          <button className="button-ghost" type="button" onClick={onSignOut}>Cerrar sesion</button>
          <button className="button" type="button" onClick={onRetry}>Reintentar</button>
        </div>
      </section>
    </main>
  );
}

function AuthPanel({ supabase }: { supabase: DromedarioSupabaseClient | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    if (!supabase) return;
    setFeedback(null);
    startTransition(() => {
      void supabase.auth.signInWithPassword({ email, password })
        .then(({ error }) => {
          if (error) throw error;
        })
        .catch((error: unknown) => setFeedback({ type: "error", text: getErrorMessage(error) }));
    });
  }

  return (
    <main className="login-screen">
      <section className="login-brand-panel">
        <div className="brand-lockup login-brand-lockup">
          <span className="brand-mark">D</span>
          <div className="brand-copy">
            <strong>Dromedario</strong>
            <span>Operacion comercial</span>
          </div>
        </div>
        <div className="login-message">
          <p className="eyebrow">Pedidos B2B</p>
          <h1>Control operativo desde registro hasta despacho.</h1>
          <p>Centraliza pedidos, responsables, documentos y trazabilidad en una sola herramienta de trabajo.</p>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="auth-card login-card">
          <p className="eyebrow">Dromedario</p>
          <h1>Bienvenido</h1>
          <p className="muted">Ingresa a tu cuenta para gestionar los pedidos.</p>
          {feedback && <div className={`notice ${feedback.type}`}>{feedback.text}</div>}
          <form className="login-form" onSubmit={(event) => { event.preventDefault(); submit(); }}>
            <label>
              Correo electronico
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required data-testid="auth-email-input" />
            </label>
            <label>
              Contrasena
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} data-testid="auth-password-input" />
            </label>
            <button className="button" type="submit" disabled={isPending} data-testid="auth-submit-button">
              Ingresar
            </button>
          </form>
          <p className="login-help">Olvidaste tu contrasena? Contacta al administrador.</p>
        </div>
      </section>
    </main>
  );
}

function Dashboard({
  data,
  profile,
  maps,
  searchQuery,
  isPending,
  onTransition,
  onOpenAttachment,
  onNavigateToOrders
}: {
  data: AppData;
  profile: Profile;
  maps: ReturnType<typeof createLookups>;
  searchQuery: string;
  isPending: boolean;
  onTransition: (order: Order, transition: TransitionDefinition, extras: TransitionExtras) => void;
  onOpenAttachment: (path: string) => void;
  onNavigateToOrders: (quickFilter: string) => void;
}) {
  const activeOrders = data.orders.filter((order) => isActiveStatus(order.status) || hasPendingRemissionInvoice(order));
  const pendingApproval = data.orders.filter((order) => order.status === "pending_approval").length;
  const pendingInvoicing = data.orders.filter((order) => order.status === "pending_invoicing" || hasPendingRemissionInvoice(order)).length;
  const pendingDispatch = data.orders.filter((order) => order.status === "pending_dispatch").length;
  const dispatchedToday = data.orders.filter((order) => order.status === "dispatched" && isToday(order.dispatched_at ?? order.updated_at)).length;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Resumen operativo"
        title="Resumen operativo"
        description="Visibilidad del flujo de pedidos desde registro hasta despacho."
      />

      <section className="stats-grid" aria-label="Indicadores operativos">
        <StatCard label="Pedidos activos" value={activeOrders.length} detail={`${estimateMinutesSaved(data.orders.length)} min estimados ahorrados`} onClick={() => onNavigateToOrders("active")} />
        <StatCard label="Pendientes de aprobacion" value={pendingApproval} detail="Requieren decision de gerencia" tone="amber" onClick={() => onNavigateToOrders("pending_approval")} />
        <StatCard label="Pendientes de facturacion" value={pendingInvoicing} detail="Facturacion o remision pendiente" tone="blue" onClick={() => onNavigateToOrders("pending_invoicing_group")} />
        <StatCard label="Pendientes de despacho" value={pendingDispatch} detail="Preparacion y envio por ejecutar" tone="violet" onClick={() => onNavigateToOrders("pending_dispatch")} />
        <StatCard label="Despachados hoy" value={dispatchedToday} detail="En seguimiento de entrega" tone="green" onClick={() => onNavigateToOrders("dispatched_today")} />
      </section>

      <OrderTable
        title="Pedidos que requieren atencion"
        description="Ordenados por actualizacion reciente para priorizar operacion diaria."
        orders={activeOrders}
        data={data}
        profile={profile}
        maps={maps}
        searchQuery={searchQuery}
        isPending={isPending}
        onTransition={onTransition}
        onOpenAttachment={onOpenAttachment}
        emptyText="No hay pedidos activos visibles para tu rol."
      />
    </div>
  );
}

function OrdersPage({
  data,
  profile,
  maps,
  searchQuery,
  isPending,
  initialQuickFilter,
  onTransition,
  onOpenAttachment
}: {
  data: AppData;
  profile: Profile;
  maps: ReturnType<typeof createLookups>;
  searchQuery: string;
  isPending: boolean;
  initialQuickFilter: string | null;
  onTransition: (order: Order, transition: TransitionDefinition, extras: TransitionExtras) => void;
  onOpenAttachment: (path: string) => void;
}) {
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Gestion de pedidos"
        title="Pedidos"
        description="Consulta, filtra y actualiza el estado operativo de cada pedido."
      />
      <OrderTable
        title="Todos los pedidos"
        description="Vista consolidada con filtros por estado, asesor y fechas."
        orders={data.orders}
        data={data}
        profile={profile}
        maps={maps}
        searchQuery={searchQuery}
        isPending={isPending}
        initialQuickFilter={initialQuickFilter}
        onTransition={onTransition}
        onOpenAttachment={onOpenAttachment}
        emptyText="No hay pedidos visibles para los filtros seleccionados."
      />
    </div>
  );
}

function OrderTable({
  title,
  description,
  orders,
  data,
  profile,
  maps,
  searchQuery,
  isPending,
  initialQuickFilter,
  onTransition,
  onOpenAttachment,
  emptyText
}: {
  title: string;
  description: string;
  orders: Order[];
  data: AppData;
  profile: Profile;
  maps: ReturnType<typeof createLookups>;
  searchQuery: string;
  isPending: boolean;
  initialQuickFilter?: string | null;
  onTransition: (order: Order, transition: TransitionDefinition, extras: TransitionExtras) => void;
  onOpenAttachment: (path: string) => void;
  emptyText: string;
}) {
  const [statusFilter, setStatusFilter] = useState(initialQuickFilter ?? "all");
  const [advisorFilter, setAdvisorFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortBy, setSortBy] = useState("updated_desc");
  const [page, setPage] = useState(1);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    return orders
      .filter((order) => {
        const customer = maps.customers.get(order.customer_id);
        const salesperson = order.assigned_salesperson_id ? maps.profiles.get(order.assigned_salesperson_id) : undefined;
        const creator = maps.profiles.get(order.created_by);
        const haystack = [
          order.id,
          customer?.legal_name,
          channelLabel(order.channel),
          salesperson?.full_name,
          creator?.full_name,
          STATUS_LABELS[order.status]
        ].join(" ").toLowerCase();
        const matchesSearch = !searchQuery.trim() || haystack.includes(searchQuery.trim().toLowerCase());
        const matchesStatus = matchesQuickFilter(order, statusFilter);
        const matchesAdvisor = advisorFilter === "all" || order.assigned_salesperson_id === advisorFilter || (!order.assigned_salesperson_id && order.created_by === advisorFilter);
        const matchesCustomer = customerFilter === "all" || order.customer_id === customerFilter;
        const orderDate = new Date(order.created_at);
        const matchesFrom = !fromDate || orderDate >= new Date(`${fromDate}T00:00:00`);
        const matchesTo = !toDate || orderDate <= new Date(`${toDate}T23:59:59`);
        return matchesSearch && matchesStatus && matchesAdvisor && matchesCustomer && matchesFrom && matchesTo;
      })
      .sort((a, b) => sortOrders(a, b, sortBy, data.orderItems));
  }, [advisorFilter, customerFilter, data.orderItems, fromDate, maps, orders, searchQuery, sortBy, statusFilter, toDate]);

  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visibleOrders = filteredOrders.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const advisors = data.profiles.filter((candidate) => candidate.role === "comercial" || candidate.role === "admin");
  const customersWithOrders = data.customers.filter((customer) => orders.some((order) => order.customer_id === customer.id));

  return (
    <section className="panel table-panel">
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span className="record-count">{filteredOrders.length} registros</span>
      </div>

      <div className="filter-bar" aria-label="Filtros de pedidos">
        <label>
          Estado
          <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}>
            <option value="all">Todos</option>
            {Object.entries(QUICK_FILTER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
            {Object.entries(STATUS_LABELS).map(([status, label]) => (
              <option key={status} value={status}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          Asesor
          <select value={advisorFilter} onChange={(event) => { setAdvisorFilter(event.target.value); setPage(1); }}>
            <option value="all">Todos</option>
            {advisors.map((advisor) => (
              <option key={advisor.id} value={advisor.id}>{advisor.full_name}</option>
            ))}
          </select>
        </label>
        <label>
          Cliente
          <select value={customerFilter} onChange={(event) => { setCustomerFilter(event.target.value); setPage(1); }}>
            <option value="all">Todos</option>
            {customersWithOrders.map((customer) => (
              <option key={customer.id} value={customer.id}>{customer.legal_name}</option>
            ))}
          </select>
        </label>
        <label>
          Desde
          <input type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPage(1); }} />
        </label>
        <label>
          Hasta
          <input type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setPage(1); }} />
        </label>
        <label>
          Ordenar
          <select value={sortBy} onChange={(event) => { setSortBy(event.target.value); setPage(1); }}>
            <option value="updated_desc">Actualizacion reciente</option>
            <option value="created_desc">Creacion reciente</option>
            <option value="value_desc">Mayor valor</option>
            <option value="customer_asc">Cliente A-Z</option>
          </select>
        </label>
      </div>

      <div className="table-scroll">
        <table className="data-table orders-table">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Cliente</th>
              <th className="col-secondary">Canal</th>
              <th>Asesor</th>
              <th>Valor</th>
              <th>Estado</th>
              <th className="col-secondary">Ultima actualizacion</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibleOrders.map((order) => {
              const customer = maps.customers.get(order.customer_id);
              const contact = order.contact_id ? maps.contacts.get(order.contact_id) : undefined;
              const salesperson = order.assigned_salesperson_id ? maps.profiles.get(order.assigned_salesperson_id) : undefined;
              const creator = maps.profiles.get(order.created_by);
              const items = data.orderItems.filter((item) => item.order_id === order.id);
              const events = data.events.filter((event) => event.order_id === order.id);
              const total = getOrderTotal(items);
              const isExpanded = expandedOrderId === order.id;
              const pendingRemissionInvoice = hasPendingRemissionInvoice(order);
              const canManageOrder = canActOnOrder(order, profile);

              return (
                <FragmentRows key={order.id}>
                  <tr className={`${isExpanded ? "is-expanded" : ""} ${pendingRemissionInvoice ? "requires-invoice" : ""} ${canManageOrder ? "" : "is-read-only"}`}>
                    <td>
                      <div className="table-strong">#{order.id.slice(0, 8).toUpperCase()}</div>
                      <span className="table-subtle">Creado {formatDate(order.created_at)}</span>
                    </td>
                    <td>
                      <div className="table-strong">{customer?.legal_name ?? "Cliente no visible"}</div>
                      <span className="table-subtle">{contact?.full_name ?? "Sin contacto"}</span>
                    </td>
                    <td className="col-secondary">{channelLabel(order.channel)}</td>
                    <td>{salesperson?.full_name ?? creator?.full_name ?? "Sin asesor"}</td>
                    <td className="numeric">{formatMoney(total)}</td>
                    <td>
                      <div className="status-cell">
                        <StatusBadge status={order.status} />
                        {pendingRemissionInvoice && <span className="alert-badge">Factura pendiente</span>}
                        {!canManageOrder && <span className="readonly-badge">Solo lectura</span>}
                      </div>
                    </td>
                    <td className="col-secondary">{formatRelativeTime(order.updated_at)}</td>
                    <td>
                      <button className="button-ghost button-small" type="button" onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}>
                        {isExpanded ? "Cerrar" : canManageOrder ? "Gestionar" : "Ver detalle"}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="table-detail-row">
                      <td colSpan={8}>
                        <OrderActionPanel
                          order={order}
                          profile={profile}
                          customer={customer}
                          contact={contact}
                          salesperson={salesperson}
                          creator={creator}
                          items={items}
                          events={events}
                          isPending={isPending}
                          readOnly={!canManageOrder}
                          onTransition={onTransition}
                          onOpenAttachment={onOpenAttachment}
                        />
                      </td>
                    </tr>
                  )}
                </FragmentRows>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredOrders.length === 0 && <EmptyState title="Sin pedidos" text={emptyText} />}

      <div className="pagination-bar">
        <span>Pagina {safePage} de {pageCount}</span>
        <div className="pagination-actions">
          <button className="button-ghost button-small" type="button" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
            Anterior
          </button>
          <button className="button-ghost button-small" type="button" disabled={safePage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>
            Siguiente
          </button>
        </div>
      </div>
    </section>
  );
}

function FragmentRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function OrderForm({
  data,
  profile,
  onCreate,
  onCancel,
  isPending
}: {
  data: AppData;
  profile: Profile;
  onCreate: (draft: OrderDraft) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [customerId, setCustomerId] = useState("");
  const [contactId, setContactId] = useState("");
  const [channel, setChannel] = useState<SalesChannel>("whatsapp");
  const [assignedSalespersonId, setAssignedSalespersonId] = useState(profile.role === "comercial" ? profile.id : "");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState("");
  const [sourceMessage, setSourceMessage] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<OrderDraftItem[]>([{ product_id: "", quantity: 1, unit_price: 0 }]);

  const contacts = data.contacts.filter((contact) => contact.customer_id === customerId);
  const salespeople = data.profiles.filter((candidate) => candidate.role === "comercial" || candidate.role === "admin");
  const total = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price), 0);

  function updateCustomer(id: string) {
    setCustomerId(id);
    setContactId("");
    const customer = data.customers.find((candidate) => candidate.id === id);
    setDeliveryAddress(customer?.dispatch_address ?? customer?.main_address ?? "");
    setAssignedSalespersonId(customer?.assigned_salesperson_id ?? assignedSalespersonId);
    setItems((current) =>
      current.map((item) =>
        item.product_id ? { ...item, unit_price: getEffectiveUnitPrice(id, item.product_id, data) } : item
      )
    );
  }

  function updateItem(index: number, patch: Partial<OrderDraftItem>) {
    setItems((current) => current.map((item, currentIndex) => (currentIndex === index ? { ...item, ...patch } : item)));
  }

  function submit() {
    const validItems = items.filter((item) => item.product_id && item.quantity > 0);
    if (!customerId || validItems.length === 0) return;
    onCreate({
      customer_id: customerId,
      contact_id: contactId || null,
      channel,
      assigned_salesperson_id: assignedSalespersonId || profile.id,
      delivery_address: deliveryAddress,
      requested_delivery_date: requestedDeliveryDate || null,
      source_message: sourceMessage,
      notes,
      items: validItems
    });
    setSourceMessage("");
    setNotes("");
    setItems([{ product_id: "", quantity: 1, unit_price: 0 }]);
  }

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow="Captura operacional"
        title="Nuevo pedido"
        description="Registra pedidos recibidos por WhatsApp, llamada o correo con datos completos para aprobacion, facturacion, preparacion y envio."
      />

      {data.customers.length === 0 && <div className="notice info">Primero crea al menos un cliente en Clientes.</div>}
      {data.products.length === 0 && <div className="notice info">Primero crea al menos un producto en Productos.</div>}

      <form className="operational-form" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <FormSection title="Cliente" description="Identifica la cuenta, contacto y responsable comercial.">
          <div className="form-grid four-columns">
            <label>
              Cliente
              <select value={customerId} onChange={(event) => updateCustomer(event.target.value)} required data-testid="order-customer-select">
                <option value="">Seleccionar cliente</option>
                {data.customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.legal_name}</option>
                ))}
              </select>
            </label>
            <label>
              Contacto
              <select value={contactId} onChange={(event) => setContactId(event.target.value)} data-testid="order-contact-select">
                <option value="">Sin contacto</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>{contact.full_name}</option>
                ))}
              </select>
            </label>
            <label>
              Canal
              <select value={channel} onChange={(event) => setChannel(event.target.value as SalesChannel)} data-testid="order-channel-select">
                <option value="whatsapp">WhatsApp</option>
                <option value="phone">Llamada</option>
                <option value="email">Correo</option>
                <option value="in_person">Presencial</option>
                <option value="other">Otro</option>
              </select>
            </label>
            <label>
              Asesor
              <select value={assignedSalespersonId} onChange={(event) => setAssignedSalespersonId(event.target.value)} data-testid="order-salesperson-select">
                <option value="">Yo / sin asignar</option>
                {salespeople.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>{candidate.full_name}</option>
                ))}
              </select>
            </label>
          </div>
        </FormSection>

        <FormSection title="Pedido" description="Agrega los productos solicitados y el valor de referencia.">
          <div className="line-items-header">
            <span>{items.length} lineas</span>
            <button className="button-ghost button-small" type="button" onClick={() => setItems([...items, { product_id: "", quantity: 1, unit_price: 0 }])}>
              Agregar producto
            </button>
          </div>
          <div className="line-items">
            {items.map((item, index) => (
              <div className="line-item-grid" key={`${index}-${item.product_id}`}>
                <label>
                  Producto
                  <select
                    value={item.product_id}
                    onChange={(event) => {
                      updateItem(index, {
                        product_id: event.target.value,
                        unit_price: event.target.value ? getEffectiveUnitPrice(customerId, event.target.value, data) : 0
                      });
                    }}
                    required
                  >
                    <option value="">Seleccionar</option>
                    {data.products.map((product) => (
                      <option key={product.id} value={product.id}>{product.name} ({product.unit})</option>
                    ))}
                  </select>
                </label>
                <label>
                  Cantidad
                  <input type="number" min="0.01" step="0.01" value={item.quantity} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })} />
                </label>
                <label>
                  Precio
                  <input type="number" min="0" step="1" value={item.unit_price} onChange={(event) => updateItem(index, { unit_price: Number(event.target.value) })} />
                </label>
                <div className="line-total">
                  <span>Total</span>
                  <div className="line-total-value">
                    <PriceComparisonHint productId={item.product_id} customerId={customerId} data={data} />
                    <strong>{formatMoney(Number(item.quantity) * Number(item.unit_price))}</strong>
                  </div>
                </div>
                <button className="button-ghost button-small" type="button" onClick={() => setItems(items.filter((_, currentIndex) => currentIndex !== index))} disabled={items.length === 1}>
                  Quitar
                </button>
              </div>
            ))}
          </div>
        </FormSection>

        <FormSection title="Entrega" description="Datos necesarios para que despacho prepare el pedido, registre el envio y haga seguimiento.">
          <div className="form-grid two-columns">
            <label>
              Direccion
              <input value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} data-testid="order-delivery-address-input" />
            </label>
            <label>
              Fecha solicitada
              <input type="date" value={requestedDeliveryDate} onChange={(event) => setRequestedDeliveryDate(event.target.value)} data-testid="order-date-input" />
            </label>
          </div>
        </FormSection>

        <FormSection title="Contexto" description="Conserva la informacion original del pedido y notas internas.">
          <div className="form-grid two-columns">
            <label>
              Mensaje original
              <textarea value={sourceMessage} onChange={(event) => setSourceMessage(event.target.value)} placeholder="Ej: Cliente pide 2 cajas de crema de coco para manana." data-testid="order-source-message-input" />
            </label>
            <label>
              Observaciones internas
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} data-testid="order-notes-input" />
            </label>
          </div>
        </FormSection>

        <div className="form-footer">
          <div>
            <span className="table-subtle">Total referencia</span>
            <strong>{formatMoney(total)}</strong>
          </div>
          <div className="footer-actions">
            <button className="button-ghost" type="button" onClick={onCancel}>Cancelar</button>
            <button className="button" type="submit" disabled={isPending || !customerId || data.products.length === 0} data-testid="order-submit-button">
              Guardar pedido
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

function CustomerPanel({
  data,
  profile,
  searchQuery,
  onCreateCustomer,
  onCreateContact,
  onUpdateContact,
  onSetCustomerPrice,
  isPending
}: {
  data: AppData;
  profile: Profile;
  searchQuery: string;
  onCreateCustomer: (payload: Partial<Customer>) => void;
  onCreateContact: (payload: Partial<Contact>) => void;
  onUpdateContact: (id: string, payload: Partial<Contact>) => void;
  onSetCustomerPrice: (customerId: string, productId: string, price: number) => void;
  isPending: boolean;
}) {
  const [drawer, setDrawer] = useState<"customer" | "contact" | "contacts" | "prices" | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const salespeople = data.profiles.filter((candidate) => candidate.role === "comercial" || candidate.role === "admin");
  const filteredCustomers = data.customers.filter((customer) => {
    const contacts = data.contacts.filter((contact) => contact.customer_id === customer.id);
    const haystack = [customer.legal_name, customer.nit, customer.billing_email, customer.main_address, customer.dispatch_address, ...contacts.map((contact) => contact.full_name)].join(" ").toLowerCase();
    return !searchQuery.trim() || haystack.includes(searchQuery.trim().toLowerCase());
  });

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Directorio comercial"
        title="Clientes"
        description="Base operativa de empresas, contactos y responsables comerciales."
        actions={
          <>
            <button className="button-ghost" type="button" onClick={() => setDrawer("contact")}>Nuevo contacto</button>
            <button className="button" type="button" onClick={() => setDrawer("customer")}>Nuevo cliente</button>
          </>
        }
      />

      <section className="panel table-panel">
        <div className="panel-header">
          <div>
            <h2>Clientes activos</h2>
            <p>Vista tabular para consulta rapida y seguimiento comercial.</p>
          </div>
          <span className="record-count">{filteredCustomers.length} clientes</span>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Contacto</th>
                <th>Telefono</th>
                <th>Email</th>
                <th>Pedidos</th>
                <th>Ultimo pedido</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => {
                const contacts = data.contacts.filter((contact) => contact.customer_id === customer.id);
                const primaryContact = contacts[0];
                const orders = data.orders.filter((order) => order.customer_id === customer.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
                return (
                  <tr key={customer.id}>
                    <td>
                      <div className="table-strong">{customer.legal_name}</div>
                      <span className="table-subtle">NIT {customer.nit || "Sin NIT"}</span>
                    </td>
                    <td>
                      {primaryContact?.full_name ?? "Sin contacto"}
                      {contacts.length > 1 && (
                        <>
                          {" "}
                          <button
                            className="link-button"
                            type="button"
                            onClick={() => { setCustomerId(customer.id); setDrawer("contacts"); }}
                          >
                            +{contacts.length - 1} mas
                          </button>
                        </>
                      )}
                    </td>
                    <td>{primaryContact?.whatsapp ?? primaryContact?.phone ?? "-"}</td>
                    <td>{primaryContact?.email ?? customer.billing_email ?? "-"}</td>
                    <td className="numeric">{orders.length}</td>
                    <td>{orders[0] ? formatRelativeTime(orders[0].created_at) : "Sin pedidos"}</td>
                    <td>
                      <button className="button-ghost button-small" type="button" onClick={() => { setCustomerId(customer.id); setDrawer("contacts"); }}>Ver contactos</button>{" "}
                      <button className="button-ghost button-small" type="button" onClick={() => { setCustomerId(customer.id); setDrawer("contact"); }}>Agregar contacto</button>{" "}
                      <button className="button-ghost button-small" type="button" onClick={() => { setCustomerId(customer.id); setDrawer("prices"); }}>Precios</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredCustomers.length === 0 && <EmptyState title="Sin clientes" text="No hay clientes visibles para la busqueda actual." />}
      </section>

      <Drawer title="Nuevo cliente" open={drawer === "customer"} onClose={() => setDrawer(null)}>
        <form className="drawer-form" onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          onCreateCustomer({
            legal_name: String(form.get("legal_name") ?? ""),
            nit: String(form.get("nit") ?? "") || null,
            billing_email: String(form.get("billing_email") ?? "") || null,
            main_address: String(form.get("main_address") ?? "") || null,
            dispatch_address: String(form.get("dispatch_address") ?? "") || null,
            assigned_salesperson_id: String(form.get("assigned_salesperson_id") ?? "") || (profile.role === "comercial" ? profile.id : null)
          });
          event.currentTarget.reset();
          setDrawer(null);
        }}>
          <label>Razon social<input name="legal_name" required data-testid="customer-name-input" /></label>
          <label>NIT<input name="nit" /></label>
          <label>Correo factura<input name="billing_email" type="email" /></label>
          <label>Direccion principal<input name="main_address" /></label>
          <label>Direccion despacho<input name="dispatch_address" /></label>
          <label>
            Asesor asignado
            <select name="assigned_salesperson_id" defaultValue={profile.role === "comercial" ? profile.id : ""}>
              <option value="">Sin asignar</option>
              {salespeople.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>{candidate.full_name}</option>
              ))}
            </select>
          </label>
          <div className="drawer-actions">
            <button className="button-ghost" type="button" onClick={() => setDrawer(null)}>Cancelar</button>
            <button className="button" disabled={isPending} data-testid="customer-submit-button">Guardar cliente</button>
          </div>
        </form>
      </Drawer>

      <Drawer title="Nuevo contacto" open={drawer === "contact"} onClose={() => setDrawer(null)}>
        <form className="drawer-form" onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          onCreateContact({
            customer_id: String(form.get("customer_id") ?? ""),
            full_name: String(form.get("full_name") ?? ""),
            phone: String(form.get("phone") ?? "") || null,
            whatsapp: String(form.get("whatsapp") ?? "") || null,
            email: String(form.get("email") ?? "") || null,
            position: String(form.get("position") ?? "") || null
          });
          event.currentTarget.reset();
          setCustomerId("");
          setDrawer(null);
        }}>
          <label>
            Cliente
            <select name="customer_id" value={customerId} onChange={(event) => setCustomerId(event.target.value)} required data-testid="contact-customer-select">
              <option value="">Seleccionar cliente</option>
              {data.customers.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.legal_name}</option>
              ))}
            </select>
          </label>
          <label>Nombre contacto<input name="full_name" required data-testid="contact-name-input" /></label>
          <label>Telefono<input name="phone" /></label>
          <label>WhatsApp<input name="whatsapp" /></label>
          <label>Correo<input name="email" type="email" /></label>
          <label>Cargo<input name="position" /></label>
          <div className="drawer-actions">
            <button className="button-ghost" type="button" onClick={() => setDrawer(null)}>Cancelar</button>
            <button className="button" disabled={isPending || !customerId} data-testid="contact-submit-button">Guardar contacto</button>
          </div>
        </form>
      </Drawer>

      <Drawer
        title={`Contactos de ${data.customers.find((customer) => customer.id === customerId)?.legal_name ?? ""}`}
        open={drawer === "contacts"}
        onClose={() => { setDrawer(null); setEditingContactId(null); }}
      >
        <div className="drawer-form">
          {data.contacts.filter((contact) => contact.customer_id === customerId).length === 0 && (
            <EmptyState title="Sin contactos" text="Este cliente todavia no tiene contactos registrados." />
          )}
          {data.contacts
            .filter((contact) => contact.customer_id === customerId)
            .map((contact) => (
              editingContactId === contact.id ? (
                <form
                  key={contact.id}
                  className="panel"
                  style={{ padding: "0.75rem 1rem", display: "grid", gap: "0.5rem" }}
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    onUpdateContact(contact.id, {
                      full_name: String(form.get("full_name") ?? ""),
                      phone: String(form.get("phone") ?? "") || null,
                      whatsapp: String(form.get("whatsapp") ?? "") || null,
                      email: String(form.get("email") ?? "") || null,
                      position: String(form.get("position") ?? "") || null
                    });
                    setEditingContactId(null);
                  }}
                >
                  <label>Nombre contacto<input name="full_name" defaultValue={contact.full_name} required data-testid="contact-edit-name-input" /></label>
                  <label>Telefono<input name="phone" defaultValue={contact.phone ?? ""} /></label>
                  <label>WhatsApp<input name="whatsapp" defaultValue={contact.whatsapp ?? ""} /></label>
                  <label>Correo<input name="email" type="email" defaultValue={contact.email ?? ""} /></label>
                  <label>Cargo<input name="position" defaultValue={contact.position ?? ""} /></label>
                  <div className="drawer-actions">
                    <button className="button-ghost" type="button" onClick={() => setEditingContactId(null)}>Cancelar</button>
                    <button className="button" disabled={isPending} data-testid="contact-edit-submit-button">Guardar cambios</button>
                  </div>
                </form>
              ) : (
                <div key={contact.id} className="panel" style={{ padding: "0.75rem 1rem" }}>
                  <div className="table-strong">{contact.full_name}</div>
                  {contact.position && <div className="table-subtle">{contact.position}</div>}
                  <div>{contact.whatsapp ?? contact.phone ?? "Sin telefono"}</div>
                  <div>{contact.email ?? "Sin correo"}</div>
                  <button className="button-ghost button-small" type="button" onClick={() => setEditingContactId(contact.id)}>Editar</button>
                </div>
              )
            ))}
          <div className="drawer-actions">
            <button className="button-ghost" type="button" onClick={() => { setDrawer(null); setEditingContactId(null); }}>Cerrar</button>
            <button className="button" type="button" onClick={() => setDrawer("contact")}>Agregar contacto</button>
          </div>
        </div>
      </Drawer>

      <Drawer
        title={`Precios de ${data.customers.find((customer) => customer.id === customerId)?.legal_name ?? ""}`}
        open={drawer === "prices"}
        onClose={() => setDrawer(null)}
      >
        <div className="drawer-form">
          <p className="muted">
            Define el precio que se le cobra a este cliente por cada producto. Si un producto no tiene precio propio, el
            pedido usara el precio base del catalogo.
          </p>
          {data.products.filter((product) => product.active).length === 0 && (
            <EmptyState title="Sin productos" text="Primero crea productos en el catalogo." />
          )}
          {data.products
            .filter((product) => product.active)
            .map((product) => (
              <CustomerPriceRow
                key={product.id}
                product={product}
                customPrice={findCustomerProductPrice(customerId, product.id, data)?.price}
                isPending={isPending}
                onSave={(price) => onSetCustomerPrice(customerId, product.id, price)}
              />
            ))}
          <div className="drawer-actions">
            <button className="button-ghost" type="button" onClick={() => setDrawer(null)}>Cerrar</button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}

function CustomerPriceRow({
  product,
  customPrice,
  isPending,
  onSave
}: {
  product: Product;
  customPrice: number | undefined;
  isPending: boolean;
  onSave: (price: number) => void;
}) {
  const [price, setPrice] = useState(customPrice ?? product.default_price);

  return (
    <div className="panel" style={{ padding: "0.75rem 1rem", display: "grid", gap: "0.5rem" }}>
      <div className="table-strong">{product.name}</div>
      <span className="table-subtle">Precio base catalogo: {formatMoney(product.default_price)}</span>
      <div className="customer-price-field">
        <label>
          Precio para este cliente
          <input type="number" min="0" step="1" value={price} onChange={(event) => setPrice(Number(event.target.value))} />
        </label>
        <button className="button-ghost button-small" type="button" disabled={isPending} onClick={() => onSave(price)}>
          Guardar precio
        </button>
      </div>
    </div>
  );
}

function ProductPanel({
  products,
  searchQuery,
  onCreateProduct,
  onUpdateProduct,
  isPending
}: {
  products: Product[];
  searchQuery: string;
  onCreateProduct: (payload: Partial<Product>) => void;
  onUpdateProduct: (id: string, payload: Partial<Product>) => void;
  isPending: boolean;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const filteredProducts = products.filter((product) => {
    const haystack = [product.name, product.sku, product.unit].join(" ").toLowerCase();
    return !searchQuery.trim() || haystack.includes(searchQuery.trim().toLowerCase());
  });

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Catalogo"
        title="Productos"
        description="Catalogo operativo usado para registrar lineas de pedido y valores de referencia."
        actions={<button className="button" type="button" onClick={() => setDrawerOpen(true)}>Nuevo producto</button>}
      />

      <section className="panel table-panel">
        <div className="panel-header">
          <div>
            <h2>Catalogo administrativo</h2>
            <p>Productos disponibles para captura de pedidos.</p>
          </div>
          <span className="record-count">{filteredProducts.length} productos</span>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>SKU</th>
                <th>Unidad</th>
                <th>Precio</th>
                <th>Estado</th>
                <th>Actualizacion</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id}>
                  <td><div className="table-strong">{product.name}</div></td>
                  <td>{product.sku || "-"}</td>
                  <td>{product.unit}</td>
                  <td className="numeric">{formatMoney(product.default_price)}</td>
                  <td><span className={`status-badge ${product.active ? "status-delivered" : "status-cancelled"}`}>{product.active ? "Activo" : "Inactivo"}</span></td>
                  <td>{formatRelativeTime(product.updated_at)}</td>
                  <td>
                    <button className="button-ghost button-small" type="button" onClick={() => setEditingProduct(product)}>Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredProducts.length === 0 && <EmptyState title="Sin productos" text="No hay productos visibles para la busqueda actual." />}
      </section>

      <Drawer title="Nuevo producto" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <form className="drawer-form" onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          onCreateProduct({
            name: String(form.get("name") ?? ""),
            sku: String(form.get("sku") ?? "") || null,
            unit: String(form.get("unit") ?? "caja"),
            default_price: Number(form.get("default_price") ?? 0),
            active: true
          });
          event.currentTarget.reset();
          setDrawerOpen(false);
        }}>
          <label>Nombre<input name="name" required data-testid="product-name-input" /></label>
          <label>SKU<input name="sku" /></label>
          <label>Unidad<input name="unit" defaultValue="caja" /></label>
          <label>Precio base<input name="default_price" type="number" min="0" step="1" defaultValue="0" /></label>
          <div className="drawer-actions">
            <button className="button-ghost" type="button" onClick={() => setDrawerOpen(false)}>Cancelar</button>
            <button className="button" disabled={isPending} data-testid="product-submit-button">Guardar producto</button>
          </div>
        </form>
      </Drawer>

      <Drawer title="Editar producto" open={editingProduct !== null} onClose={() => setEditingProduct(null)}>
        {editingProduct && (
          <form
            className="drawer-form"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              onUpdateProduct(editingProduct.id, {
                name: String(form.get("name") ?? ""),
                sku: String(form.get("sku") ?? "") || null,
                unit: String(form.get("unit") ?? "caja"),
                default_price: Number(form.get("default_price") ?? 0),
                active: form.get("active") === "on"
              });
              setEditingProduct(null);
            }}
          >
            <label>Nombre<input name="name" defaultValue={editingProduct.name} required data-testid="product-edit-name-input" /></label>
            <label>SKU<input name="sku" defaultValue={editingProduct.sku ?? ""} /></label>
            <label>Unidad<input name="unit" defaultValue={editingProduct.unit} /></label>
            <label>Precio base<input name="default_price" type="number" min="0" step="1" defaultValue={editingProduct.default_price} /></label>
            <label className="checkbox-field">
              <input name="active" type="checkbox" defaultChecked={editingProduct.active} />
              Producto activo (disponible para nuevos pedidos)
            </label>
            <div className="drawer-actions">
              <button className="button-ghost" type="button" onClick={() => setEditingProduct(null)}>Cancelar</button>
              <button className="button" disabled={isPending} data-testid="product-edit-submit-button">Guardar cambios</button>
            </div>
          </form>
        )}
      </Drawer>
    </div>
  );
}

function ReportsPage({ data, onNavigateToOrders }: { data: AppData; onNavigateToOrders: (quickFilter: string) => void }) {
  const activeOrders = data.orders.filter((order) => isActiveStatus(order.status) || hasPendingRemissionInvoice(order));
  const pendingApproval = data.orders.filter((order) => order.status === "pending_approval").length;
  const pendingInvoicing = data.orders.filter((order) => order.status === "pending_invoicing" || hasPendingRemissionInvoice(order)).length;
  const pendingDispatch = data.orders.filter((order) => order.status === "pending_dispatch").length;
  const delivered = data.orders.filter((order) => order.status === "delivered").length;
  const novelty = data.orders.filter((order) => order.status === "novelty").length;
  const pendingRemissionInvoices = data.orders.filter(hasPendingRemissionInvoice).length;
  const totalReferenceValue = getOrderTotal(data.orderItems);
  const cadence = computeCustomerCadence(data);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Reportes / metricas"
        title="Reportes operativos"
        description="Indicadores simples para revisar carga activa, cuellos de botella y avance del flujo diario."
      />

      <section className="stats-grid" aria-label="Metricas principales">
        <StatCard label="Pedidos totales" value={data.orders.length} detail="Pedidos visibles para tu rol" onClick={() => onNavigateToOrders("all")} />
        <StatCard label="Pedidos activos" value={activeOrders.length} detail="Aun no cerrados" tone="amber" onClick={() => onNavigateToOrders("active")} />
        <StatCard label="Entregados" value={delivered} detail="Flujo completado" tone="green" onClick={() => onNavigateToOrders("delivered")} />
        <StatCard label="Novedades" value={novelty} detail="Requieren seguimiento" tone="violet" onClick={() => onNavigateToOrders("novelty")} />
        <StatCard label="Remisiones sin factura" value={pendingRemissionInvoices} detail="Alerta: siempre deben facturarse" tone="blue" onClick={() => onNavigateToOrders("pending_remission_invoice")} />
      </section>

      <section className="report-grid">
        <div className="panel">
          <div className="panel-header compact">
            <div>
              <h2>Cuellos de botella</h2>
              <p>Estados que requieren accion para mover pedidos. Da clic en un indicador para ver esos pedidos.</p>
            </div>
          </div>
          <ul className="metric-list">
            <li className="is-clickable" {...clickableRowProps(() => onNavigateToOrders("pending_approval"))}><span>Pendientes de aprobacion</span><strong>{pendingApproval}</strong></li>
            <li className="is-clickable" {...clickableRowProps(() => onNavigateToOrders("pending_invoicing_group"))}><span>Pendientes de facturacion</span><strong>{pendingInvoicing}</strong></li>
            <li className="is-clickable" {...clickableRowProps(() => onNavigateToOrders("pending_dispatch"))}><span>Pendientes de despacho</span><strong>{pendingDispatch}</strong></li>
            <li className="requires-invoice-metric is-clickable" {...clickableRowProps(() => onNavigateToOrders("pending_remission_invoice"))}><span>Remisiones sin factura</span><strong>{pendingRemissionInvoices}</strong></li>
            <li><span>Valor referencia visible</span><strong>{formatMoney(totalReferenceValue)}</strong></li>
          </ul>
        </div>

        <div className="panel">
          <div className="panel-header compact">
            <div>
              <h2>Pedidos por estado</h2>
              <p>Distribucion actual del flujo operativo. Da clic en un estado para ver esos pedidos.</p>
            </div>
          </div>
          <ul className="status-summary-list">
            {Object.entries(STATUS_LABELS).map(([status, label]) => {
              const count = data.orders.filter((order) => order.status === status).length;
              return (
                <li key={status} className="is-clickable" {...clickableRowProps(() => onNavigateToOrders(status))}>
                  <StatusBadge status={status as Order["status"]} />
                  <span>{label}</span>
                  <strong>{count}</strong>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="panel table-panel">
        <div className="panel-header">
          <div>
            <h2>Frecuencia de compra por cliente</h2>
            <p>Compara a cada cliente contra su propio historico para detectar quien esta pidiendo mas espaciado de lo usual.</p>
          </div>
          <span className="record-count">{cadence.length} clientes con pedidos</span>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Pedidos</th>
                <th>Frecuencia promedio</th>
                <th>Ultimo pedido</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {cadence.map((row) => (
                <tr key={row.customerId}>
                  <td><div className="table-strong">{row.legalName}</div></td>
                  <td className="numeric">{row.orderCount}</td>
                  <td>{row.averageIntervalDays !== null ? `cada ${row.averageIntervalDays.toFixed(1)} dias` : "Sin historial suficiente"}</td>
                  <td>{formatRelativeTime(row.lastOrderAt)}</td>
                  <td>
                    {row.status === "atrasado" && <span className="alert-badge">Atrasado ({row.daysSinceLastOrder} d)</span>}
                    {row.status === "a-tiempo" && <span className="status-badge status-delivered">A tiempo</span>}
                    {row.status === "sin-historial" && <span className="metadata-pill">Sin historial suficiente</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {cadence.length === 0 && (
          <EmptyState title="Sin datos suficientes" text="Aun no hay clientes con pedidos registrados para calcular frecuencia de compra." />
        )}
      </section>
    </div>
  );
}

function SettingsPage({
  data,
  profile,
  searchQuery,
  onCreateUser,
  isPending
}: {
  data: AppData;
  profile: Profile;
  searchQuery: string;
  onCreateUser: (payload: CreateUserDraft) => void;
  isPending: boolean;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isAdmin = profile.role === "admin";
  const filteredProfiles = data.profiles.filter((candidate) => {
    const haystack = [candidate.full_name, candidate.email, ROLE_LABELS[candidate.role], ROLE_DESCRIPTIONS[candidate.role]].join(" ").toLowerCase();
    return !searchQuery.trim() || haystack.includes(searchQuery.trim().toLowerCase());
  });

  if (!isAdmin) {
    return (
      <div className="page-stack">
        <PageHeader
          eyebrow="Configuracion"
          title="Configuracion"
          description="La administracion de usuarios esta reservada para perfiles admin."
        />
        <div className="notice info">Tu rol actual es {ROLE_LABELS[profile.role]}. Pide a un admin que cree o cambie usuarios.</div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Configuracion"
        title="Usuarios y roles"
        description="Crea cuentas internas y asigna el rol operativo correspondiente."
        actions={<button className="button" type="button" onClick={() => setDrawerOpen(true)}>Nuevo usuario</button>}
      />

      <section className="panel table-panel">
        <div className="panel-header">
          <div>
            <h2>Usuarios internos</h2>
            <p>Perfiles activos registrados en Dromedario.</p>
          </div>
          <span className="record-count">{filteredProfiles.length} usuarios</span>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Responsabilidad</th>
                <th>Estado</th>
                <th>Creacion</th>
              </tr>
            </thead>
            <tbody>
              {filteredProfiles.map((userProfile) => (
                <tr key={userProfile.id}>
                  <td><div className="table-strong">{userProfile.full_name}</div></td>
                  <td>{userProfile.email}</td>
                  <td><span className="metadata-pill">{ROLE_LABELS[userProfile.role]}</span></td>
                  <td>{ROLE_DESCRIPTIONS[userProfile.role]}</td>
                  <td><span className={`status-badge ${userProfile.active ? "status-delivered" : "status-cancelled"}`}>{userProfile.active ? "Activo" : "Inactivo"}</span></td>
                  <td>{formatDate(userProfile.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredProfiles.length === 0 && <EmptyState title="Sin usuarios" text="No hay usuarios visibles para la busqueda actual." />}
      </section>

      <Drawer title="Nuevo usuario" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <form className="drawer-form" onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          onCreateUser({
            full_name: String(form.get("full_name") ?? ""),
            email: String(form.get("email") ?? ""),
            password: String(form.get("password") ?? ""),
            role: String(form.get("role") ?? "comercial") as UserRole
          });
          event.currentTarget.reset();
          setDrawerOpen(false);
        }}>
          <label>Nombre completo<input name="full_name" required /></label>
          <label>Correo electronico<input name="email" type="email" required /></label>
          <label>Contrasena temporal<input name="password" type="password" required minLength={6} /></label>
          <label>
            Rol
            <select name="role" defaultValue="comercial" required>
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>{ROLE_LABELS[role]}</option>
              ))}
            </select>
          </label>
          <div className="role-help-list">
            {ROLE_OPTIONS.map((role) => (
              <div key={role}>
                <strong>{ROLE_LABELS[role]}</strong>
                <span>{ROLE_DESCRIPTIONS[role]}</span>
              </div>
            ))}
          </div>
          <div className="drawer-actions">
            <button className="button-ghost" type="button" onClick={() => setDrawerOpen(false)}>Cancelar</button>
            <button className="button" disabled={isPending}>Crear usuario</button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}

function OrderActionPanel({
  order,
  profile,
  customer,
  contact,
  salesperson,
  creator,
  items,
  events,
  isPending,
  readOnly,
  onTransition,
  onOpenAttachment
}: {
  order: Order;
  profile: Profile;
  customer?: Customer;
  contact?: Contact;
  salesperson?: Profile;
  creator?: Profile;
  items: OrderItem[];
  events: AppData["events"];
  isPending: boolean;
  readOnly: boolean;
  onTransition: (order: Order, transition: TransitionDefinition, extras: TransitionExtras) => void;
  onOpenAttachment: (path: string) => void;
}) {
  const [note, setNote] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState(order.invoice_number ?? "");
  const [remissionNumber, setRemissionNumber] = useState(order.remission_number ?? "");
  const [dispatchGuide, setDispatchGuide] = useState(order.dispatch_guide ?? "");
  const [file, setFile] = useState<File | null>(null);
  const pendingRemissionInvoice = hasPendingRemissionInvoice(order);
  const availableTransitions = readOnly ? [] : getAvailableTransitions(order.status, profile.role)
    .filter((transition) => isTransitionVisibleForOrder(transition, order));
  const total = getOrderTotal(items);
  const latestEvents = [...events].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 4);
  const stageAttachments = getStageAttachments(order, events);

  function submitTransition(transition: TransitionDefinition) {
    if (transition.requiresNote && !note.trim()) {
      alert("Esta accion requiere una nota o razon.");
      return;
    }
    onTransition(order, transition, { note, invoiceNumber, remissionNumber, dispatchGuide, file });
    setNote("");
    setFile(null);
  }

  return (
    <div className="order-detail-panel">
      <div className="detail-grid">
        <section className="detail-card">
          <h3>Resumen del pedido</h3>
          <dl className="definition-list">
            <div><dt>Cliente</dt><dd>{customer?.legal_name ?? "Cliente no visible"}</dd></div>
            <div><dt>Contacto</dt><dd>{contact?.full_name ?? "Sin contacto"}</dd></div>
            <div><dt>Asesor</dt><dd>{salesperson?.full_name ?? creator?.full_name ?? "Sin asesor"}</dd></div>
            <div><dt>Preparacion/envio</dt><dd>{order.delivery_address || customer?.dispatch_address || "Sin direccion"}</dd></div>
            <div><dt>Fecha solicitada</dt><dd>{formatDate(order.requested_delivery_date)}</dd></div>
            <div><dt>Total referencia</dt><dd>{formatMoney(total)}</dd></div>
          </dl>
        </section>

        <section className="detail-card">
          <h3>Productos</h3>
          <ul className="compact-list">
            {items.map((item) => (
              <li key={item.id}>
                <span>{item.quantity} x {item.product_name}</span>
                <strong>{formatMoney(Number(item.quantity) * Number(item.unit_price))}</strong>
              </li>
            ))}
          </ul>
          {items.length === 0 && <p className="muted">Sin productos visibles.</p>}
        </section>

        <section className="detail-card">
          <h3>Documentos y trazabilidad</h3>
          <div className="status-row">
            {order.invoice_number && <span className="metadata-pill">Factura: {order.invoice_number}</span>}
            {order.remission_number && <span className="metadata-pill">Remision: {order.remission_number}</span>}
            {order.dispatch_guide && <span className="metadata-pill">Guia: {order.dispatch_guide}</span>}
            {order.invoice_file_path && <button className="button-ghost button-small" onClick={() => onOpenAttachment(order.invoice_file_path!)}>Ver factura/remision</button>}
            {order.dispatch_file_path && <button className="button-ghost button-small" onClick={() => onOpenAttachment(order.dispatch_file_path!)}>Ver guia</button>}
          </div>
          <div className="attachment-section">
            <h4>Adjuntos por etapa</h4>
            {stageAttachments.length > 0 ? (
              <ul className="attachment-list">
                {stageAttachments.map((attachment) => (
                  <li key={attachment.key}>
                    <div>
                      <strong>{attachment.stage}</strong>
                      <span>{attachment.label} · {attachment.fileName} · {formatDateTime(attachment.createdAt)}</span>
                      {attachment.notes && <small>{attachment.notes}</small>}
                    </div>
                    <button className="button-ghost button-small" type="button" onClick={() => onOpenAttachment(attachment.path)}>
                      Ver adjunto
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Sin adjuntos registrados por etapa.</p>
            )}
          </div>
          <ul className="compact-list events-list">
            {latestEvents.map((event) => (
              <li key={event.id}>
                <span>{formatDateTime(event.created_at)} · {event.action}</span>
                <strong>{event.notes || "Sin nota"}</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <OrderFlowDiagram order={order} events={events} />

      {pendingRemissionInvoice && (
        <div className="remission-alert" role="alert">
          <strong>Factura pendiente por remision</strong>
          <span>Este pedido puede avanzar a despacho/envio, pero debe permanecer visible hasta registrar la factura. No se debe olvidar facturar la remision {order.remission_number}.</span>
        </div>
      )}

      {order.source_message && <div className="notice info">Mensaje original: {order.source_message}</div>}

      {readOnly && (
        <div className="notice info" role="note">
          Vista solo lectura: tu rol puede consultar este pedido porque esta asociado a ti o ya paso por tu etapa, pero no tiene acciones pendientes para tu rol.
        </div>
      )}

      {availableTransitions.length > 0 && (
        <section className="transition-panel">
          <div className="panel-header compact">
            <div>
              <h3>Actualizar estado</h3>
              <p>Registra el siguiente paso del flujo y conserva evidencia cuando aplique.</p>
            </div>
          </div>
          <div className="form-grid five-columns">
            <label>Nota / razon<textarea value={note} onChange={(event) => setNote(event.target.value)} /></label>
            <label>Factura<input value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} /></label>
            <label>Remision<input value={remissionNumber} onChange={(event) => setRemissionNumber(event.target.value)} /></label>
            <label>Guia / soporte envio<input value={dispatchGuide} onChange={(event) => setDispatchGuide(event.target.value)} /></label>
            <label>Adjunto<input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
          </div>
          <div className="actions">
            {availableTransitions.map((transition) => (
              <button
                key={transition.action}
                className={transition.kind === "rejection" || transition.kind === "cancel" || transition.kind === "novelty" ? "button-danger" : "button-secondary"}
                disabled={isPending}
                onClick={() => submitTransition(transition)}
                data-testid={`order-transition-${transition.action}-button`}
              >
                {transition.label}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function OrderFlowDiagram({ order, events }: { order: Order; events: AppData["events"] }) {
  const terminalDetail = TERMINAL_FLOW_DETAILS[order.status];
  const terminalEvent = getLatestStatusEvent(order.status, events);
  const terminalPreviousStatus = terminalEvent?.from_status ?? null;
  const terminalPreviousIndex = terminalPreviousStatus ? getFlowIndexForStatus(terminalPreviousStatus) : -1;
  const currentIndex = getFlowIndexForStatus(order.status);
  const currentSince = getCurrentStatusSince(order, events);
  const currentLabel = terminalDetail?.label ?? ORDER_FLOW_STEPS[currentIndex]?.label ?? STATUS_LABELS[order.status];

  const standardSteps = ORDER_FLOW_STEPS.map((step, index) => {
    let state: "completed" | "current" | "pending" | "blocked" = "pending";

    if (terminalDetail) {
      state = index <= terminalPreviousIndex ? "completed" : "blocked";
    } else if (index < currentIndex) {
      state = "completed";
    } else if (index === currentIndex) {
      state = "current";
    }

    return { ...step, state };
  });

  const steps = terminalDetail
    ? [
      ...standardSteps,
      {
        key: order.status,
        label: terminalDetail.label,
        owner: terminalDetail.owner,
        description: terminalDetail.description,
        statuses: [order.status],
        state: "current" as const
      }
    ]
    : standardSteps;

  const pendingLabels = steps.filter((step) => step.state === "pending").map((step) => step.label);
  const missingText = hasPendingRemissionInvoice(order)
    ? "Alerta: falta facturar la remision."
    : getMissingFlowText(order.status, pendingLabels);

  return (
    <section className="flow-panel">
      <div className="panel-header compact">
        <div>
          <h3>Flujo del pedido</h3>
          <p>
            Estado actual: <strong>{currentLabel}</strong> · Tiempo en estado: <strong>{formatElapsedDuration(currentSince)}</strong>
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="flow-summary">
        <span>Desde {formatDateTime(currentSince)}</span>
        <strong>{missingText}</strong>
      </div>

      <ol className="flow-diagram" aria-label="Flujo operativo del pedido">
        {steps.map((step, index) => (
          <li className={`flow-step is-${step.state}`} key={step.key}>
            <div className="flow-node">{step.state === "completed" ? "OK" : index + 1}</div>
            <div className="flow-copy">
              <div className="flow-title-row">
                <strong>{step.label}</strong>
                <span>{flowStateLabel(step.state)}</span>
              </div>
              <p>{step.description}</p>
              <small>{step.owner}</small>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function StatusBadge({ status }: { status: Order["status"] }) {
  return <span className={`status-badge status-${status.replaceAll("_", "-")}`}>{STATUS_LABELS[status]}</span>;
}

function StatCard({
  label,
  value,
  detail,
  tone = "neutral",
  onClick
}: {
  label: string;
  value: number | string;
  detail: string;
  tone?: "neutral" | "amber" | "blue" | "violet" | "green";
  onClick?: () => void;
}) {
  const className = `stat-card stat-${tone}${onClick ? " stat-card-clickable" : ""}`;

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        <span>{label}</span>
        <strong>{value}</strong>
        <p>{detail}</p>
      </button>
    );
  }

  return (
    <article className={className}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="search-input">
      <span>Buscar</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: React.ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

function FormSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="form-section">
      <div className="form-section-copy">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="form-section-body">{children}</div>
    </section>
  );
}

function Drawer({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={title}>
      <button className="drawer-scrim" type="button" onClick={onClose} aria-label="Cerrar" />
      <aside className="drawer-panel">
        <div className="drawer-header">
          <h2>{title}</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar">x</button>
        </div>
        {children}
      </aside>
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function RoleBlockedPage({ title, text, actionLabel, onAction }: { title: string; text: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="page-stack">
      <PageHeader eyebrow="Acceso por rol" title={title} description={text} />
      <div className="notice info">
        <p>{text}</p>
        <div className="actions compact-actions">
          <button className="button-secondary" type="button" onClick={onAction}>{actionLabel}</button>
        </div>
      </div>
    </div>
  );
}

function getSectionMeta(view: View): SectionMeta {
  const sections: Record<View, SectionMeta> = {
    dashboard: {
      title: "Resumen",
      eyebrow: "Resumen",
      searchPlaceholder: "Buscar pedidos, clientes o asesores"
    },
    orders: {
      title: "Pedidos",
      eyebrow: "Pedidos",
      searchPlaceholder: "Buscar por pedido, cliente, canal o asesor"
    },
    "new-order": {
      title: "Nuevo pedido",
      eyebrow: "Pedidos / Nuevo",
      searchPlaceholder: "Buscar clientes o productos"
    },
    customers: {
      title: "Clientes",
      eyebrow: "Directorio",
      searchPlaceholder: "Buscar clientes, NIT o contactos"
    },
    products: {
      title: "Productos",
      eyebrow: "Catalogo",
      searchPlaceholder: "Buscar productos o SKU"
    },
    reports: {
      title: "Reportes / metricas",
      eyebrow: "Analitica",
      searchPlaceholder: "Buscar pedidos, clientes o estados"
    },
    settings: {
      title: "Configuracion",
      eyebrow: "Administracion",
      searchPlaceholder: "Buscar usuarios o roles"
    }
  };
  return sections[view];
}

function getViewFromPathname(pathname: string | null): View {
  const normalized = (pathname ?? "/").replace(/\/+$/, "") || "/";
  if (normalized === "/" || normalized === "/resumen") return "dashboard";
  if (normalized === "/pedidos") return "orders";
  if (normalized === "/pedidos/nuevo") return "new-order";
  if (normalized === "/clientes") return "customers";
  if (normalized === "/productos") return "products";
  if (normalized === "/reportes") return "reports";
  if (normalized === "/configuracion") return "settings";
  return "dashboard";
}

function channelLabel(channel: SalesChannel) {
  const labels: Record<SalesChannel, string> = {
    whatsapp: "WhatsApp",
    phone: "Llamada",
    email: "Correo",
    in_person: "Presencial",
    other: "Otro"
  };
  return labels[channel];
}

function getStageAttachments(order: Order, events: OrderEvent[]): StageAttachment[] {
  const seenPaths = new Set<string>();
  const attachments: StageAttachment[] = [];

  for (const event of [...events].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const path = getEventFilePath(event);
    if (!path || seenPaths.has(path)) continue;
    seenPaths.add(path);
    attachments.push({
      key: `${event.id}-${path}`,
      stage: getEventStageLabel(event),
      label: getEventActionLabel(event.action),
      fileName: getAttachmentFileName(path),
      path,
      createdAt: event.created_at,
      notes: event.notes
    });
  }

  if (order.invoice_file_path && !seenPaths.has(order.invoice_file_path)) {
    seenPaths.add(order.invoice_file_path);
    attachments.push({
      key: `invoice-${order.invoice_file_path}`,
      stage: "Facturacion",
      label: "Factura/remision",
      fileName: getAttachmentFileName(order.invoice_file_path),
      path: order.invoice_file_path,
      createdAt: order.invoiced_at ?? order.remitted_at ?? order.updated_at,
      notes: null
    });
  }

  if (order.dispatch_file_path && !seenPaths.has(order.dispatch_file_path)) {
    attachments.push({
      key: `dispatch-${order.dispatch_file_path}`,
      stage: "Despacho / envio",
      label: "Guia / soporte envio",
      fileName: getAttachmentFileName(order.dispatch_file_path),
      path: order.dispatch_file_path,
      createdAt: order.dispatched_at ?? order.updated_at,
      notes: null
    });
  }

  return attachments.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function getEventFilePath(event: OrderEvent) {
  const value = event.metadata?.file_path;
  return typeof value === "string" && value.trim() ? value : null;
}

function getAttachmentFileName(path: string) {
  return path.split("/").pop() ?? "Adjunto";
}

function getEventActionLabel(action: string) {
  if (action === "created") return "Pedido creado";
  return TRANSITIONS.find((transition) => transition.action === action)?.label ?? action;
}

function getEventStageLabel(event: OrderEvent) {
  if (event.action === "created" || event.action === "submit_for_approval") return "Registro comercial";
  if (event.action === "approve" || event.action === "reject") return "Aprobacion";
  if (event.action === "invoice" || event.action === "remit" || event.action === "invoice_after_dispatch") return "Facturacion";
  if (event.action === "dispatch" || event.action === "retry_dispatch") return "Despacho / envio";
  if (event.action === "deliver") return "Entrega";
  if (event.action === "novelty") return "Novedad";
  if (event.action === "cancel") return "Anulacion";
  return event.to_status ? STATUS_LABELS[event.to_status] : "Trazabilidad";
}

function createLookups(data: AppData) {
  return {
    profiles: new Map(data.profiles.map((item) => [item.id, item])),
    customers: new Map(data.customers.map((item) => [item.id, item])),
    contacts: new Map(data.contacts.map((item) => [item.id, item])),
    products: new Map(data.products.map((item) => [item.id, item])),
    customerProductPrices: new Map(data.customerProductPrices.map((item) => [customerProductPriceKey(item.customer_id, item.product_id), item]))
  };
}

function customerProductPriceKey(customerId: string, productId: string) {
  return `${customerId}::${productId}`;
}

function findCustomerProductPrice(customerId: string, productId: string, data: AppData) {
  return data.customerProductPrices.find(
    (entry) => entry.customer_id === customerId && entry.product_id === productId
  );
}

function getCatalogPrice(productId: string, data: AppData) {
  return data.products.find((product) => product.id === productId)?.default_price ?? 0;
}

function PriceComparisonHint({
  productId,
  customerId,
  data
}: {
  productId: string;
  customerId: string;
  data: AppData;
}) {
  const customPrice = productId ? findCustomerProductPrice(customerId, productId, data) : undefined;
  const catalogPrice = productId ? getCatalogPrice(productId, data) : 0;

  if (!customPrice || customPrice.price === catalogPrice) {
    return <div className="price-compare" />;
  }

  const diffPct = catalogPrice > 0 ? Math.round((1 - customPrice.price / catalogPrice) * 100) : 0;

  return (
    <div className="price-compare">
      <s className="price-catalog-strike">{formatMoney(catalogPrice)}</s>
      {diffPct !== 0 && (
        <span className={`price-diff-badge ${diffPct > 0 ? "is-discount" : "is-markup"}`}>
          {diffPct > 0 ? "-" : "+"}{Math.abs(diffPct)}%
        </span>
      )}
    </div>
  );
}

function getEffectiveUnitPrice(customerId: string, productId: string, data: AppData) {
  const customPrice = findCustomerProductPrice(customerId, productId, data);
  if (customPrice) return customPrice.price;
  return data.products.find((product) => product.id === productId)?.default_price ?? 0;
}

function getOrderTotal(items: OrderItem[]) {
  return items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price), 0);
}

function hasPendingRemissionInvoice(order: Order) {
  return Boolean(order.remission_number && !order.invoice_number);
}

const QUICK_FILTER_LABELS: Record<string, string> = {
  active: "Activos (todos los pendientes)",
  pending_invoicing_group: "Pendientes de facturacion (incl. remision)",
  pending_remission_invoice: "Remision sin factura",
  dispatched_today: "Despachado hoy"
};

function clickableRowProps(onActivate: () => void) {
  return {
    role: "button" as const,
    tabIndex: 0,
    onClick: onActivate,
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onActivate();
      }
    }
  };
}

function matchesQuickFilter(order: Order, filter: string) {
  if (filter === "all") return true;
  if (filter === "active") return isActiveStatus(order.status) || hasPendingRemissionInvoice(order);
  if (filter === "pending_invoicing_group") return order.status === "pending_invoicing" || hasPendingRemissionInvoice(order);
  if (filter === "pending_remission_invoice") return hasPendingRemissionInvoice(order);
  if (filter === "dispatched_today") return order.status === "dispatched" && isToday(order.dispatched_at ?? order.updated_at);
  return order.status === filter;
}

interface CustomerCadence {
  customerId: string;
  legalName: string;
  orderCount: number;
  averageIntervalDays: number | null;
  lastOrderAt: string | null;
  daysSinceLastOrder: number | null;
  status: "sin-historial" | "a-tiempo" | "atrasado";
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function computeCustomerCadence(data: AppData): CustomerCadence[] {
  const ordersByCustomer = new Map<string, Order[]>();
  for (const order of data.orders) {
    const list = ordersByCustomer.get(order.customer_id);
    if (list) {
      list.push(order);
    } else {
      ordersByCustomer.set(order.customer_id, [order]);
    }
  }

  const now = Date.now();

  return data.customers
    .map((customer): CustomerCadence => {
      const orders = (ordersByCustomer.get(customer.id) ?? [])
        .slice()
        .sort((a, b) => a.created_at.localeCompare(b.created_at));

      if (orders.length === 0) {
        return {
          customerId: customer.id,
          legalName: customer.legal_name,
          orderCount: 0,
          averageIntervalDays: null,
          lastOrderAt: null,
          daysSinceLastOrder: null,
          status: "sin-historial"
        };
      }

      const lastOrderAt = orders[orders.length - 1].created_at;
      const daysSinceLastOrder = Math.floor((now - new Date(lastOrderAt).getTime()) / MS_PER_DAY);

      if (orders.length < 2) {
        return {
          customerId: customer.id,
          legalName: customer.legal_name,
          orderCount: orders.length,
          averageIntervalDays: null,
          lastOrderAt,
          daysSinceLastOrder,
          status: "sin-historial"
        };
      }

      const intervalDays: number[] = [];
      for (let index = 1; index < orders.length; index += 1) {
        const diff = new Date(orders[index].created_at).getTime() - new Date(orders[index - 1].created_at).getTime();
        intervalDays.push(diff / MS_PER_DAY);
      }
      const averageIntervalDays = intervalDays.reduce((sum, value) => sum + value, 0) / intervalDays.length;

      return {
        customerId: customer.id,
        legalName: customer.legal_name,
        orderCount: orders.length,
        averageIntervalDays,
        lastOrderAt,
        daysSinceLastOrder,
        status: daysSinceLastOrder > averageIntervalDays ? "atrasado" : "a-tiempo"
      };
    })
    .filter((row) => row.orderCount > 0)
    .sort((a, b) => {
      if (a.status === "atrasado" && b.status !== "atrasado") return -1;
      if (b.status === "atrasado" && a.status !== "atrasado") return 1;
      return (b.daysSinceLastOrder ?? 0) - (a.daysSinceLastOrder ?? 0);
    });
}

function isOrderVisibleForProfile(order: Order, profile: Profile) {
  return isOrderVisibleForRole({
    status: order.status,
    role: profile.role,
    isCreatedOrAssigned: order.created_by === profile.id || order.assigned_salesperson_id === profile.id,
    adminApproved: Boolean(order.admin_approved_by),
    hasInvoice: Boolean(order.invoice_number || order.invoiced_at),
    hasRemission: Boolean(order.remission_number || order.remitted_at),
    hasDispatch: Boolean(order.dispatch_guide || order.dispatch_file_path || order.dispatched_at || order.delivered_at)
  });
}

function canActOnOrder(order: Order, profile: Profile) {
  if (profile.role === "comercial" && order.created_by !== profile.id && order.assigned_salesperson_id !== profile.id) {
    return false;
  }

  return getAvailableTransitions(order.status, profile.role)
    .filter((transition) => isTransitionVisibleForOrder(transition, order))
    .length > 0;
}

function isTransitionVisibleForOrder(transition: TransitionDefinition, order: Order) {
  if (transition.action === "invoice_after_dispatch") return hasPendingRemissionInvoice(order);
  if (transition.action === "invoice") return !order.invoice_number;
  if (transition.action === "remit") return !order.invoice_number;
  return true;
}

function sortOrders(a: Order, b: Order, sortBy: string, orderItems: OrderItem[]) {
  if (sortBy === "created_desc") return b.created_at.localeCompare(a.created_at);
  if (sortBy === "value_desc") {
    const totalA = getOrderTotal(orderItems.filter((item) => item.order_id === a.id));
    const totalB = getOrderTotal(orderItems.filter((item) => item.order_id === b.id));
    return totalB - totalA;
  }
  if (sortBy === "customer_asc") return a.customer_id.localeCompare(b.customer_id);
  return b.updated_at.localeCompare(a.updated_at);
}

function isToday(value: string | null | undefined) {
  if (!value) return false;
  const date = new Date(value);
  const today = new Date();
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 1) return "Hace instantes";
  if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;
  return formatDate(value);
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "US";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function getFlowIndexForStatus(status: Order["status"]) {
  return ORDER_FLOW_STEPS.findIndex((step) => step.statuses.includes(status));
}

function getLatestStatusEvent(status: Order["status"], events: AppData["events"]) {
  return [...events]
    .filter((event) => event.to_status === status)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

function getCurrentStatusSince(order: Order, events: AppData["events"]) {
  const latestEvent = getLatestStatusEvent(order.status, events);
  return latestEvent?.created_at ?? getKnownStatusTimestamp(order) ?? order.updated_at ?? order.created_at;
}

function getKnownStatusTimestamp(order: Order) {
  if (order.status === "registered" || order.status === "pending_approval") return order.created_at;
  if (order.status === "pending_invoicing") return order.admin_approved_at;
  if (order.status === "invoiced") return order.invoiced_at;
  if (order.status === "remitted_pending_invoice") return order.remitted_at;
  if (order.status === "pending_dispatch") return order.invoiced_at ?? order.remitted_at;
  if (order.status === "dispatched") return order.dispatched_at;
  if (order.status === "delivered") return order.delivered_at;
  return order.updated_at;
}

function formatElapsedDuration(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  const diffMinutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  const days = Math.floor(diffMinutes / 1440);
  const hours = Math.floor((diffMinutes % 1440) / 60);
  const minutes = diffMinutes % 60;

  if (days > 0) return `${days} d ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes} min`;
  if (minutes > 0) return `${minutes} min`;
  return "Menos de 1 min";
}

function getMissingFlowText(status: Order["status"], pendingLabels: string[]) {
  if (status === "novelty") return "Falta resolver la novedad y reintentar despacho.";
  if (status === "rejected" || status === "cancelled") return "Flujo detenido; no quedan pasos operativos.";
  if (pendingLabels.length === 0) return "Flujo completo.";
  return `Falta: ${pendingLabels.join(", ")}.`;
}

function flowStateLabel(state: "completed" | "current" | "pending" | "blocked") {
  const labels = {
    completed: "Completado",
    current: "Actual",
    pending: "Falta",
    blocked: "No aplica"
  };
  return labels[state];
}

async function bootstrapUser(supabase: DromedarioSupabaseClient, session: Session) {
  const { data: profileData, error: profileError } = await supabase
    .from("dromedario_profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();

  if (profileError) throw profileError;

  let profile = profileData as Profile | null;

  if (!profile) {
    const { data: insertedProfile, error: insertError } = await supabase
      .from("dromedario_profiles")
      .insert({
        id: session.user.id,
        email: session.user.email ?? "sin-correo@local",
        full_name: session.user.user_metadata.full_name ?? session.user.email?.split("@")[0] ?? "Usuario",
        role: "comercial"
      })
      .select("*")
      .single();
    if (insertError) throw insertError;
    profile = insertedProfile as Profile;
  }

  const [profiles, customers, contacts, products, customerProductPrices, orders, orderItems, events] = await Promise.all([
    supabase.from("dromedario_profiles").select("*").order("full_name", { ascending: true }),
    supabase.from("dromedario_customers").select("*").order("legal_name", { ascending: true }),
    supabase.from("dromedario_contacts").select("*").order("full_name", { ascending: true }),
    supabase.from("dromedario_products").select("*").order("name", { ascending: true }),
    supabase.from("dromedario_customer_product_prices").select("*"),
    supabase.from("dromedario_orders").select("*").order("created_at", { ascending: false }),
    supabase.from("dromedario_order_items").select("*").order("created_at", { ascending: true }),
    supabase.from("dromedario_order_events").select("*").order("created_at", { ascending: false })
  ]);

  const results = [profiles, customers, contacts, products, customerProductPrices, orders, orderItems, events];
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;

  const loadedOrders = (orders.data ?? []) as Order[];
  const loadedOrderItems = (orderItems.data ?? []) as OrderItem[];
  const loadedEvents = (events.data ?? []) as AppData["events"];
  const visibleOrders = loadedOrders.filter((order) => isOrderVisibleForProfile(order, profile));
  const visibleOrderIds = new Set(visibleOrders.map((order) => order.id));

  return {
    profile,
    appData: {
      profiles: (profiles.data ?? []) as Profile[],
      customers: (customers.data ?? []) as Customer[],
      contacts: (contacts.data ?? []) as Contact[],
      products: (products.data ?? []) as Product[],
      customerProductPrices: (customerProductPrices.data ?? []) as CustomerProductPrice[],
      orders: visibleOrders,
      orderItems: loadedOrderItems.filter((item) => visibleOrderIds.has(item.order_id)),
      events: loadedEvents.filter((event) => visibleOrderIds.has(event.order_id))
    }
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) return String((error as { message: unknown }).message);
  return "Ocurrio un error inesperado.";
}
