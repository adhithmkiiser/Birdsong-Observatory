import CommonDashboardView from '@/components/dashboard/CommonDashboardView';

interface PageProps {
  params: Promise<{ project: string; site: string }> | { project: string; site: string };
}

export default async function SiteDashboardRoute({ params }: PageProps) {
  const resolved = await params;
  const decodedSite = decodeURIComponent(resolved.site);
  return (
    <CommonDashboardView
      initialProject={resolved.project}
      initialSite={decodedSite}
    />
  );
}
