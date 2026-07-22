import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function PortalEquipmentDetailAliasPage({ params }: Props) {
  const { id } = await params;
  redirect(`/portal/printers/${id}`);
}
