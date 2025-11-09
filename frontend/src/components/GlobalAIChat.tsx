import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Bot, X, Send, Minimize2, Maximize2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const GlobalAIChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: '👋 Hi! I\'m your Floe AI assistant. I can help you with payments, contracts, and A2A transactions. How can I assist you today?',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const messageToSend = inputMessage;
    setInputMessage('');
    setIsTyping(true);

    try {
      const fullHistory = [...messages, userMessage].map(m => ({ 
        role: m.role, 
        content: m.content 
      }));

      console.log('🤖 Sending to AI:', { message: messageToSend, historyLength: fullHistory.length });

      const token = localStorage.getItem('auth_token');
      
      const response = await axios.post('/api/ai/chat', {
        message: messageToSend,
        conversationHistory: fullHistory
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ AI Response received:', response.data);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiMessage]);
      setIsTyping(false);

    } catch (error: any) {
      console.error('❌ AI Chat Error:', error);
      console.error('❌ Error details:', error.response?.data || error.message);
      
      toast.error('AI connection failed - using fallback response', { position: 'top-right' });
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: generateAIResponse(messageToSend),
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);
      setIsTyping(false);
    }
  };

  const generateAIResponse = (userInput: string): string => {
    const input = userInput.toLowerCase();
    
    if (input.includes('payment') || input.includes('pay')) {
      return '💸 I can help you with payments! You can create recurring payments, one-time transfers, or set up A2A autonomous payments. Would you like me to guide you through any of these?';
    } else if (input.includes('contract')) {
      return '📋 Contracts are the foundation of Floe. You can create request contracts (where you receive money) or payment contracts (where you send money). Need help setting one up?';
    } else if (input.includes('a2a') || input.includes('agent')) {
      return '🤖 A2A (Agent-to-Agent) payments let AI handle your transactions autonomously! Enable A2A on any contract, and agents will automatically evaluate and process payments based on your terms. Want to see it in action?';
    } else if (input.includes('wallet')) {
      return '💼 You can manage multiple wallets in Floe. Go to the Wallets page to view balances, create new wallets, or transfer funds. Need help with wallet setup?';
    } else if (input.includes('help') || input.includes('how')) {
      return '🎯 I can help you with:\n• Creating and managing contracts\n• Setting up payments\n• Enabling A2A autonomous payments\n• Managing wallets\n• Understanding transactions\n\nWhat would you like to know more about?';
    } else {
      return '🤔 I understand you\'re asking about "' + userInput + '". I\'m here to help with payments, contracts, and A2A features. Could you tell me more about what you need?';
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 rounded-full w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-lg flex items-center justify-center z-50 animate-bounce-slow"
        >
          <Bot className="w-8 h-8" />
          <Sparkles className="absolute top-1 right-1 w-4 h-4 text-yellow-300 animate-pulse" />
        </Button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <Card className={`fixed bottom-6 right-6 bg-white dark:bg-gray-900 shadow-xl rounded-lg flex flex-col z-50 transition-all duration-300 ${isMinimized ? 'w-80 h-16' : 'w-96 h-[600px]'}`}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-t-lg flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Bot className="w-6 h-6 text-white" />
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
              </div>
              <div>
                <h3 className="font-bold text-white">Floe AI</h3>
                <p className="text-xs text-white/80">Always here to help</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={() => setIsMinimized(!isMinimized)}>
                {isMinimized ? <Maximize2 className="w-4 h-4 text-white" /> : <Minimize2 className="w-4 h-4 text-white" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                <X className="w-4 h-4 text-white" />
              </Button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar">
                {messages.map(message => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] p-3 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-blue-500 text-white rounded-br-none'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <span className="block text-xs mt-1 opacity-70">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="max-w-[70%] p-3 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none">
                      <div className="flex space-x-1">
                        <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce-dot"></span>
                        <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce-dot delay-150"></span>
                        <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce-dot delay-300"></span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t bg-white dark:bg-gray-900">
                <div className="flex gap-2">
                  <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask me anything..."
                    className="flex-1"
                  />
                  
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isTyping}
                    className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  💬 Text chat • ⌨️ Enter to send
                </p>
              </div>
            </>
          )}
        </Card>
      )}
    </>
  );
};

export default GlobalAIChat;
