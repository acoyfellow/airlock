export type FleetTask = {
  id: string;
  description: string;
  writes?: Record<string, string | number>;
  appendReadme?: string;
};

// Every worker starts from the same base commit. Two tasks deliberately edit
// different keys in the same one-line JSON file (a textual collision that can
// be reconciled). Two others demand incompatible values for the same behavior
// (a semantic collision that must be blocked, not guessed through).
export const tasks: FleetTask[] = [
  {
    id: "banner",
    description: "Change the checkout banner to fleet-ready.",
    writes: { banner: "fleet-ready" },
  },
  {
    id: "currency",
    description: "Change the displayed currency to EUR.",
    writes: { currency: "EUR" },
  },
  {
    id: "docs",
    description: "Document that checkout changes are reconciled before release.",
    appendReadme: "Checkout changes are reconciled before release.",
  },
  {
    id: "timeout-fast",
    description: "Require checkout to time out after 5 seconds.",
    writes: { checkoutTimeoutMs: 5_000 },
  },
  {
    id: "timeout-slow",
    description: "Require checkout to time out after 30 seconds.",
    writes: { checkoutTimeoutMs: 30_000 },
  },
];
