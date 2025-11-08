import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  TrendingUp, FileText, Wallet, Settings, LogOut, Bell,
  Upload, Home, Package, DollarSign, Building2, Cog, ArrowLeft,
  CreditCard, Mic, Edit3
} from "lucide-react";
import Logo from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { contractsAPI, walletsAPI, voiceAPI, recipientsAPI } from "@/services/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import VoiceRecorder from "@/components/VoiceRecorder";

const ContractNew = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1); // Multi-step form
  const [userWallets, setUserWallets] = useState<any[]>([]);
  const [isLoadingWallets, setIsLoadingWallets] = useState(true);
  
  // Voice mode state
  const [mode, setMode] = useState<'voice' | 'manual'>('manual');
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [aiMessage, setAiMessage] = useState("Hi! Tell me about the payment you want to set up.");
  const [conversationContext, setConversationContext] = useState<any>({});
  const [extractedFields, setExtractedFields] = useState<any>({});
  const [matchedRecipients, setMatchedRecipients] = useState<any[]>([]);
  const [audioResponse, setAudioResponse] = useState<string>('');
  
  const [formData, setFormData] = useState({
    // Step 1: Contract Type
    contract_type: "",
    
    // Step 2: Contract Details
    contract_name: "",
    description: "",
    
    // Step 3: Payment Details
    counterparty_name: "",
    counterparty_address: "",
    amount_usdc: "",
    payment_frequency: "",
    payment_day_of_month: "",
    start_date: "",
    end_date: "",
    
    // Optional: File upload
    contract_file: null as File | null,
  });

  // Fetch user's wallets on mount
  useEffect(() => {
    fetchUserWallets();
  }, []);

  const fetchUserWallets = async () => {
    try {
      setIsLoadingWallets(true);
      const response = await walletsAPI.getMy();
      if (response.success && response.wallets) {
        setUserWallets(response.wallets);
      }
    } catch (error) {
      console.error('Failed to fetch wallets:', error);
    } finally {
      setIsLoadingWallets(false);
    }
  };

  // ✅ OPTIMIZED Voice processing handler with retry logic
  const handleVoiceTranscript = async (transcript: string, retryCount = 0) => {
    setIsProcessingVoice(true);
    try {
      const response = await voiceAPI.processContract(transcript, conversationContext);
      
      console.log('📥 Response in', response.processing_time_ms || 0, 'ms:', {
        transcript: response.transcript,
        ai_response: response.ai_response,
        audio: response.audio ? 'Yes' : 'No',
        extracted: response.extracted
      });
      
      // ✅ UPDATE: Merge extracted fields with context (preserve previous values)
      const mergedFields = {
        ...conversationContext,
        ...response.extracted,
        // Only update if new value exists
        amount: response.extracted.amount || conversationContext.amount,
        recipient_name: response.extracted.recipient_name || conversationContext.recipient_name,
        frequency: response.extracted.frequency || conversationContext.frequency,
        start_date: response.extracted.start_date || conversationContext.start_date
      };
      
      setExtractedFields(mergedFields);
      setMatchedRecipients(response.matched_recipients || []);
      setAiMessage(response.ai_response);
      
      // ✅ Store matched recipients in context for later use
      const updatedContext = {
        ...mergedFields,
        counterparty_address: response.matched_recipients?.[0]?.wallet_address || mergedFields.counterparty_address
      };
      setConversationContext(updatedContext);
      
      // Set audio response (triggers auto-play)
      if (response.audio) {
        console.log('🔊 Audio ready:', response.audio.length, 'bytes');
        setAudioResponse(response.audio);
      } else {
        console.warn('⚠️ No audio, showing text only');
        toast.info(response.ai_response);
      }
      
      // If complete, populate form data
      if (response.is_complete) {
        // Get wallet address from matched recipients or context
        const walletAddress = response.matched_recipients?.[0]?.wallet_address || 
                             matchedRecipients?.[0]?.wallet_address || 
                             conversationContext?.counterparty_address || 
                             '';
        
        const contractData = {
          ...formData,
          contract_name: mergedFields.description || `Payment to ${mergedFields.recipient_name}`,
          description: mergedFields.description || '',
          counterparty_name: mergedFields.recipient_name || '',
          counterparty_address: walletAddress,
          amount_usdc: mergedFields.amount?.toString() || '',
          payment_frequency: mergedFields.frequency || '',
          start_date: mergedFields.start_date || new Date().toISOString().split('T')[0],
          payment_day_of_month: mergedFields.payment_day_of_month?.toString() || '',
          contract_type: 'invoice_payment'
        };
        
        setFormData(contractData);
        
        // ✅ Show success message - let user click button
        console.log('📋 Contract ready! User can review and click "Create Contract"');
        toast.success('✅ Contract details collected! Review and click "Create Contract".');
      }
    } catch (error: any) {
      console.error('❌ Voice processing error:', error);
      
      // ✅ RETRY LOGIC (up to 2 retries)
      if (retryCount < 2) {
        console.log(`🔄 Retrying... (${retryCount + 1}/2)`);
        toast.warning('Retrying...');
        setTimeout(() => handleVoiceTranscript(transcript, retryCount + 1), 1000);
        return;
      }
      
      // ✅ GRACEFUL ERROR HANDLING
      const errorMsg = error.response?.data?.fallback_message || 
                       error.response?.data?.error || 
                       'Sorry, I had trouble understanding. Could you try again?';
      
      toast.error(errorMsg);
      setAiMessage(errorMsg);
    } finally {
      setIsProcessingVoice(false);
    }
  };

  const contractTypes = [
    { value: "real_estate_rental", label: "Real Estate Rental", icon: Home },
    { value: "supply_chain", label: "Supply Chain Payment", icon: Package },
    { value: "treasury_bond", label: "Treasury Bond/Investment", icon: DollarSign },
    { value: "freelance_milestone", label: "Freelance/Service Agreement", icon: Building2 },
    { value: "equipment_lease", label: "Equipment Lease", icon: Cog },
    { value: "invoice_payment", label: "Invoice Payment", icon: FileText },
  ];

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast.error("File size must be less than 10MB");
        return;
      }
      if (!file.type.includes('pdf') && !file.type.includes('text')) {
        toast.error("Only PDF and TXT files are supported");
        return;
      }
      setFormData({ ...formData, contract_file: file });
      toast.success(`File uploaded: ${file.name}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent, dataOverride?: any) => {
    e?.preventDefault();
    setIsLoading(true);

    try {
      const dataToSubmit = dataOverride || formData;
      
      console.log('📤 Submitting contract with data:', {
        ...dataToSubmit,
        start_date: dataToSubmit.start_date,
        end_date: dataToSubmit.end_date,
        payment_day_of_month: dataToSubmit.payment_day_of_month
      });
      
      const response = await contractsAPI.create(dataToSubmit);
      
      console.log('✅ Contract created:', response);
      toast.success("✅ Contract created successfully!");
      navigate("/contracts");
    } catch (error: any) {
      console.error("❌ Contract creation error:", error);
      const errorMessage = error.response?.data?.error || error.message || "Failed to create contract";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const nextStep = () => {
    if (step === 1 && !formData.contract_type) {
      toast.error("Please select a contract type");
      return;
    }
    if (step === 2 && !formData.contract_name) {
      toast.error("Please enter a contract name");
      return;
    }
    setStep(step + 1);
  };

  const prevStep = () => setStep(step - 1);

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-background sticky top-0 h-screen flex flex-col">
        <div className="p-6 border-b border-border">
          <Link to="/" className="hover:opacity-80 transition-opacity inline-block">
            <Logo />
          </Link>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <Link to="/dashboard">
            <Button variant="ghost" className="w-full justify-start gap-3">
              <TrendingUp className="w-5 h-5" />
              Dashboard
            </Button>
          </Link>
          <Link to="/contracts">
            <Button className="w-full justify-start gap-3 bg-primary hover:bg-primary/90 text-white font-semibold">
              <FileText className="w-5 h-5" />
              Contracts
            </Button>
          </Link>
          <Link to="/payments">
            <Button variant="ghost" className="w-full justify-start gap-3">
              <CreditCard className="w-5 h-5" />
              Payments
            </Button>
          </Link>
          <Link to="/wallets">
            <Button variant="ghost" className="w-full justify-start gap-3">
              <Wallet className="w-5 h-5" />
              Wallets
            </Button>
          </Link>
          <Link to="/settings">
            <Button variant="ghost" className="w-full justify-start gap-3">
              <Settings className="w-5 h-5" />
              Settings
            </Button>
          </Link>
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-3 p-3 rounded-lg bg-muted">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center text-white font-bold">
              {user?.full_name?.split(' ').map(n => n[0]).join('') || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{user?.full_name || 'User'}</p>
              <p className="text-xs text-muted-foreground">{user?.role || 'Free Plan'}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
              <Link to="/contracts">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold">Create New Contract</h1>
                <p className="text-muted-foreground mt-1">Set up automated payment schedule</p>
              </div>
            </div>
            <Button variant="ghost" size="icon">
              <Bell className="w-5 h-5" />
            </Button>
          </div>
        </header>

        <div className="p-6 max-w-4xl mx-auto">
          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-3 ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  step >= 1 ? 'bg-primary text-white' : 'bg-muted'
                }`}>
                  1
                </div>
                <span className="font-semibold">Type</span>
              </div>
              <div className={`flex-1 h-1 mx-4 ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
              <div className={`flex items-center gap-3 ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  step >= 2 ? 'bg-primary text-white' : 'bg-muted'
                }`}>
                  2
                </div>
                <span className="font-semibold">Details</span>
              </div>
              <div className={`flex-1 h-1 mx-4 ${step >= 3 ? 'bg-primary' : 'bg-muted'}`} />
              <div className={`flex items-center gap-3 ${step >= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  step >= 3 ? 'bg-primary text-white' : 'bg-muted'
                }`}>
                  3
                </div>
                <span className="font-semibold">Payment</span>
              </div>
            </div>
          </div>

          {/* Voice/Manual Toggle */}
          <div className="mb-8 flex justify-center">
            <div className="inline-flex rounded-lg border border-border p-1 bg-muted">
              <Button
                type="button"
                variant={mode === 'voice' ? 'default' : 'ghost'}
                className="gap-2"
                onClick={() => setMode('voice')}
              >
                <Mic className="w-4 h-4" />
                Voice Assistant
              </Button>
              <Button
                type="button"
                variant={mode === 'manual' ? 'default' : 'ghost'}
                className="gap-2"
                onClick={() => setMode('manual')}
              >
                <Edit3 className="w-4 h-4" />
                Manual Form
              </Button>
            </div>
          </div>

          {/* Voice Mode */}
          {mode === 'voice' ? (
            <div className="space-y-6">
              <VoiceRecorder
                onTranscript={handleVoiceTranscript}
                audioResponse={audioResponse}
                isProcessing={isProcessingVoice}
                aiMessage={aiMessage}
                extractedFields={extractedFields}
              />

              {/* Show extracted contract preview when complete */}
              {extractedFields.amount && extractedFields.recipient_name && extractedFields.frequency && (
                <Card className="p-6 bg-primary/5 border-primary/20">
                  <h3 className="text-xl font-bold mb-4">📋 Contract Preview</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount:</span>
                      <span className="font-semibold">${extractedFields.amount} USDC</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Recipient:</span>
                      <span className="font-semibold">{extractedFields.recipient_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Frequency:</span>
                      <span className="font-semibold capitalize">{extractedFields.frequency?.replace('_', ' ')}</span>
                    </div>
                    {extractedFields.start_date && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Start Date:</span>
                        <span className="font-semibold">{extractedFields.start_date}</span>
                      </div>
                    )}
                    {extractedFields.description && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Description:</span>
                        <span className="font-semibold">{extractedFields.description}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setMode('manual');
                        toast.info('Switched to manual mode for editing');
                      }}
                    >
                      ✏️ Edit Manually
                    </Button>
                    <Button
                      type="button"
                      variant="gradient"
                      className="flex-1 animate-pulse"
                      onClick={handleSubmit}
                      disabled={isLoading}
                    >
                      {isLoading ? '⏳ Creating...' : '✅ Create Contract'}
                    </Button>
                  </div>
                  <p className="text-center text-sm text-muted-foreground mt-3">
                    👆 Review the details above and click "Create Contract" to proceed
                  </p>
                </Card>
              )}
            </div>
          ) : (
            /* Manual Form Mode */
            <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: Contract Type */}
            {step === 1 && (
              <Card className="p-6">
                <h2 className="text-2xl font-bold mb-6">Choose Contract Type</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {contractTypes.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, contract_type: type.value })}
                      className={`p-6 rounded-lg border-2 transition-all hover:border-primary ${
                        formData.contract_type === type.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          formData.contract_type === type.value
                            ? 'bg-primary text-white'
                            : 'bg-muted'
                        }`}>
                          <type.icon className="w-6 h-6" />
                        </div>
                        <div className="text-left">
                          <p className="font-semibold">{type.label}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="flex justify-end gap-4 mt-6">
                  <Button type="button" onClick={nextStep} variant="gradient" size="lg">
                    Continue
                  </Button>
                </div>
              </Card>
            )}

            {/* Step 2: Contract Details */}
            {step === 2 && (
              <Card className="p-6 space-y-6">
                <h2 className="text-2xl font-bold">Contract Details</h2>
                
                <div className="space-y-2">
                  <Label htmlFor="contract_name">Contract Name *</Label>
                  <Input
                    id="contract_name"
                    placeholder="e.g., Apartment #405 Monthly Rent"
                    value={formData.contract_name}
                    onChange={(e) => setFormData({ ...formData, contract_name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of the contract"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contract_file">Upload Contract (Optional)</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors">
                    <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">
                      {formData.contract_file ? formData.contract_file.name : "Drag & drop PDF or TXT file"}
                    </p>
                    <Input
                      id="contract_file"
                      type="file"
                      accept=".pdf,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('contract_file')?.click()}
                    >
                      Choose File
                    </Button>
                  </div>
                </div>

                <div className="flex justify-between gap-4 pt-4">
                  <Button type="button" onClick={prevStep} variant="outline" size="lg">
                    Back
                  </Button>
                  <Button type="button" onClick={nextStep} variant="gradient" size="lg">
                    Continue
                  </Button>
                </div>
              </Card>
            )}

            {/* Step 3: Payment Details */}
            {step === 3 && (
              <Card className="p-6 space-y-6">
                <h2 className="text-2xl font-bold">Payment Details</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="counterparty_name">Recipient Name *</Label>
                    <Input
                      id="counterparty_name"
                      placeholder="e.g., Alice Thompson"
                      value={formData.counterparty_name}
                      onChange={(e) => setFormData({ ...formData, counterparty_name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="counterparty_address">Recipient Wallet Address *</Label>
                    <Input
                      id="counterparty_address"
                      placeholder="0x..."
                      value={formData.counterparty_address}
                      onChange={(e) => setFormData({ ...formData, counterparty_address: e.target.value })}
                      required
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <p className="text-xs text-muted-foreground">
                        💡 For testing: Use one of your wallet addresses
                      </p>
                      {userWallets.length > 0 && (
                        <Select 
                          value=""
                          onValueChange={(value) => {
                            setFormData({ ...formData, counterparty_address: value });
                          }}
                        >
                          <SelectTrigger className="w-[180px] h-7 text-xs">
                            <SelectValue placeholder="Quick copy..." />
                          </SelectTrigger>
                          <SelectContent>
                            {userWallets.map((wallet) => (
                              <SelectItem key={wallet.id} value={wallet.address} className="text-xs">
                                {wallet.name} {wallet.isPrimary && '★'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="amount_usdc">Amount (USDC) *</Label>
                    <Input
                      id="amount_usdc"
                      type="number"
                      step="0.01"
                      placeholder="1200.00"
                      value={formData.amount_usdc}
                      onChange={(e) => setFormData({ ...formData, amount_usdc: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payment_frequency">Payment Frequency *</Label>
                    <Select 
                      value={formData.payment_frequency}
                      onValueChange={(value) => setFormData({ ...formData, payment_frequency: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="one_time">One-time</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {formData.payment_frequency === "monthly" && (
                  <div className="space-y-2">
                    <Label htmlFor="payment_day_of_month">Payment Day of Month *</Label>
                    <Input
                      id="payment_day_of_month"
                      type="number"
                      min="1"
                      max="31"
                      placeholder="1"
                      value={formData.payment_day_of_month}
                      onChange={(e) => setFormData({ ...formData, payment_day_of_month: e.target.value })}
                      required
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Start Date *</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="end_date">End Date (Optional)</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex justify-between gap-4 pt-4">
                  <Button type="button" onClick={prevStep} variant="outline" size="lg">
                    Back
                  </Button>
                  <Button type="submit" variant="gradient" size="lg" disabled={isLoading}>
                    {isLoading ? "Creating..." : "Create Contract"}
                  </Button>
                </div>
              </Card>
            )}
          </form>
          )}
        </div>
      </main>
    </div>
  );
};

export default ContractNew;

