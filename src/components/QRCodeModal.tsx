/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Smartphone, Copy, Check, ExternalLink, X, Wifi } from 'lucide-react';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  isConnected: boolean;
  onOpenSplitView?: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  sessionId,
  isConnected,
  onOpenSplitView,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const controllerUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?session=${sessionId}&role=controller`
    : '';

  useEffect(() => {
    if (!sessionId || !isOpen) return;

    QRCode.toDataURL(
      controllerUrl,
      {
        width: 320,
        margin: 2,
        color: {
          dark: '#1e1b4b',
          light: '#ffffff',
        },
      },
      (err, url) => {
        if (!err && url) {
          setQrDataUrl(url);
        }
      }
    );
  }, [sessionId, controllerUrl, isOpen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(controllerUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Connect Phone Motion Controller"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border-4 border-amber-300 text-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close connect modal"
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-900 rounded-full text-xs font-bold tracking-wide uppercase mb-2">
            <Smartphone className="w-3.5 h-3.5" /> Physical Motion Steering
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Connect Phone Controller
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Scan with your smartphone camera to steer your toy car or plane!
          </p>
        </div>

        {/* QR Code Container */}
        <div className="bg-gradient-to-b from-amber-50 to-orange-50 border-2 border-dashed border-amber-300 rounded-2xl p-4 flex flex-col items-center justify-center shadow-inner">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="Scan QR code to open mobile controller"
              className="w-56 h-56 rounded-xl shadow-md border-2 border-white"
            />
          ) : (
            <div className="w-56 h-56 flex items-center justify-center text-slate-400">
              Generating QR Code...
            </div>
          )}

          {/* Session Code Badge */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Room Code:</span>
            <span className="font-mono text-lg font-black tracking-widest px-3 py-0.5 bg-white border border-amber-200 rounded-lg text-amber-700 shadow-sm">
              {sessionId}
            </span>
          </div>
        </div>

        {/* Status Pill */}
        <div className="mt-4 flex items-center justify-center gap-2">
          <span
            className={`w-3 h-3 rounded-full ${
              isConnected ? 'bg-emerald-500' : 'bg-amber-400'
            }`}
          />
          <span className="text-xs font-bold text-slate-700">
            {isConnected ? '✓ Phone Connected & Ready to Steer!' : 'Waiting for phone to scan...'}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="mt-5 grid grid-cols-2 gap-2 text-xs font-bold">
          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Link Copied!' : 'Copy Controller Link'}
          </button>

          <a
            href={controllerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition"
          >
            <ExternalLink className="w-4 h-4" />
            Open in New Tab
          </a>
        </div>

        {onOpenSplitView && (
          <button
            onClick={onOpenSplitView}
            className="w-full mt-2 py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
          >
            <Wifi className="w-3.5 h-3.5 text-blue-500" />
            Switch to Dual Screen Test Mode
          </button>
        )}
      </div>
    </div>
  );
};
