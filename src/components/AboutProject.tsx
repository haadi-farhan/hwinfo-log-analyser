import React from "react";
import { motion } from "motion/react";
import { ArrowLeft, Award, ExternalLink } from "lucide-react";

interface AboutProjectProps {
  onBack: () => void;
}

export default function AboutProject({ onBack }: AboutProjectProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg w-full bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden"
      >
        {/* Background Accents */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl -ml-32 -mb-32" />

        <button
          onClick={onBack}
          className="group mb-8 flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          Back to Tool
        </button>

        <div className="relative">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
              <Award className="w-5 h-5 text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">About Project</h1>
          </div>

          <div className="space-y-4 text-slate-300 leading-relaxed text-base">
            <p>
              This app is the capstone project for my{" "}
              <a
                href="https://www.coursera.org/professional-certificates/google-ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 font-medium hover:text-blue-300 transition-colors inline-flex items-center gap-1 group/link underline decoration-blue-500/30 underline-offset-4 hover:decoration-blue-400"
              >
                Google AI Professional Certificate
                <ExternalLink className="w-3.5 h-3.5 opacity-50 group-hover/link:opacity-100 transition-opacity" />
              </a>
              . I built it by applying the AI skills I learned during the course, utilising{" "}
              <a
                href="https://aistudio.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 font-medium hover:text-cyan-300 transition-colors inline-flex items-center gap-1 group/link underline decoration-cyan-500/30 underline-offset-4 hover:decoration-cyan-400"
              >
                Google AI Studio
                <ExternalLink className="w-3.5 h-3.5 opacity-50 group-hover/link:opacity-100 transition-opacity" />
              </a>{" "}
              to rapidly prototype and build an application designed to solve a real-world issue I was facing with visualising HWiNFO log data.
            </p>
            
            <p>
              Development took around four hours, in part due to time spent navigating rate limits on the free tier.
            </p>

            <div className="pt-4 border-t border-slate-800">
              <p className="text-slate-400 italic">
                Thank you for exploring my project, I hope you find it useful!
              </p>
            </div>
          </div>


        </div>
      </motion.div>
    </div>
  );
}
