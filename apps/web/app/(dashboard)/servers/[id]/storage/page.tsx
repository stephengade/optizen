import { redirect } from 'next/navigation'

export default async function ServerStorageRedirectPage(
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params
  redirect(`/storage?server=${id}`)
}
