import GenerateQuoteBase from '@/pages/staff/GenerateQuote';

// Admin version with no minimum rate validation
export default function AdminGenerateQuote() {
  return <GenerateQuoteBase skipMinRateValidation={true} />;
}
