import { apiGroup } from "@xanots/sdk";

/**
 * The one API group. Its canonical slug is PINNED so the public paths are
 * stable (`/api:spend/...`) and `getPath()` resolves in the browser bundle
 * without needing a lock.
 */
export const spendApi = apiGroup({ name: "spend", canonical: "spend" });
