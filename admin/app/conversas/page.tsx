'use client';

import { useEffect, useState, type FormEvent } from 'react';
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

type Flag =
  'sale' | 'money' | 'scam' | 'external_contact' | 'offense' | 'threat' | 'abuse' | 'harassment';

/** Mesmos rótulos de `chatFlagLabels` na API (packages/shared/src/chatModeration.ts). */
const flagLabel: Record<Flag, string> = {
  sale: 'Venda de animal',
  money: 'Dinheiro ou Pix',
  scam: 'Possível golpe',
  external_contact: 'Contato ou dado pessoal',
  offense: 'Ofensa',
  threat: 'Ameaça',
  abuse: 'Maus-tratos',
  harassment: 'Assédio',
};
/** As que pedem olhar primeiro: risco a pessoa ou ao animal. */
const severe = new Set<string>(['threat', 'abuse', 'harassment', 'sale', 'scam']);

interface Person {
  id: string;
  name: string;
  handle: string;
  suspended: boolean;
}

interface ChatSummary {
  id: string;
  postId: string;
  animal: { name: string | null; species: string; status: string };
  author: Person;
  adopter: Person;
  reviewStatus: 'clear' | 'flagged' | 'reviewed';
  flaggedAt: string | null;
  reviewedAt: string | null;
  reviewerHandle: string | null;
  closedAt: string | null;
  closedReason: string | null;
  createdAt: string;
  lastAt: string | null;
  messages: number;
  withheld: number;
  flags: string[];
  openReports: number;
  preview: string | null;
  previewFlags: string[];
}

interface ChatMessage {
  id: string;
  from: 'author' | 'adopter';
  body: string;
  flags: string[];
  withheld: boolean;
  hiddenAt: string | null;
  hiddenByHandle: string | null;
  createdAt: string;
}

interface ChatDetail {
  chat: ChatSummary;
  messages: ChatMessage[];
  reports: {
    id: string;
    reason: string;
    status: string;
    createdAt: string;
    reporterHandle: string | null;
  }[];
}

const tabs = [
  { filter: 'flagged', label: 'Sinalizadas' },
  { filter: 'reported', label: 'Denunciadas' },
  { filter: 'reviewed', label: 'Revisadas' },
  { filter: 'closed', label: 'Encerradas' },
  { filter: 'recent', label: 'Todas' },
] as const;

const speciesWord: Record<string, string> = { dog: 'cachorro', cat: 'gato' };

function animalName(chat: ChatSummary): string {
  return chat.animal.name?.trim() || `um ${speciesWord[chat.animal.species] ?? 'animal'}`;
}

function FlagBadges({ flags }: { flags: string[] }) {
  return (
    <>
      {flags.map((flag) => (
        <span key={flag} className={`badge${severe.has(flag) ? ' warn' : ' gold'}`}>
          {flagLabel[flag as Flag] ?? flag}
        </span>
      ))}
    </>
  );
}

