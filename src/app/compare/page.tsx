import { CompareClient } from "./compare-client";

export const dynamic = "force-dynamic";

export { formatDate, getImportanceBadge, getImpactBadge, getImpactLabel } from "./compare-client";

export default function ComparePage() {
  return <CompareClient />;
}
