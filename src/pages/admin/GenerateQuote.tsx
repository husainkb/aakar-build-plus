// Re-export staff's GenerateQuote since DashboardLayout already handles role-based UI
// Both admin and staff use the same quote generation logic
export { default } from '@/pages/staff/GenerateQuote';
