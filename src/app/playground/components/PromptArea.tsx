'use client';

import { useState } from 'react';
import { usePlayground } from '@/lib/playground-context';
import { Textarea } from '@/components/ui/textarea';
import { ChevronRight } from 'lucide-react';

const ASPECTS = ['1:1', '4:3', '16:9', '9:16', '3:4'] as const;

export default function PromptArea() {
  const { mode, prompt, setPrompt, systemPrompt, setSystemPrompt, aspectRatio, setAspectRatio, runGeneration, status } =
    usePlayground();
  const [showSystem, setShowSystem] = useState(false);

  return (
    <div className="grid gap-2">
      {/* System prompt toggle */}
      <button
        onClick={() => setShowSystem(!showSystem)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ChevronRight
          className={`h-3 w-3 transition-transform ${showSystem ? 'rotate-90' : ''}`}
        />
        System prompt
      </button>

      {showSystem && (
        <Textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="You are a helpful assistant..."
          rows={2}
          className="text-sm resize-none bg-muted/50"
        />
      )}

      {/* Main prompt */}
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            if (status !== 'generating') runGeneration();
          }
        }}
        placeholder={
          mode === 'image'
            ? 'A samurai armor with gold accents and dragon engravings...'
            : 'Your prompt...'
        }
        rows={4}
        className="text-sm resize-none"
      />

      {/* Aspect ratio for image mode */}
      {mode === 'image' && (
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1">Aspect:</span>
          {ASPECTS.map((a) => (
            <button
              key={a}
              onClick={() => setAspectRatio(a)}
              className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
                aspectRatio === a
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
