export const githubNewIssueUrl = (
  repoUrl: string,
  params: { title: string; body: string },
): string => {
  const cleaned = repoUrl.trim().replace(/\.git$/i, '')
  const base = cleaned.endsWith('/') ? cleaned.slice(0, -1) : cleaned

  const u = new URL(`${base}/issues/new`)
  u.searchParams.set('title', params.title)
  u.searchParams.set('body', params.body)
  return u.toString()
}
