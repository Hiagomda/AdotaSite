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

interface Partner {
  id: string;
  name: string;
  kind: string;
  kindLabel: string;
  about: string | null;
  perk: string | null;
  hours: string | null;
  addressText: string | null;
  location: { latitude: number; longitude: number };
  whatsapp: string | null;
  instagram: string | null;
  featured: boolean;
  status: 'pending' | 'approved' | 'paused' | 'rejected';
  paused: boolean;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  ownerHandle: string;
  ownerName: string;
  ownerVerified: boolean;
}

const filters = [
  { value: 'pending', label: 'Esperando aprovação' },
  { value: 'approved', label: 'No mapa' },
  { value: 'paused', label: 'Pausados' },
  { value: 'rejected', label: 'Recusados' },
] as const;

/**
 * Parceiros do Cupu (petshops, clínicas, lojas): a equipe aprova cada pedido antes de ele aparecer
 * no mapa, escolhe quem vai para o destaque do feed e pausa quem recebeu reclamação. Quem pediu
 * recebe aviso com o resultado, e cada decisão vai para a auditoria.
 */
export default function PartnersPage() {
  const me = useStaff();
  const [filter, setFilter] = useState<(typeof filters)[number]['value']>('pending');
  const allowed = Boolean(me?.permissions.includes('posts.moderate'));
  const { data, message, reload } = useModeration<{ partners: Partner[] }>(
    allowed ? `partners?filter=${filter}` : null,
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function run(partner: Partner, path: string, body: unknown) {
    setBusy(partner.id);
    setError('');
    const failure = await moderate(`partners/${partner.id}/${path}`, body);
    setBusy(null);
    if (failure) setError(failure);
    reload();
  }

  function withNote(
    partner: Partner,
    action: 'reject' | 'pause',
    form: FormEvent<HTMLFormElement>,
  ) {
    form.preventDefault();
    const note = String(new FormData(form.currentTarget).get('note') ?? '');
    void run(partner, 'review', { action, note });
  }

  return (
    <Guard me={me} permission="posts.moderate" label="os parceiros">
      {(staff) => (
        <Frame me={staff}>
          <>
            <PageHeader
              title="Parceiros do Cupu"
              subtitle="Petshops, clínicas e lojas que pediram para aparecer no mapa. O cadastro é de graça em troca de uma vantagem para quem adota ou resgata."
            />
            <InviteSwitch />
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
            {data && data.partners.length === 0 ? <Empty>Nenhum parceiro aqui.</Empty> : null}
            {(data?.partners ?? []).map((partner) => {
              const map = `https://www.openstreetmap.org/?mlat=${partner.location.latitude}&mlon=${partner.location.longitude}#map=17/${partner.location.latitude}/${partner.location.longitude}`;
              return (
                <article key={partner.id} className="card item">
                  <div className="thumb">{icons.shop}</div>
                  <div className="stack">
                    <div className="row">
                      <span className="badge">{partner.kindLabel}</span>
                      {partner.status === 'pending' ? (
                        <span className="badge warn">Esperando aprovação</span>
                      ) : null}
                      {partner.status === 'approved' && !partner.paused ? (
                        <span className="badge ok">No mapa</span>
                      ) : null}
                      {partner.status === 'approved' && partner.paused ? (
                        <span className="badge">Pausado pelo dono</span>
                      ) : null}
                      {partner.status === 'paused' ? (
                        <span className="badge warn">Pausado pela equipe</span>
                      ) : null}
                      {partner.status === 'rejected' ? (
                        <span className="badge">Recusado</span>
                      ) : null}
                      {partner.featured ? (
                        <span className="badge ok">No destaque do feed</span>
                      ) : null}
                    </div>
                    <strong>{partner.name}</strong>
                    {partner.perk ? (
                      <p>
                        <strong>Vantagem:</strong> {partner.perk}
                      </p>
                    ) : null}
                    {partner.about ? <p>{partner.about}</p> : null}
                    <p className="muted">
                      {partner.addressText ?? 'Sem endereço escrito'} ·{' '}
                      <a href={map} target="_blank" rel="noreferrer">
                        ver no mapa
                      </a>
                      {partner.hours ? ` · ${partner.hours}` : ''}
                    </p>
                    <p className="muted">
                      {partner.whatsapp ? `WhatsApp ${partner.whatsapp}` : 'Sem WhatsApp'}
                      {partner.instagram ? ` · @${partner.instagram} no Instagram` : ''}
                    </p>
                    <p className="muted">
                      Pedido de {partner.ownerName} @{partner.ownerHandle}
                      {partner.ownerVerified ? ' · verificado' : ' · sem selo'} · enviado em{' '}
                      {formatDate(partner.createdAt)}
                    </p>
                    {partner.reviewNote ? (
                      <p className="muted">Motivo registrado: {partner.reviewNote}</p>
                    ) : null}
                    {partner.status !== 'approved' ? (
                      <div className="actions">
                        <button
                          type="button"
                          disabled={busy === partner.id}
                          onClick={() => void run(partner, 'review', { action: 'approve' })}
                        >
                          {partner.status === 'pending' ? 'Aprovar' : 'Aprovar e voltar ao mapa'}
                        </button>
                        {partner.status === 'pending' ? (
                          <button
                            type="button"
                            className="quiet"
                            disabled={busy === partner.id}
                            onClick={() =>
                              void run(partner, 'review', { action: 'approve', featured: true })
                            }
                          >
                            Aprovar com destaque no feed
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    {partner.status === 'approved' ? (
                      <div className="actions">
                        <button
                          type="button"
                          className="quiet"
                          disabled={busy === partner.id}
                          onClick={() =>
                            void run(partner, 'feature', { featured: !partner.featured })
                          }
                        >
                          {partner.featured ? 'Tirar do destaque' : 'Pôr no destaque do feed'}
                        </button>
                      </div>
                    ) : null}
                    {partner.status === 'pending' ? (
                      <form
                        className="actions"
                        onSubmit={(form) => withNote(partner, 'reject', form)}
                      >
                        <input
                          name="note"
                          required
                          minLength={5}
                          maxLength={300}
                          placeholder="Motivo da recusa (vai para quem pediu)"
                        />
                        <button type="submit" className="quiet" disabled={busy === partner.id}>
                          Recusar
                        </button>
                      </form>
                    ) : null}
                    {partner.status === 'approved' ? (
                      <form
                        className="actions"
                        onSubmit={(form) => withNote(partner, 'pause', form)}
                      >
                        <input
                          name="note"
                          required
                          minLength={5}
                          maxLength={300}
                          placeholder="Motivo da pausa (vai para quem pediu)"
                        />
                        <button type="submit" className="danger" disabled={busy === partner.id}>
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

/**
 * Liga e desliga o "Anuncie aqui" no app (convite no mapa, item no painel de camadas e em
 * Configurações). Começa desligado. Os parceiros já aprovados continuam no mapa de qualquer jeito.
 */
function InviteSwitch() {
  const { data, message, reload } = useModeration<{ switches: { partnerInvite: boolean } }>(
    'switches',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const on = data?.switches.partnerInvite ?? false;

  async function toggle() {
    setBusy(true);
    setError('');
    const failure = await moderate('switches', { name: 'partnerInvite', enabled: !on });
    setBusy(false);
    if (failure) setError(failure);
    reload();
  }

  return (
    <article className="card item">
      <div className="thumb">{icons.shop}</div>
      <div className="stack">
        <div className="row">
          <strong>&quot;Anuncie aqui&quot; no app</strong>
          {data ? (
            <span className={on ? 'badge ok' : 'badge'}>{on ? 'Ligado' : 'Desligado'}</span>
          ) : null}
        </div>
        <p className="muted">
          Quando ligado, o app mostra o convite para petshops e clínicas virarem parceiros (no mapa
          e em Configurações). Desligado, ninguém vê o convite; os parceiros aprovados continuam no
          mapa.
        </p>
        {message ? <p className="error">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}
        <div className="row">
          <button
            type="button"
            className={on ? 'quiet' : undefined}
            disabled={!data || busy}
            onClick={() => void toggle()}
          >
            {busy ? 'Salvando...' : on ? 'Desligar' : 'Ligar'}
          </button>
        </div>
      </div>
    </article>
  );
}
