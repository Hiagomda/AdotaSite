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

interface AgendaEvent {
  id: string;
  title: string;
  description: string | null;
  category: string;
  categoryLabel: string;
  placeLabel: string;
  neighborhood: string | null;
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  registered: number;
  attended: number;
  reviewStatus: 'pending' | 'published' | 'rejected';
  reviewNote: string | null;
  hidden: boolean;
  cancelled: boolean;
  createdAt: string;
  result: { summary: string; adoptions: number | null } | null;
  openReports: number;
  lastReport: string | null;
  organizerHandle: string;
  organizerName: string;
  organizerVerified: boolean;
}

const filters = [
  { value: 'pending', label: 'Esperando aprovação' },
  { value: 'reported', label: 'Denunciados' },
  { value: 'upcoming', label: 'Próximos' },
  { value: 'past', label: 'Já aconteceram' },
  { value: 'hidden', label: 'Fora do ar' },
] as const;

/** Data e hora sempre no relógio de Belém, onde os eventos acontecem. */
function belem(value: string): string {
  return new Date(value).toLocaleString('pt-BR', {
    timeZone: 'America/Belem',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function belemHour(value: string): string {
  return new Date(value).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Belem',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Moderação da agenda: evento de quem não tem selo espera aprovação, denúncias aparecem aqui e
 * a equipe pode tirar do ar. Cada decisão vai para a auditoria e para o histórico do evento.
 */
export default function EventsPage() {
  const me = useStaff();
  const [filter, setFilter] = useState<(typeof filters)[number]['value']>('pending');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const allowed = Boolean(me?.permissions.includes('posts.moderate'));
  const query = `events?filter=${filter}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
  const { data, message, reload } = useModeration<{ events: AgendaEvent[] }>(
    allowed ? query : null,
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function run(event: AgendaEvent, path: string, body: unknown) {
    setBusy(event.id);
    setError('');
    const failure = await moderate(`events/${event.id}/${path}`, body);
    setBusy(null);
    if (failure) setError(failure);
    reload();
  }

  function reject(event: AgendaEvent, form: FormEvent<HTMLFormElement>) {
    form.preventDefault();
    const note = String(new FormData(form.currentTarget).get('note') ?? '');
    void run(event, 'review', { action: 'reject', note });
  }

  function toggleVisibility(event: AgendaEvent, form: FormEvent<HTMLFormElement>) {
    form.preventDefault();
    const justification = String(new FormData(form.currentTarget).get('justification') ?? '');
    void run(event, 'visibility', { hidden: !event.hidden, justification });
  }

  return (
    <Guard me={me} permission="posts.moderate" label="os eventos">
      {(staff) => (
        <Frame me={staff}>
          <>
            <PageHeader
              title="Eventos"
              subtitle="Aprove os eventos da agenda, confira as denúncias e tire do ar o que fere as regras. Horários de Belém."
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
            <form
              className="row"
              onSubmit={(event) => {
                event.preventDefault();
                setQ(search.trim());
              }}
            >
              <span className="search">
                {icons.search}
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar no nome, no lugar ou no @ de quem organiza"
                />
              </span>
              <button type="submit">Buscar</button>
            </form>
            {message ? <p className="error">{message}</p> : null}
            {error ? <p className="error">{error}</p> : null}
            {!data && !message ? <Loading /> : null}
            {data && data.events.length === 0 ? <Empty>Nenhum evento aqui.</Empty> : null}
            {(data?.events ?? []).map((event) => (
              <article key={event.id} className="card item">
                <div className="thumb">{icons.calendar}</div>
                <div className="stack">
                  <div className="row">
                    <span className="badge">{event.categoryLabel}</span>
                    {event.reviewStatus === 'pending' ? (
                      <span className="badge warn">Esperando aprovação</span>
                    ) : null}
                    {event.reviewStatus === 'rejected' ? (
                      <span className="badge">Recusado</span>
                    ) : null}
                    {event.cancelled ? <span className="badge">Cancelado</span> : null}
                    {event.hidden ? <span className="badge warn">Fora do ar</span> : null}
                    {event.reviewStatus === 'published' && !event.hidden && !event.cancelled ? (
                      <span className="badge ok">Na agenda</span>
                    ) : null}
                    {event.openReports > 0 ? (
                      <span className="badge warn">
                        {event.openReports} {event.openReports === 1 ? 'denúncia' : 'denúncias'}
                      </span>
                    ) : null}
                  </div>
                  <strong>{event.title}</strong>
                  <p>
                    {belem(event.startsAt)} até {belemHour(event.endsAt)} · {event.placeLabel}
                  </p>
                  {event.description ? <p>{event.description}</p> : null}
                  <p className="muted">
                    {event.organizerName} @{event.organizerHandle}
                    {event.organizerVerified ? ' · verificado' : ' · sem selo'} · criado em{' '}
                    {formatDate(event.createdAt)}
                  </p>
                  <p className="muted">
                    {event.registered} inscritos
                    {event.capacity !== null ? ` de ${event.capacity} vagas` : ', sem limite'}
                    {event.attended > 0 ? ` · ${event.attended} presentes` : ''}
                  </p>
                  {event.lastReport ? (
                    <p className="error">Última denúncia: {event.lastReport}</p>
                  ) : null}
                  {event.reviewNote ? (
                    <p className="muted">Motivo da recusa: {event.reviewNote}</p>
                  ) : null}
                  {event.result ? (
                    <p>
                      Resultado: {event.result.summary}
                      {event.result.adoptions !== null
                        ? ` (${event.result.adoptions} adoções)`
                        : ''}
                    </p>
                  ) : null}
                  {event.reviewStatus !== 'published' ? (
                    <div className="actions">
                      <button
                        type="button"
                        disabled={busy === event.id}
                        onClick={() => void run(event, 'review', { action: 'approve' })}
                      >
                        Aprovar
                      </button>
                    </div>
                  ) : null}
                  {event.reviewStatus === 'pending' ? (
                    <form className="actions" onSubmit={(form) => reject(event, form)}>
                      <input
                        name="note"
                        required
                        minLength={5}
                        maxLength={300}
                        placeholder="Motivo da recusa (vai para quem organizou)"
                      />
                      <button type="submit" className="quiet" disabled={busy === event.id}>
                        Recusar
                      </button>
                    </form>
                  ) : null}
                  {event.openReports > 0 ? (
                    <div className="actions">
                      <button
                        type="button"
                        className="quiet"
                        disabled={busy === event.id}
                        onClick={() => void run(event, 'reports', { action: 'dismiss' })}
                      >
                        Arquivar denúncias
                      </button>
                    </div>
                  ) : null}
                  <form className="actions" onSubmit={(form) => toggleVisibility(event, form)}>
                    <input
                      name="justification"
                      required
                      minLength={10}
                      placeholder="Motivo (vai para a auditoria)"
                    />
                    <button
                      type="submit"
                      className={event.hidden ? undefined : 'danger'}
                      disabled={busy === event.id}
                    >
                      {event.hidden ? 'Voltar ao ar' : 'Tirar do ar'}
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </>
        </Frame>
      )}
    </Guard>
  );
}
