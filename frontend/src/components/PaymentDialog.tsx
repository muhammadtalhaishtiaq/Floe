import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Loader2 } from "lucide-react";
import { walletsAPI } from "@/services/api";
import { toast } from "sonner";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: any;
  onPaymentSuccess?: () => void;
  onExecute: (walletId: string, walletAddress: string) => Promise<void>;
}

export const PaymentDialog = ({
  open,
  onOpenChange,
  contract,
  onPaymentSuccess,
  onExecute
}: PaymentDialogProps) => {
  const [userWallets, setUserWallets] = useState<any[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<string>('');
  const [selectedWalletBalance, setSelectedWalletBalance] = useState<number>(0);
  const [isFetchingBalance, setIsFetchingBalance] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // Fetch user wallets when dialog opens
  useEffect(() => {
    if (open) {
      fetchUserWallets();
    }
  }, [open]);

  const fetchUserWallets = async () => {
    try {
      const response = await walletsAPI.getAll();
      if (response.success && response.wallets) {
        // Fetch transactions for each wallet to calculate balance
        const walletsWithBalance = await Promise.all(
          response.wallets.map(async (wallet: any) => {
            try {
              const txResponse = await walletsAPI.getTransactions(wallet.id);
              if (txResponse.success && txResponse.transactions) {
                const transactions = txResponse.transactions;
                
                // Calculate balance: received - sent (only completed transactions)
                let calculatedBalance = 0;
                transactions.forEach((tx: any) => {
                  if (tx.status === 'complete' || tx.status === 'confirmed') {
                    if (tx.type === 'received') {
                      calculatedBalance += parseFloat(tx.amount || 0);
                    } else if (tx.type === 'sent') {
                      calculatedBalance -= parseFloat(tx.amount || 0);
                    }
                  }
                });

                return {
                  ...wallet,
                  calculatedBalance
                };
              }
              return { ...wallet, calculatedBalance: 0 };
            } catch (error) {
              console.error(`Failed to fetch transactions for wallet ${wallet.id}:`, error);
              return { ...wallet, calculatedBalance: 0 };
            }
          })
        );

        setUserWallets(walletsWithBalance);
        
        // Auto-select primary wallet
        const primaryWallet = walletsWithBalance.find((w: any) => w.isPrimary);
        if (primaryWallet) {
          setSelectedWallet(primaryWallet.id);
          setSelectedWalletBalance(primaryWallet.calculatedBalance || 0);
        }
      }
    } catch (error) {
      console.error('Failed to fetch wallets:', error);
      toast.error('Failed to load wallets');
    }
  };

  const calculateWalletBalance = (walletId: string) => {
    const wallet = userWallets.find(w => w.id === walletId);
    if (wallet) {
      setSelectedWalletBalance(wallet.calculatedBalance || 0);
    }
  };

  const handleExecutePayment = async () => {
    if (!selectedWallet) {
      toast.error('Please select a wallet');
      return;
    }

    const wallet = userWallets.find(w => w.id === selectedWallet);
    if (!wallet) {
      toast.error('Wallet not found');
      return;
    }

    setIsExecuting(true);
    try {
      await onExecute(wallet.id, wallet.address);
      onOpenChange(false);
      if (onPaymentSuccess) {
        onPaymentSuccess();
      }
    } catch (error: any) {
      console.error('Payment execution failed:', error);
      toast.error(error.message || 'Payment failed');
    } finally {
      setIsExecuting(false);
    }
  };

  // Parse contract data
  let parsedData: any = {};
  try {
    if (contract?.raw_contract_text) {
      parsedData = typeof contract.raw_contract_text === 'string' 
        ? JSON.parse(contract.raw_contract_text) 
        : contract.raw_contract_text;
    }
  } catch (e) {
    console.error('Failed to parse contract data:', e);
  }

  const counterpartyName = parsedData.counterparty_name || 'Recipient';
  const counterpartyAddress = parsedData.counterparty_address || '';
  const amount = contract ? parseFloat(contract.total_amount_usdc) : 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Confirm Payment
          </AlertDialogTitle>
          <AlertDialogDescription>
            Review the payment details before executing the transaction.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          {/* Select Source Wallet */}
          <div className="space-y-2">
            <label className="text-sm font-semibold">Pay From (Your Wallet)</label>
            <Select 
              value={selectedWallet} 
              onValueChange={(value) => {
                setSelectedWallet(value);
                calculateWalletBalance(value);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select wallet" />
              </SelectTrigger>
              <SelectContent>
                {userWallets.map((wallet) => (
                  <SelectItem key={wallet.id} value={wallet.id}>
                    <div className="flex flex-col items-start w-full">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {wallet.name || 'My Wallet'}
                        </span>
                        {wallet.isPrimary && (
                          <Badge variant="outline" className="text-xs">Primary</Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {wallet.calculatedBalance !== undefined 
                          ? `${wallet.calculatedBalance.toFixed(2)} USDC` 
                          : 'Loading...'}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedWallet && (
              <p className="text-xs text-muted-foreground">
                Send from: {userWallets.find(w => w.id === selectedWallet)?.address}
              </p>
            )}
          </div>

          {/* Destination Wallet */}
          <div className="space-y-2">
            <label className="text-sm font-semibold">Pay To (Recipient)</label>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-1">
                {counterpartyName}
              </p>
              <code className="text-xs text-muted-foreground font-mono">
                Receiver Wallet: {counterpartyAddress}
              </code>
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <label className="text-sm font-semibold">Amount</label>
            <div className="p-4 bg-primary/10 rounded-lg border-2 border-primary/20">
              <p className="text-3xl font-bold text-primary text-center">
                {amount.toFixed(2)} USDC
              </p>
            </div>
          </div>

          {/* Balance Check */}
          {selectedWallet && (
            <div className={`p-3 rounded-lg ${
              isFetchingBalance 
                ? 'bg-muted border border-border'
                : selectedWalletBalance < amount
                ? 'bg-red-500/10 border border-red-500/20'
                : 'bg-green-500/10 border border-green-500/20'
            }`}>
              {isFetchingBalance ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Calculating balance...
                </div>
              ) : (
                <p className={`text-xs ${
                  selectedWalletBalance < amount
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-green-600 dark:text-green-400'
                }`}>
                  <strong>Balance:</strong> {selectedWalletBalance.toFixed(2)} USDC
                  {selectedWalletBalance < amount ? (
                    <span className="block mt-1 text-red-600 dark:text-red-400">
                      ❌ Insufficient balance - For testnet, you can still try
                    </span>
                  ) : (
                    <span className="block mt-1 text-green-600 dark:text-green-400">
                      ✓ Sufficient balance
                    </span>
                  )}
                </p>
              )}
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isExecuting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleExecutePayment();
            }}
            disabled={isExecuting || !selectedWallet || isFetchingBalance}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isExecuting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Execute Payment'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

