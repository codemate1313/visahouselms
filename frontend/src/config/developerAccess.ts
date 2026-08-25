const LOCAL_DEVELOPER_ACCESS_SLUG = "vh-control-9f4c2a";

export const DEVELOPER_ACCESS_SLUG =
  import.meta.env.VITE_DEVELOPER_ACCESS_SLUG || (import.meta.env.DEV ? LOCAL_DEVELOPER_ACCESS_SLUG : "developer");
