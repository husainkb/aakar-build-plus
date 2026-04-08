import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

// Simple notification sound using Web Audio API
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.5);
  } catch (e) {
    // Audio not supported, silently fail
  }
}

export function GrievanceNotificationListener() {
  const { user, userRole } = useAuth();
  const previousTicketsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!user || !userRole) return;

    // Only admin, manager, and staff need notifications
    if (!['admin', 'manager', 'staff'].includes(userRole)) return;

    const channel = supabase
      .channel('grievance-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'grievance_tickets',
        },
        async (payload) => {
          // Skip initial load notifications
          if (!initializedRef.current) return;

          // Admin/Manager: notify on new ticket creation
          if (userRole === 'admin' || userRole === 'manager') {
            const ticket = payload.new as any;
            
            // Fetch customer name
            const { data: customer } = await supabase
              .from('customers')
              .select('name')
              .eq('id', ticket.customer_id)
              .single();

            playNotificationSound();
            toast.info(
              `🎫 New Grievance Ticket Created`,
              {
                description: `Ticket ${ticket.ticket_number} raised by ${customer?.name || 'Customer'} - ${ticket.grievance_type}`,
                duration: 10000,
              }
            );
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'grievance_tickets',
        },
        async (payload) => {
          if (!initializedRef.current) return;

          const newData = payload.new as any;
          const oldData = payload.old as any;

          // Staff: notify when a ticket is assigned to them
          if (
            userRole === 'staff' &&
            newData.assigned_staff_id === user.id &&
            oldData.assigned_staff_id !== user.id
          ) {
            // Fetch customer name
            const { data: customer } = await supabase
              .from('customers')
              .select('name')
              .eq('id', newData.customer_id)
              .single();

            playNotificationSound();
            toast.info(
              `📋 New Ticket Assigned to You`,
              {
                description: `Ticket ${newData.ticket_number} - ${newData.grievance_type} (${newData.priority} priority) from ${customer?.name || 'Customer'}`,
                duration: 10000,
              }
            );
          }

          // Admin: also notify when ticket is assigned (confirmation)
          if (
            (userRole === 'admin' || userRole === 'manager') &&
            newData.assigned_staff_id &&
            oldData.assigned_staff_id !== newData.assigned_staff_id
          ) {
            const { data: staff } = await supabase
              .from('profiles')
              .select('name')
              .eq('id', newData.assigned_staff_id)
              .single();

            // Don't play sound for admin assignment confirmations
            toast.success(
              `✅ Ticket ${newData.ticket_number} assigned to ${staff?.name || 'Staff'}`,
              { duration: 5000 }
            );
          }
        }
      )
      .subscribe();

    // Mark as initialized after a short delay to skip initial data
    const timer = setTimeout(() => {
      initializedRef.current = true;
    }, 3000);

    return () => {
      clearTimeout(timer);
      initializedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [user, userRole]);

  return null; // This is a listener-only component
}
