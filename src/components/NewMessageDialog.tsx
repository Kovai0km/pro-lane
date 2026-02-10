import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Search, MessageSquare, User } from 'lucide-react';

interface UserResult {
  id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface NewMessageDialogProps {
  isOpen?: boolean;
  onClose?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSelectUser?: (userId: string) => void;
  orgId?: string;
}

export function NewMessageDialog({ 
  isOpen, 
  onClose, 
  open, 
  onOpenChange, 
  onSelectUser,
  orgId 
}: NewMessageDialogProps) {
  // Support both old (isOpen/onClose) and new (open/onOpenChange) prop patterns
  const dialogOpen = open ?? isOpen ?? false;
  const handleOpenChange = (newOpen: boolean) => {
    if (onOpenChange) onOpenChange(newOpen);
    if (!newOpen && onClose) onClose();
  };
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentContacts, setRecentContacts] = useState<UserResult[]>([]);

  useEffect(() => {
    if (dialogOpen && user) {
      fetchRecentContacts();
    }
  }, [dialogOpen, user]);

  const fetchRecentContacts = async () => {
    if (!user) return;

    // Get recent message partners
    const { data: sentMessages } = await supabase
      .from('messages')
      .select('receiver_id')
      .eq('sender_id', user.id)
      .is('team_id', null)
      .order('created_at', { ascending: false })
      .limit(10);

    const { data: receivedMessages } = await supabase
      .from('messages')
      .select('sender_id')
      .eq('receiver_id', user.id)
      .is('team_id', null)
      .order('created_at', { ascending: false })
      .limit(10);

    const userIds = new Set<string>();
    sentMessages?.forEach((m) => userIds.add(m.receiver_id));
    receivedMessages?.forEach((m) => userIds.add(m.sender_id));

    if (userIds.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name, username, avatar_url')
        .in('id', Array.from(userIds))
        .limit(5);

      if (profiles) {
        setRecentContacts(profiles);
      }
    }
  };

  const searchUsers = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || !user) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      // Search by username or email
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, username, avatar_url')
        .or(`username.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
        .neq('id', user.id)
        .limit(10);

      if (error) throw error;
      setResults(data || []);
    } catch (error) {
      console.error('Error searching users:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      searchUsers(query);
    }, 300);

    return () => clearTimeout(debounce);
  }, [query, searchUsers]);

  const handleSelectUser = (selectedUser: UserResult) => {
    if (onSelectUser) {
      onSelectUser(selectedUser.id);
    } else if (orgId) {
      navigate(`/org/${orgId}?tab=chat&channel=dm&id=${selectedUser.id}`);
    } else {
      navigate(`/dashboard`);
    }
    handleOpenChange(false);
    setQuery('');
    setResults([]);
  };

  const displayUsers = query.trim() ? results : recentContacts;
  const sectionTitle = query.trim() ? 'Search Results' : 'Recent Contacts';

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            New Message
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by username or email..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>

          {/* Results */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              {sectionTitle}
            </p>
            <ScrollArea className="h-64">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : displayUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <User className="h-10 w-10 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {query.trim() ? 'No users found' : 'No recent contacts'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {displayUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleSelectUser(u)}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors text-left"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={u.avatar_url || ''} />
                        <AvatarFallback>
                          {(u.full_name || u.email).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {u.full_name || u.email.split('@')[0]}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {u.username ? `@${u.username}` : u.email}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
