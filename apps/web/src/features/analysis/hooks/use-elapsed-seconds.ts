// Licznik sekund od zamontowania (postep analizy). API nie ma strumienia postepu, wiec kroki na ekranie ida po czasie.
import { useEffect, useState } from 'react';

const TICK_MS = 1000;

export function useElapsedSeconds(): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAt) / TICK_MS));
    }, TICK_MS);

    return () => clearInterval(timer);
  }, []);

  return seconds;
}
