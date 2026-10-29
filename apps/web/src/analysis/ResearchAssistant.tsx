import { useEffect, useRef, useState } from 'react';
import { researchAnswerSchema, researchQuestions } from '@aq/contracts';
import type {
  AnalysisSeriesResponse,
  ResearchAnswer,
  ResearchRequest,
} from '@aq/contracts';

export function ResearchAssistant({ data }: { data: AnalysisSeriesResponse }) {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [question, setQuestion] = useState<string>(researchQuestions.summary);
  const [answer, setAnswer] = useState<ResearchAnswer>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open || checked) return;
    const controller = new AbortController();
    void fetch('/api/research/status', { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((v: unknown) => {
        if (!controller.signal.aborted) {
          setEnabled(
            !!v &&
              typeof v === 'object' &&
              'enabled' in v &&
              v.enabled === true,
          );
          setChecked(true);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [open, checked]);
  const ids = data.series.map((s) => s.station.id);
  const context: ResearchRequest['context'] = {
    region: data.meta.region,
    pollutant: data.meta.pollutant,
    measurementType: data.meta.measurementType,
    mode: data.meta.dataMode,
    windowHours: data.windowHours,
    endAt: data.meta.window.to,
    stationIds: ids,
    ...(data.meta.snapshotId ? { snapshotId: data.meta.snapshotId } : {}),
  };
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  async function ask() {
    const controller = new AbortController();
    active.current?.abort();
    active.current = controller;
    setBusy(true);
    setError('');
    setAnswer(undefined);
    try {
      const response = await fetch('/api/research/answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Research-Request': '1',
        },
        body: JSON.stringify({ question, context }),
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(20000),
        ]),
      });
      if (!response.ok) throw new Error('Unavailable');
      const value = researchAnswerSchema.parse(await response.json());
      const e = value.evidence;
      if (
        value.question !== question ||
        (e &&
          (e.meta.region !== context.region ||
            e.meta.dataMode !== context.mode ||
            e.meta.pollutant !== context.pollutant ||
            e.meta.measurementType !== context.measurementType ||
            e.meta.window.to !== context.endAt ||
            e.windowHours !== context.windowHours ||
            e.meta.snapshotId !== (context.snapshotId ?? null) ||
            e.series.some((s) => !ids.includes(s.station.id))))
      )
        throw new Error('Mismatched context');
      if (!controller.signal.aborted) setAnswer(value);
    } catch {
      if (!controller.signal.aborted)
        setError(
          'Research Assistant unavailable. The deterministic chart remains available.',
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <details
      className="observation-notes research-assistant"
      aria-label="Optional Research Assistant"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>
        Research Assistant · optional ·{' '}
        {checked
          ? enabled
            ? 'configured'
            : 'disabled'
          : 'open to check configuration'}
      </summary>
      <p>
        Read-only evidence for {data.meta.dataMode} · {data.meta.pollutant} ·{' '}
        {data.meta.measurementType}. Sample is synthetic; source certification
        is not assumed.
      </p>
      {!enabled && (
        <p>
          Configure OPENAI_API_KEY and RESEARCH_ASSISTANT_ENABLED on the local
          server. No model request is made while disabled.
        </p>
      )}
      <label>
        Research question{' '}
        <select
          value={question}
          disabled={busy}
          onChange={(e) => {
            setQuestion(e.target.value);
            setAnswer(undefined);
          }}
        >
          {Object.values(researchQuestions).map((q) => (
            <option key={q}>{q}</option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={
          !enabled || busy || !ids.length || data.meta.dataMode === 'live'
        }
        onClick={() => void ask()}
      >
        {busy ? 'Verifying evidence…' : 'Ask Research Assistant'}
      </button>
      <div aria-live="polite">
        {error}
        {answer && (
          <>
            <p>
              {answer.status} · {answer.shortAnswer}
            </p>
            {answer.evidence && (
              <p>
                Source: {answer.evidence.acquisition.label} ·{' '}
                {answer.evidence.meta.window.from} →{' '}
                {answer.evidence.meta.window.to} (UTC) · Cache:{' '}
                {answer.evidence.meta.cache.status}
              </p>
            )}
            {answer.citations.map((c) => {
              const s = answer.evidence!.series.find(
                (s) => s.station.id === c.id,
              )!;
              return (
                <section key={c.id}>
                  <h3>{s.station.name}</h3>
                  <p>Evidence ID: {c.id}</p>
                  <p>
                    Source statuses:{' '}
                    {[...new Set(s.records.map((r) => r.dataStatus))].join(
                      ', ',
                    ) || 'No records supplied'}
                    . {s.interpretation?.averagingDescription}
                  </p>
                  {s.summary ? (
                    <p>
                      Range: {s.summary.min ?? 'unavailable'} –{' '}
                      {s.summary.max ?? 'unavailable'} {s.interpretation?.unit}.
                      Available: {s.summary.availableCount}; absent:{' '}
                      {s.summary.absentCount}; null: {s.summary.nullCount};
                      outside coverage: {s.summary.outsideCoverageCount};
                      conflicts: {s.summary.conflictCount}.
                    </p>
                  ) : (
                    <p>Incompatible or unavailable: {s.reason}</p>
                  )}
                  <details>
                    <summary>Inspect cited source records and periods</summary>
                    <pre
                      style={{
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {JSON.stringify(
                        {
                          interpretation: s.interpretation,
                          records: s.records,
                          slots: s.slots,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                </section>
              );
            })}
            <ul>
              {answer.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </details>
  );
}
