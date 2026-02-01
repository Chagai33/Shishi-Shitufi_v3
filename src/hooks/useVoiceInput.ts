import { useState, useEffect, useRef, useCallback } from 'react';

interface VoiceInputState {
  isListening: boolean;
  transcript: string;
  start: () => void;
  stop: () => void;
  reset: () => void;
  error: string | null;
  notSupported: boolean;
}

export function useVoiceInput(): VoiceInputState {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notSupported, setNotSupported] = useState(false);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // @ts-ignore - Vendor prefixes
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setNotSupported(true);
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'he-IL'; // Hebrew default

    recognitionRef.current.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setError(event.error);
      setIsListening(false);
    };

    recognitionRef.current.onresult = (event: any) => {
      let finalTranscript = '';

      // Build transcript from results
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          // Provide interim feedback if needed, but for now we append mainly final
          // Actually, we should probably concatenate current buffer
          // For simplicity in this hook, we'll just grab the latest
          finalTranscript += event.results[i][0].transcript;
        }
      }

      // We want to accumulate or just show current? 
      // User likely wants to speak a list. "continuous=true" lets them keep talking.
      // We'll append to existing state? Or just rely on the API full transcript?
      // SpeechRecognition accummulates results if continuous is true?
      // Actually handling 'continuous' correctly requires valid logic.
      // Simpler approach for this specific hook:

      let currentInterim = '';
      let currentFinal = '';

      for (let i = 0; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          currentFinal += event.results[i][0].transcript;
        } else {
          currentInterim += event.results[i][0].transcript;
        }
      }
      setTranscript(currentFinal + currentInterim);
    };

  }, []);

  const start = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error(e);
      }
    }
  }, [isListening]);

  const stop = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const reset = useCallback(() => {
    setTranscript('');
    setError(null);
  }, []);

  return {
    isListening,
    transcript,
    start,
    stop,
    reset,
    error,
    notSupported
  };
}
