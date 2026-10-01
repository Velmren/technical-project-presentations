// Synthetic service description used as the starting document. Names,
// addresses and figures are invented.
const service = {
  service: "billing-api",
  version: "4.12.0",
  region: "eu-central-1",
  updatedAt: "2026-09-28T14:05:00Z",
  owners: [
    { name: "Mira Olsen", email: "mira@example.com", role: "lead" },
    { name: "Tomas Reyes", email: "tomas@example.com", role: "on-call" },
  ],
  endpoints: [
    {
      method: "GET",
      path: "/v1/invoices",
      p95Ms: 182,
      public: true,
      tags: ["read"],
    },
    {
      method: "POST",
      path: "/v1/invoices",
      p95Ms: 340,
      public: true,
      tags: ["write"],
    },
    {
      method: "GET",
      path: "/v1/invoices/{id}",
      p95Ms: 96,
      public: true,
      tags: ["read"],
    },
    {
      method: "POST",
      path: "/v1/refunds",
      p95Ms: 512,
      public: false,
      tags: ["write", "audit"],
    },
    {
      method: "DELETE",
      path: "/v1/sessions/{id}",
      p95Ms: 44,
      public: false,
      tags: [],
    },
  ],
  limits: { requestsPerMinute: 1200, maxBodyBytes: 1048576, burst: 1.5 },
  features: { idempotencyKeys: true, webhooks: true, sandbox: false },
  maintenance: null,
};

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

export const sourceSample = pretty(service);

export const comparisonSample = pretty({
  ...service,
  version: "4.13.0",
  updatedAt: "2026-09-30T09:40:00Z",
  endpoints: [
    ...service.endpoints.slice(0, 3),
    { ...service.endpoints[3], p95Ms: 288 },
    service.endpoints[4],
    {
      method: "GET",
      path: "/v1/payouts",
      p95Ms: 131,
      public: true,
      tags: ["read"],
    },
  ],
  limits: { ...service.limits, requestsPerMinute: 1500 },
  features: { ...service.features, sandbox: true },
});

export const schemaSample = JSON.stringify(
  {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    required: ["service", "version", "endpoints"],
    properties: {
      service: { type: "string", pattern: "^[a-z][a-z0-9-]*$" },
      version: { type: "string", pattern: "^\\d+\\.\\d+\\.\\d+$" },
      updatedAt: { type: "string", format: "date-time" },
      owners: {
        type: "array",
        items: {
          type: "object",
          required: ["name", "email"],
          properties: {
            name: { type: "string" },
            email: { type: "string", format: "email" },
          },
        },
      },
      endpoints: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          required: ["method", "path", "p95Ms"],
          properties: {
            method: { enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] },
            path: { type: "string", pattern: "^/" },
            p95Ms: { type: "number", minimum: 0, maximum: 400 },
          },
        },
      },
    },
  },
  null,
  2,
);

// Adds an endpoint, raises a limit and checks the region before changing anything else.
export const patchSample = JSON.stringify(
  [
    { op: "test", path: "/region", value: "eu-central-1" },
    { op: "replace", path: "/version", value: "4.12.1" },
    {
      op: "add",
      path: "/endpoints/-",
      value: {
        method: "GET",
        path: "/v1/payouts",
        p95Ms: 131,
        public: true,
        tags: ["read"],
      },
    },
    { op: "replace", path: "/limits/requestsPerMinute", value: 1500 },
    { op: "remove", path: "/maintenance" },
  ],
  null,
  2,
);

export const queryExamples = [
  { id: "filter", query: "$.endpoints[?@.public == true].path" },
  { id: "compare", query: "$.endpoints[?@.p95Ms > 200].path" },
  { id: "all", query: "$..email" },
  { id: "slice", query: "$.endpoints[0:2]" },
  { id: "match", query: '$.endpoints[?match(@.method, "POST|PUT")].path' },
] as const;

export const defaultQuery = "$.endpoints[?@.p95Ms > 200].path";
