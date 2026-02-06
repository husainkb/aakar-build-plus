import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

interface OverdueTicket {
  id: string;
  ticket_number: string;
  grievance_type: string;
  priority: string;
  created_at: string;
  customer?: {
    name: string;
  };
}

const SLA_HOURS = 24;

export function NotificationBell() {
  const { userRole } = useAuth();
  const [overdueTickets, setOverdueTickets] = useState<OverdueTicket[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (userRole !== 'admin' && userRole !== 'manager') return;

    const fetchOverdueTickets = async () => {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - SLA_HOURS);

      const { data, error } = await supabase
        .from('grievance_tickets')
        .select(`
          id,
          ticket_number,
          grievance_type,
          priority,
          created_at,
          customer:customers(name)
        `)
        .in('status', ['new', 'open', 'in_progress'])
        .lt('created_at', cutoffTime.toISOString())
        .order('created_at', { ascending: true });

      if (!error && data) {
        setOverdueTickets(data as unknown as OverdueTicket[]);
      }
    };

    fetchOverdueTickets();

    // Refresh every minute
    const interval = setInterval(fetchOverdueTickets, 60000);
    return () => clearInterval(interval);
  }, [userRole]);

  if (userRole !== 'admin' && userRole !== 'manager') {
    return null;
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-blue-500';
    }
  };

  const ticketPath = userRole === 'admin' ? '/admin/grievances' : '/manager/grievances';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {overdueTickets.length > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center animate-pulse">
              {overdueTickets.length > 9 ? '9+' : overdueTickets.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b bg-muted/50">
          <h4 className="font-semibold text-sm">Overdue Tickets</h4>
          <p className="text-xs text-muted-foreground">
            Tickets unresolved for more than 24 hours
          </p>
        </div>
        <ScrollArea className="h-[300px]">
          {overdueTickets.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No overdue tickets 🎉
            </div>
          ) : (
            <div className="divide-y">
              {overdueTickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  to={ticketPath}
                  onClick={() => setOpen(false)}
                  className="block p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {ticket.ticket_number}
                        </span>
                        <Badge 
                          variant="secondary" 
                          className={`${getPriorityColor(ticket.priority)} text-white text-xs`}
                        >
                          {ticket.priority}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {ticket.grievance_type}
                      </p>
                      {ticket.customer && (
                        <p className="text-xs text-muted-foreground">
                          {ticket.customer.name}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-destructive font-medium whitespace-nowrap">
                      {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </ScrollArea>
        {overdueTickets.length > 0 && (
          <div className="p-2 border-t">
            <Link to={ticketPath} onClick={() => setOpen(false)}>
              <Button variant="outline" size="sm" className="w-full">
                View All Tickets
              </Button>
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
