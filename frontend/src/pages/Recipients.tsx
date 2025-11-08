import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Users, Plus, Trash2, Edit, Loader2, Search
} from "lucide-react";
import AppSidebar from "@/components/AppSidebar";
import { recipientsAPI } from "@/services/api";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const Recipients = () => {
  const [recipients, setRecipients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    recipient_name: "",
    wallet_address: "",
    nickname: "",
    notes: ""
  });

  // Fetch recipients
  useEffect(() => {
    fetchRecipients();
  }, []);

  const fetchRecipients = async () => {
    try {
      const response = await recipientsAPI.list();
      setRecipients(response.recipients || []);
    } catch (error: any) {
      console.error("Failed to fetch recipients:", error);
      toast.error("Failed to load recipients");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!formData.recipient_name || !formData.wallet_address) {
      toast.error("Name and wallet address are required");
      return;
    }

    setIsSaving(true);
    try {
      await recipientsAPI.save(formData);
      toast.success("Recipient added successfully! 🎉");
      setShowAddDialog(false);
      resetForm();
      fetchRecipients();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to add recipient");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editingRecipient) return;

    setIsSaving(true);
    try {
      await recipientsAPI.update(editingRecipient.id, formData);
      toast.success("Recipient updated successfully! ✅");
      setShowEditDialog(false);
      setEditingRecipient(null);
      resetForm();
      fetchRecipients();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to update recipient");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;

    try {
      await recipientsAPI.delete(id);
      toast.success("Recipient deleted");
      fetchRecipients();
    } catch (error: any) {
      toast.error("Failed to delete recipient");
    }
  };

  const openEditDialog = (recipient: any) => {
    setEditingRecipient(recipient);
    setFormData({
      recipient_name: recipient.recipient_name,
      wallet_address: recipient.wallet_address,
      nickname: recipient.nickname || "",
      notes: recipient.notes || ""
    });
    setShowEditDialog(true);
  };

  const resetForm = () => {
    setFormData({
      recipient_name: "",
      wallet_address: "",
      nickname: "",
      notes: ""
    });
  };

  const filteredRecipients = recipients.filter(r =>
    r.recipient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.nickname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.wallet_address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />

      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex items-center justify-between p-6">
            <div>
              <h1 className="text-3xl font-bold">Saved Recipients</h1>
              <p className="text-muted-foreground mt-1">Manage your payment recipients for quick access</p>
            </div>
            <Button onClick={() => setShowAddDialog(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Recipient
            </Button>
          </div>
        </header>

        <div className="p-6 space-y-6">
          {/* Search */}
          <Card className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search by name, nickname, or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </Card>

          {/* Recipients List */}
          <Card className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredRecipients.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No recipients yet</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery ? "No recipients match your search" : "Add your first recipient to get started"}
                </p>
                {!searchQuery && (
                  <Button onClick={() => setShowAddDialog(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Recipient
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRecipients.map((recipient) => (
                  <div
                    key={recipient.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-lg">{recipient.recipient_name}</h3>
                        {recipient.nickname && (
                          <Badge variant="outline" className="text-xs">
                            @{recipient.nickname}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground font-mono">
                        {recipient.wallet_address.substring(0, 10)}...{recipient.wallet_address.substring(38)}
                      </p>
                      {recipient.notes && (
                        <p className="text-sm text-muted-foreground mt-1">{recipient.notes}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(recipient)}
                        className="gap-1"
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(recipient.id, recipient.recipient_name)}
                        className="gap-1 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </main>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Recipient</DialogTitle>
            <DialogDescription>
              Save a recipient for quick payments and voice commands
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="recipient_name">Full Name *</Label>
              <Input
                id="recipient_name"
                placeholder="John Smith"
                value={formData.recipient_name}
                onChange={(e) => setFormData({ ...formData, recipient_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wallet_address">Wallet Address *</Label>
              <Input
                id="wallet_address"
                placeholder="0x..."
                value={formData.wallet_address}
                onChange={(e) => setFormData({ ...formData, wallet_address: e.target.value })}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nickname">Nickname (for voice commands)</Label>
              <Input
                id="nickname"
                placeholder="John, Mom, Landlord..."
                value={formData.nickname}
                onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Use short names for voice commands like "Pay John"
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Recipient"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Recipient</DialogTitle>
            <DialogDescription>
              Update recipient information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit_recipient_name">Full Name *</Label>
              <Input
                id="edit_recipient_name"
                placeholder="John Smith"
                value={formData.recipient_name}
                onChange={(e) => setFormData({ ...formData, recipient_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_wallet_address">Wallet Address *</Label>
              <Input
                id="edit_wallet_address"
                placeholder="0x..."
                value={formData.wallet_address}
                onChange={(e) => setFormData({ ...formData, wallet_address: e.target.value })}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_nickname">Nickname</Label>
              <Input
                id="edit_nickname"
                placeholder="John, Mom, Landlord..."
                value={formData.nickname}
                onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_notes">Notes</Label>
              <Textarea
                id="edit_notes"
                placeholder="Additional notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditDialog(false); setEditingRecipient(null); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Recipients;

