// Raindrop.io API client

export interface RaindropCollection {
  _id: number
  title: string
  count: number
  parent?: { $id: number }
}

export async function fetchCollections(accessToken: string): Promise<RaindropCollection[]> {
  const headers = { Authorization: `Bearer ${accessToken}` }
  const [rootRes, childRes] = await Promise.all([
    fetch('https://api.raindrop.io/rest/v1/collections', { headers }),
    fetch('https://api.raindrop.io/rest/v1/collections/childrens', { headers }),
  ])
  let items: RaindropCollection[] = []
  if (rootRes.ok) {
    const data = await rootRes.json()
    items = (data.items || []).filter((c: RaindropCollection) => c._id >= 0)
  }
  if (childRes.ok) {
    const data = await childRes.json()
    const children = (data.items || []).filter((c: RaindropCollection) => c._id >= 0)
    items = [...items, ...children]
  }
  return items
}

export async function fetchUserInfo(accessToken: string): Promise<{ name: string; email: string } | null> {
  try {
    const res = await fetch('https://api.raindrop.io/rest/v1/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    const data = await res.json()
    return { name: data.user?.name || '', email: data.user?.email || '' }
  } catch {
    return null
  }
}
