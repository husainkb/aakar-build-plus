import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { Send, Loader2, MessageSquare, User, Clock, ImageIcon } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface TicketInfo {
  id: string;
  ticket_number: string;
  grievance_type: string;
  description: string;
  priority: string;
  status: string;
  resolution_note: string | null;
  escalated?: boolean;
  escalated_at?: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  photo_urls?: string[] | null;
  customer?: { id: string; name: string; phone_number: string; email?: string } | null;
  building?: { id: string; name: string } | null;
  flat?: { id: string; flat_no: number; wing: string | null; floor: number; type: string } | null;
  assigned_staff?: { id: string; name: string } | null;
}

interface Comment {
  id: string;
  ticket_id: string;
  commenter_id: string;
  commenter_type: string;
  commenter_name: string;
  comment_text: string;
  created_at: string;
}

interface TicketDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: TicketInfo | null;
}

export default function TicketDetailModal({ open, onOpenChange, ticket }: TicketDetailModalProps) {
  const { user, userRole } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isClosed = ticket?.status === 'closed';

  const fetchComments = useCallback(async () => {
    if (!ticket) return;
    setLoadingComments(true);
    const { data, error } = await supabase
      .from('ticket_comments')
      .select('*')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setComments(data as Comment[]);
    }
    setLoadingComments(false);
  }, [ticket]);

  useEffect(() => {
    if (open && ticket) {
      fetchComments();
    } else {
      setComments([]);
      setNewComment('');
    }
  }, [open, ticket, fetchComments]);

  // Realtime subscription for comments
  useEffect(() => {
    if (!open || !ticket) return;

    const channel = supabase
      .channel(`ticket-comments-${ticket.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_comments',
          filter: `ticket_id=eq.${ticket.id}`,
        },
        (payload) => {
          const newC = payload.new as Comment;
          setComments(prev => {
            if (prev.find(c => c.id === newC.id)) return prev;
            return [...prev, newC];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, ticket]);

  // Auto-scroll to bottom on new comments
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments]);

  const getCommenterDisplayName = async (): Promise<{ name: string; type: string }> => {
    if (!user) return { name: 'Unknown', type: 'unknown' };

    if (userRole === 'customer') {
      // Get customer name
      const { data } = await supabase
        .from('customers')
        .select('name')
        .eq('user_id', user.id)
        .single();
      return { name: data?.name || 'Customer', type: 'customer' };
    }

    // Staff/admin/manager - get from profiles
    const { data } = await supabase
      .from('profiles')
      .select('name, role')
      .eq('id', user.id)
      .single();
    return { name: data?.name || 'Staff', type: data?.role || userRole || 'staff' };
  };

  const handleSendComment = async () => {
    if (!newComment.trim() || !ticket || !user) return;

    setSending(true);
    try {
      const { name, type } = await getCommenterDisplayName();

      const { error } = await supabase
        .from('ticket_comments')
        .insert({
          ticket_id: ticket.id,
          commenter_id: user.id,
          commenter_type: type,
          commenter_name: name,
          comment_text: newComment.trim(),
        });

      if (error) {
        if (error.message?.includes('closed')) {
          toast.error('Cannot add comments to a closed ticket');
        } else {
          toast.error('Failed to send comment');
          console.error(error);
        }
        return;
      }

      setNewComment('');
    } catch (err) {
      toast.error('Failed to send comment');
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendComment();
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      new: 'bg-blue-500',
      open: 'bg-yellow-500',
      in_progress: 'bg-orange-500',
      resolved: 'bg-green-500',
      closed: 'bg-gray-500',
    };
    return <Badge className={`${styles[status] || 'bg-gray-500'} text-white`}>{status.replace('_', ' ')}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      low: 'bg-blue-100 text-blue-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800',
    };
    return <Badge className={styles[priority] || ''}>{priority}</Badge>;
  };

  const getRoleBadgeColor = (type: string) => {
    switch (type) {
      case 'admin': return 'bg-purple-100 text-purple-800';
      case 'manager': return 'bg-indigo-100 text-indigo-800';
      case 'staff': return 'bg-blue-100 text-blue-800';
      case 'customer': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!ticket) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <span>{ticket.ticket_number}</span>
            {getStatusBadge(ticket.status)}
            {getPriorityBadge(ticket.priority)}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col px-6">
          {/* Ticket Details Section */}
          <div className="space-y-3 pb-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Type</p>
                <p className="font-medium">{ticket.grievance_type}</p>
              </div>
              {ticket.customer && (
                <div>
                  <p className="text-muted-foreground">Customer</p>
                  <p className="font-medium">{ticket.customer.name}</p>
                  <p className="text-xs text-muted-foreground">{ticket.customer.phone_number}</p>
                </div>
              )}
              {ticket.building && (
                <div>
                  <p className="text-muted-foreground">Building</p>
                  <p className="font-medium">{ticket.building.name}</p>
                </div>
              )}
              {ticket.flat && (
                <div>
                  <p className="text-muted-foreground">Flat</p>
                  <p className="font-medium">
                    {ticket.flat.wing ? `Wing ${ticket.flat.wing} - ` : ''}
                    Flat {ticket.flat.flat_no} (Floor {ticket.flat.floor})
                  </p>
                </div>
              )}
              {ticket.assigned_staff && (
                <div>
                  <p className="text-muted-foreground">Assigned Staff</p>
                  <p className="font-medium">{ticket.assigned_staff.name}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Created</p>
                <p className="font-medium">{format(new Date(ticket.created_at), 'dd/MM/yyyy HH:mm')}</p>
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">Description</p>
              <p className="text-sm whitespace-pre-wrap bg-muted p-2 rounded-md">{ticket.description}</p>
            </div>

            {ticket.photo_urls && ticket.photo_urls.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <ImageIcon className="h-3 w-3" /> Photos
                </p>
                <div className="flex flex-wrap gap-2">
                  {ticket.photo_urls.map((url, idx) => (
                    <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                      <img src={url} alt={`Photo ${idx + 1}`}
                        className="h-16 w-16 object-cover rounded-md border hover:opacity-80" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {ticket.resolution_note && (
              <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-md">
                <p className="text-xs font-medium text-green-800 dark:text-green-200">Resolution</p>
                <p className="text-sm">{ticket.resolution_note}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Comments Section */}
          <div className="flex items-center gap-2 py-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Comments ({comments.length})</p>
          </div>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto min-h-[150px] max-h-[250px] space-y-3 pr-1"
          >
            {loadingComments ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No comments yet. Start the conversation.
              </p>
            ) : (
              comments.map((comment) => {
                const isOwn = comment.commenter_id === user?.id;
                return (
                  <div
                    key={comment.id}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] ${isOwn ? 'bg-primary/10' : 'bg-muted'} rounded-lg p-3`}>
                      <div className="flex items-center gap-2 mb-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs font-medium">{comment.commenter_name}</span>
                        <Badge className={`text-[10px] px-1 py-0 ${getRoleBadgeColor(comment.commenter_type)}`}>
                          {comment.commenter_type}
                        </Badge>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{comment.comment_text}</p>
                      <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Comment Input */}
          <div className="py-3">
            {isClosed ? (
              <p className="text-sm text-muted-foreground text-center py-2 bg-muted rounded-md">
                This ticket is closed. No more comments can be added.
              </p>
            ) : (
              <div className="flex gap-2">
                <Textarea
                  placeholder="Type a comment... (Enter to send, Shift+Enter for new line)"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={2}
                  className="flex-1 min-h-[60px] resize-none"
                  disabled={sending}
                />
                <Button
                  size="icon"
                  onClick={handleSendComment}
                  disabled={sending || !newComment.trim()}
                  className="self-end h-10 w-10"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
