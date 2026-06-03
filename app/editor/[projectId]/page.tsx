interface EditorWorkspacePageProps {
  params: Promise<{
    projectId: string
  }>
}

export default async function EditorWorkspacePage({ params }: EditorWorkspacePageProps) {
  const { projectId } = await params

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-10">
      <div className="w-full max-w-2xl space-y-3 text-center">
        <h1 className="text-2xl font-semibold text-copy-primary">Project Workspace</h1>
        <p className="text-copy-muted">Loaded project room: {projectId}</p>
      </div>
    </div>
  )
}
