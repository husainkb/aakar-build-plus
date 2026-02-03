import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone_number: string;
}

interface CustomerDetails {
  title: string;
  gender: string;
  name: string;
  whatsappPhone: string;
}

export function useCustomerSearch() {
  const [isSearching, setIsSearching] = useState(false);
  const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null);
  const [customerSelected, setCustomerSelected] = useState(false);

  const searchCustomerByPhone = useCallback(async (phoneNumber: string): Promise<Customer | null> => {
    if (!phoneNumber || phoneNumber.length < 10) {
      setFoundCustomer(null);
      setCustomerSelected(false);
      return null;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('phone_number', phoneNumber)
        .maybeSingle();

      if (error) {
        console.error('Error searching customer:', error);
        toast.error('Error searching for customer');
        return null;
      }

      if (data) {
        setFoundCustomer(data);
        return data;
      } else {
        setFoundCustomer(null);
        setCustomerSelected(false);
        return null;
      }
    } catch (error) {
      console.error('Error searching customer:', error);
      return null;
    } finally {
      setIsSearching(false);
    }
  }, []);

  const createOrUpdateCustomer = useCallback(async (
    phoneNumber: string,
    name: string,
    email: string
  ): Promise<string | null> => {
    try {
      // First try to find existing customer by phone
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('phone_number', phoneNumber)
        .maybeSingle();

      if (existing) {
        // Customer exists, return their ID
        return existing.id;
      }

      // Create new customer
      const { data: newCustomer, error } = await supabase
        .from('customers')
        .insert({
          name,
          email: email || `${phoneNumber}@placeholder.com`, // Email is required in schema
          phone_number: phoneNumber
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error creating customer:', error);
        // If duplicate phone error, try to fetch existing
        if (error.code === '23505') {
          const { data: existingCustomer } = await supabase
            .from('customers')
            .select('id')
            .eq('phone_number', phoneNumber)
            .single();
          return existingCustomer?.id || null;
        }
        return null;
      }

      return newCustomer?.id || null;
    } catch (error) {
      console.error('Error in createOrUpdateCustomer:', error);
      return null;
    }
  }, []);

  const selectCustomer = useCallback((customer: Customer) => {
    setFoundCustomer(customer);
    setCustomerSelected(true);
  }, []);

  const clearCustomer = useCallback(() => {
    setFoundCustomer(null);
    setCustomerSelected(false);
  }, []);

  return {
    isSearching,
    foundCustomer,
    customerSelected,
    searchCustomerByPhone,
    createOrUpdateCustomer,
    selectCustomer,
    clearCustomer
  };
}
