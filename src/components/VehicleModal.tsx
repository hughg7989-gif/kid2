/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  X,
  Copy,
  Check,
  Upload,
  Play,
  Car,
  Plane,
  AlertCircle,
  FileCode,
  Sparkles,
  Download,
} from 'lucide-react';
import { VehicleDefinition } from '../types/game';
import { PRESET_VEHICLES } from '../vehicles/presets';
import { AI_SYSTEM_PROMPT, loadVehicleFromCode } from '../vehicles/vehicleLoader';

interface VehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVehicle: VehicleDefinition;
  onVehicleLoaded: (vehicle: VehicleDefinition) => void;
}

export const VehicleModal: React.FC<VehicleModalProps> = ({
  isOpen,
  onClose,
  currentVehicle,
  onVehicleLoaded,
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(currentVehicle.id);
  const [code, setCode] = useState<string>(() => {
    const found = PRESET_VEHICLES.find((p) => p.id === currentVehicle.id);
    return found ? found.code : PRESET_VEHICLES[0].code;
  });
  const [error, setError] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSelectPreset = (presetId: string) => {
    const preset = PRESET_VEHICLES.find((p) => p.id === presetId);
    if (preset) {
      setSelectedPresetId(presetId);
      setCode(preset.code);
      setError(null);
    }
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(AI_SYSTEM_PROMPT);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleLoadCode = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const vehicle = await loadVehicleFromCode(code);
      onVehicleLoaded(vehicle);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Failed to instantiate vehicle: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      readFile(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readFile(file);
    }
  };

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setCode(content);
        setSelectedPresetId('custom');
        setError(null);
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadFile = () => {
    const blob = new Blob([code], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedPresetId || 'vehicle'}.js`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Modular Vehicle Generator & Script Loader"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border-4 border-sky-300 text-slate-800 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-sky-50 via-indigo-50 to-amber-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 leading-tight">
                Vehicle Generator & Dynamic Loader
              </h2>
              <p className="text-xs text-slate-500">
                Switch vehicles, load custom Three.js modules, or create new ones with AI
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close vehicle modal"
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* Preset Selector */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5 uppercase tracking-wider text-[11px]">
              Choose Built-in Vehicle Preset
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {PRESET_VEHICLES.map((p) => {
                const isSelected = selectedPresetId === p.id;
                const isAir = p.code.includes('"air"');
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPreset(p.id)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 text-center transition font-bold ${
                      isSelected
                        ? 'border-sky-500 bg-sky-50 text-sky-900 shadow-sm'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-xs">
                      {isAir ? (
                        <Plane className="w-4 h-4 text-sky-600" />
                      ) : (
                        <Car className="w-4 h-4 text-amber-600" />
                      )}
                    </div>
                    <span className="leading-tight text-[11px]">{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* AI Prompt Blueprint Banner */}
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div>
              <div className="flex items-center gap-1.5 font-black text-amber-900 text-sm">
                <Sparkles className="w-4 h-4 text-amber-600" />
                Want to build your own custom vehicle?
              </div>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Copy our standardized Three.js vehicle prompt to generate any toy car, rocket, or boat!
              </p>
            </div>
            <button
              onClick={handleCopyPrompt}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold shadow-sm transition"
            >
              {copiedPrompt ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedPrompt ? 'Prompt Copied!' : 'Copy AI Prompt'}
            </button>
          </div>

          {/* Drag & Drop File Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-1.5 ${
              isDragOver
                ? 'border-sky-500 bg-sky-50 text-sky-700'
                : 'border-slate-300 hover:border-slate-400 bg-slate-50 text-slate-500'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              accept=".js,.ts"
              className="hidden"
            />
            <Upload className="w-5 h-5 text-slate-400" />
            <div className="font-bold text-slate-700">
              Drag & Drop your <span className="font-mono text-sky-600">.js</span> vehicle module here
            </div>
            <p className="text-[10px] text-slate-400">or click to browse files from your computer</p>
          </div>

          {/* Real-time Code Editor */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-bold text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-sky-600" />
                JavaScript Module Code (ES Module)
              </label>
              <button
                onClick={handleDownloadFile}
                className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-700"
              >
                <Download className="w-3 h-3" /> Save as .js
              </button>
            </div>
            <textarea
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setSelectedPresetId('custom');
                setError(null);
              }}
              rows={9}
              className="w-full font-mono text-[11px] p-3 rounded-2xl bg-slate-900 text-emerald-400 border border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-sky-500 leading-relaxed resize-y"
              spellCheck={false}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
          <div className="text-[11px] text-slate-500">
            Current Active:{' '}
            <span className="font-bold text-slate-800">{currentVehicle.name}</span> (
            {currentVehicle.type})
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold transition"
            >
              Cancel
            </button>
            <button
              onClick={handleLoadCode}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-black shadow-md shadow-sky-500/20 transition disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-current" />
              {isLoading ? 'Instantiating...' : 'Load Into Game'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
