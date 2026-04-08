import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Copy, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface CreatedAccount {
  email: string;
  name: string;
  role: string;
  password: string;
}

export default function CreateStaff() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'staff' | 'manager'>('staff');
  const [password, setPassword] = useState('Pass%word@123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [createdAccount, setCreatedAccount] = useState<CreatedAccount | null>(null);

  // Fetch existing staff/manager profiles
  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ['staff-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, role, created_at')
        .in('role', ['staff', 'manager'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !password.trim()) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('You must be logged in');
        return;
      }

      const response = await supabase.functions.invoke('create-staff-account', {
        body: { email: email.trim(), name: name.trim(), password, role },
      });

      if (response.error) {
        toast.error(response.error.message || 'Failed to create account');
        return;
      }

      const result = response.data;
      if (result?.error) {
        toast.error(result.error);
        return;
      }

      setCreatedAccount({ email: email.trim(), name: name.trim(), role, password });
      toast.success(`${role === 'manager' ? 'Manager' : 'Staff'} account created successfully`);
      setName('');
      setEmail('');
      setPassword('Pass%word@123');
      setRole('staff');
      queryClient.invalidateQueries({ queryKey: ['staff-profiles'] });
    } catch (error: any) {
      toast.error(error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const copyAllCredentials = () => {
    if (!createdAccount) return;
    const loginUrl = `${window.location.origin}/auth/login`;
    const text = `Login URL: ${loginUrl}\nEmail: ${createdAccount.email}\nPassword: ${createdAccount.password}\nRole: ${createdAccount.role}`;
    navigator.clipboard.writeText(text);
    toast.success('All credentials copied!');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Create Staff / Manager Account</h1>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Create Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              New Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter full name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email address"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select value={role} onValueChange={(v) => setRole(v as 'staff' | 'manager')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create Account
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Credentials Card */}
        {createdAccount && (
          <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
            <CardHeader>
              <CardTitle className="text-green-700 dark:text-green-300">✅ Account Created</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Share these credentials with the {createdAccount.role}:</p>

              <div
                className="flex items-center justify-between rounded-md bg-background p-3 border cursor-pointer hover:bg-muted/50"
                onClick={() => copyToClipboard(`${window.location.origin}/auth/login`, 'Login URL')}
              >
                <div>
                  <p className="text-xs text-muted-foreground">Login URL</p>
                  <p className="text-sm font-mono select-all">{window.location.origin}/auth/login</p>
                </div>
                <Copy className="h-4 w-4 text-muted-foreground" />
              </div>

              <div
                className="flex items-center justify-between rounded-md bg-background p-3 border cursor-pointer hover:bg-muted/50"
                onClick={() => copyToClipboard(createdAccount.email, 'Email')}
              >
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-mono select-all">{createdAccount.email}</p>
                </div>
                <Copy className="h-4 w-4 text-muted-foreground" />
              </div>

              <div
                className="flex items-center justify-between rounded-md bg-background p-3 border cursor-pointer hover:bg-muted/50"
                onClick={() => copyToClipboard(createdAccount.password, 'Password')}
              >
                <div>
                  <p className="text-xs text-muted-foreground">Password</p>
                  <p className="text-sm font-mono select-all">{createdAccount.password}</p>
                </div>
                <Copy className="h-4 w-4 text-muted-foreground" />
              </div>

              <div
                className="flex items-center justify-between rounded-md bg-background p-3 border cursor-pointer hover:bg-muted/50"
                onClick={() => copyToClipboard(createdAccount.role, 'Role')}
              >
                <div>
                  <p className="text-xs text-muted-foreground">Role</p>
                  <Badge variant={createdAccount.role === 'manager' ? 'default' : 'secondary'}>
                    {createdAccount.role}
                  </Badge>
                </div>
                <Copy className="h-4 w-4 text-muted-foreground" />
              </div>

              <Button variant="outline" className="w-full mt-2" onClick={copyAllCredentials}>
                <Copy className="mr-2 h-4 w-4" />
                Copy All Credentials
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Existing Staff/Manager List */}
      <Card>
        <CardHeader>
          <CardTitle>Existing Staff & Managers</CardTitle>
        </CardHeader>
        <CardContent>
          {profilesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No staff or managers found
                    </TableCell>
                  </TableRow>
                ) : (
                  profiles.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.email}</TableCell>
                      <TableCell>
                        <Badge variant={p.role === 'manager' ? 'default' : 'secondary'}>
                          {p.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
