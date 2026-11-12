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

interface FeedPoint {
  id: string;
  kind: 'food' | 'water' | 'both';
  kindLabel: string;
  relation: 'mine' | 'known';
  addressText: string;
  note: string | null;
  location: { latitude: number; longitude: number };
  photo: { url: string; thumbUrl: string } | null;
  lastRefilledAt: string | null;
  lastEmptyAt: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'removed';
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  ownerHandle: string;
  ownerName: string;
  ownerVerified: boolean;
  goneReports: number;
  emptyReports: number;
}

const filters = [
  { value: 'pending', label: 'Esperando aprovação' },
  { value: 'approved', label: 'No mapa' },
  { value: 'removed', label: 'Tirados do mapa' },
  { value: 'rejected', label: 'Recusados' },
] as const;

const relationLabel = {
  mine: 'Quem cadastrou cuida do ponto',
  known: 'Quem cadastrou só conhece o ponto',
};

/** Foto do ponto. Se o imgproxy não responder, fica o potinho no lugar. */
function Thumb({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <div className="thumb">{icons.bowl}</div>;
  // Foto vem do imgproxy, fora do domínio do painel.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="thumb" src={url} alt="" loading="lazy" onError={() => setFailed(true)} />;
}

/**
 * Pontos solidários de ração e água: a equipe confere cada ponto antes de ele aparecer no mapa
 * (perfil verificado entra direto) e olha de novo os que três pessoas disseram que não existem
 * mais. Quem cadastrou recebe aviso com o resultado, e cada decisão vai para a auditoria.
 */
export default function FeedPointsPage() {
  const me = useStaff();
  const [filter, setFilter] = useState<(typeof filters)[number]['value']>('pending');
  const allowed = Boolean(me?.permissions.includes('posts.moderate'));
  const { data, message, reload } = useModeration<{ points: FeedPoint[] }>(
    allowed ? `feed-points?filter=${filter}` : null,
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function run(point: FeedPoint, body: unknown) {
    setBusy(point.id);
    setError('');
    const failure = await moderate(`feed-points/${point.id}/review`, body);
    setBusy(null);
    if (failure) setError(failure);
    reload();
  }

  function withNote(
    point: FeedPoint,
    action: 'reject' | 'remove',
    form: FormEvent<HTMLFormElement>,
  ) {
    form.preventDefault();
    const note = String(new FormData(form.currentTarget).get('note') ?? '');
    void run(point, { action, note });
  }

  return (
    <Guard me={me} permission="posts.moderate" label="os pontos de ração e água">
      {(staff) => (
        <Frame me={staff}>
          <>
            <PageHeader
              title="Ração e água"
              subtitle="Pontos solidários que as pessoas cadastraram no mapa: potes de ração e de água na rua. Confira se é lugar público e se a foto não mostra rosto nem placa."
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
            {data && data.points.length === 0 ? <Empty>Nenhum ponto aqui.</Empty> : null}
            {(data?.points ?? []).map((point) => {
              const map = `https://www.openstreetmap.org/?mlat=${point.location.latitude}&mlon=${point.location.longitude}#map=18/${point.location.latitude}/${point.location.longitude}`;
              return (
                <article key={point.id} className="card item">
                  {point.photo ? (
                    <a href={point.photo.url} target="_blank" rel="noreferrer">
                      <Thumb url={point.photo.thumbUrl} />
                    </a>
                  ) : (
                    <Thumb url={null} />
                  )}
                  <div className="stack">
                    <div className="row">
                      <span className="badge">{point.kindLabel}</span>
                      {point.status === 'pending' ? (
                        <span className="badge warn">Esperando aprovação</span>
                      ) : null}
                      {point.status === 'approved' ? (
                        <span className="badge ok">No mapa</span>
                      ) : null}
                      {point.status === 'removed' ? (
                        <span className="badge">Fora do mapa</span>
                      ) : null}
                      {point.status === 'rejected' ? <span className="badge">Recusado</span> : null}
                      {point.goneReports > 0 ? (
                        <span className="badge warn">
                          {point.goneReports}{' '}
                          {point.goneReports === 1 ? 'pessoa disse' : 'pessoas disseram'} que não
                          existe mais
                        </span>
                      ) : null}
                    </div>
                    <strong>{point.addressText}</strong>
                    {point.note ? <p>{point.note}</p> : null}
                    <p className="muted">
                      {relationLabel[point.relation]} ·{' '}
                      <a href={map} target="_blank" rel="noreferrer">
                        ver no mapa
                      </a>
                      {point.photo ? '' : ' · sem foto'}
                    </p>
                    <p className="muted">
                      Cadastrado por {point.ownerName} @{point.ownerHandle}
                      {point.ownerVerified ? ' · verificado' : ' · sem selo'} · em{' '}
                      {formatDate(point.createdAt)}
                      {point.emptyReports > 0
                        ? ` · marcado como vazio por ${point.emptyReports}`
                        : ''}
                    </p>
                    {point.reviewNote ? (
                      <p className="muted">Motivo registrado: {point.reviewNote}</p>
                    ) : null}
                    {point.status === 'pending' || point.status === 'removed' ? (
                      <div className="actions">
                        <button
                          type="button"
                          disabled={busy === point.id}
                          onClick={() => void run(point, { action: 'approve' })}
                        >
                          {point.status === 'pending' ? 'Aprovar' : 'Voltar ao mapa'}
                        </button>
                      </div>
                    ) : null}
                    {point.status === 'pending' ? (
                      <form
                        className="actions"
                        onSubmit={(form) => withNote(point, 'reject', form)}
                      >
                        <input
                          name="note"
                          required
                          minLength={5}
                          maxLength={300}
                          placeholder="Motivo da recusa (vai para quem cadastrou)"
                        />
                        <button type="submit" className="quiet" disabled={busy === point.id}>
                          Recusar
                        </button>
                      </form>
                    ) : null}
                    {point.status === 'approved' ? (
                      <form
                        className="actions"
                        onSubmit={(form) => withNote(point, 'remove', form)}
                      >
                        <input
                          name="note"
                          required
                          minLength={5}
                          maxLength={300}
                          placeholder="Motivo (vai para quem cadastrou)"
                        />
                        <button type="submit" className="danger" disabled={busy === point.id}>
                          Tirar do mapa
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
