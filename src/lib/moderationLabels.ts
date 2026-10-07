export const REPORT_REASON_LABELS: Record<string, string> = {
  contact_outside: "Talk or pay outside Crafteey",
  abusive: "Rude or abusive",
  scam: "Looks like a scam",
  unsafe: "Feels unsafe",
  fake_request: "Fake or time-wasting request",
  other: "Something else",
};

export const REPORT_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  reviewed: "Reviewed",
  action_taken: "Action taken",
  dismissed: "Dismissed",
};

export const LOCK_REASON_LABELS: Record<string, string> = {
  phone: "Phone number",
  email: "Email",
  link: "Link",
  social: "Social app",
  outside_contact: "Outside contact",
  payment_outside: "Outside payment",
};