import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, Building2, FolderOpen, MessageSquare, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  type: 'project' | 'organization' | 'file' | 'message';
  title: string;
  subtitle?: string;
  link: string;
}

export function GlobalSearch() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Keyboard shortcut: Cmd/Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Search function
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || !user) {
      setResults([]);
      return;
    }

    setLoading(true);
    const searchResults: SearchResult[] = [];

    try {
      // Search projects
      const { data: projects } = await supabase
        .from('projects')
        .select('id, title, project_code, organization_id')
        .or(`title.ilike.%${searchQuery}%,project_code.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
        .limit(5);

      if (projects) {
        projects.forEach((p) => {
          searchResults.push({
            id: p.id,
            type: 'project',
            title: p.title,
            subtitle: p.project_code || undefined,
            link: `/project/${p.id}`,
          });
        });
      }

      // Search organizations
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, name')
        .ilike('name', `%${searchQuery}%`)
        .limit(3);

      if (orgs) {
        orgs.forEach((o) => {
          searchResults.push({
            id: o.id,
            type: 'organization',
            title: o.name,
            link: `/org/${o.id}`,
          });
        });
      }

      // Search files (attachments & outputs)
      const { data: attachments } = await supabase
        .from('project_attachments')
        .select('id, file_name, project_id')
        .ilike('file_name', `%${searchQuery}%`)
        .limit(3);

      if (attachments) {
        attachments.forEach((a) => {
          searchResults.push({
            id: a.id,
            type: 'file',
            title: a.file_name,
            subtitle: 'Attachment',
            link: `/project/${a.project_id}`,
          });
        });
      }

      // Search messages
      const { data: messages } = await supabase
        .from('messages')
        .select('id, content, sender_id')
        .ilike('content', `%${searchQuery}%`)
        .limit(3);

      if (messages) {
        messages.forEach((m) => {
          searchResults.push({
            id: m.id,
            type: 'message',
            title: m.content.substring(0, 60) + (m.content.length > 60 ? '...' : ''),
            link: `/dashboard`, // Navigate to dashboard for now
          });
        });
      }

      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      navigate(results[selectedIndex].link);
      setOpen(false);
      setQuery('');
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const handleSelect = (result: SearchResult) => {
    navigate(result.link);
    setOpen(false);
    setQuery('');
  };

  const getIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'project':
        return FolderOpen;
      case 'organization':
        return Building2;
      case 'file':
        return FileText;
      case 'message':
        return MessageSquare;
      default:
        return FileText;
    }
  };

  const getTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'project':
        return 'Project';
      case 'organization':
        return 'Organization';
      case 'file':
        return 'File';
      case 'message':
        return 'Message';
      default:
        return type;
    }
  };

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-9 p-0 xl:h-10 xl:w-60 xl:justify-start xl:px-3 xl:py-2"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4 xl:mr-2" />
        <span className="hidden xl:inline-flex">Search...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-2 hidden h-6 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 xl:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-0 p-0 sm:max-w-[600px]">
          <DialogHeader className="border-b border-border p-4">
            <DialogTitle className="sr-only">Search</DialogTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects, organizations, files, messages..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                className="pl-10 pr-10 border-0 focus-visible:ring-0 bg-transparent text-base"
                autoFocus
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[400px]">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : results.length === 0 && query ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No results found for "{query}"
              </div>
            ) : results.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Start typing to search...
              </div>
            ) : (
              <div className="p-2">
                {results.map((result, index) => {
                  const Icon = getIcon(result.type);
                  return (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleSelect(result)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors',
                        index === selectedIndex
                          ? 'bg-accent text-accent-foreground'
                          : 'hover:bg-muted'
                      )}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded border border-border bg-muted">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{result.title}</div>
                        {result.subtitle && (
                          <div className="text-xs text-muted-foreground truncate">
                            {result.subtitle}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground capitalize">
                        {getTypeLabel(result.type)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          <div className="border-t border-border p-2 text-xs text-muted-foreground flex items-center justify-between">
            <span>
              <kbd className="px-1 py-0.5 rounded border border-border bg-muted">↑</kbd>
              <kbd className="ml-1 px-1 py-0.5 rounded border border-border bg-muted">↓</kbd>
              <span className="ml-1">to navigate</span>
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded border border-border bg-muted">Enter</kbd>
              <span className="ml-1">to select</span>
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded border border-border bg-muted">Esc</kbd>
              <span className="ml-1">to close</span>
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
