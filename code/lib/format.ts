export const moneyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0
});

export const shortDateFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium"
});

export const shortDateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short"
});

export function formatMoney(value: number | null | undefined) {
  return moneyFormatter.format(value ?? 0);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  return shortDateFormatter.format(new Date(value));
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  return shortDateTimeFormatter.format(new Date(value));
}

export function sanitizeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}
