import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  ArrowRight, Check, ChevronRight, CircleAlert, Crown, LoaderCircle,
  LockKeyhole, Medal, Plus, RefreshCw, ShieldCheck, Swords, UserRound,
  UserRoundPlus, Users, X,
} from 'lucide-react';
import {
  getGetCommunityFriendsQueryKey,
  getGetCommunityLeaderboardQueryKey,
  getGetCommunityMeQueryKey,
  useCreateFriendRequest,
  useGetCommunityFriends,
  useGetCommunityLeaderboard,
  useGetCommunityMe,
  useRemoveCommunityFriend,
  useRespondFriendRequest,
  useSetCommunitySharing,
  useUpdateCommunityMe,
  type GetCommunityMeParams,
} from '@workspace/api-client-react';

const fieldClass = 'w-full rounded-xl border border-border bg-secondary/45 px-3.5 py-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15';
const secondaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary/45 px-3.5 py-2.5 text-xs font-semibold text-foreground transition hover:border-primary/40 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50';
const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50';

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase() || '?';
}

function useNetworkStatus() {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  useEffect(() => {
    const onlineAgain = () => setOnline(true);
    const offline = () => setOnline(false);
    window.addEventListener('online', onlineAgain);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', onlineAgain);
      window.removeEventListener('offline', offline);
    };
  }, []);
  return online;
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-secondary/70 ${className}`} />;
}

function SectionHeading({ eyebrow, title, count }: { eyebrow: string; title: string; count?: number }) {
  return <div className="flex items-end justify-between gap-3">
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[.19em] text-primary">{eyebrow}</p>
      <h2 className="font-display mt-1.5 text-xl font-bold tracking-[-.04em] sm:text-2xl">{title}</h2>
    </div>
    {count !== undefined && <span className="rounded-full border border-border bg-secondary/55 px-2.5 py-1 font-mono text-[10px] text-muted-foreground">{String(count).padStart(2, '0')}</span>}
  </div>;
}

function QueryProblem({ message, retry }: { message: string; retry: () => void }) {
  return <div className="flex flex-col items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/[.06] p-4 sm:flex-row sm:items-center sm:justify-between">
    <p className="flex items-center gap-2 text-xs leading-5 text-muted-foreground"><CircleAlert size={15} className="shrink-0 text-destructive" />{message}</p>
    <button type="button" className={secondaryButton} onClick={retry} data-testid="button-community-retry"><RefreshCw size={13} /> Try again</button>
  </div>;
}

function Avatar({ name, you = false }: { name: string; you?: boolean }) {
  return <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border font-display text-xs font-bold ${you ? 'border-primary/35 bg-primary/12 text-primary' : 'border-border bg-secondary text-muted-foreground'}`} aria-hidden="true">{initials(name)}</span>;
}

