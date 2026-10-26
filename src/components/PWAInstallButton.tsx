import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, Check, X, ShieldCheck } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // If already running as an installed PWA on Android or Desktop, show installed badge
  if (isInstalled) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold shadow-xs">
        <Check className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Android App Installed</span>
        <span className="sm:hidden">App Active</span>
      </div>
    );
  }

  // Chromium / Android flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs tracking-wider uppercase shadow-lg shadow-emerald-500/25 transition-all transform hover:scale-105 active:scale-95"
      >
        <Smartphone className="w-4 h-4 fill-current" />
        <span>Install App</span>
      </button>
    );
  }

  // Manual Android / iOS Guide button
  return (
    <>
      <button
        onClick={() => setShowGuide(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold transition-all"
        title="Install FNF Converter on your Android phone"
      >
        <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
        <span className="hidden sm:inline">Install on Android</span>
        <span className="sm:hidden">APK / PWA</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl text-slate-100">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black font-bungee text-white">INSTALL ON ANDROID</h3>
                  <p className="text-xs text-slate-400">Offline Converter for Phone Storage</p>
                </div>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 mb-6">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="font-bold text-emerald-400 text-sm flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  How to Install on Android Chrome:
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300 pl-1">
                  <li>Tap the <strong>three dots (⋮)</strong> menu in Chrome.</li>
                  <li>Select <strong>"Install app"</strong> or <strong>"Add to Home Screen"</strong>.</li>
                  <li>Tap <strong>Install</strong> to add FNF Converter directly to your phone.</li>
                  <li>The app will run offline in full screen with direct access to your local files!</li>
                </ol>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="font-bold text-pink-400 text-xs">Android Mod Paths:</div>
                <div className="font-mono text-[11px] text-slate-400 break-all select-all bg-slate-900 p-2 rounded border border-slate-800">
                  /storage/emulated/0/Android/data/com.shadowmario.psychengine/files/mods/
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Drop your converted charts and songs directly into your phone's FNF mods folder!
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowGuide(false)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider transition-colors"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};
