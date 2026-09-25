import { redirect } from "next/navigation";

export default async function StarredPage() {
  redirect("/inbox?view=starred");
}