export default function CommunityHub() {
  const { isLoaded, isSignedIn } = useAuth();
  const online = useNetworkStatus();
  const queryClient = useQueryClient();
  const params = useMemo<GetCommunityMeParams>(() => ({ timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }), []);
  const enabled = Boolean(isLoaded && isSignedIn && online);
  const meQuery = useGetCommunityMe(params, { query: { enabled, queryKey: getGetCommunityMeQueryKey(params), retry: false } });
  const friendsQuery = useGetCommunityFriends({ query: { enabled, queryKey: getGetCommunityFriendsQueryKey(), retry: false } });
  const leaderboardQuery = useGetCommunityLeaderboard({ query: { enabled, queryKey: getGetCommunityLeaderboardQueryKey(), retry: false } });
  const updateProfile = useUpdateCommunityMe();
  const createRequest = useCreateFriendRequest();
  const respondRequest = useRespondFriendRequest();
  const removeFriend = useRemoveCommunityFriend();
  const setSharing = useSetCommunitySharing();

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [friendUsername, setFriendUsername] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [friendToRemove, setFriendToRemove] = useState<string | null>(null);

  useEffect(() => {
    if (meQuery.data) {
      setUsername(meQuery.data.username);
      setDisplayName(meQuery.data.displayName);
    }
  }, [meQuery.data?.userId, meQuery.data?.username, meQuery.data?.displayName]);

  const refreshCommunity = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetCommunityMeQueryKey(params) }),
      queryClient.invalidateQueries({ queryKey: getGetCommunityFriendsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetCommunityLeaderboardQueryKey() }),
    ]);
  };
  const saveProfile = () => {
    setProfileMessage('');
    updateProfile.mutate({ data: { username: username.trim().toLowerCase(), displayName: displayName.trim() } }, {
      onSuccess: async () => {
        setProfileMessage('Profile saved. Your friends will see the updated details.');
        await refreshCommunity();
      },
      onError: (error) => setProfileMessage(error instanceof Error ? error.message : 'Could not save your profile. Try again.'),
    });
  };
  const sendRequest = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRequestMessage('');
    createRequest.mutate({ data: { username: friendUsername.trim().toLowerCase() } }, {
      onSuccess: async () => {
        setFriendUsername('');
        setRequestMessage('Request sent. They can accept when they are ready.');
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getGetCommunityFriendsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetCommunityLeaderboardQueryKey() }),
        ]);
      },
      onError: (error) => setRequestMessage(error instanceof Error ? error.message : 'Could not send the request. Check the username and try again.'),
    });
  };
  const decideRequest = (requestId: number, decision: 'accept' | 'decline' | 'cancel') => {
    respondRequest.mutate({ requestId, data: { decision } }, { onSuccess: refreshCommunity });
  };
  const removeAcceptedFriend = (friendUserId: string) => {
    removeFriend.mutate({ friendUserId }, {
      onSuccess: async () => {
        setFriendToRemove(null);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getGetCommunityFriendsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetCommunityLeaderboardQueryKey() }),
        ]);
      },
    });
  };
  const toggleSharing = () => {
    if (!profile) return;
    const enabled = !profile.sharingEnabled;
    setProfileMessage('');
    setSharing.mutate({ data: { enabled } }, {
      onSuccess: async () => {
        setProfileMessage(enabled
          ? 'Sharing is on. Your score is visible only to accepted friends.'
          : 'Sharing is paused. Your existing workouts stay private from friends.');
        await refreshCommunity();
      },
      onError: (error) => setProfileMessage(error instanceof Error ? error.message : 'Could not update score sharing. Try again.'),
    });
  };

  if (!isLoaded) {
    return <div className="page-enter mx-auto max-w-5xl space-y-5" aria-label="Loading community">
      <Skeleton className="h-8 w-44" /><Skeleton className="h-48" /><Skeleton className="h-64" />
    </div>;
  }

  if (!isSignedIn) {
    return <main className="page-enter mx-auto max-w-4xl py-8">
      <header className="mb-7">
        <p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">The quiet circle</p>
        <h1 className="font-display mt-2 text-4xl font-bold tracking-[-.06em] sm:text-5xl">Community, on your terms.</h1>
      </header>
      <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card p-6 sm:p-10">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full border-[32px] border-primary/[.06]" />
        <div className="relative max-w-xl">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-primary/20 bg-primary/[.08] text-primary"><LockKeyhole size={21} /></div>
          <h2 className="font-display mt-7 text-3xl font-bold tracking-[-.05em]">Your score stays private until you choose.</h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">Sign in to set up a profile, connect with people you trust, and share your Shadow Score only with accepted friends.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/sign-in" className={primaryButton} data-testid="link-community-sign-in">Sign in <ArrowRight size={15} /></Link>
            <Link href="/sign-up" className={secondaryButton} data-testid="link-community-sign-up">Create an account</Link>
          </div>
        </div>
      </section>
      <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck size={14} className="text-primary" /> The leaderboard is visible only to you and your accepted friends.</p>
    </main>;
  }

  const profile = meQuery.data;
  const friends = friendsQuery.data;
  const leaderboard = leaderboardQuery.data;
  const profileChanged = !!profile && (username.trim().toLowerCase() !== profile.username || displayName.trim() !== profile.displayName);

  return <div className="page-enter mx-auto max-w-5xl pb-5">
    <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">The quiet circle</p>
        <h1 className="font-display mt-2 text-[34px] font-bold leading-none tracking-[-.06em] sm:text-[42px]">Community</h1>
        <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">Strength is personal. Share only with the people you let in.</p>
      </div>
      <div className="flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/[.06] px-3 py-2 text-[10px] font-mono uppercase tracking-[.1em] text-primary">
        <LockKeyhole size={13} /> Friends-only scores
      </div>
    </header>

    {!online && <div className="mb-4 rounded-xl border border-accent/25 bg-accent/[.07] px-4 py-3 text-xs leading-5 text-muted-foreground" role="status">You’re offline. Community details are paused until your connection returns.</div>}

    <div className="grid gap-4 lg:grid-cols-[.92fr_1.08fr]">
      <section className="card relative overflow-hidden p-5 sm:p-6">
        <div className="absolute -right-14 -top-16 h-44 w-44 rounded-full border-[22px] border-primary/[.045]" />
        <div className="relative">
          <SectionHeading eyebrow="Your presence" title="Profile" />
          {meQuery.isLoading ? <div className="mt-6 space-y-3"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-11" /><Skeleton className="h-11" /><Skeleton className="h-10 w-28" /></div> :
            meQuery.isError ? <div className="mt-5"><QueryProblem message={online ? 'Your profile could not be loaded.' : 'Profile unavailable while offline.'} retry={() => meQuery.refetch()} /></div> :
              profile && <>
                <div className="mt-5 flex items-center gap-3 rounded-xl border border-border/80 bg-secondary/35 p-3.5">
                  <Avatar name={displayName || profile.displayName} you />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold" data-testid="text-community-display-name">{profile.displayName}</p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground" data-testid="text-community-username">@{profile.username}</p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[.12em] text-primary">{profile.rank}</span>
                </div>
                <div className={`mt-3 flex flex-col gap-3 rounded-xl border p-3.5 sm:flex-row sm:items-center sm:justify-between ${profile.sharingEnabled ? 'border-primary/25 bg-primary/[.045]' : 'border-border bg-secondary/25'}`}>
                  <div className="flex items-start gap-2.5">
                    <ShieldCheck size={15} className={`mt-0.5 shrink-0 ${profile.sharingEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div>
                      <p className="text-xs font-semibold">Friends-only score sharing</p>
                      <p className="mt-1 max-w-sm text-[10px] leading-4 text-muted-foreground">{profile.sharingEnabled ? 'Your workouts sync for your score and are visible only to accepted friends.' : 'Off by default. Your workouts stay on this device until you turn this on.'}</p>
                    </div>
                  </div>
                  <button type="button" onClick={toggleSharing} disabled={!online || setSharing.isPending} aria-pressed={profile.sharingEnabled} className={`${profile.sharingEnabled ? secondaryButton : primaryButton} shrink-0`} data-testid="button-community-toggle-sharing">
                    {setSharing.isPending ? <LoaderCircle size={13} className="animate-spin" /> : profile.sharingEnabled ? <LockKeyhole size={13} /> : <ShieldCheck size={13} />}
                    {setSharing.isPending ? 'Updating' : profile.sharingEnabled ? 'Pause sharing' : 'Enable sharing'}
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-secondary/40 p-3"><p className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">Shadow score</p><p className="font-display mt-1 text-2xl font-bold tracking-[-.05em] text-primary" data-testid="text-community-score">{profile.score.toLocaleString()}</p></div>
                  <div className="rounded-xl bg-secondary/40 p-3"><p className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">Friends</p><p className="font-display mt-1 text-2xl font-bold tracking-[-.05em]" data-testid="text-community-friends-count">{profile.friendCount}</p></div>
                </div>
                <div className="mt-5 space-y-3">
                  <label className="block text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground" htmlFor="community-display-name">Display name</label>
                  <input id="community-display-name" className={fieldClass} value={displayName} maxLength={32} onChange={(event) => setDisplayName(event.target.value)} data-testid="input-community-display-name" />
                  <label className="block pt-1 text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground" htmlFor="community-username">Username</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">@</span>
                    <input id="community-username" className={`${fieldClass} pl-8`} value={username} minLength={3} maxLength={20} pattern="[a-z0-9_]+" onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} data-testid="input-community-username" />
                  </div>
                  <p className="text-[10px] leading-4 text-muted-foreground">3–20 characters. Lowercase letters, numbers, and underscores.</p>
                  <button type="button" onClick={saveProfile} disabled={!profileChanged || updateProfile.isPending || !online || displayName.trim().length === 0 || username.trim().length < 3} className={`${primaryButton} w-full sm:w-auto`} data-testid="button-community-save-profile">
                    {updateProfile.isPending ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}
                    {updateProfile.isPending ? 'Saving profile' : 'Save profile'}
                  </button>
                  {profileMessage && <p className={`text-xs leading-5 ${updateProfile.isError ? 'text-destructive' : 'text-primary'}`} role="status" data-testid="status-community-profile">{profileMessage}</p>}
                </div>
              </>}
          <p className="mt-5 flex items-start gap-2 border-t border-border/70 pt-4 text-[10px] leading-4 text-muted-foreground"><ShieldCheck size={13} className="mt-0.5 shrink-0 text-primary" />Your profile and score are shared only inside your accepted-friends circle.</p>
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <SectionHeading eyebrow="Invite with intent" title="Add a friend" />
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/[.08] text-primary"><UserRoundPlus size={17} /></div>
        </div>
        <p className="mt-3 max-w-md text-xs leading-5 text-muted-foreground">{profile?.sharingEnabled ? 'Requests go to a username. Scores become visible only after they accept.' : 'Turn on friends-only sharing to invite people and sync your score. You can pause it at any time.'}</p>
        <form onSubmit={sendRequest} className="mt-5 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">@</span>
            <input aria-label="Friend username" className={`${fieldClass} pl-8`} placeholder="username" value={friendUsername} minLength={3} maxLength={20} pattern="[a-zA-Z0-9_]+" onChange={(event) => setFriendUsername(event.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} disabled={!online || !profile?.sharingEnabled} data-testid="input-community-friend-username" />
          </div>
          <button type="submit" disabled={!online || !profile?.sharingEnabled || friendUsername.trim().length < 3 || createRequest.isPending} className={`${primaryButton} min-h-11`} data-testid="button-community-send-request">
            {createRequest.isPending ? <LoaderCircle size={14} className="animate-spin" /> : <Plus size={15} />}
            {createRequest.isPending ? 'Sending' : 'Send request'}
          </button>
        </form>
        {requestMessage && <p className={`mt-3 text-xs leading-5 ${createRequest.isError ? 'text-destructive' : 'text-primary'}`} role="status" data-testid="status-community-request">{requestMessage}</p>}

        <div className="mt-6 grid gap-4 border-t border-border/70 pt-5 sm:grid-cols-2">
          <div>
            <div className="mb-3 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-accent" /><p className="font-mono text-[9px] uppercase tracking-[.16em] text-muted-foreground">Incoming <span className="text-foreground">{friends?.incoming.length ?? '—'}</span></p></div>
            {friendsQuery.isLoading ? <Skeleton className="h-16" /> : friendsQuery.isError ? <p className="text-[11px] text-muted-foreground">Requests unavailable.</p> : friends?.incoming.length ? <ul className="space-y-2">
              {friends.incoming.map((request) => <li key={request.id} className="rounded-xl border border-border/80 bg-secondary/25 p-3" data-testid={`row-incoming-request-${request.id}`}>
                <div className="flex items-center gap-2"><Avatar name={request.displayName} /><div className="min-w-0"><p className="truncate text-xs font-semibold">{request.displayName}</p><p className="truncate font-mono text-[9px] text-muted-foreground">@{request.username}</p></div></div>
                <div className="mt-3 flex gap-2">
                  <button type="button" className={`${primaryButton} flex-1 py-2`} disabled={!online || respondRequest.isPending} onClick={() => decideRequest(request.id, 'accept')} data-testid={`button-accept-request-${request.id}`}><Check size={13} /> Accept</button>
                  <button type="button" className={`${secondaryButton} flex-1 py-2`} disabled={!online || respondRequest.isPending} onClick={() => decideRequest(request.id, 'decline')} data-testid={`button-decline-request-${request.id}`}><X size={13} /> Decline</button>
                </div>
              </li>)}
            </ul> : <p className="rounded-xl bg-secondary/30 px-3 py-3 text-[11px] leading-4 text-muted-foreground">No requests waiting. Take your time.</p>}
          </div>
          <div>
            <div className="mb-3 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" /><p className="font-mono text-[9px] uppercase tracking-[.16em] text-muted-foreground">Sent <span className="text-foreground">{friends?.outgoing.length ?? '—'}</span></p></div>
            {friendsQuery.isLoading ? <Skeleton className="h-16" /> : friendsQuery.isError ? <p className="text-[11px] text-muted-foreground">Requests unavailable.</p> : friends?.outgoing.length ? <ul className="space-y-2">
              {friends.outgoing.map((request) => <li key={request.id} className="flex items-center gap-2 rounded-xl border border-border/80 bg-secondary/25 p-3" data-testid={`row-outgoing-request-${request.id}`}>
                <Avatar name={request.displayName} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{request.displayName}</p><p className="truncate font-mono text-[9px] text-muted-foreground">@{request.username}</p></div>
                <button type="button" className="rounded-lg p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50" disabled={!online || respondRequest.isPending} title="Cancel request" aria-label={`Cancel request to ${request.displayName}`} onClick={() => decideRequest(request.id, 'cancel')} data-testid={`button-cancel-request-${request.id}`}><X size={15} /></button>
              </li>)}
            </ul> : <p className="rounded-xl bg-secondary/30 px-3 py-3 text-[11px] leading-4 text-muted-foreground">No requests sent.</p>}
          </div>
        </div>
      </section>
    </div>

    <section className="mt-4 grid gap-4 lg:grid-cols-[.78fr_1.22fr]">
      <div className="card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <SectionHeading eyebrow="Your circle" title="Friends" count={friends?.friends.length ?? 0} />
          <Users size={17} className="mt-1 text-primary" />
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">Only accepted friends appear in your score table.</p>
        <div className="mt-4">
          {friendsQuery.isLoading ? <div className="space-y-2"><Skeleton className="h-14" /><Skeleton className="h-14" /></div> :
            friendsQuery.isError ? <QueryProblem message={online ? 'Your friends could not be loaded.' : 'Friends unavailable while offline.'} retry={() => friendsQuery.refetch()} /> :
              friends?.friends.length ? <ul className="space-y-2">
                {friends.friends.map((friend) => <li key={friend.userId} className="flex items-center gap-2.5 rounded-xl border border-border/75 bg-secondary/25 p-3" data-testid={`row-community-friend-${friend.userId}`}>
                  <Avatar name={friend.displayName} />
                  <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{friend.displayName}</p><p className="mt-0.5 truncate font-mono text-[9px] text-muted-foreground">@{friend.username}</p></div>
                  <div className="text-right"><p className="font-mono text-xs font-medium text-primary">{friend.sharingEnabled ? friend.score.toLocaleString() : '—'}</p><p className="mt-0.5 text-[9px] text-muted-foreground">{friend.rank}</p></div>
                  {friendToRemove === friend.userId ? <span className="ml-1 flex items-center gap-1"><button type="button" className="rounded-lg px-2 py-1 text-[10px] font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50" disabled={!online || removeFriend.isPending} onClick={() => removeAcceptedFriend(friend.userId)} data-testid={`button-confirm-remove-friend-${friend.userId}`}>{removeFriend.isPending ? 'Removing' : 'Remove'}</button><button type="button" aria-label="Keep friend" onClick={() => setFriendToRemove(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary" data-testid={`button-cancel-remove-friend-${friend.userId}`}><X size={13} /></button></span> :
                    <button type="button" aria-label={`Remove ${friend.displayName}`} title="Remove friend" onClick={() => setFriendToRemove(friend.userId)} className="ml-1 rounded-lg p-2 text-muted-foreground transition hover:bg-secondary hover:text-destructive" data-testid={`button-remove-friend-${friend.userId}`}><X size={14} /></button>}
                </li>)}
              </ul> :
                <div className="rounded-xl border border-dashed border-border bg-secondary/15 px-4 py-6 text-center">
                  <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-primary/[.08] text-primary"><UserRoundPlus size={18} /></div>
                  <p className="mt-3 text-xs font-semibold">A small circle is still a circle.</p>
                  <p className="mx-auto mt-1 max-w-[220px] text-[10px] leading-4 text-muted-foreground">Send a request when someone feels right to share this with.</p>
                </div>}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-border/70 p-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <SectionHeading eyebrow="Quiet progress, together" title="Friends leaderboard" />
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/[.08] text-primary"><Swords size={17} /></div>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">A private snapshot of scores in your accepted circle. No public rankings.</p>
        </div>
        <div className="p-4 sm:p-5">
          {leaderboardQuery.isLoading ? <div className="space-y-2"><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div> :
            leaderboardQuery.isError ? <QueryProblem message={online ? 'The leaderboard could not be loaded.' : 'Leaderboard unavailable while offline.'} retry={() => leaderboardQuery.refetch()} /> :
              leaderboard?.entries.length ? <>
                <div className="mb-3 flex items-center justify-between px-3 font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">
                  <span>Position <span className="ml-1 text-foreground" data-testid="text-community-position">#{leaderboard.yourPosition}</span></span>
                  <span>{leaderboard.entries.length} {leaderboard.entries.length === 1 ? 'person' : 'people'}</span>
                </div>
                <ol className="space-y-1.5">
                  {leaderboard.entries.map((entry, index) => <li key={entry.userId} className={`flex items-center gap-3 rounded-xl border px-3 py-3 transition ${entry.isYou ? 'border-primary/30 bg-primary/[.055]' : 'border-transparent bg-secondary/25'}`} data-testid={`row-leaderboard-${entry.userId}`}>
                    <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg font-mono text-[10px] ${index === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                      {index === 0 ? <Crown size={13} /> : String(entry.rank).match(/^\d+$/) ? entry.rank : index + 1}
                    </div>
                    <Avatar name={entry.displayName} you={entry.isYou} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold">{entry.displayName}{entry.isYou && <span className="ml-2 font-mono text-[9px] font-normal uppercase tracking-[.12em] text-primary">You</span>}</p>
                      <p className="mt-0.5 truncate font-mono text-[9px] text-muted-foreground">@{entry.username} <span className="mx-1 text-border">/</span> {entry.rank}</p>
                    </div>
                    <div className="text-right"><p className="font-mono text-sm font-medium">{entry.score.toLocaleString()}</p><p className="font-mono text-[8px] uppercase tracking-[.12em] text-muted-foreground">score</p></div>
                    {index === 0 && <Medal size={14} className="ml-1 hidden text-primary sm:block" />}
                  </li>)}
                </ol>
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-secondary/35 px-3.5 py-3 text-[10px] leading-4 text-muted-foreground"><ShieldCheck size={14} className="shrink-0 text-primary" />Only you and accepted friends can see these scores.</div>
              </> :
                <div className="rounded-xl border border-dashed border-border px-5 py-9 text-center">
                  <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-primary/[.08] text-primary"><Medal size={19} /></div>
                  <p className="mt-3 text-sm font-semibold">Your place is yours alone for now.</p>
                  <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-muted-foreground">When you accept a friend, you’ll both see your scores together here.</p>
                  <ChevronRight size={15} className="mx-auto mt-3 text-muted-foreground/50" />
                </div>}
        </div>
      </div>
    </section>
    <div className="mt-5 flex items-center justify-center gap-2 text-[10px] text-muted-foreground"><LockKeyhole size={12} className="text-primary" />Your circle is opt-in. Your progress stays yours.</div>
  </div>;
}