import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Film, Sparkles, Palette, Share2, Globe, Layout, Folder, Loader2, Check } from 'lucide-react';

interface ProjectTemplate {
  id: string;
  name: string;
  description: string | null;
  job_type: string;
  default_title: string | null;
  default_description: string | null;
  icon: string | null;
}

interface ProjectTemplatesProps {
  onSelect: (template: ProjectTemplate) => void;
  selectedId?: string;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Film,
  Sparkles,
  Palette,
  Share2,
  Globe,
  Layout,
  Folder,
};

const jobTypeColors: Record<string, string> = {
  video_editing: 'bg-purple-500',
  design: 'bg-pink-500',
  website: 'bg-blue-500',
  other: 'bg-gray-500',
};

const jobTypeLabels: Record<string, string> = {
  video_editing: 'Video',
  design: 'Design',
  website: 'Website',
  other: 'Other',
};

export function ProjectTemplates({ onSelect, selectedId }: ProjectTemplatesProps) {
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('project_templates')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-12">
        <Folder className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">No templates available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => {
          const IconComponent = iconMap[template.icon || 'Folder'] || Folder;
          const isSelected = selectedId === template.id;

          return (
            <Card
              key={template.id}
              onClick={() => onSelect(template)}
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg relative overflow-hidden group ${
                isSelected 
                  ? 'border-2 border-primary ring-2 ring-primary/20 bg-primary/5' 
                  : 'border-2 border-border hover:border-foreground/50'
              }`}
            >
              {isSelected && (
                <div className="absolute top-3 right-3 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                  <Check className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  <div className={`h-12 w-12 rounded-lg flex items-center justify-center transition-colors ${
                    isSelected 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-secondary text-foreground group-hover:bg-foreground group-hover:text-background'
                  }`}>
                    <IconComponent className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base font-semibold truncate">
                      {template.name}
                    </CardTitle>
                    <Badge 
                      variant="secondary" 
                      className={`mt-1 text-xs ${jobTypeColors[template.job_type]} text-white border-0`}
                    >
                      {jobTypeLabels[template.job_type] || template.job_type}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <CardDescription className="text-sm line-clamp-2 min-h-[2.5rem]">
                  {template.description || 'No description available'}
                </CardDescription>
                {template.default_title && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Default title:</span> {template.default_title}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
