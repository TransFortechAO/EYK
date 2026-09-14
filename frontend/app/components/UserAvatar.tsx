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
  username: string;
  foto?: string | null;
}

export function UserAvatar({
  name: propName,
  initials: propInitials,
  foto: propFoto,
  userId: propUserId,
  username: propUsername,
  profileBasePath = '/perfil',
  size = 40,
  backgroundColor = '#b27f1e',
  textColor = '#FFFFFF',
  className = '',
  noLink = false,
  endpoint = API_BASE_URL + `/accounts/auth/me/`,
  onClick,
}: UserAvatarProps) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const isControlled = !!(propName && (propUserId !== undefined || propUsername !== undefined));

  useEffect(() => {
    if (isControlled) return;
    let cancelado = false;
    const fetchUser = async () => {
      try {
        const response = await fetch(endpoint, { credentials: 'include' });
        if (!response.ok) throw new Error(`Erro ${response.status}`);
        const data = await response.json();
        if (!data.ok || !data.authenticated || !data.user) {
          throw new Error('Usuário não autenticado');
        }
        const { user: userData } = data;
        if (cancelado) return;
        setUser({
          id: userData.id,
          name: userData.name || 'Usuário',
          initials: userData.initials || getInitialsFromName(userData.name),
          username: userData.username || '',
          foto: userData.foto ?? null,
        });
      } catch (err) {
        if (cancelado) return;
        console.error('Erro ao carregar perfil:', err);
        setError(true);
      } finally {
        if (!cancelado) setLoading(false);
      }
    };
    void fetchUser();
    return () => {
      cancelado = true;
    };
  }, [endpoint, isControlled]);

  function getInitialsFromName(fullName: string): string {
    if (!fullName) return '?';
    const names = fullName.trim().split(/\s+/);
    if (names.length === 0) return '?';
    if (names.length === 1) return names[0].substring(0, 2).toUpperCase();
    const first = names[0][0]?.toUpperCase() || '';
    const last = names[names.length - 1][0]?.toUpperCase() || '';
    return `${first}${last}`;
  }

  function renderAvatar(
    displayName: string,
    displayInitials: string,
    fotoUrl: string | null | undefined,
  ) {
    const fotoAbsoluta = fotoUrl ? mediaUrl(fotoUrl) : null;
    if (fotoAbsoluta) {
      return (
        <div
          className={cn(
            'user-avatar inline-flex overflow-hidden rounded-full transition-all duration-200',
            className,
          )}
          style={{
            width: size,
            height: size,
            flexShrink: 0,
            backgroundColor,
          }}
          title={displayName}
        >
          <img
            src={fotoAbsoluta}
            alt={displayName}
            className="h-full w-full object-cover"
          />
        </div>
      );
    }

    return (
      <div
        className={cn(
          'user-avatar inline-flex items-center justify-center rounded-full font-bold uppercase transition-all duration-200',
          className,
        )}
        style={{
          width: size,
          height: size,
          fontSize: size * 0.45,
          backgroundColor,
          color: textColor,
          flexShrink: 0,
        }}
        title={displayName}
      >
        {displayInitials}
      </div>
    );
  }

  function renderInteractive(inner: React.ReactNode, linkId?: number | string) {
    if (noLink || !linkId) return inner;

    if (onClick) {
      return (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick();
          }}
          className="block rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring transition-transform duration-200 hover:scale-105 cursor-pointer"
          style={{ width: size, height: size }}
        >
<<<<<<< HEAD
          {inner}
        </button>
=======
          {avatar}
        </span>
>>>>>>> a1112b78c8df4a1d2039389c8f4b0dfcaf602c99
      );
    }

    const href = `${profileBasePath}/${linkId}`;
    return (
      <Link
        href={href}
        className="block rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring transition-transform duration-200 hover:scale-105"
        style={{ width: size, height: size }}
      >
        {inner}
      </Link>
    );
  }

  if (isControlled) {
    const displayName = propName || 'Usuário';
    const displayInitials = propInitials || getInitialsFromName(displayName);
    const linkId = propUserId || propUsername;
    const avatar = renderAvatar(displayName, displayInitials, propFoto);
    return renderInteractive(avatar, linkId);
  }

  if (loading) {
    return (
      <div
        className="animate-pulse rounded-full bg-muted"
        style={{ width: size, height: size, flexShrink: 0 }}
      />
    );
  }

  if (error || !user) {
    return (
      <div
        className="flex items-center justify-center rounded-full bg-destructive text-destructive-foreground font-bold"
        style={{ width: size, height: size, fontSize: size * 0.4, flexShrink: 0 }}
        title="Erro ao carregar perfil"
      >
        ?
      </div>
    );
  }

  const avatar = renderAvatar(user.name, user.initials, user.foto);
  return renderInteractive(avatar, user.id);
}

export const UserInitialsLink = UserAvatar;
