import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft, FileText } from 'lucide-react';
import { getReport } from '../services/api';

const LABELS = {
  sleep_problems: 'Sleep',
  fatigue: 'Energy',
  loss_of_interest: 'Motivation / interest',
  depressed_mood: 'Low mood',
  appetite_change: 'Appetite',
  worthlessness_guilt: 'Being hard on themselves',
  concentration_problems: 'Focus',
  psychomotor_change: 'Restlessness',
  nervous_anxious: 'Feeling on edge',
  uncontrollable_worry: 'Worry that is hard to stop',
  excessive_worry: 'Worrying about many things',
  trouble_relaxing: 'Trouble relaxing',
  restlessness: 'Restlessness',
  irritability: 'Irritability',
  fear_awful: 'Fear something bad may happen',
  hard_to_wind_down: 'Hard to wind down',
  over_reactive: 'Reacting strongly',
  nervous_energy: 'Nervous energy',
  agitated: 'Feeling wound up',
  difficult_to_relax: 'Difficulty relaxing',
  intolerant: 'Low patience',
  touchy: 'Feeling touchy',
  relaxing: 'Difficulty relaxing / winding down',
  worry: 'Worry',
};

const fmt = (ts) => {
  if (!ts) return '';
  try { return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return ''; }
};

export default function Report({ darkMode, sessionId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionId) return;
    getReport(sessionId).then((d) => { setData(d); setLoading(false); });
  }, [sessionId]);

  if (loading) {
    return <div className="p-10 text-slate-500 font-medium">Preparing your summary…</div>;
  }

  if (!data?.ok) {
    return (
      <div className="p-10">
        <p className="text-slate-500 font-medium mb-6">
          {data?.need
            ? `A summary needs at least ${data.need} completed conversations to be worth anything — you're at ${data.have}.`
            : "There isn't enough here yet to put together a summary."}
        </p>
        <button onClick={() => navigate('/dashboard')} className="px-5 py-3 rounded-2xl bg-indigo-600 text-white font-bold">
          Back to Analytics
        </button>
      </div>
    );
  }

  const neverList = Object.entries(data.never_discussed || {})
    .flatMap(([, items]) => items)
    .slice(0, 6);

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white p-6 print:p-0">

      {/* screen-only controls */}
      <div className="max-w-3xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <button onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200">
          <ArrowLeft size={16}/> Back
        </button>
        <button onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-500">
          <Printer size={18}/> Save as PDF
        </button>
      </div>

      <div className="max-w-3xl mx-auto mb-6 p-5 rounded-2xl bg-amber-50 border-2 border-amber-200 print:hidden">
        <p className="text-amber-900 font-medium text-sm leading-relaxed">
          This is yours. Nobody sees it unless you choose to show it. Read it through first —
          if anything doesn't feel right, you don't have to share it.
        </p>
      </div>

      {/* the printable sheet */}
      <div className="max-w-3xl mx-auto bg-white text-slate-900 p-12 print:p-8 rounded-3xl print:rounded-none shadow-xl print:shadow-none">

        <div className="flex items-start justify-between border-b-2 border-slate-200 pb-6 mb-8">
          <div>
            <h1 className="text-3xl font-black mb-1">Conversation Summary</h1>
            <p className="text-slate-500 font-medium text-sm">
              {fmt(data.first) === fmt(data.last)
                ? fmt(data.last)
                : `${fmt(data.first)} — ${fmt(data.last)}`} · {data.session_count} conversations
            </p>
            <p className="text-slate-400 text-xs mt-1">
              Prepared {fmt(data.generated)} · covering {data.session_count} completed conversations
            </p>
          </div>
          <FileText size={32} className="text-indigo-500 shrink-0" />
        </div>

        <div className="mb-8 p-5 rounded-2xl bg-slate-50 border border-slate-200">
          <p className="text-slate-700 text-sm leading-relaxed">
            <strong>What this is.</strong> A summary of what came up while you were
            chatting with MindEase, an anonymous support companion. It is drawn from ordinary
            conversation.
            <strong> It is not a clinical assessment and contains no diagnosis.</strong> It is
            intended only to help a conversation with a professional start further along.
          </p>
        </div>

        <section className="mb-8">
          <h2 className="text-lg font-black mb-4 uppercase tracking-wide text-slate-500">What came up</h2>
          {data.themes.length === 0 ? (
            <p className="text-slate-500">Nothing recurring stood out.</p>
          ) : (
            <div className="space-y-3">
              {data.themes.map((t) => (
                <div key={t.key} className="flex items-center gap-4">
                  <div className="w-52 font-bold">{LABELS[t.key] || t.key}</div>
                  <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full"
                         style={{ width: `${Math.round((t.sessions / data.total_sessions) * 100)}%` }} />
                  </div>
                  <div className="w-40 text-sm text-slate-500 font-medium text-right">
                    {t.sessions} of {data.total_sessions} conversations
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-black mb-3 uppercase tracking-wide text-slate-500">Direction</h2>
          <p className="text-slate-800 leading-relaxed">
            Comparing the earliest conversations with the most recent ones, {data.direction}.
          </p>
        </section>

        {data.quotes?.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-black mb-4 uppercase tracking-wide text-slate-500">In their own words</h2>
            <div className="space-y-3">
              {data.quotes.map((q, i) => (
                <p key={i} className="pl-5 border-l-4 border-indigo-200 text-slate-700 italic">"{q}"</p>
              ))}
            </div>
          </section>
        )}

        {data.session_notes?.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-black mb-4 uppercase tracking-wide text-slate-500">Recent conversations</h2>
            <div className="space-y-2">
              {data.session_notes.filter((s) => s.summary).map((s, i) => (
                <p key={i} className="text-slate-700 text-sm">
                  <span className="text-slate-400 font-bold mr-2">{fmt(s.ts)}</span>{s.summary}
                </p>
              ))}
            </div>
          </section>
        )}

        {neverList.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-black mb-3 uppercase tracking-wide text-slate-500">Not discussed</h2>
            <p className="text-slate-500 text-sm mb-3">
              These never came up in conversation. That does not mean they are absent — only that
              they were never mentioned, so nothing is known either way.
            </p>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-slate-600">
              {neverList.map((q, i) => <li key={i}>· {q}</li>)}
            </ul>
          </section>
        )}

        <div className="border-t-2 border-slate-200 pt-6 mt-10 text-xs text-slate-400 leading-relaxed">
          <p>
            <strong>Where this comes from.</strong> MindEase notices themes as they come up
            naturally in conversation — you were never asked to fill anything in. The themes
            above follow the same categories professionals use when they ask about sleep, worry,
            energy and mood, so a counsellor will recognise them. But because they came from
            conversation rather than from questions you answered, they are indicative only and
            are not a completed assessment. Nothing here is a diagnosis. Based on
            {' '}{data.message_count} messages across {data.session_count} conversations.
          </p>
        </div>
      </div>

      <style>{`
        @media print {
          @page { margin: 14mm; }
          body { background: #fff !important; }
          nav, .print\\:hidden { display: none !important; }
          main { margin-left: 0 !important; }
        }
      `}</style>
    </div>
  );
}