import React, { useEffect, useState } from 'react';
import Link from 'next/link'; // <-- import do Link
import { API_BASE_URL } from '@/lib/api';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  name?: string;
  initials?: string;
  userId?: number | string;
  username?: string;
  profileBasePath?: string; // ex: '/perfil'
  size?: number;
  backgroundColor?: string;
  textColor?: string;
  className?: string;
  noLink?: boolean;
  endpoint?: string;
  // Se quiser executar uma função ao clicar (ex: abrir modal)
  onClick?: () => void;
}

interface UserData {
  id: number;
  name: string;
  initials: string;
  username: string;
}

export function UserAvatar({
  name: propName,
  initials: propInitials,
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

  // --- Modo controlado (usa props) ---
  if (isControlled) {
    const displayName = propName || 'Usuário';
    const displayInitials = propInitials || getInitialsFromName(displayName);
    const linkId = propUserId || propUsername;
    const href = linkId ? `${profileBasePath}/${linkId}` : '#';

    const avatar = (
      <div
        className={cn(
          'user-avatar inline-flex items-center justify-center rounded-full font-bold uppercase transition-all duration-200',
          className
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

    if (noLink || !linkId) return avatar;

    // Se houver onClick, usamos um botão/div com clique
    if (onClick) {
      return (
        <button
          type="button"
          onClick={onClick}
          className="block rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring transition-transform duration-200 hover:scale-105"
          style={{ width: size, height: size }}
        >
          {avatar}
        </button>
      );
    }

    // Usamos Link do Next.js para navegação SPA
    return (
      <Link
        href={href}
        className="block rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring transition-transform duration-200 hover:scale-105"
        style={{ width: size, height: size }}
      >
        {avatar}
      </Link>
    );
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

  const profileUrl = `${profileBasePath}/${user.id}`;

  const avatar = (
    <div
      className={cn(
        'user-avatar inline-flex items-center justify-center rounded-full font-bold uppercase transition-all duration-200',
        className
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.45,
        backgroundColor,
        color: textColor,
        flexShrink: 0,
      }}
      title={user.name}
    >
      {user.initials}
    </div>
  );

  if (noLink) return avatar;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="block rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring transition-transform duration-200 hover:scale-105"
        style={{ width: size, height: size }}
      >
        {avatar}
      </button>
    );
  }

  return (
    <Link
      href={profileUrl}
      className="block rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring transition-transform duration-200 hover:scale-105"
      style={{ width: size, height: size }}
    >
      {avatar}
    </Link>
  );
}

// Alias para compatibilidade
export const UserInitialsLink = UserAvatar;