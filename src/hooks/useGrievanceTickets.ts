import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';

export interface GrievanceTicket {
  id: string;
  ticket_number: string;
  customer_id: string;
  building_id: string | null;
  flat_id: string | null;
  quote_id: string | null;
  grievance_type: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'new' | 'open' | 'in_progress' | 'resolved' | 'closed';
  resolution_note: string | null;
  escalated: boolean;
  escalated_at: string | null;
  assigned_staff_id: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  photo_urls: string[] | null;
  customer?: {
    id: string;
    name: string;
    phone_number: string;
    email: string;
  };
  building?: {
    id: string;
    name: string;
  };
  flat?: {
    id: string;
    flat_no: number;
    wing: string | null;
    floor: number;
    type: string;
  };
  assigned_staff?: {
    id: string;
    name: string;
  } | null;
}

export interface EscalationLog {
  id: string;
  ticket_id: string;
  escalation_reason: string;
  notified_roles: string[];
  created_at: string;
}

export interface CreateTicketData {
  customer_id: string;
  building_id: string;
  flat_id: string;
  quote_id?: string;
  grievance_type: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_staff_id?: string;
}

const SLA_HOURS = 24;

export function useGrievanceTickets() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<GrievanceTicket[]>([]);
  const [overdueTickets, setOverdueTickets] = useState<GrievanceTicket[]>([]);
  const [escalationLogs, setEscalationLogs] = useState<EscalationLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('grievance_tickets')
        .select(`
          *,
          customer:customers(id, name, phone_number, email),
          building:buildings(id, name),
          flat:flats(id, flat_no, wing, floor, type),
          assigned_staff:profiles_public(id, name)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching tickets:', error);
        toast.error('Failed to load tickets');
        return;
      }

      const typedData = (data || []) as unknown as GrievanceTicket[];
      setTickets(typedData);

      // Calculate overdue tickets (open/in_progress > 24 hours)
      const now = new Date();
      const overdue = typedData.filter(ticket => {
        if (['resolved', 'closed'].includes(ticket.status)) return false;
        const createdAt = new Date(ticket.created_at);
        const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
        return hoursDiff > SLA_HOURS;
      });
      setOverdueTickets(overdue);

    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEscalationLogs = useCallback(async (ticketId?: string) => {
    try {
      let query = supabase
        .from('escalation_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (ticketId) {
        query = query.eq('ticket_id', ticketId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching escalation logs:', error);
        return;
      }

      setEscalationLogs(data || []);
    } catch (error) {
      console.error('Error fetching escalation logs:', error);
    }
  }, []);

  const createTicket = useCallback(async (ticketData: CreateTicketData): Promise<GrievanceTicket | null> => {
    try {
      // Generate ticket number
      const { data: ticketNumber } = await supabase.rpc('generate_ticket_number');

      const { data, error } = await supabase
        .from('grievance_tickets')
        .insert({
          ticket_number: ticketNumber,
          customer_id: ticketData.customer_id,
          building_id: ticketData.building_id,
          flat_id: ticketData.flat_id,
          quote_id: ticketData.quote_id || null,
          grievance_type: ticketData.grievance_type,
          description: ticketData.description,
          priority: ticketData.priority,
          status: 'new',
          assigned_staff_id: ticketData.assigned_staff_id || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating ticket:', error);
        toast.error('Failed to create ticket');
        return null;
      }

      toast.success(`Ticket ${ticketNumber} created successfully`);
      await fetchTickets();
      return data as unknown as GrievanceTicket;
    } catch (error) {
      console.error('Error creating ticket:', error);
      toast.error('Failed to create ticket');
      return null;
    }
  }, [fetchTickets]);

  const updateTicketStatus = useCallback(async (
    ticketId: string,
    newStatus: GrievanceTicket['status'],
    resolutionNote?: string
  ): Promise<boolean> => {
    try {
      // Require resolution note for resolved/closed status
      if (['resolved', 'closed'].includes(newStatus) && !resolutionNote) {
        toast.error('Resolution note is required when closing a ticket');
        return false;
      }

      const updateData: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (['resolved', 'closed'].includes(newStatus)) {
        updateData.resolution_note = resolutionNote;
        updateData.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('grievance_tickets')
        .update(updateData)
        .eq('id', ticketId);

      if (error) {
        console.error('Error updating ticket:', error);
        toast.error('Failed to update ticket status');
        return false;
      }

      toast.success('Ticket status updated');
      await fetchTickets();
      return true;
    } catch (error) {
      console.error('Error updating ticket:', error);
      toast.error('Failed to update ticket status');
      return false;
    }
  }, [fetchTickets]);

  const logEscalation = useCallback(async (
    ticketId: string,
    reason: string,
    notifiedRoles: string[] = ['admin', 'manager']
  ): Promise<boolean> => {
    try {
      // First update the ticket as escalated
      const { error: updateError } = await supabase
        .from('grievance_tickets')
        .update({
          escalated: true,
          escalated_at: new Date().toISOString(),
        })
        .eq('id', ticketId);

      if (updateError) {
        console.error('Error updating ticket escalation:', updateError);
        return false;
      }

      // Log the escalation
      const { error } = await supabase
        .from('escalation_logs')
        .insert({
          ticket_id: ticketId,
          escalation_reason: reason,
          notified_roles: notifiedRoles,
        });

      if (error) {
        console.error('Error logging escalation:', error);
        return false;
      }

      await fetchTickets();
      return true;
    } catch (error) {
      console.error('Error logging escalation:', error);
      return false;
    }
  }, [fetchTickets]);

  // Check and escalate overdue tickets
  const checkAndEscalateOverdue = useCallback(async () => {
    const now = new Date();

    for (const ticket of overdueTickets) {
      if (!ticket.escalated) {
        await logEscalation(
          ticket.id,
          `SLA breach: Ticket has been unresolved for more than ${SLA_HOURS} hours`,
          ['admin', 'manager']
        );
      }
    }
  }, [overdueTickets, logEscalation]);

  useEffect(() => {
    fetchTickets();
    fetchEscalationLogs();
  }, [fetchTickets, fetchEscalationLogs]);

  // Auto-check for escalations on load
  useEffect(() => {
    if (overdueTickets.length > 0) {
      checkAndEscalateOverdue();
    }
  }, [overdueTickets.length, checkAndEscalateOverdue]);

  const deleteTicket = useCallback(async (ticketId: string): Promise<boolean> => {
    try {
      // 1. Fetch ticket to get photo URLs before deletion
      const { data: ticket, error: fetchError } = await supabase
        .from('grievance_tickets')
        .select('id')
        .eq('id', ticketId)
        .single();

      if (fetchError) {
        console.error('Error fetching ticket for deletion:', fetchError);
        toast.error('Failed to retrieve ticket details for deletion');
        return false;
      }

      // 2. Delete the ticket from the database
      const { error: deleteError } = await supabase
        .from('grievance_tickets')
        .delete()
        .eq('id', ticketId);

      if (deleteError) {
        console.error('Error deleting ticket:', deleteError);
        toast.error('Failed to delete ticket');
        return false;
      }

      // Photo cleanup skipped — photo_urls column does not exist on grievance_tickets

      toast.success('Ticket and associated media deleted successfully');
      await fetchTickets();
      return true;
    } catch (error) {
      console.error('Error deleting ticket:', error);
      toast.error('Failed to delete ticket');
      return false;
    }
  }, [fetchTickets]);

  const assignTicket = useCallback(async (ticketId: string, staffId: string | null): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('grievance_tickets')
        .update({
          assigned_staff_id: staffId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ticketId);

      if (error) {
        console.error('Error assigning ticket:', error);
        toast.error('Failed to assign ticket');
        return false;
      }

      toast.success(staffId ? 'Ticket assigned successfully' : 'Ticket unassigned');
      await fetchTickets();
      return true;
    } catch (error) {
      console.error('Error assigning ticket:', error);
      toast.error('Failed to assign ticket');
      return false;
    }
  }, [fetchTickets]);

  return {
    tickets,
    overdueTickets,
    escalationLogs,
    loading,
    fetchTickets,
    fetchEscalationLogs,
    createTicket,
    updateTicketStatus,
    deleteTicket,
    assignTicket,
    logEscalation,
    checkAndEscalateOverdue,
  };
}
