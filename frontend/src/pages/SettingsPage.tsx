import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User, Shield, Mail, Key, Eye, EyeOff, Bell, CreditCard, Loader2, Trash2, Check, X
} from "lucide-react";
import AppSidebar from "@/components/AppSidebar";
import { toast } from "sonner";
import { apiKeysAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

const Settings = () => {
  const { user } = useAuth();
  const [userName, setUserName] = useState(user?.full_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [company, setCompany] = useState("");
  
  // API Keys State
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  
  // New API Key Form
  const [newKeyService, setNewKeyService] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [newKeyConfig, setNewKeyConfig] = useState("");
  const [showNewKeyValue, setShowNewKeyValue] = useState(false);

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    setIsLoadingKeys(true);
    try {
      const response = await apiKeysAPI.list();
      setApiKeys(response.apiKeys || []);
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
      toast.error('Failed to load API keys');
    } finally {
      setIsLoadingKeys(false);
    }
  };

  const handleSaveProfile = () => {
    toast.success("Profile updated successfully!");
  };

  const handleSaveApiKey = async () => {
    if (!newKeyService || !newKeyValue) {
      toast.error('Service name and API key are required');
      return;
    }

    setIsSavingKey(true);
    try {
      let additionalConfig = null;
      if (newKeyConfig) {
        try {
          additionalConfig = JSON.parse(newKeyConfig);
        } catch (e) {
          toast.error('Invalid JSON in additional config');
          setIsSavingKey(false);
          return;
        }
      }

      await apiKeysAPI.save({
        service_name: newKeyService,
        api_key: newKeyValue,
        additional_config: additionalConfig
      });

      toast.success(`${newKeyService} API key saved successfully! 🎉`);
      setNewKeyService('');
      setNewKeyValue('');
      setNewKeyConfig('');
      fetchApiKeys();
    } catch (error: any) {
      console.error('Failed to save API key:', error);
      toast.error(error.response?.data?.error || 'Failed to save API key');
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleDeleteApiKey = async (serviceName: string) => {
    if (!confirm(`Delete ${serviceName} API key?`)) return;

    try {
      await apiKeysAPI.delete(serviceName);
      toast.success(`${serviceName} API key deleted`);
      fetchApiKeys();
    } catch (error) {
      console.error('Failed to delete API key:', error);
      toast.error('Failed to delete API key');
    }
  };

  const handleToggleApiKey = async (serviceName: string) => {
    try {
      await apiKeysAPI.toggle(serviceName);
      toast.success(`${serviceName} API key toggled`);
      fetchApiKeys();
    } catch (error) {
      console.error('Failed to toggle API key:', error);
      toast.error('Failed to toggle API key');
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar */}
      <AppSidebar />

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex items-center justify-between p-6">
            <div>
              <h1 className="text-3xl font-bold">Settings</h1>
              <p className="text-muted-foreground mt-1">Manage your account preferences and security</p>
            </div>
            <Button variant="ghost" size="icon">
              <Bell className="w-5 h-5" />
            </Button>
          </div>
        </header>

        <div className="p-6">
          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
              <TabsTrigger value="profile" className="gap-2">
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">Profile</span>
              </TabsTrigger>
              <TabsTrigger value="api-keys" className="gap-2">
                <Key className="w-4 h-4" />
                <span className="hidden sm:inline">API Keys</span>
              </TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile">
              <Card className="p-6">
                <h2 className="text-2xl font-bold mb-6">Profile Information</h2>
                <div className="space-y-6 max-w-xl">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input 
                      id="name" 
                      value={userName} 
                      onChange={(e) => setUserName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

  

                  {/* <Button variant="gradient" onClick={handleSaveProfile}>
                    Save Changes
                  </Button> */}
                </div>
              </Card>
            </TabsContent>

            {/* API Keys Tab */}
            <TabsContent value="api-keys">
              <div className="space-y-6">
                {/* Add New API Key Card */}
                <Card className="p-6">
                  <h2 className="text-2xl font-bold mb-2">Add API Key</h2>
                  <p className="text-muted-foreground mb-6">
                    Store your ElevenLabs and Cloudflare AI API keys securely. These are encrypted and only accessible by you.
                  </p>

                  <div className="space-y-4 max-w-2xl">
                    <div className="space-y-2">
                      <Label htmlFor="service">Service</Label>
                      <select
                        id="service"
                        className="w-full px-3 py-2 border border-border rounded-md bg-background"
                        value={newKeyService}
                        onChange={(e) => setNewKeyService(e.target.value)}
                      >
                        <option value="">Select a service...</option>
                        <option value="elevenlabs">ElevenLabs (Voice AI)</option>
                        <option value="cloudflare">Cloudflare Workers AI</option>
                        {/* <option value="openai">OpenAI (Optional)</option> */}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="api-key">API Key</Label>
                      <div className="relative">
                        <Input
                          id="api-key"
                          type={showNewKeyValue ? "text" : "password"}
                          value={newKeyValue}
                          onChange={(e) => setNewKeyValue(e.target.value)}
                          placeholder="sk_..."
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowNewKeyValue(!showNewKeyValue)}
                        >
                          {showNewKeyValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="config">Additional Config (Optional JSON)</Label>
                      <Input
                        id="config"
                        value={newKeyConfig}
                        onChange={(e) => setNewKeyConfig(e.target.value)}
                        placeholder='{"accountId": "...", "apiToken": "..."}'
                      />
                      <p className="text-xs text-muted-foreground">
                        For Cloudflare: Add accountId and apiToken as JSON
                      </p>
                    </div>

                    <Button
                      variant="gradient"
                      onClick={handleSaveApiKey}
                      disabled={isSavingKey || !newKeyService || !newKeyValue}
                    >
                      {isSavingKey ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save API Key'
                      )}
                    </Button>
                  </div>
                </Card>

                {/* Saved API Keys List */}
                <Card className="p-6">
                  <h2 className="text-2xl font-bold mb-2">Saved API Keys</h2>
                  <p className="text-muted-foreground mb-6">
                    Manage your stored API keys. Keys are encrypted and never displayed in full.
                  </p>

                  {isLoadingKeys ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : apiKeys.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Key className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No API keys saved yet</p>
                      <p className="text-sm mt-2">Add your first API key above to get started</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {apiKeys.map((key) => (
                        <div
                          key={key.service_name}
                          className="flex items-center justify-between p-4 border border-border rounded-lg bg-card"
                        >
                          <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-primary/10">
                              {key.service_name === 'elevenlabs' && <CreditCard className="w-5 h-5 text-primary" />}
                              {key.service_name === 'cloudflare' && <Shield className="w-5 h-5 text-primary" />}
                              {/* {key.service_name === 'openai' && <Key className="w-5 h-5 text-primary" />} */}
                            </div>
                            <div>
                              <h3 className="font-semibold">
                                {key.service_name === 'elevenlabs' && 'ElevenLabs'}
                                {key.service_name === 'cloudflare' && 'Cloudflare Workers AI'}
                                {/* {key.service_name === 'openai' && 'OpenAI'} */}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                Added {new Date(key.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge variant={key.is_active ? "default" : "secondary"}>
                              {key.is_active ? (
                                <>
                                  <Check className="w-3 h-3 mr-1" />
                                  Active
                                </>
                              ) : (
                                <>
                                  <X className="w-3 h-3 mr-1" />
                                  Inactive
                                </>
                              )}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleApiKey(key.service_name)}
                            >
                              {key.is_active ? 'Disable' : 'Enable'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteApiKey(key.service_name)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Help Card */}
                <Card className="p-6 bg-primary/5 border-primary/20">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    Security & Privacy
                  </h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>✓ All API keys are encrypted using AES-256-GCM</li>
                    <li>✓ Keys are only decrypted when needed for API calls</li>
                    <li>✓ Circle keys remain server-side for maximum security</li>
                    <li>✓ You can disable or delete keys at any time</li>
                  </ul>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Settings;
