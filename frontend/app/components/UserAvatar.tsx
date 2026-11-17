import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { mediaUrl, API_BASE_URL } from '@/lib/api';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  name?: string;
  initials?: string;
  foto?: string | null;
  userId?: number | string;
  username?: string;
  profileBasePath?: string;
  size?: number;
  /** Cor de fundo fixa. Sem ela, o fundo é o dourado da EYK (ou o que vier no className). */
  backgroundColor?: string;
  textColor?: string;
  className?: string;
  noLink?: boolean;
  endpoint?: string;
  onClick?: () => void;
}

interface UserData {
  id: number;
  name: string;
  initials: string;
  foto?: string | null;
}

function iniciaisDe(nome?: string): string {
  const partes = (nome || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
}

/**
 * Foto de perfil (ou iniciais) de uma pessoa.
 *
 * Com dados (nome, foto, iniciais ou id), mostra essa pessoa. Só sem nenhum
 * dado mostra a conta de quem está a ver (vai buscá-la a /auth/me/). Se a
 * foto não carregar, mostra as iniciais.
 */
export function UserAvatar({
  name: propName,
  initials: propInitials,
  foto: propFoto,
  userId: propUserId,
  username: propUsername,
  profileBasePath = '/perfil',
  size = 40,
  backgroundColor,
  textColor,
  className = '',
  noLink = false,
  endpoint = API_BASE_URL + `/accounts/auth/me/`,
  onClick,
}: UserAvatarProps) {
  // Qualquer dado passado chega: sem isto, um autor sem id aparecia com a foto de quem está a ver.
  const isControlled = [propName, propInitials, propFoto, propUserId, propUsername].some((v) => v !== undefined);

  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  // O endereço da foto que não carregou (uma foto nova volta a ser tentada).
  const [fotoFalhada, setFotoFalhada] = useState<string | null>(null);

  useEffect(() => {
    if (isControlled) return;
    let cancelado = false;
    const fetchUser = async () => {
      try {
        const response = await fetch(endpoint, { credentials: 'include' });
        if (!response.ok) throw new Error(`Erro ${response.status}`);
        const data = await response.json();
        if (!data.ok || !data.authenticated || !data.user) throw new Error('Sem sessão');
        if (cancelado) return;
        const u = data.user;
        setUser({
          id: u.id,
          name: u.name || 'Utilizador',
          initials: u.initials || iniciaisDe(u.name),
          foto: u.foto ?? null,
        });
      } catch {
        // Sem sessão ou sem rede: fica o círculo neutro com "?".
      } finally {
        if (!cancelado) setLoading(false);
      }
    };
    void fetchUser();
    return () => {
      cancelado = true;
    };
  }, [endpoint, isControlled]);

  const displayName = isControlled ? propName || 'Utilizador' : user?.name || 'Utilizador';
  const displayInitials = isControlled ? propInitials || iniciaisDe(propName) : user?.initials || '?';
  const fotoUrl = mediaUrl(isControlled ? propFoto : user?.foto);
  const linkId = isControlled ? propUserId || propUsername : user?.id;

  if (!isControlled && loading) {
    return <div className="animate-pulse rounded-full bg-muted" style={{ width: size, height: size, flexShrink: 0 }} />;
  }

  const semDados = !isControlled && !user;
  const estiloCor: React.CSSProperties = {
    ...(backgroundColor ? { backgroundColor } : {}),
    ...(textColor ? { color: textColor } : {}),
  };

  const inner =
    fotoUrl && fotoUrl !== fotoFalhada ? (
      <div
        className={cn('user-avatar inline-flex overflow-hidden rounded-full bg-muted', className)}
        style={{ width: size, height: size, flexShrink: 0, ...estiloCor }}
        title={displayName}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- fotos vêm do armazenamento, com tamanho pequeno */}
        <img
          src={fotoUrl}
          alt={displayName}
          className="h-full w-full object-cover"
          onError={() => setFotoFalhada(fotoUrl)}
        />
      </div>
    ) : (
      <div
        className={cn(
          'user-avatar inline-flex select-none items-center justify-center rounded-full font-bold uppercase leading-none',
          semDados ? 'bg-muted text-muted-foreground' : 'bg-gradient-gold text-primary-foreground',
          className,
        )}
        style={{ width: size, height: size, fontSize: size * 0.4, flexShrink: 0, ...estiloCor }}
        title={displayName}
        role="img"
        aria-label={displayName}
      >
        {displayInitials}
      </div>
    );

  if (noLink || !linkId) return inner;

  const classeInterativa =
    'block shrink-0 rounded-full outline-none transition-transform duration-200 hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring';

  if (onClick) {
    return (
      <span
        role="button"
        tabIndex={0}
        aria-label={displayName}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        className={cn(classeInterativa, 'cursor-pointer')}
        style={{ width: size, height: size }}
      >
        {inner}
      </span>
    );
  }

  return (
    <Link
      href={`${profileBasePath}/${linkId}`}
      aria-label={`Perfil de ${displayName}`}
      className={classeInterativa}
      style={{ width: size, height: size }}
    >
      {inner}
    </Link>
  );
}

export const UserInitialsLink = UserAvatar;
