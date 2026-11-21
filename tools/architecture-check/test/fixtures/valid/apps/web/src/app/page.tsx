import { Button } from '@/components/ui/button';
import { JobList } from '@/features/jobs';
import { loadJobs } from '@/features/jobs/server/loader';

export default async function Page(): Promise<string> {
  const jobs = await loadJobs();
  return `${JobList.name}${Button.name}${jobs.length}`;
}
