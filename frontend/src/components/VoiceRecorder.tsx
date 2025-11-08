import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Loader2, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { voiceAPI } from '@/services/api';

interface VoiceRecorderProps {
  onTranscript: (transcript: string) => void;
  audioResponse: string; // ✅ Changed from callback to actual audio data
  isProcessing: boolean;
  aiMessage: string;
  extractedFields?: {
    amount?: number;
    frequency?: string;
    recipient_name?: string;
    start_date?: string;
  };
}

const VoiceRecorder = ({ 
  onTranscript, 
  audioResponse, 
  isProcessing, 
  aiMessage,
  extractedFields 
}: VoiceRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // Play audio response
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.onended = () => {
        setIsPlayingAudio(false);
      };
    }
  }, []);

  const startRecording = async () => {
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
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        // Send to ElevenLabs for transcription
        setIsTranscribing(true);
        try {
          const formData = new FormData();
          formData.append('audio', audioBlob);
          
          const response = await voiceAPI.speechToText(formData);
          const transcriptText = response.transcript;
          
          setTranscript(transcriptText);
          setIsTranscribing(false);
          onTranscript(transcriptText);
          toast.success('Transcription complete!');
        } catch (error: any) {
          console.error('Transcription error:', error);
          setIsTranscribing(false);
          toast.error('Failed to transcribe audio');
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setTranscript('');
      toast.info('🎤 Recording... Click stop when done');
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Failed to access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const playAudio = (audioBase64: string) => {
    try {
      console.log('🔊 Playing audio, size:', audioBase64.length, 'bytes');
      const audio = new Audio(`data:audio/mpeg;base64,${audioBase64}`);
      audioRef.current = audio;
      setIsPlayingAudio(true);
      
      audio.play()
        .then(() => {
          console.log('✅ Audio playback started');
          toast.info('🔊 AI is speaking...');
        })
        .catch((err) => {
          console.error('❌ Audio play error:', err);
          toast.error('Failed to play audio response');
          setIsPlayingAudio(false);
        });
      
      audio.onended = () => {
        console.log('✅ Audio playback ended');
        setIsPlayingAudio(false);
      };
      
      audio.onerror = (err) => {
        console.error('❌ Audio error:', err);
        toast.error('Audio playback error');
        setIsPlayingAudio(false);
      };
    } catch (error) {
      console.error('❌ Failed to create audio:', error);
      toast.error('Failed to play audio');
      setIsPlayingAudio(false);
    }
  };

  // Auto-play AI audio response when it changes
  useEffect(() => {
    if (audioResponse && audioResponse.length > 0) {
      console.log('🔊 Auto-playing audio response:', audioResponse.substring(0, 50) + '...');
      playAudio(audioResponse);
    }
  }, [audioResponse]);

  return (
    <Card className="p-8">
      {/* Animated Waveform */}
      <div className="flex justify-center mb-6">
        {isRecording || isTranscribing ? (
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-primary rounded-full animate-pulse"
                style={{
                  height: `${Math.random() * 40 + 20}px`,
                  animationDelay: `${i * 0.1}s`
                }}
              />
            ))}
          </div>
        ) : (
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Mic className="w-10 h-10 text-primary" />
          </div>
        )}
      </div>

      {/* ✅ ENHANCED Progress Badges with animations */}
      {extractedFields && (
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          <Badge 
            variant={extractedFields.amount ? 'default' : 'secondary'}
            className={extractedFields.amount ? 'animate-in fade-in zoom-in duration-300' : ''}
          >
            {extractedFields.amount ? `💵 $${extractedFields.amount}` : '💵 Amount'}
          </Badge>
          <Badge 
            variant={extractedFields.recipient_name ? 'default' : 'secondary'}
            className={extractedFields.recipient_name ? 'animate-in fade-in zoom-in duration-300' : ''}
          >
            {extractedFields.recipient_name ? `👤 ${extractedFields.recipient_name}` : '👤 Recipient'}
          </Badge>
          <Badge 
            variant={extractedFields.frequency ? 'default' : 'secondary'}
            className={extractedFields.frequency ? 'animate-in fade-in zoom-in duration-300' : ''}
          >
            {extractedFields.frequency ? `🔄 ${extractedFields.frequency}` : '🔄 Frequency'}
          </Badge>
          <Badge 
            variant={extractedFields.start_date ? 'default' : 'secondary'}
            className={extractedFields.start_date ? 'animate-in fade-in zoom-in duration-300' : ''}
          >
            {extractedFields.start_date ? `📅 ${extractedFields.start_date}` : '📅 Date'}
          </Badge>
        </div>
      )}

      {/* AI Message */}
      <div className="text-center mb-6">
        <p className="text-lg font-medium mb-2">
          {isTranscribing ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Transcribing with ElevenLabs...
            </span>
          ) : isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Processing...
            </span>
          ) : isPlayingAudio ? (
            <span className="flex items-center justify-center gap-2">
              <Volume2 className="w-5 h-5 animate-pulse" />
              Speaking...
            </span>
          ) : (
            aiMessage || "Hi! Tell me about the payment you want to set up."
          )}
        </p>
      </div>

      {/* Transcript Display */}
      {transcript && (
        <div className="mb-6 p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground mb-1">You said:</p>
          <p className="text-base">{transcript}</p>
        </div>
      )}

      {/* Record Button */}
      <div className="flex justify-center">
        <Button
          size="lg"
          variant={isRecording ? 'destructive' : 'default'}
          className={isRecording ? 'animate-pulse' : ''}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing || isPlayingAudio || isTranscribing}
        >
          {isRecording ? (
            <>
              <MicOff className="w-5 h-5 mr-2" />
              Stop Recording
            </>
          ) : isTranscribing ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Transcribing...
            </>
          ) : isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Processing...
            </>
          ) : isPlayingAudio ? (
            <>
              <Volume2 className="w-5 h-5 mr-2 animate-pulse" />
              Listening to AI...
            </>
          ) : (
            <>
              <Mic className="w-5 h-5 mr-2" />
              Start Speaking
            </>
          )}
        </Button>
      </div>

      {/* Instructions */}
      <p className="text-center text-sm text-muted-foreground mt-4">
        {isRecording 
          ? "Speak now... Click 'Stop' when done" 
          : isTranscribing
          ? "Transcribing your speech with ElevenLabs Scribe v1..."
          : "Click the button and say something like: 'Pay John $500 monthly for rent'"}
      </p>
    </Card>
  );
};

export default VoiceRecorder;

