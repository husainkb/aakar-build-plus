import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone_number: string;
  gender?: string | null;
}

interface CustomerDetails {
  title: string;
  gender: string;
  name: string;
  whatsappPhone: string;
}

export function useCustomerSearch() {
  const [isSearching, setIsSearching] = useState(false);
  const [matchingCustomers, setMatchingCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSelected, setCustomerSelected] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search for customers by phone number (partial match)
  const searchCustomersByPhone = useCallback(async (phoneNumber: string): Promise<void> => {
    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Reset if phone is too short
    if (!phoneNumber || phoneNumber.length < 3) {
      setMatchingCustomers([]);
      setSelectedCustomer(null);
      setCustomerSelected(false);
      return;
    }

    // Debounce the search
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        // Search for customers whose phone number starts with or contains the input
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .ilike('phone_number', `%${phoneNumber}%`)
          .order('name')
          .limit(10);

        if (error) {
          console.error('Error searching customers:', error);
          toast.error('Error searching for customers');
          return;
        }

        setMatchingCustomers(data || []);
        
        // If no customers found and phone is complete (10+ digits), clear selected
        if ((!data || data.length === 0) && phoneNumber.length >= 10) {
          setSelectedCustomer(null);
          setCustomerSelected(false);
        }
      } catch (error) {
        console.error('Error searching customers:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300); // 300ms debounce
  }, []);

  // Search for exact phone match (for backward compatibility)
  const searchCustomerByPhone = useCallback(async (phoneNumber: string): Promise<Customer | null> => {
    if (!phoneNumber || phoneNumber.length < 10) {
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
        setMatchingCustomers([data]);
        return data;
      } else {
        setMatchingCustomers([]);
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
    email: string,
    gender?: string | null
  ): Promise<string | null> => {
    try {
      // First try to find existing customer by phone
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('phone_number', phoneNumber)
        .maybeSingle();

      if (existing) {
        // Customer exists, update with new information including gender
        const updateData: any = {
          name,
          email: email || `${phoneNumber}@placeholder.com`
        };
        
        // Only update gender if provided
        if (gender) {
          updateData.gender = gender;
        }
        
        await supabase
          .from('customers')
          .update(updateData)
          .eq('id', existing.id);
          
        return existing.id;
      }

      // Create new customer with gender
      const insertData: any = {
        name,
        email: email || `${phoneNumber}@placeholder.com`,
        phone_number: phoneNumber
      };
      
      // Only include gender if provided
      if (gender) {
        insertData.gender = gender;
      }

      const { data: newCustomer, error } = await supabase
        .from('customers')
        .insert(insertData)
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
    setSelectedCustomer(customer);
    setCustomerSelected(true);
    setMatchingCustomers([]); // Clear dropdown after selection
  }, []);

  const clearCustomer = useCallback(() => {
    setSelectedCustomer(null);
    setMatchingCustomers([]);
    setCustomerSelected(false);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    isSearching,
    matchingCustomers,
    selectedCustomer,
    foundCustomer: selectedCustomer, // Alias for backward compatibility
    customerSelected,
    searchCustomersByPhone,
    searchCustomerByPhone,
    createOrUpdateCustomer,
    selectCustomer,
    clearCustomer
  };
}
