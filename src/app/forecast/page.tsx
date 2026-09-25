import { redirect } from "next/navigation";

export default async function ForecastPage() {
  redirect("/inbox?view=signals");
}
