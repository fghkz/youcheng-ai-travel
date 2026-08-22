import { redirect } from "next/navigation";
export default async function PlanAliasPage({ params }: { params: Promise<{ planId: string }> }) { const { planId } = await params; redirect(`/trips/${planId}`); }

