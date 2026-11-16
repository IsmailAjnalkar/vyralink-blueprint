// Role names as people read them. Plain module: usable from server and client components.
const ROLE_LABEL: Record<string, string> = {
  brand_owner: "Brand Owner", brand_marketing_manager: "Brand Manager", brand_finance: "Brand Finance",
  location_manager: "Location Manager", producer: "Studio Producer", inventory: "Inventory Coordinator", finance_admin: "Finance Administrator",
};
export const roleLabel = (r: string) => ROLE_LABEL[r] ?? r;
