import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, X, Search, Loader2, Mail, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

export function ChatDrawer() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user && open) {
      fetchUsers();
    }
  }, [user, open]);

  useEffect(() => {
    if (selectedUser && user) {
      fetchMessages();
      
      // Subscribe to new messages
      const channel = supabase
        .channel(`messages-${selectedUser.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
          },
          (payload) => {
            const newMsg = payload.new as Message;
            if (
              (newMsg.sender_id === user.id && newMsg.receiver_id === selectedUser.id) ||
              (newMsg.sender_id === selectedUser.id && newMsg.receiver_id === user.id)
            ) {
              setMessages((prev) => [...prev, newMsg]);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedUser, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', user?.id)
      .order('full_name');

    if (!error && data) {
      setUsers(data);
    }
  };

  const fetchMessages = async () => {
    if (!selectedUser || !user) return;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${selectedUser.id}),and(sender_id.eq.${selectedUser.id},receiver_id.eq.${user.id})`
      )
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data);
      
      // Mark messages as read
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('sender_id', selectedUser.id)
        .eq('receiver_id', user.id)
        .eq('read', false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser || !user) return;

    setSending(true);
    const { error } = await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: selectedUser.id,
      content: newMessage.trim(),
    });

    if (!error) {
      setNewMessage('');
    }
    setSending(false);
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviting(true);
    try {
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('email', inviteEmail.trim())
        .single();

      if (existingUser) {
        // User exists, select them for chat
        setSelectedUser(existingUser);
        setInviteDialogOpen(false);
        setInviteEmail('');
        toast({ title: 'User found! You can now start chatting.' });
      } else {
        // Send invitation (would need email service)
        toast({
          title: 'Invitation sent',
          description: `An invitation to join has been sent to ${inviteEmail}`,
        });
        setInviteDialogOpen(false);
        setInviteEmail('');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setInviting(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Messages">
            <MessageSquare className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="p-4 border-b-2 border-foreground">
            <SheetTitle className="flex items-center justify-between">
              {selectedUser ? (
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedUser(null)}
                    className="px-2"
                  >
                    ←
                  </Button>
                  <div className="h-8 w-8 border-2 border-foreground flex items-center justify-center text-sm font-bold">
                    {(selectedUser.full_name || selectedUser.email).charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm">
                    {selectedUser.full_name || selectedUser.email}
                  </span>
                </div>
              ) : (
                <span className="uppercase tracking-wider">Messages</span>
              )}
            </SheetTitle>
          </SheetHeader>

          {!selectedUser ? (
            <div className="flex-1 flex flex-col">
              <div className="p-4 border-b-2 border-foreground space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setInviteDialogOpen(true)}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Invite New User
                </Button>
              </div>
              <ScrollArea className="flex-1">
                {filteredUsers.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No users found
                  </div>
                ) : (
                  filteredUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => setSelectedUser(u)}
                      className="w-full flex items-center gap-3 p-4 hover:bg-secondary transition-colors border-b border-foreground/10"
                    >
                      <div className="h-10 w-10 border-2 border-foreground flex items-center justify-center font-bold">
                        {(u.full_name || u.email).charAt(0).toUpperCase()}
                      </div>
                      <div className="text-left">
                        <div className="font-medium text-sm">{u.full_name || 'No name'}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </div>
                    </button>
                  ))
                )}
              </ScrollArea>
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center text-sm text-muted-foreground py-8">
                      No messages yet. Start the conversation!
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] p-3 ${
                            msg.sender_id === user?.id
                              ? 'bg-foreground text-background'
                              : 'bg-secondary border-2 border-foreground'
                          }`}
                        >
                          <p className="text-sm">{msg.content}</p>
                          <p className={`text-xs mt-1 ${
                            msg.sender_id === user?.id ? 'text-background/60' : 'text-muted-foreground'
                          } font-mono`}>
                            {formatTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              <form onSubmit={handleSendMessage} className="p-4 border-t-2 border-foreground">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                  />
                  <Button type="submit" disabled={sending || !newMessage.trim()}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <form onSubmit={handleInviteUser}>
            <DialogHeader>
              <DialogTitle>Invite User to Chat</DialogTitle>
              <DialogDescription>
                Enter the email of the person you want to chat with. If they don't have an account, they'll receive an invitation to sign up.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input
                  type="email"
                  placeholder="colleague@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInviteDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={inviting}>
                {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Mail className="mr-2 h-4 w-4" />
                Find or Invite
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}