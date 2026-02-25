import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { formatINR } from "@/lib/utils";

interface QuoteViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    quote: any;
}

export function QuoteViewModal({ isOpen, onClose, quote }: QuoteViewModalProps) {
    if (!quote) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">Quote Details</DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Customer Info */}
                    <div className="pb-4 border-b">
                        <p className="text-lg font-semibold">
                            Customer: {quote.customer_title} {quote.customer_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Gender: {quote.customer_gender}
                            {quote.customer_gender === 'Female' && (
                                <span className="ml-2 text-green-600">(1% Stamp Duty Discount Applied)</span>
                            )}
                        </p>
                    </div>

                    {/* Property Details */}
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <h4 className="font-semibold mb-2">Property Details</h4>
                            <dl className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                    <dt>Building:</dt>
                                    <dd>{quote.building_name}</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt>Flat No:</dt>
                                    <dd>{quote.flat_details.flat_no}</dd>
                                </div>
                                {quote.flat_details.wing && (
                                    <div className="flex justify-between">
                                        <dt>Wing:</dt>
                                        <dd>{quote.flat_details.wing}</dd>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <dt>Super Built Up:</dt>
                                    <dd>{quote.flat_details.square_foot} sqft</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt>Terrace Area:</dt>
                                    <dd>{quote.flat_details.terrace_area || 0} sqft</dd>
                                </div>
                                <div className="flex justify-between font-semibold">
                                    <dt>Total Area:</dt>
                                    <dd>{(quote.flat_details.square_foot || 0) + (quote.flat_details.terrace_area || 0)} sqft</dd>
                                </div>
                            </dl>
                        </div>

                        <div>
                            <h4 className="font-semibold mb-2">Amount Details</h4>
                            <dl className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                    <dt>Agreement Amount:</dt>
                                    <dd>{formatINR(quote.base_amount)}</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt>Loan Amount:</dt>
                                    <dd>{formatINR(quote.loan_amount)}</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt>Own Amount:</dt>
                                    <dd>{formatINR(quote.own_amt)}</dd>
                                </div>
                            </dl>
                        </div>
                    </div>

                    {/* Payment Schedule */}
                    {quote.payment_schedule && quote.payment_schedule.length > 0 && (
                        <div>
                            <h4 className="font-semibold mb-2">Payment Schedule</h4>
                            <div className="rounded-md border">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted">
                                        <tr>
                                            <th className="px-4 py-2 text-left">Payment Mode</th>
                                            <th className="px-4 py-2 text-right">Percentage</th>
                                            <th className="px-4 py-2 text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {quote.payment_schedule.map((mode: any, index: number) => (
                                            <tr key={index} className="border-t">
                                                <td className="px-4 py-2">{mode.text}</td>
                                                <td className="px-4 py-2 text-right">{mode.value}%</td>
                                                <td className="px-4 py-2 text-right">
                                                    {formatINR((quote.base_amount * mode.value) / 100)}
                                                </td>
                                            </tr>
                                        ))}
                                        <tr className="border-t bg-muted/50 font-medium">
                                            <td className="px-4 py-2">OWN AMT</td>
                                            <td className="px-4 py-2 text-right">-</td>
                                            <td className="px-4 py-2 text-right">{formatINR(quote.own_amt)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Statutories */}
                    <div>
                        <h4 className="font-semibold mb-2">Statutory Charges</h4>
                        <div className="rounded-md border">
                            <table className="w-full text-sm">
                                <thead className="bg-muted">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Charge</th>
                                        <th className="px-4 py-2 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-t">
                                        <td className="px-4 py-2">Maintenance</td>
                                        <td className="px-4 py-2 text-right">{formatINR(quote.maintenance)}</td>
                                    </tr>
                                    <tr className="border-t">
                                        <td className="px-4 py-2">Electrical & Water</td>
                                        <td className="px-4 py-2 text-right">{formatINR(quote.electrical_water_charges)}</td>
                                    </tr>
                                    <tr className="border-t">
                                        <td className="px-4 py-2">Registration</td>
                                        <td className="px-4 py-2 text-right">{formatINR(quote.registration_charges)}</td>
                                    </tr>
                                    <tr className="border-t">
                                        <td className="px-4 py-2">GST</td>
                                        <td className="px-4 py-2 text-right">{formatINR(quote.gst_tax)}</td>
                                    </tr>
                                    <tr className="border-t">
                                        <td className="px-4 py-2">Stamp Duty</td>
                                        <td className="px-4 py-2 text-right">{formatINR(quote.stamp_duty)}</td>
                                    </tr>
                                    <tr className="border-t">
                                        <td className="px-4 py-2">Legal Charges</td>
                                        <td className="px-4 py-2 text-right">{formatINR(quote.legal_charges)}</td>
                                    </tr>
                                    <tr className="border-t">
                                        <td className="px-4 py-2">Other Charges</td>
                                        <td className="px-4 py-2 text-right">{formatINR(quote.other_charges)}</td>
                                    </tr>
                                    <tr className="border-t bg-muted font-semibold">
                                        <td className="px-4 py-2">Total Statutories</td>
                                        <td className="px-4 py-2 text-right">
                                            {formatINR(
                                                (quote.maintenance || 0) +
                                                (quote.electrical_water_charges || 0) +
                                                (quote.registration_charges || 0) +
                                                (quote.gst_tax || 0) +
                                                (quote.stamp_duty || 0) +
                                                (quote.legal_charges || 0) +
                                                (quote.other_charges || 0)
                                            )}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Grand Total */}
                    <div className="pt-4 border-t">
                        <div className="flex justify-between items-center text-xl font-bold">
                            <span>Grand Total:</span>
                            <span>{formatINR(quote.total_amount)}</span>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
