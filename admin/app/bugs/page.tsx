'use client';

import { useState } from 'react';
import {
  Empty,
  Frame,
  Guard,
  Loading,
  PageHeader,
  formatDate,
  moderate,
  useModeration,
  useStaff,
} from '../painel';

interface BugReport {
  id: string;
  message: string;
  screen: string | null;
  appVersion: string | null;
  platform: string | null;
  device: string | null;
  status: 'open' | 'done';
  reviewedAt: string | null;
  createdAt: string;
  userId: string;
  userHandle: string;
  userName: string;
}

const filters = [
  { value: 'open', label: 'Abertos' },
  { value: 'done', label: 'Resolvidos' },
] as const;

/**
 * Bugs que as pessoas avisam pelo besourinho do app (o app está em pleno desenvolvimento).
 * Vem junto a tela, a versão e o celular. Marcar como resolvido vai para a auditoria.
 */
export default function BugReportsPage() {
  const me = useStaff();
  const [filter, setFilter] = useState<(typeof filters)[number]['value']>('open');
  const allowed = Boolean(me?.permissions.includes('posts.moderate'));
  const { data, message, reload } = useModeration<{ openCount: number; reports: BugReport[] }>(
    allowed ? `bug-reports?filter=${filter}` : null,
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function setStatus(report: BugReport, status: 'open' | 'done') {
    setBusy(report.id);
    setError('');
    const failure = await moderate(`bug-reports/${report.id}/status`, { status });
    setBusy(null);
    if (failure) setError(failure);
    reload();
  }

  return (
    <Guard me={me} permission="posts.moderate" label="os bugs do app">
      {(staff) => (
        <Frame me={staff}>
          <>
            <PageHeader
              title="Bugs do app"
              subtitle="Avisos que as pessoas mandam pelo besourinho do app. Vem junto a tela em que estavam, a versão e o celular."
            />
            <div className="tabs">
              {filters.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={filter === item.value}
                  onClick={() => setFilter(item.value)}
                >
                  {item.label}
                  {item.value === 'open' && data ? ` (${data.openCount})` : ''}
                </button>
              ))}
            </div>
            {message ? <p className="error">{message}</p> : null}
            {error ? <p className="error">{error}</p> : null}
            {!data && !message ? <Loading /> : null}
            {data && data.reports.length === 0 ? (
              <Empty>
                {filter === 'open'
                  ? 'Nenhum bug aberto. Égua, que beleza!'
                  : 'Nada resolvido ainda.'}
              </Empty>
            ) : null}
            {(data?.reports ?? []).map((report) => (
              <article key={report.id} className="card item">
                <div className="stack">
                  <div className="row">
                    {report.status === 'open' ? (
                      <span className="badge warn">Aberto</span>
                    ) : (
                      <span className="badge ok">Resolvido</span>
                    )}
                    {report.appVersion ? (
                      <span className="badge">Versão {report.appVersion}</span>
                    ) : null}
                    {report.screen ? <span className="badge">Tela {report.screen}</span> : null}
                  </div>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{report.message}</p>
                  <p className="muted">
                    {report.userName} @{report.userHandle} · {formatDate(report.createdAt)}
                    {report.device ? ` · ${report.device}` : ''}
                    {report.platform ? ` · ${report.platform}` : ''}
                  </p>
                  <div className="actions">
                    {report.status === 'open' ? (
                      <button
                        type="button"
                        disabled={busy === report.id}
                        onClick={() => void setStatus(report, 'done')}
                      >
                        Marcar como resolvido
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="quiet"
                        disabled={busy === report.id}
                        onClick={() => void setStatus(report, 'open')}
                      >
                        Reabrir
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </>
        </Frame>
      )}
    </Guard>
  );
}
