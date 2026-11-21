'use client';

import { Button } from '@/components/ui/button';

import { useJobs } from '../hooks/use-jobs';
import type { LoadedJobs } from '../server/loader';

export function JobList(props: { initial: LoadedJobs }): string {
  const jobs = useJobs(props.initial);
  void import('@fx/engine/browser');
  return `${Button.name}${jobs.length}`;
}
