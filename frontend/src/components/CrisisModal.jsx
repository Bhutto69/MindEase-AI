import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle } from 'lucide-react';

export default function CrisisModal({ show, onClose }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-md"
        >
          <motion.div
            initial={{ y: 50, scale: 0.9 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 50, scale: 0.9 }}
            className="bg-[#ef4444] text-white w-full max-w-3xl rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden"
          >
            <button
              onClick={onClose}
              className="absolute top-8 right-8 text-white/60 hover:text-white text-2xl font-bold p-2"
            >
              ✕
            </button>

            <div className="flex items-start gap-6 mb-10">
              <div className="p-4 bg-white/20 rounded-3xl animate-pulse">
                <AlertCircle size={40} />
              </div>
              <div>
                <h2 className="text-4xl font-black tracking-tight mb-2 uppercase">
                  Crisis Support
                </h2>
                <p className="text-red-100 text-lg font-medium opacity-90 leading-tight">
                  If you're in crisis or need immediate support, please reach out:
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
              <div className="bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-[2rem]">
                <p className="text-xs uppercase font-black text-red-200 tracking-widest mb-2">
                  Umang — 24/7 Mental Health Helpline (free)
                </p>
                <p className="text-4xl font-black tracking-tighter">0311-7786264</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-[2rem]">
                <p className="text-xs uppercase font-black text-red-200 tracking-widest mb-2">
                  National Youth Helpline
                </p>
                <p className="text-4xl font-black tracking-tight leading-none">0800-69457</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-[2rem]">
                <p className="text-xs uppercase font-black text-red-200 tracking-widest mb-2">
                  Emergency Services (Pakistan)
                </p>
                <p className="text-5xl font-black tracking-tighter leading-none">1122</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-[2rem]">
               <p className="text-xs uppercase font-black text-red-200 tracking-widest mb-2">
                  More Verified Helplines
                </p>
                <a
                  href="https://findahelpline.com/countries/pk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xl font-black tracking-tight underline break-all"
                >
                  findahelpline.com/pk
                </a>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}