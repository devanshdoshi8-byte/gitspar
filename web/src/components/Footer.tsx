import Link from "next/link";
import { Shield, Github, Terminal, Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950/90 text-slate-400 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-400" />
              <span className="font-bold text-lg text-white">GitSpar</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                v0.3.0
              </span>
            </div>
            <p className="text-sm text-slate-400 max-w-md leading-relaxed">
              Verified Change Understanding for AI-Assisted Code. An editor-agnostic diagnostic gatekeeper
              transforming AI-generated code changes into executable comprehension drills.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <code className="text-xs font-mono bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-blue-400">
                npx gitspar
              </code>
              <code className="text-xs font-mono bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400">
                npm test
              </code>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Features</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/demo" className="hover:text-white transition-colors">
                  Interactive Simulator
                </Link>
              </li>
              <li>
                <Link href="/verify/PR-1082" className="hover:text-white transition-colors">
                  Clean-Room Timed Portal
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-white transition-colors">
                  Organizer Leaderboard
                </Link>
              </li>
              <li>
                <Link href="/#differentiation" className="hover:text-white transition-colors">
                  Differentiation Matrix
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Resources</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="https://github.com/devanshdoshi8-byte/gitspar"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  GitHub Repository
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/devanshdoshi8-byte/gitspar#architecture"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  System Architecture
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/devanshdoshi8-byte/gitspar#license"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  MIT License
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© {new Date().getFullYear()} GitSpar Research Project. Open source under the MIT License.</p>
          <div className="flex items-center gap-1">
            <span>Built for rigorous engineering & AI change verification</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
