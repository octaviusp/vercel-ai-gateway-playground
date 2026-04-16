'use client';

import { usePlayground } from '@/lib/playground-context';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle } from 'lucide-react';

function MetadataFooter() {
  const { lastMeta } = usePlayground();
  if (!lastMeta) return null;

  return (
    <div className="flex flex-wrap gap-1.5 pt-3 border-t border-border/50">
      <Badge variant="secondary" className="text-[10px] font-mono">
        {lastMeta.model}
      </Badge>
      {lastMeta.providerUsed && (
        <Badge variant="outline" className="text-[10px]">
          via {lastMeta.providerUsed}
        </Badge>
      )}
      {lastMeta.inputTokens != null && (
        <Badge variant="outline" className="text-[10px] font-mono">
          {lastMeta.inputTokens} in / {lastMeta.outputTokens ?? 0} out
        </Badge>
      )}
      {lastMeta.latencyMs != null && (
        <Badge variant="outline" className="text-[10px] font-mono">
          {lastMeta.latencyMs}ms
        </Badge>
      )}
      {lastMeta.costUsd != null && (
        <Badge variant="outline" className="text-[10px] font-mono">
          ${lastMeta.costUsd.toFixed(6)}
        </Badge>
      )}
    </div>
  );
}

export default function OutputArea() {
  const { mode, status, output, images, errorMsg } = usePlayground();

  // Nothing to show yet
  if (status === 'idle' && !output && images.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center rounded-lg border border-dashed border-border/50">
        <p className="text-sm text-muted-foreground">
          Output will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col rounded-lg border bg-card/30 min-h-0">
      {/* Error */}
      {errorMsg && (
        <div className="flex items-start gap-2 p-3 text-sm text-red-400 border-b border-red-500/20 bg-red-500/5">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Text output */}
      {(mode === 'text' || output) && output && (
        <ScrollArea className="flex-1 p-4">
          <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
            {output}
            {status === 'generating' && (
              <span className="inline-block w-1.5 h-4 bg-foreground/70 animate-blink ml-0.5 align-text-bottom" />
            )}
          </pre>
        </ScrollArea>
      )}

      {/* Generating placeholder for text */}
      {mode === 'text' && status === 'generating' && !output && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-400" />
            </span>
            Waiting for response...
          </div>
        </div>
      )}

      {/* Image output */}
      {images.length > 0 && (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {images.map((img, i) => (
            <img
              key={i}
              src={`data:${img.mediaType};base64,${img.base64}`}
              className="rounded-lg border w-full"
              alt=""
            />
          ))}
        </div>
      )}

      {/* Image generating placeholder */}
      {mode === 'image' && status === 'generating' && images.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-400" />
            </span>
            Generating image...
          </div>
        </div>
      )}

      {/* Metadata footer after completion */}
      {(status === 'complete' || status === 'error') && (
        <div className="p-3 border-t border-border/30">
          <MetadataFooter />
        </div>
      )}
    </div>
  );
}
