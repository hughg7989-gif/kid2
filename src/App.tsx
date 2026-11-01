/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { HostGame } from './components/HostGame';
import { MobileController } from './components/MobileController';
import { generateSessionId, NetworkManager } from './utils/webrtc';
import { Monitor, Smartphone, Columns, Gamepad2 } from 'lucide-react';

export default function App() {
  const [sessionId, setSessionId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlSession = params.get('session');
      if (urlSession) return urlSession.toUpperCase();
    }
    return generateSessionId();
  });

  const [mode, setMode] = useState<'host' | 'controller' | 'split'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const role = params.get('role');
      if (role === 'controller') return 'controller';
      if (params.get('split') === '1') return 'split';
    }
    return 'host';
  });

  // Keep URL updated with session for easy bookmarking and sharing
  useEffect(() => {
    if (typeof window !== 'undefined' && window.history) {
      const url = new URL(window.location.href);
      url.searchParams.set('session', sessionId);
      if (mode === 'controller') {
        url.searchParams.set('role', 'controller');
      } else {
        url.searchParams.delete('role');
      }
      if (mode === 'split') {
        url.searchParams.set('split', '1');
      } else {
        url.searchParams.delete('split');
      }
      window.history.replaceState({}, '', url.toString());
    }
  }, [sessionId, mode]);

  return (
    <main className="w-full h-screen bg-slate-950 flex flex-col overflow-hidden">
      {/* Mode Switcher Nav (Visible on desktop or when in split mode) */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 hidden md:flex items-center gap-1 p-1 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-700 shadow-xl text-xs font-bold text-slate-300">
        <button
          onClick={() => setMode('host')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
            mode === 'host'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'hover:text-white hover:bg-slate-800'
          }`}
        >
          <Monitor className="w-3.5 h-3.5" />
          <span>Host (3D Screen)</span>
        </button>

        <button
          onClick={() => setMode('controller')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
            mode === 'controller'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'hover:text-white hover:bg-slate-800'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Mobile Controller</span>
        </button>

        <button
          onClick={() => setMode('split')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
            mode === 'split'
              ? 'bg-indigo-500 text-white shadow-sm'
              : 'hover:text-white hover:bg-slate-800'
          }`}
        >
          <Columns className="w-3.5 h-3.5" />
          <span>Dual Screen Test</span>
        </button>
      </div>

      {/* Main View Render */}
      {mode === 'host' && (
        <HostGame
          sessionId={sessionId}
          onOpenSplitView={() => setMode('split')}
        />
      )}

      {mode === 'controller' && (
        <MobileController
          sessionId={sessionId}
          onBackToHost={() => setMode('host')}
        />
      )}

      {mode === 'split' && (
        <div className="w-full h-full flex flex-col md:flex-row overflow-hidden pt-12">
          {/* Left: 3D Host Screen */}
          <div className="flex-1 h-1/2 md:h-full relative border-b-4 md:border-b-0 md:border-r-4 border-slate-800">
            <HostGame
              sessionId={sessionId}
            />
          </div>

          {/* Right: Phone Controller Simulation */}
          <div className="w-full md:w-96 h-1/2 md:h-full shrink-0 relative bg-slate-950 shadow-2xl">
            <MobileController
              sessionId={sessionId}
              onBackToHost={() => setMode('host')}
            />
          </div>
        </div>
      )}
    </main>
  );
}
