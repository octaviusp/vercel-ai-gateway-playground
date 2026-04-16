'use client';

import { useState } from 'react';
import { PlaygroundProvider, usePlayground } from '@/lib/playground-context';
import AuthGate from './components/AuthGate';
import SessionStatsBar from './components/SessionStatsBar';
import ModelSelectorCompact from './components/ModelSelectorCompact';
import PromptArea from './components/PromptArea';
import GenerateButton from './components/GenerateButton';
import OutputArea from './components/OutputArea';
import AccountSummary from './components/AccountSummary';
import TransactionFeed from './components/TransactionFeed';
import TopupDialog from './components/TopupDialog';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

function PlaygroundInner() {
  const { modelsLoading } = usePlayground();
  const [topupOpen, setTopupOpen] = useState(false);

  if (modelsLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading models...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <SessionStatsBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Main panel */}
        <main className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          <ModelSelectorCompact />
          <PromptArea />
          <GenerateButton />
          <OutputArea />
        </main>

        {/* Sidebar */}
        <aside className="hidden w-80 shrink-0 border-l bg-card/20 lg:flex lg:flex-col">
          <AccountSummary onTopup={() => setTopupOpen(true)} />
          <TransactionFeed />
          <div className="p-3 border-t">
            <a href="/api/usage/export" download>
              <Button variant="outline" size="sm" className="w-full">
                <Download className="h-3.5 w-3.5 mr-2" />
                Export report
              </Button>
            </a>
          </div>
        </aside>
      </div>

      <TopupDialog open={topupOpen} onOpenChange={setTopupOpen} />
    </div>
  );
}

export default function PlaygroundPage() {
  return (
    <PlaygroundProvider>
      <AuthGate>
        <PlaygroundInner />
      </AuthGate>
    </PlaygroundProvider>
  );
}
