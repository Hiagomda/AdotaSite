'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, type FormEvent, type ReactNode } from 'react';
import { icons } from './icons';
import { Frame, Loading, useModeration, useStaff, type StaffMe } from './painel';

export default function HomePage() {
  const me = useStaff();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  if (me === undefined)
    return (
      <main className="content">
        <Loading />
      </main>
    );
  if (me) {
    return (
      <Frame me={me}>
        <Overview me={me} />
      </Frame>
    );
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const response = await fetch('/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), password }),
    });
    const body = (await response.json()) as { message?: string };
    setBusy(false);
    if (!response.ok) {
      setMessage(body.message ?? 'Não consegui entrar.');
      return;
    }
    window.location.assign('/');
  }

  return (
    <main className="login">
      <section className="login-art">
        <Image
          src="/mascote-acenando.webp"
          alt="Mascote do Égua, adota!, um vira-lata caramelo acenando"
          width={220}
          height={252}
          priority
          unoptimized
        />
        <h1>Égua, adota!</h1>
        <p>Painel da equipe: denúncias, posts, ONGs e pessoas do app, num lugar só.</p>
      </section>
      <section className="login-form">
        <div className="card">
          <form className="stack" onSubmit={(event) => void login(event)}>
            <h2>Entrar</h2>
            <p className="muted">Use o usuário e a senha da equipe.</p>
            <label>
              Usuário
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            </label>
            <label>
              Senha
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <button type="submit" disabled={busy}>
              Entrar {icons.arrow}
            </button>
          </form>
          {message ? <p className="error">{message}</p> : null}
        </div>
      </section>
    </main>
  );
}

interface OverviewData {
  usersTotal: number;
  usersThisWeek: number;
  usersSuspended: number;
  postsThisWeek: number;
  alertsOpen: number;
  adopted: number;
  pendingReview: number;
  openReports: number;
  pendingVerifications: number;
  meanSecondsToResponse: number | null;
  /** Some na API anterior a esta versão do painel. */
  rescues30d?: {
    created: number;
    safe: number;
    stillOpen: number;
    notFound: number;
    medianHoursToSafe: number | null;
  };
}

function hours(value: number | null): string {
  if (value === null) return '—';
  if (value < 1) return `${Math.round(value * 60)} min`;
  return `${value.toFixed(1).replace('.', ',')} h`;
}

function share(part: number, total: number): string {
  return total === 0 ? '' : ` (${Math.round((part / total) * 100)}%)`;
}

function minutes(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${(seconds / 3600).toFixed(1).replace('.', ',')} h`;
}

function Stat({
  icon,
  tone,
  value,
  label,
}: {
  icon: ReactNode;
  tone?: 'coral' | 'caramel';
  value: string;
  label: string;
}) {
  return (
    <div className="card stat">
      <span className={`stat-icon${tone ? ` ${tone}` : ''}`}>{icon}</span>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function Overview({ me }: { me: StaffMe }) {
  const allowed = me.permissions.includes('overview.read');
  const { data, message } = useModeration<OverviewData>(allowed ? 'overview' : null);
  const firstName = me.name.split(' ')[0] ?? me.name;
  const hero = (pending: number | null) => (
    <section className="hero">
      <div className="stack">
        <h1>
          {greeting()}, {firstName}!
        </h1>
        <p>
          {pending === null
            ? 'Sua conta abre a equipe e a auditoria.'
            : pending === 0
              ? 'Nada esperando a equipe agora. Os bichos agradecem.'
              : `Tem ${pending} ${pending === 1 ? 'coisa esperando' : 'coisas esperando'} a equipe.`}
        </p>
      </div>
      <Image src="/mascote-acenando.webp" alt="" width={150} height={172} unoptimized />
    </section>
  );
  if (!allowed) return hero(null);
  if (message) return <p className="error">{message}</p>;
  if (!data) return <Loading />;
  const queue = [
    {
      label: 'Denúncias abertas',
      value: data.openReports,
      href: '/denuncias',
      permission: 'reports.manage',
      icon: icons.flag,
    },
    {
      label: 'Posts esperando revisão',
      value: data.pendingReview,
      href: '/posts',
      permission: 'posts.moderate',
      icon: icons.posts,
    },
    {
      label: 'Pedidos de verificação',
      value: data.pendingVerifications,
      href: '/verificacoes',
      permission: 'verifications.manage',
      icon: icons.badge,
    },
  ];
  const pending = queue
    .filter((item) => me.permissions.includes(item.permission))
    .reduce((total, item) => total + item.value, 0);
  return (
    <>
      {hero(pending)}
      <h2 className="section-title">Fila de trabalho</h2>
      <div className="grid tasks">
        {queue.map((item) => {
          const body = (
            <>
              <span className={`stat-icon${item.value > 0 ? ' coral' : ''}`}>{item.icon}</span>
              <span className="task-text">
                <strong>{item.value}</strong>
                <span className="muted">{item.label}</span>
              </span>
              {me.permissions.includes(item.permission) ? (
                <span className="arrow">{icons.arrow}</span>
              ) : null}
            </>
          );
          const className = `card task${item.value > 0 ? ' attention' : ''}`;
          return me.permissions.includes(item.permission) ? (
            <Link key={item.label} href={item.href} className={className}>
              {body}
            </Link>
          ) : (
            <div key={item.label} className={className}>
              {body}
            </div>
          );
        })}
      </div>
      <h2 className="section-title">Números do app</h2>
      <div className="grid">
        <Stat icon={icons.people} value={String(data.usersTotal)} label="Pessoas cadastradas" />
        <Stat
          icon={icons.sparkle}
          tone="caramel"
          value={String(data.usersThisWeek)}
          label="Novas nos últimos 7 dias"
        />
        <Stat
          icon={icons.posts}
          value={String(data.postsThisWeek)}
          label="Posts nos últimos 7 dias"
        />
        <Stat
          icon={icons.paw}
          tone="coral"
          value={String(data.alertsOpen)}
          label="Resgates em aberto"
        />
        <Stat
          icon={icons.heart}
          tone="coral"
          value={String(data.adopted)}
          label="Adoções concluídas"
        />
        <Stat
          icon={icons.clock}
          tone="caramel"
          value={minutes(data.meanSecondsToResponse)}
          label='Tempo médio até "vou ajudar" (30 dias)'
        />
        <Stat icon={icons.ban} value={String(data.usersSuspended)} label="Contas suspensas" />
      </div>
      {data.rescues30d ? (
        <>
          <h2 className="section-title">Resgates nos últimos 30 dias</h2>
          <div className="grid">
            <Stat
              icon={icons.paw}
              value={String(data.rescues30d.created)}
              label="Avisos de resgate publicados"
            />
            <Stat
              icon={icons.heart}
              tone="coral"
              value={`${data.rescues30d.safe}${share(data.rescues30d.safe, data.rescues30d.created)}`}
              label="Saíram da rua (resgatado, lar temporário, adoção)"
            />
            <Stat
              icon={icons.clock}
              tone="caramel"
              value={hours(data.rescues30d.medianHoursToSafe)}
              label="Tempo do aviso até sair da rua (mediana)"
            />
            <Stat
              icon={icons.flag}
              value={String(data.rescues30d.stillOpen)}
              label="Ainda na rua (aberto ou a caminho)"
            />
            <Stat
              icon={icons.ban}
              value={String(data.rescues30d.notFound)}
              label="Não encontrados"
            />
          </div>
        </>
      ) : null}
    </>
  );
}
