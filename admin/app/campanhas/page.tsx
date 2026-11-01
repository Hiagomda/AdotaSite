'use client';

import { useState, type FormEvent } from 'react';
import { icons } from '../icons';
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

interface Campaign {
  id: string;
  title: string;
  status: string;
  goalCents: number;
  goal: string;
  raisedCents: number;
  spentCents: number;
  pendingCount: number;
  openReports: number;
  deadline: string;
  ownerHandle: string;
  ownerName: string;
  createdAt: string;
}

const filters = [
  { value: 'reported', label: 'Denunciadas' },
  { value: 'active', label: 'No ar' },
  { value: 'suspended', label: 'Suspensas' },
  { value: 'all', label: 'Todas' },
] as const;

const statusLabel: Record<string, string> = {
  active: 'No ar',
  suspended: 'Suspensa',
  closed: 'Encerrada',
};

function money(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function day(value: string): string {
  const [year, month, date] = value.split('-');
  return year && month && date ? `${date}/${month}/${year}` : value;
}

/**
 * Revisão das campanhas de arrecadação. O app não recebe dinheiro: aqui a equipe vê o que o
 * responsável confirmou (com comprovante), as denúncias e pode suspender, o que tira o Pix do ar.
 */
export default function CampaignsPage() {
  const me = useStaff();
  const [filter, setFilter] = useState<(typeof filters)[number]['value']>('reported');
  const allowed = Boolean(me?.permissions.includes('campaigns.review'));
  const { data, message, reload } = useModeration<{ campaigns: Campaign[] }>(
    allowed ? `campaigns?filter=${filter}` : null,
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(campaign: Campaign, form: FormEvent<HTMLFormElement>) {
    form.preventDefault();
    const justification = String(new FormData(form.currentTarget).get('justification') ?? '');
    setBusy(campaign.id);
    setError('');
    const failure = await moderate(`campaigns/${campaign.id}/status`, {
      suspended: campaign.status !== 'suspended',
      justification,
    });
    setBusy(null);
    if (failure) setError(failure);
    reload();
  }

  return (
    <Guard me={me} permission="campaigns.review" label="as campanhas">
      {(staff) => (
        <Frame me={staff}>
          <>
            <PageHeader
              title="Campanhas"
              subtitle="Arrecadações abertas no app. O valor arrecadado só soma o que o responsável confirmou com comprovante. Suspender tira o Pix do ar e avisa o responsável."
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
                </button>
              ))}
            </div>
            {message ? <p className="error">{message}</p> : null}
            {error ? <p className="error">{error}</p> : null}
            {!data && !message ? <Loading /> : null}
            {data && data.campaigns.length === 0 ? <Empty>Nenhuma campanha aqui.</Empty> : null}
            {(data?.campaigns ?? []).map((campaign) => {
              const suspended = campaign.status === 'suspended';
              const percent =
                campaign.goalCents > 0
                  ? Math.min(100, Math.round((campaign.raisedCents / campaign.goalCents) * 100))
                  : 0;
              return (
                <article key={campaign.id} className="card item">
                  <div className="thumb">{icons.coin}</div>
                  <div className="stack">
                    <div className="row">
                      <span
                        className={`badge${suspended ? ' warn' : campaign.status === 'active' ? ' ok' : ''}`}
                      >
                        {statusLabel[campaign.status] ?? campaign.status}
                      </span>
                      {campaign.openReports > 0 ? (
                        <span className="badge warn">
                          {campaign.openReports}{' '}
                          {campaign.openReports === 1 ? 'denúncia' : 'denúncias'}
                        </span>
                      ) : null}
                      {campaign.pendingCount > 0 ? (
                        <span className="badge">
                          {campaign.pendingCount} {campaign.pendingCount === 1 ? 'aviso' : 'avisos'}{' '}
                          para o responsável conferir
                        </span>
                      ) : null}
                    </div>
                    <strong>{campaign.title}</strong>
                    <p>
                      {money(campaign.raisedCents)} de {money(campaign.goalCents)} ({percent}%) ·
                      gasto {money(campaign.spentCents)} · até {day(campaign.deadline)}
                    </p>
                    <p className="muted">
                      {campaign.ownerName} @{campaign.ownerHandle} · criada em{' '}
                      {formatDate(campaign.createdAt)}
                    </p>
                    {campaign.openReports > 0 ? (
                      <p className="muted">
                        As denúncias desta campanha ficam em Denúncias, onde dá para aceitar ou
                        arquivar.
                      </p>
                    ) : null}
                    {campaign.status === 'active' || suspended ? (
                      <form className="actions" onSubmit={(form) => void toggle(campaign, form)}>
                        <input
                          name="justification"
                          required
                          minLength={10}
                          maxLength={500}
                          placeholder="Motivo (vai para o responsável e para a auditoria)"
                        />
                        <button
                          type="submit"
                          className={suspended ? undefined : 'danger'}
                          disabled={busy === campaign.id}
                        >
                          {suspended ? 'Voltar ao ar' : 'Suspender'}
                        </button>
                      </form>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </>
        </Frame>
      )}
    </Guard>
  );
}
