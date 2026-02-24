import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { Plus, Loader2, Star, Edit2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface Building {
    id: string;
    name: string;
}

interface Flat {
    id: string;
    flat_no: number;
    wing: string | null;
    floor: number;
    type: string;
    building_id: string;
    building?: Building;
    booking_created_by?: string | null;
}

interface Feedback {
    id: string;
    rating: number;
    comments: string | null;
    suggestions: string | null;
    created_at: string;
    building_id: string | null;
    flat_id: string | null;
    building?: { name: string };
    flat?: { flat_no: number; wing: string | null };
}

export default function CustomerFeedback() {
    const { user } = useAuth();
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [loading, setLoading] = useState(true);
    const [customerRecord, setCustomerRecord] = useState<{ id: string } | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [editingFeedback, setEditingFeedback] = useState<Feedback | null>(null);
    const [customerFlats, setCustomerFlats] = useState<Flat[]>([]);
    const [selectedWing, setSelectedWing] = useState('');

    const [formData, setFormData] = useState({
        building_id: '',
        flat_id: '',
        rating: 0,
        comments: '',
        suggestions: '',
    });

    // Fetch customer record
    useEffect(() => {
        if (!user) return;
        const fetchCustomer = async () => {
            const { data } = await supabase
                .from('customers')
                .select('id')
                .eq('user_id', user.id)
                .maybeSingle();
            setCustomerRecord(data);
        };
        fetchCustomer();
    }, [user]);

    // Fetch feedbacks
    useEffect(() => {
        if (!customerRecord) return;
        fetchFeedbacks();
    }, [customerRecord]);

    const fetchFeedbacks = async () => {
        if (!customerRecord) return;
        setLoading(true);
        const { data } = await supabase
            .from('feedback')
            .select('*, building:buildings(name), flat:flats(flat_no, wing)')
            .eq('customer_id', customerRecord.id)
            .order('created_at', { ascending: false });
        setFeedbacks((data || []) as unknown as Feedback[]);
        setLoading(false);
    };

    // Fetch customer's booked flats
    useEffect(() => {
        if (!customerRecord) return;
        const fetchFlats = async () => {
            const { data } = await supabase
                .from('flats')
                .select('*, building:buildings(id, name)')
                .eq('booked_customer_id', customerRecord.id)
                .eq('booked_status', 'Booked');
            setCustomerFlats((data || []) as unknown as Flat[]);
        };
        fetchFlats();
    }, [customerRecord]);

    // Derived buildings
    const customerBuildings = useMemo(() => {
        return customerFlats.reduce<Building[]>((acc, flat) => {
            if (flat.building && !acc.find(b => b.id === flat.building!.id)) {
                acc.push(flat.building);
            }
            return acc;
        }, []);
    }, [customerFlats]);

    // Derived wings for selected building
    const availableWings = useMemo(() => {
        return customerFlats
            .filter(f => f.building_id === formData.building_id && f.wing)
            .map(f => f.wing!)
            .filter((wing, index, self) => self.indexOf(wing) === index);
    }, [customerFlats, formData.building_id]);

    // Sync selected wing when available wings change
    useEffect(() => {
        if (availableWings.length > 0 && !selectedWing && formData.building_id) {
            setSelectedWing(availableWings[0]);
        }
    }, [availableWings, selectedWing, formData.building_id]);

    // Filtered flats
    const filteredFlats = useMemo(() => {
        return customerFlats.filter(flat => {
            if (flat.building_id !== formData.building_id) return false;
            if (selectedWing && flat.wing !== selectedWing) return false;
            return true;
        });
    }, [customerFlats, formData.building_id, selectedWing]);

    const handleOpenDialog = (feedback?: Feedback) => {
        if (feedback) {
            setEditingFeedback(feedback);

            // Set building and wing based on existing feedback
            // Note: wing is derived from the flat
            const flatId = feedback.flat_id || '';
            const flat = customerFlats.find(f => f.id === flatId);
            const buildingId = feedback.building_id || '';
            const wing = flat?.wing || '';

            setFormData({
                building_id: buildingId,
                flat_id: flatId,
                rating: feedback.rating,
                comments: feedback.comments || '',
                suggestions: feedback.suggestions || '',
            });
            setSelectedWing(wing);
        } else {
            setEditingFeedback(null);
            setFormData({
                building_id: '',
                flat_id: '',
                rating: 0,
                comments: '',
                suggestions: '',
            });
            setSelectedWing('');
        }
        setIsDialogOpen(true);
    };

    const handleSubmit = async () => {
        if (!customerRecord) return;
        if (!formData.building_id || !formData.flat_id) {
            toast.error('Please select building and flat');
            return;
        }
        if (formData.rating === 0) {
            toast.error('Please provide a rating');
            return;
        }

        setSubmitting(true);

        const selectedFlat = customerFlats.find(f => f.id === formData.flat_id);
        const assignedStaffId = selectedFlat?.booking_created_by || null;

        const feedbackData = {
            customer_id: customerRecord.id,
            building_id: formData.building_id,
            flat_id: formData.flat_id,
            rating: formData.rating,
            comments: formData.comments,
            suggestions: formData.suggestions,
            staff_id: assignedStaffId,
        };

        let error;
        if (editingFeedback) {
            const { error: updateError } = await supabase
                .from('feedback')
                .update(feedbackData)
                .eq('id', editingFeedback.id);
            error = updateError;
        } else {
            const { error: insertError } = await supabase
                .from('feedback')
                .insert(feedbackData);
            error = insertError;
        }

        setSubmitting(false);
        if (error) {
            console.error('Feedback submission error:', error);
            toast.error(editingFeedback ? 'Failed to update feedback' : 'Failed to submit feedback');
        } else {
            toast.success(editingFeedback ? 'Feedback updated successfully' : 'Feedback submitted successfully');
            setIsDialogOpen(false);
            fetchFeedbacks();
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this feedback?')) return;

        const { error } = await supabase
            .from('feedback')
            .delete()
            .eq('id', id);

        if (error) {
            toast.error('Failed to delete feedback');
        } else {
            toast.success('Feedback deleted successfully');
            fetchFeedbacks();
        }
    };

    const StarRating = ({ rating, onRatingChange, readonly = false }: { rating: number, onRatingChange?: (r: number) => void, readonly?: boolean }) => {
        return (
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        className={`h-6 w-6 cursor-pointer ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'} transition-colors`}
                        onClick={() => !readonly && onRatingChange && onRatingChange(star)}
                    />
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Feedback</h1>
                    <p className="text-muted-foreground">Share your thoughts and suggestions with us</p>
                </div>
                <Button onClick={() => handleOpenDialog()} disabled={customerFlats.length === 0}>
                    <Plus className="mr-2 h-4 w-4" />
                    Submit Feedback
                </Button>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) {
                    setFormData({ building_id: '', flat_id: '', rating: 0, comments: '', suggestions: '' });
                    setSelectedWing('');
                }
            }}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingFeedback ? 'Update Feedback' : 'Submit Feedback'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {/* Building Selection */}
                        <div className="space-y-2">
                            <Label>Building</Label>
                            <Select
                                value={formData.building_id}
                                onValueChange={(value) => {
                                    setFormData(prev => ({ ...prev, building_id: value, flat_id: '' }));
                                    setSelectedWing('');
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select building" />
                                </SelectTrigger>
                                <SelectContent>
                                    {customerBuildings.map((b) => (
                                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Wing Selection */}
                        {availableWings.length > 0 && formData.building_id && (
                            <div className="space-y-2">
                                <Label>Wing</Label>
                                <Select
                                    value={selectedWing}
                                    onValueChange={(value) => {
                                        setSelectedWing(value);
                                        setFormData(prev => ({ ...prev, flat_id: '' }));
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select wing" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableWings.map((wing) => (
                                            <SelectItem key={wing} value={wing}>{wing}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Flat Selection */}
                        {formData.building_id && (
                            <div className="space-y-2">
                                <Label>Flat</Label>
                                <Select
                                    value={formData.flat_id}
                                    onValueChange={(value) => setFormData(prev => ({ ...prev, flat_id: value }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select flat" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {filteredFlats.map((flat) => (
                                            <SelectItem key={flat.id} value={flat.id}>
                                                {flat.wing ? `${flat.wing}-` : ''}Flat {flat.flat_no} (Floor {flat.floor})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Remaining Fields - Only show after Flat is selected */}
                        {formData.flat_id && (
                            <div className="space-y-4 pt-2 border-t mt-4">
                                <div className="space-y-2">
                                    <Label>Rating</Label>
                                    <StarRating rating={formData.rating} onRatingChange={(r) => setFormData({ ...formData, rating: r })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Comments</Label>
                                    <Textarea
                                        placeholder="How was your experience?"
                                        value={formData.comments}
                                        onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                                        rows={3}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Suggestions</Label>
                                    <Textarea
                                        placeholder="Any suggestions for improvement?"
                                        value={formData.suggestions}
                                        onChange={(e) => setFormData({ ...formData, suggestions: e.target.value })}
                                        rows={3}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSubmit} disabled={submitting}>
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingFeedback ? 'Update' : 'Submit'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Card>
                <CardHeader>
                    <CardTitle>My Feedback History</CardTitle>
                </CardHeader>
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
                                            <div>
                                                <p className="text-sm font-medium">{fb.building?.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {fb.flat ? `${fb.flat.wing ? fb.flat.wing + '-' : ''}Flat ${fb.flat.flat_no}` : '-'}
                                                </p>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <StarRating rating={fb.rating} readonly />
                                        </TableCell>
                                        <TableCell className="max-w-[200px] truncate">
                                            {fb.comments || fb.suggestions || 'No comments'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(fb)}>
                                                    <Edit2 className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(fb.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {feedbacks.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                                            No feedback submitted yet
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
