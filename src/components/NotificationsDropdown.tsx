import { useState, useEffect } from 'react';
import { Bell, ExternalLink, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

export function NotificationsDropdown() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      
      const channel = supabase
        .channel('notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            setNotifications((prev) => [payload.new as Notification, ...prev]);
            setUnreadCount((prev) => prev + 1);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchNotifications = async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.read).length);
    }
  };

  const markAsRead = async (id: string) => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id);

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user?.id)
      .eq('read', false);

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const handleAcceptInvitation = async (notification: Notification, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !notification.link) return;
    
    setProcessing(notification.id);
    try {
      // Extract org ID from link (e.g., /accept-org-invite/uuid or /org/uuid)
      const orgId = notification.link.replace('/accept-org-invite/', '').replace('/org/', '');
      
      // Add user as member of the organization
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({ organization_id: orgId, user_id: user.id, role: 'member' });

      if (memberError) throw memberError;

      // Mark notification as read and update message
      await supabase
        .from('notifications')
        .update({ 
          read: true, 
          message: (notification.message || '') + ' [Accepted]' 
        })
        .eq('id', notification.id);

      setNotifications((prev) =>
        prev.map((n) => n.id === notification.id 
          ? { ...n, read: true, type: 'org_invitation_accepted', message: (n.message || '') + ' [Accepted]' } 
          : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      
      toast({ title: 'Invitation accepted', description: 'You now have access to the organization.' });
      navigate(`/org/${orgId}`);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to accept invitation.', variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  };

  const handleDeclineInvitation = async (notification: Notification, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !notification.link) return;
    
    setProcessing(notification.id);
    try {
      // Update notification as declined (no member to remove since we don't add on invite anymore)
      await supabase
        .from('notifications')
        .update({ 
          read: true, 
          message: (notification.message || '') + ' [Declined]' 
        })
        .eq('id', notification.id);

      setNotifications((prev) =>
        prev.map((n) => n.id === notification.id 
          ? { ...n, read: true, type: 'org_invitation_declined', message: (n.message || '') + ' [Declined]' } 
          : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      
      toast({ title: 'Invitation declined' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to decline invitation.', variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  };

  const getTimeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const isInvitation = (n: Notification) => 
    n.type === 'org_invitation' && !n.message?.includes('[Accepted]') && !n.message?.includes('[Declined]') && !n.read;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-foreground text-background text-xs flex items-center justify-center font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-3 py-2 border-b-2 border-foreground">
          <span className="font-semibold text-sm uppercase tracking-wider">Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`flex flex-col items-start gap-1 px-3 py-3 cursor-pointer hover:bg-accent ${
                  !notification.read ? 'bg-secondary' : ''
                }`}
                onClick={() => {
                  markAsRead(notification.id);
                  if (notification.link && !isInvitation(notification)) {
                    navigate(notification.link);
                  }
                }}
              >
                <div className="flex items-center gap-2 w-full">
                  <span className="font-medium text-sm flex-1 flex items-center gap-2">
                    {notification.title}
                    {notification.link && !isInvitation(notification) && (
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    )}
                  </span>
                  {!notification.read && (
                    <div className="h-2 w-2 bg-foreground" />
                  )}
                </div>
                {notification.message && (
                  <span className="text-xs text-muted-foreground line-clamp-2">
                    {notification.message}
                  </span>
                )}
                
                {/* Accept / Decline buttons for org invitations */}
                {isInvitation(notification) && (
                  <div className="flex gap-2 mt-2 w-full">
                    <Button
                      size="sm"
                      className="flex-1 h-7 text-xs"
                      disabled={processing === notification.id}
                      onClick={(e) => handleAcceptInvitation(notification, e)}
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-7 text-xs"
                      disabled={processing === notification.id}
                      onClick={(e) => handleDeclineInvitation(notification, e)}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Decline
                    </Button>
                  </div>
                )}

                <span className="text-xs text-muted-foreground font-mono">
                  {getTimeAgo(notification.created_at)}
                </span>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}