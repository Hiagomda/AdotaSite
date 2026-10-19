'use client';

import { useState } from 'react';
import {
  Empty,
  Frame,
  Guard,
  Loading,
  PageHeader,
  formatDate,
  labelRole,
  moderate,
  useModeration,
  useStaff,
} from '../painel';

interface Verification {
  id: string;
  organizationName: string;
  note: string | null;
  createdAt: string;
  /** O que a pessoa pediu ser. APIs antigas não mandam os campos do cadastro. */
  kind?: 'ngo' | 'protector';
  instagram?: string | null;
  cnpj?: string | null;
  neighborhood?: string | null;
  userId: string;
  handle: string;
  name: string;
  role: string;
  verified: boolean;
}

const kindLabel = { ngo: 'ONG ou coletivo', protector: 'Protetor independente' } as const;

function formatCnpj(cnpj: string): string {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

export default function VerificationsPage() {
  const me = useStaff();
  const allowed = Boolean(me?.permissions.includes('verifications.manage'));
  const { data, message, reload } = useModeration<{ verifications: Verification[] }>(
    allowed ? 'verifications' : null,
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function act(item: Verification, action: 'approve' | 'reject', role?: string) {
    setBusy(item.id);
    setError('');
    const failure = await moderate(`verifications/${item.id}`, { action, role });
    setBusy(null);
    if (failure) setError(failure);
    reload();
  }

  return (
    <Guard me={me} permission="verifications.manage" label="as verificações">
      {(staff) => (
        <Frame me={staff}>
          <>
            <PageHeader
              title="Verificações"
              subtitle="Perfil verificado ganha o selo e pode mostrar Pix em pedido de ajuda. Confira a ONG ou o protetor fora do app antes de aprovar."
            />
            {message ? <p className="error">{message}</p> : null}
            {error ? <p className="error">{error}</p> : null}
            {!data && !message ? <Loading /> : null}
            {data && data.verifications.length === 0 ? (
              <Empty>Nenhum pedido esperando.</Empty>
            ) : null}
            {(data?.verifications ?? []).map((item) => (
              <article key={item.id} className="card stack">
                <h2>{item.organizationName}</h2>
                <p>
                  {item.name} <span className="muted">@{item.handle}</span> · {labelRole(item.role)}
                  <span className="muted"> · pedido em {formatDate(item.createdAt)}</span>
                </p>
                {item.kind || item.neighborhood ? (
                  <p>
                    {item.kind ? <strong>Pediu como {kindLabel[item.kind]}</strong> : null}
                    {item.neighborhood ? (
                      <span className="muted"> · atua em {item.neighborhood}</span>
                    ) : null}
                  </p>
                ) : null}
                {item.instagram || item.cnpj ? (
                  <p>
                    {item.instagram ? (
                      <a
                        href={`https://instagram.com/${encodeURIComponent(item.instagram)}`}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        @{item.instagram}
                      </a>
                    ) : null}
                    {item.instagram && item.cnpj ? ' · ' : null}
                    {item.cnpj ? <span>CNPJ {formatCnpj(item.cnpj)}</span> : null}
                  </p>
                ) : null}
                {item.note ? (
                  <p className="quote">{item.note}</p>
                ) : (
                  <p className="muted">Sem observação.</p>
                )}
                <div className="actions">
                  <button
                    type="button"
                    disabled={busy === item.id}
                    onClick={() => void act(item, 'approve', 'ngo')}
                  >
                    Aprovar como ONG
                  </button>
                  <button
                    type="button"
                    disabled={busy === item.id}
                    onClick={() => void act(item, 'approve', 'protector')}
                  >
                    Aprovar como protetor
                  </button>
                  <button
                    type="button"
                    className="quiet"
                    disabled={busy === item.id}
                    onClick={() => void act(item, 'reject')}
                  >
                    Recusar
                  </button>
                </div>
              </article>
            ))}
          </>
        </Frame>
      )}
    </Guard>
  );
}
