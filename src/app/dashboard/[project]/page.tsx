import CommonDashboardView from '@/components/dashboard/CommonDashboardView';

interface PageProps {
  params: Promise<{ project: string }> | { project: string };
}

export default async function ProjectDashboardRoute({ params }: PageProps) {
  const resolved = await params;
  return <CommonDashboardView initialProject={resolved.project} />;
}
