import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StorageUsage {
  totalBytes: number;
  loading: boolean;
}

export function formatStorageSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function useUserStorageUsage(userId: string | undefined): StorageUsage {
  const [totalBytes, setTotalBytes] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }

    const calculate = async () => {
      setLoading(true);
      try {
        // Get all orgs where user is admin (owner)
        const { data: orgs } = await supabase
          .from('organizations')
          .select('id')
          .eq('owner_id', userId);

        const orgIds = orgs?.map(o => o.id) || [];

        // Get projects created by user + projects in user's orgs
        let projectIds: string[] = [];

        const { data: userProjects } = await supabase
          .from('projects')
          .select('id')
          .eq('created_by', userId);
        projectIds.push(...(userProjects?.map(p => p.id) || []));

        if (orgIds.length > 0) {
          const { data: orgProjects } = await supabase
            .from('projects')
            .select('id')
            .in('organization_id', orgIds);
          projectIds.push(...(orgProjects?.map(p => p.id) || []));
        }

        projectIds = [...new Set(projectIds)];

        if (projectIds.length === 0) { setTotalBytes(0); setLoading(false); return; }

        // Sum file sizes from outputs and attachments
        let total = 0;
        const { data: outputs } = await supabase
          .from('project_outputs')
          .select('file_size')
          .in('project_id', projectIds);
        outputs?.forEach(o => { total += (o.file_size || 0); });

        const { data: attachments } = await supabase
          .from('project_attachments')
          .select('file_size')
          .in('project_id', projectIds);
        attachments?.forEach(a => { total += (a.file_size || 0); });

        setTotalBytes(total);
      } catch (err) {
        console.error('Error calculating storage:', err);
      } finally {
        setLoading(false);
      }
    };

    calculate();
  }, [userId]);

  return { totalBytes, loading };
}

export function useOrgStorageUsage(orgId: string | undefined): StorageUsage {
  const [totalBytes, setTotalBytes] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) { setLoading(false); return; }

    const calculate = async () => {
      setLoading(true);
      try {
        const { data: projects } = await supabase
          .from('projects')
          .select('id')
          .eq('organization_id', orgId);

        const projectIds = projects?.map(p => p.id) || [];
        if (projectIds.length === 0) { setTotalBytes(0); setLoading(false); return; }

        let total = 0;
        const { data: outputs } = await supabase
          .from('project_outputs')
          .select('file_size')
          .in('project_id', projectIds);
        outputs?.forEach(o => { total += (o.file_size || 0); });

        const { data: attachments } = await supabase
          .from('project_attachments')
          .select('file_size')
          .in('project_id', projectIds);
        attachments?.forEach(a => { total += (a.file_size || 0); });

        setTotalBytes(total);
      } catch (err) {
        console.error('Error calculating org storage:', err);
      } finally {
        setLoading(false);
      }
    };

    calculate();
  }, [orgId]);

  return { totalBytes, loading };
}

export function useProjectStorageUsage(projectId: string | undefined): StorageUsage {
  const [totalBytes, setTotalBytes] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) { setLoading(false); return; }

    const calculate = async () => {
      setLoading(true);
      try {
        let total = 0;
        const { data: outputs } = await supabase
          .from('project_outputs')
          .select('file_size')
          .eq('project_id', projectId);
        outputs?.forEach(o => { total += (o.file_size || 0); });

        const { data: attachments } = await supabase
          .from('project_attachments')
          .select('file_size')
          .eq('project_id', projectId);
        attachments?.forEach(a => { total += (a.file_size || 0); });

        setTotalBytes(total);
      } catch (err) {
        console.error('Error calculating project storage:', err);
      } finally {
        setLoading(false);
      }
    };

    calculate();
  }, [projectId]);

  return { totalBytes, loading };
}