export default function ChatsPage() {
  const me = useStaff();
  const allowed = Boolean(me?.permissions.includes('chats.moderate'));
  const canSuspend = Boolean(me?.permissions.includes('users.suspend'));
  const [filter, setFilter] = useState<(typeof tabs)[number]['filter']>('flagged');
  const [flag, setFlag] = useState<'' | Flag>('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const params = new URLSearchParams({ filter });
  if (flag) params.set('flag', flag);
  if (q) params.set('q', q);
  const { data, message, reload } = useModeration<{ chats: ChatSummary[] }>(
    allowed ? `chats?${params.toString()}` : null,
  );

  // Vindo da tela de denúncias: abre direto a conversa pedida.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    if (id) {
      setFilter('recent');
      setOpenId(id);
    }
  }, []);

  return (
    <Guard me={me} permission="chats.moderate" label="as conversas">
      {(staff) => (
        <Frame me={staff}>
          <PageHeader
            title="Conversas de adoção"
            subtitle="O filtro sinaliza venda, Pix, golpe, contato fora do app, ofensa, ameaça, maus-tratos e assédio. Venda e Pix nem chegam à outra pessoa. Abrir uma conversa fica registrado na auditoria."
          />
          <div className="tabs">
            {tabs.map((tab) => (
              <button
                key={tab.filter}
                type="button"
                aria-pressed={filter === tab.filter}
                onClick={() => setFilter(tab.filter)}
              >
                {tab.label}
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
                placeholder="Buscar por @, nome ou animal"
              />
            </span>
            <select
              aria-label="Tipo de sinal"
              value={flag}
              onChange={(event) => setFlag(event.target.value as '' | Flag)}
            >
              <option value="">Todos os sinais</option>
              {(Object.keys(flagLabel) as Flag[]).map((key) => (
                <option key={key} value={key}>
                  {flagLabel[key]}
                </option>
              ))}
            </select>
            <button type="submit">Buscar</button>
          </form>
          {message ? <p className="error">{message}</p> : null}
          {!data && !message ? <Loading /> : null}
          {data && data.chats.length === 0 ? (
            <Empty>
              {filter === 'flagged'
                ? 'Nenhuma conversa esperando a equipe. Tudo tranquilo por aqui.'
                : 'Nenhuma conversa aqui.'}
            </Empty>
          ) : null}
          {openId && !data?.chats.some((chat) => chat.id === openId) ? (
            <ChatPanel
              id={openId}
              canSuspend={canSuspend}
              onClose={() => setOpenId(null)}
              onChanged={reload}
            />
          ) : null}
          {(data?.chats ?? []).map((chat) => (
            <article key={chat.id} className="card stack accent-chat">
              <div className="row">
                {chat.closedAt ? <span className="badge">Encerrada</span> : null}
                {chat.reviewStatus === 'flagged' ? (
                  <span className="badge warn">Esperando revisão</span>
                ) : null}
                {chat.reviewStatus === 'reviewed' ? (
                  <span className="badge ok">
                    Revisada{chat.reviewerHandle ? ` por @${chat.reviewerHandle}` : ''}
                  </span>
                ) : null}
                {chat.openReports > 0 ? (
                  <span className="badge warn">
                    {chat.openReports} {chat.openReports === 1 ? 'denúncia' : 'denúncias'}
                  </span>
                ) : null}
                {chat.withheld > 0 ? (
                  <span className="badge warn">
                    {chat.withheld}{' '}
                    {chat.withheld === 1 ? 'mensagem barrada' : 'mensagens barradas'}
                  </span>
                ) : null}
                <FlagBadges flags={chat.flags} />
              </div>
              <p>
                <strong>@{chat.adopter.handle}</strong>
                {chat.adopter.suspended ? <span className="muted"> (suspensa)</span> : null} quer
                adotar <strong>{animalName(chat)}</strong> de <strong>@{chat.author.handle}</strong>
                {chat.author.suspended ? <span className="muted"> (suspensa)</span> : null}
              </p>
              {chat.preview ? (
                <blockquote className="quote" style={{ margin: 0 }}>
                  {chat.preview}
                  {chat.previewFlags.length > 0 ? (
                    <div className="row" style={{ marginTop: 6 }}>
                      <FlagBadges flags={chat.previewFlags} />
                    </div>
                  ) : null}
                </blockquote>
              ) : null}
              <p className="muted">
                {chat.messages} {chat.messages === 1 ? 'mensagem' : 'mensagens'}
                {chat.lastAt ? ` · última em ${formatDate(chat.lastAt)}` : ''}
                {chat.flaggedAt ? ` · sinalizada em ${formatDate(chat.flaggedAt)}` : ''}
              </p>
              {openId === chat.id ? (
                <ChatPanel
                  id={chat.id}
                  canSuspend={canSuspend}
                  onClose={() => setOpenId(null)}
                  onChanged={reload}
                />
              ) : (
                <div className="actions">
                  <button type="button" onClick={() => setOpenId(chat.id)}>
                    {icons.chat} Ler a conversa
                  </button>
                </div>
              )}
            </article>
          ))}
        </Frame>
      )}
    </Guard>
  );
}

function ChatPanel({
  id,
  canSuspend,
  onClose,
  onChanged,
}: {
  id: string;
  canSuspend: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { data, message, reload } = useModeration<ChatDetail>(`chats/${id}`);
  const [justification, setJustification] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');

  async function run(path: string, body: Record<string, unknown>, success: string) {
    if (justification.trim().length < 10) {
      setError('Escreva o motivo (pelo menos 10 letras). Ele vai para a auditoria.');
      return;
    }
    setBusy(true);
    setError('');
    setDone('');
    const failure = await moderate(path, { ...body, justification: justification.trim() });
    setBusy(false);
    if (failure) {
      setError(failure);
      return;
    }
    setDone(success);
    setJustification('');
    reload();
    onChanged();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
  }

  if (message) return <p className="error">{message}</p>;
  if (!data) return <Loading />;
  const { chat } = data;
  const people = { author: chat.author, adopter: chat.adopter };

  return (
    <section className="stack chat-panel" aria-label="Conversa">
      <div className="row">
        <h2 style={{ flex: 1 }}>
          @{chat.adopter.handle} e @{chat.author.handle} sobre {animalName(chat)}
        </h2>
        <button type="button" className="quiet" onClick={onClose}>
          Fechar
        </button>
      </div>
      {chat.closedAt ? (
        <p className="muted">
          Encerrada em {formatDate(chat.closedAt)}
          {chat.closedReason ? `: ${chat.closedReason}` : ''}
        </p>
      ) : null}
      {data.reports.length > 0 ? (
        <div className="stack">
          <strong>Denúncias</strong>
          {data.reports.map((report) => (
            <p key={report.id}>
              {report.reason}
              <span className="muted">
                {' '}
                · {report.reporterHandle ? `@${report.reporterHandle}` : 'conta apagada'} ·{' '}
                {formatDate(report.createdAt)}
                {report.status === 'open' ? ' · aberta' : ''}
              </span>
            </p>
          ))}
        </div>
      ) : null}
      <div className="chat-log">
        {data.messages.length === 0 ? <p className="muted">Sem mensagens.</p> : null}
        {data.messages.map((item) => {
          const person = people[item.from];
          return (
            <div
              key={item.id}
              className={`bubble ${item.from}${item.withheld ? ' withheld' : ''}${item.hiddenAt ? ' hidden' : ''}`}
            >
              <div className="row bubble-head">
                <strong>@{person.handle}</strong>
                <span className="muted">
                  {item.from === 'author' ? 'quem cuida' : 'quer adotar'} ·{' '}
                  {formatDate(item.createdAt)}
                </span>
              </div>
              <p>{item.body}</p>
              <div className="row">
                {item.withheld ? (
                  <span className="badge warn">Barrada, não foi entregue</span>
                ) : null}
                {item.hiddenAt ? (
                  <span className="badge">
                    Escondida{item.hiddenByHandle ? ` por @${item.hiddenByHandle}` : ''}
                  </span>
                ) : null}
                <FlagBadges flags={item.flags} />
                {!item.withheld ? (
                  <button
                    type="button"
                    className="quiet small"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        `chats/${chat.id}/hide`,
                        { messageId: item.id, hidden: !item.hiddenAt },
                        item.hiddenAt ? 'Mensagem de volta na conversa.' : 'Mensagem escondida.',
                      )
                    }
                  >
                    {item.hiddenAt ? 'Mostrar de novo' : 'Esconder'}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <form className="actions" onSubmit={submit}>
        <input
          value={justification}
          onChange={(event) => setJustification(event.target.value)}
          minLength={10}
          placeholder="Motivo da decisão (vai para a auditoria)"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void run(
              `chats/${chat.id}/review`,
              { action: 'clear' },
              'Conversa marcada como revisada.',
            )
          }
        >
          {icons.shield} Está tudo certo
        </button>
        {chat.closedAt ? (
          <button
            type="button"
            className="quiet"
            disabled={busy}
            onClick={() =>
              void run(`chats/${chat.id}/review`, { action: 'reopen' }, 'Conversa reaberta.')
            }
          >
            Reabrir a conversa
          </button>
        ) : (
          <button
            type="button"
            className="danger"
            disabled={busy}
            onClick={() =>
              void run(
                `chats/${chat.id}/review`,
                { action: 'close' },
                'Conversa encerrada. As duas pessoas receberam um aviso.',
              )
            }
          >
            Encerrar a conversa
          </button>
        )}
        {canSuspend
          ? [chat.adopter, chat.author].map((person) => (
              <button
                key={person.id}
                type="button"
                className={person.suspended ? 'quiet' : 'danger'}
                disabled={busy}
                onClick={() =>
                  void run(
                    `users/${person.id}/suspend`,
                    { suspended: !person.suspended },
                    person.suspended
                      ? `@${person.handle} liberada.`
                      : `@${person.handle} suspensa. A conta não entra mais no app.`,
                  )
                }
              >
                {person.suspended ? `Liberar @${person.handle}` : `Suspender @${person.handle}`}
              </button>
            ))
          : null}
      </form>
      {error ? <p className="error">{error}</p> : null}
      {done ? <p className="ok-text">{done}</p> : null}
    </section>
  );
}
