import { useCallback, useRef, useState } from "react";
import { Platform } from "react-native";

interface Options {
  onResult: (text: string) => void;
  lang?: string;
}

export function useVoiceSearch({ onResult, lang = "en-US" }: Options) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const recognitionRef = useRef<any>(null);

  const start = useCallback(() => {
    if (Platform.OS !== "web") {
      setIsSupported(false);
      return;
    }

    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SR) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SR();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      onResult(transcript);
      if (event.results[event.results.length - 1]?.isFinal) {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isListening, lang, onResult]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return { isListening, isSupported, start, stop };
}
