import StatusUpdates from '../StatusUpdates';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
 const { id } = await params;
 return <StatusUpdates key={id} id={id} />;
}
