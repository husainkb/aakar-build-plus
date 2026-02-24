import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Star, Eye } from 'lucide-react';
import { format } from 'date-fns';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface Feedback {
    id: string;
    rating: number;
    comments: string | null;
    suggestions: string | null;
    created_at: string;
    customer: {
        name: string;
        email: string;
        phone_number: string;
    } | null;
    building?: { name: string } | null;
    flat?: { flat_no: number; wing: string | null } | null;
}

export default function AdminFeedback() {
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    useEffect(() => {
        fetchFeedbacks();
    }, []);

    const fetchFeedbacks = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('feedback')
            .select(`
                *,
                customer:customers(name, email, phone_number),
                building:buildings(name),
                flat:flats(flat_no, wing)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Fetch feedback error:', error);
            toast.error('Failed to fetch feedback');
        } else {
            setFeedbacks((data || []) as unknown as Feedback[]);
        }
        setLoading(false);
    };

    const StarRating = ({ rating }: { rating: number }) => {
        return (
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        className={`h-4 w-4 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                    />
                ))}
            </div>
        );
    };

    const handleViewDetails = (fb: Feedback) => {
        setSelectedFeedback(fb);
        setIsDetailsOpen(true);
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Customer Feedback</h1>
                <p className="text-muted-foreground">View and manage all customer feedback</p>
            </div>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Property</TableHead>
                                    <TableHead>Rating</TableHead>
                                    <TableHead>Comments</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {feedbacks.map((fb) => (
                                    <TableRow key={fb.id}>
                                        <TableCell>{format(new Date(fb.created_at), 'dd/MM/yyyy')}</TableCell>
                                        <TableCell>
                                            {fb.customer ? (
                                                <div>
                                                    <p className="font-medium">{fb.customer.name}</p>
                                                    <p className="text-xs text-muted-foreground">{fb.customer.phone_number}</p>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">Unknown</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {fb.building ? (
                                                <div>
                                                    <p className="text-sm">{fb.building.name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {fb.flat ? `${fb.flat.wing ? fb.flat.wing + '-' : ''}Flat ${fb.flat.flat_no}` : '-'}
                                                    </p>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <StarRating rating={fb.rating} />
                                        </TableCell>
                                        <TableCell className="max-w-[200px] truncate">
                                            {fb.comments || fb.suggestions || 'No comments'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <button
                                                onClick={() => handleViewDetails(fb)}
                                                className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
                                                title="View Details"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {feedbacks.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                            No feedback items found
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Feedback Details</DialogTitle>
                    </DialogHeader>
                    {selectedFeedback && (
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Customer</Label>
                                    {selectedFeedback.customer ? (
                                        <>
                                            <p className="text-sm font-medium">{selectedFeedback.customer.name}</p>
                                            <p className="text-xs text-muted-foreground">{selectedFeedback.customer.email}</p>
                                            <p className="text-xs text-muted-foreground">{selectedFeedback.customer.phone_number}</p>
                                        </>
                                    ) : (
                                        <p className="text-sm font-medium">Unknown Customer</p>
                                    )}
                                </div>
                                <div className="space-y-1 text-right">
                                    <Label className="text-xs text-muted-foreground">Submitted On</Label>
                                    <p className="text-sm font-medium">{format(new Date(selectedFeedback.created_at), 'PPP')}</p>
                                    <p className="text-xs text-muted-foreground">{format(new Date(selectedFeedback.created_at), 'p')}</p>
                                </div>
                            </div>

                            {/* Property Details */}
                            <div className="pt-4 border-t space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Property</Label>
                                        <p className="text-sm font-medium">{selectedFeedback.building?.name || 'N/A'}</p>
                                    </div>
                                    <div className="space-y-1 text-right">
                                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Flat / Wing</Label>
                                        <p className="text-sm font-medium">
                                            {selectedFeedback.flat
                                                ? `${selectedFeedback.flat.wing ? selectedFeedback.flat.wing + ' - ' : ''}Flat ${selectedFeedback.flat.flat_no}`
                                                : 'N/A'
                                            }
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t space-y-4">
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Overall Rating</Label>
                                    <StarRating rating={selectedFeedback.rating} />
                                </div>

                                <div className="space-y-1 whitespace-pre-wrap">
                                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Comments</Label>
                                    <p className="text-sm border p-4 rounded-md bg-muted/30 min-h-[80px]">
                                        {selectedFeedback.comments || 'No specific comments provided.'}
                                    </p>
                                </div>

                                <div className="space-y-1 whitespace-pre-wrap">
                                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Suggestions</Label>
                                    <p className="text-sm border p-4 rounded-md bg-muted/30 min-h-[80px]">
                                        {selectedFeedback.suggestions || 'No suggestions provided.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
