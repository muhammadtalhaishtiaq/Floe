import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, MicOff, Square, X, Sparkles } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

const GlobalVoiceAssistant = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentStatus, setCurrentStatus] = useState("Ready");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Start recording
  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await processVoiceInput(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsListening(true);
      setCurrentStatus("Listening...");
      toast.info('🎤 Listening... Speak now!', { position: 'top-right' });
    } catch (error) {
      console.error('Microphone error:', error);
      toast.error('❌ Microphone access denied', { position: 'top-right' });
    }
  };

  // Stop recording
  const stopListening = () => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      setIsListening(false);
      setCurrentStatus("Processing...");
    }
  };

  // Stop speaking
  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsSpeaking(false);
    setCurrentStatus("Ready");
    toast.info('🔇 Stopped speaking', { position: 'top-right' });
  };

  // Process voice input: Transcribe → AI → Speak
  const processVoiceInput = async (audioBlob: Blob) => {
    try {
      // Step 1: Transcribe audio (Cloudflare Whisper)
      setCurrentStatus("Transcribing...");
      const token = localStorage.getItem('auth_token');
      const formData = new FormData();
      formData.append('audio', audioBlob);

      const transcribeResponse = await axios.post(
        '/api/ai/transcribe',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      const transcribedText = transcribeResponse.data.text;

      // Step 2: Get AI response (Cloudflare LLaMA 3) - SHORT VERSION
      setCurrentStatus("AI thinking...");
      const aiResponse = await axios.post(
        '/api/ai/chat',
        {
          message: transcribedText,
          conversationHistory: [],
          shortResponse: true // Flag for shorter responses
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const aiText = aiResponse.data.response;

      // Step 3: Check if navigation is needed
      if (aiResponse.data.navigate) {
        const navPath = aiResponse.data.navigate;
        
        // Check if navigation requires authentication
        const protectedRoutes = ['/dashboard', '/wallets', '/contracts', '/payments', '/a2a', '/request-center', '/settings'];
        const isProtected = protectedRoutes.some(route => navPath.startsWith(route));
        
        if (isProtected) {
          const token = localStorage.getItem('auth_token');
          if (!token) {
            // User not logged in - don't navigate, just inform
            await speakResponse("I'd love to show you that, but you need to login first. Please sign in to access your dashboard features.");
            return;
          }
        }
        
        console.log(`🧭 Navigating to: ${navPath}`);
        
        // Speak response first, then navigate
        await speakResponse(aiText, navPath);
      } else {
        // Just speak response
        await speakResponse(aiText);
      }

    } catch (error: any) {
      console.error('Voice processing error:', error);
      toast.error('❌ Voice processing failed', { position: 'top-right' });
      setCurrentStatus("Ready");
    }
  };

  // Speak response using ElevenLabs
  const speakResponse = async (text: string, navigateTo?: string) => {
    try {
      setIsSpeaking(true);
      setCurrentStatus("Speaking...");

    const response = await axios.post(
      '/api/ai/speak',
        { text },
        { responseType: 'blob' }
      );

      const audioBlob = new Blob([response.data], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        setCurrentStatus("Ready");
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
        
        // Navigate after speaking if path is provided
        if (navigateTo) {
          setTimeout(() => {
            navigate(navigateTo);
            toast.success(`✅ Navigated to ${navigateTo}`, { position: 'top-right' });
          }, 500);
        }
      };

      audio.play();
    } catch (error: any) {
      console.error('Speech error:', error);
      toast.error('❌ Speech failed', { position: 'top-right' });
      setIsSpeaking(false);
      setCurrentStatus("Ready");
    }
  };

  return (
    <>
      {/* Floating Voice Button - ABOVE Chat (bottom: 28rem instead of 6) */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-28 right-6 rounded-full w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg flex items-center justify-center z-50"
        >
          <Mic className="w-8 h-8" />
          <Sparkles className="absolute top-1 right-1 w-4 h-4 text-yellow-300 animate-pulse" />
        </Button>
      )}

      {/* Voice Assistant Window */}
      {isOpen && (
        <Card className="fixed bottom-28 right-6 w-80 bg-white dark:bg-gray-900 shadow-xl rounded-lg flex flex-col z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Mic className="w-6 h-6 text-white" />
                <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                  isListening ? 'bg-red-500 animate-pulse' : isSpeaking ? 'bg-blue-500 animate-pulse' : 'bg-green-400'
                }`}></div>
              </div>
              <div>
                <h3 className="font-bold text-white">Voice Assistant</h3>
                <p className="text-xs text-white/80">{currentStatus}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
              <X className="w-4 h-4 text-white" />
            </Button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Microphone Button OR Stop Button */}
            <div className="flex justify-center">
              {isSpeaking ? (
                <Button
                  onClick={stopSpeaking}
                  className="w-32 h-32 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg flex items-center justify-center animate-pulse"
                >
                  <Square className="w-16 h-16" />
                </Button>
              ) : (
                <Button
                  onClick={isListening ? stopListening : startListening}
                  className={`w-32 h-32 rounded-full ${
                    isListening
                      ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                      : 'bg-green-500 hover:bg-green-600'
                  } text-white shadow-lg flex items-center justify-center`}
                >
                  {isListening ? (
                    <MicOff className="w-16 h-16" />
                  ) : (
                    <Mic className="w-16 h-16" />
                  )}
                </Button>
              )}
            </div>

            {/* Status Only */}
            <div className="text-center">
              {isListening && (
                <p className="text-sm text-green-600 dark:text-green-400 font-semibold animate-pulse">
                  🎤 {currentStatus}
                </p>
              )}
              {isSpeaking && (
                <p className="text-sm text-blue-600 dark:text-blue-400 font-semibold animate-pulse">
                  🔊 {currentStatus}
                </p>
              )}
              {!isListening && !isSpeaking && currentStatus === "Processing..." && (
                <p className="text-sm text-purple-600 dark:text-purple-400 font-semibold animate-pulse">
                  ⚡ {currentStatus}
                </p>
              )}
              {!isListening && !isSpeaking && currentStatus === "Ready" && (
                <p className="text-sm text-muted-foreground">
                  Click the microphone to start
                </p>
              )}
            </div>

            {/* Instructions */}
            {!isListening && !isSpeaking && currentStatus === "Ready" && (
              <div className="text-center space-y-2 text-xs text-muted-foreground">
                <p>🎙️ Press mic → speak → press again</p>
                <p>🤖 AI will respond with voice</p>
                <p>🔴 Click stop to interrupt</p>
              </div>
            )}
          </div>
        </Card>
      )}
    </>
  );
};

export default GlobalVoiceAssistant;

